
import { db } from '@/utils/db/db'
import { betaPurchases, usersTable } from '@/utils/db/schema'
import { stripe } from '@/utils/stripe/api'
import { and, eq, isNull } from 'drizzle-orm'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

const BETA_PRICE_ID = 'price_1UKVfyGIHHpJQEluh2w4gG5F'

function addSixMonths(date: Date): Date {
    const result = new Date(date)
    const originalDay = result.getUTCDate()

    result.setUTCDate(1)
    result.setUTCMonth(result.getUTCMonth() + 6)

    const lastDayOfTargetMonth = new Date(
        Date.UTC(
            result.getUTCFullYear(),
            result.getUTCMonth() + 1,
            0
        )
    ).getUTCDate()

    result.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth))
    return result
}

async function recordAndApplyBetaPurchase(
    session: Stripe.Checkout.Session,
    email: string,
    purchasedAt: Date,
    expiresAt: Date
) {
    await db.transaction(async tx => {
        // Insert once. Stripe may retry delivery of the same event.
        await tx.insert(betaPurchases).values({
            stripe_checkout_session_id: session.id,
            email,
            payment_status: 'paid',
            purchased_at: purchasedAt,
            expires_at: expiresAt,
        }).onConflictDoNothing({
            target: betaPurchases.stripe_checkout_session_id,
        })

        // Read the stored purchase, including on webhook retries.
        const purchases = await tx.select()
            .from(betaPurchases)
            .where(
                eq(
                    betaPurchases.stripe_checkout_session_id,
                    session.id
                )
            )
            .limit(1)

        const purchase = purchases[0]

        if (!purchase || !purchase.expires_at) {
            throw new Error('Could not retrieve recorded beta purchase')
        }

        // If signup has already happened, find the matching account.
        const users = await tx.select()
            .from(usersTable)
            .where(eq(usersTable.email, email))
            .limit(1)

        const existingUser = users[0]

        // If signup has not happened yet, leave the purchase unclaimed.
        // The signup flow can claim it later.
        if (!existingUser) {
            console.log('Beta purchase stored for future signup:', email)
            return
        }

        // If already claimed by another account, do not transfer access.
        if (
            purchase.claimed_user_id &&
            purchase.claimed_user_id !== existingUser.id
        ) {
            console.error(
                'Beta purchase is already claimed by another account:',
                session.id
            )
            return
        }

        // Claim the purchase if it is still unclaimed.
        if (!purchase.claimed_user_id) {
            const claimed = await tx.update(betaPurchases)
                .set({
                    claimed_user_id: existingUser.id,
                    claimed_at: new Date(),
                })
                .where(
                    and(
                        eq(betaPurchases.id, purchase.id),
                        isNull(betaPurchases.claimed_user_id)
                    )
                )
                .returning({
                    id: betaPurchases.id,
                })

            // Another process may have claimed it concurrently.
            if (claimed.length === 0) {
                const latest = await tx.select()
                    .from(betaPurchases)
                    .where(eq(betaPurchases.id, purchase.id))
                    .limit(1)

                if (latest[0]?.claimed_user_id !== existingUser.id) {
                    console.error(
                        'Beta purchase was claimed by another account:',
                        session.id
                    )
                    return
                }
            }
        }

        // Grant or refresh beta access for the matching account.
        await tx.update(usersTable)
            .set({
                beta_access_expires_at: purchase.expires_at,
            })
            .where(eq(usersTable.id, existingUser.id))

        console.log('Beta access applied to existing user:', {
            sessionId: session.id,
            userId: existingUser.id,
            expiresAt: purchase.expires_at.toISOString(),
        })
    })
}

export async function POST(req: Request) {
    try {
        const signature = req.headers.get('stripe-signature')
        const liveSecret = process.env.STRIPE_WEBHOOK_SECRET
        const testSecret = process.env.STRIPE_TEST_WEBHOOK_SECRET

        if (!signature || (!liveSecret && !testSecret)) {
            console.error('Missing Stripe signature or webhook secrets')
            return new Response('Webhook configuration error', {
                status: 400,
            })
        }

        const payload = await req.text()

        let event: Stripe.Event | undefined
        let verifiedMode: 'live' | 'test' | undefined

        const secrets = [
            { secret: liveSecret, mode: 'live' as const },
            { secret: testSecret, mode: 'test' as const },
        ]

        for (const candidate of secrets) {
            if (!candidate.secret) continue

            try {
                event = stripe.webhooks.constructEvent(
                    payload,
                    signature,
                    candidate.secret
                )
                verifiedMode = candidate.mode
                break
            } catch {
                // Try the other configured secret.
            }
        }

        if (!event || !verifiedMode) {
            console.error('Stripe signature verification failed')
            return new Response('Invalid Stripe signature', {
                status: 400,
            })
        }

        if (event.livemode !== (verifiedMode === 'live')) {
            console.error('Stripe event mode does not match signing secret')
            return new Response('Stripe event mode mismatch', {
                status: 400,
            })
        }

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session

                if (session.payment_status !== 'paid') {
                    console.log(
                        'Checkout completed but payment is not yet paid:',
                        session.id
                    )
                    break
                }

                if (session.mode !== 'payment') {
                    console.log('Ignoring non-payment checkout:', session.id)
                    break
                }

                const lineItems = await stripe.checkout.sessions.listLineItems(
                    session.id,
                    { limit: 100 }
                )

                const isBetaPurchase = lineItems.data.some(
                    item => item.price?.id === BETA_PRICE_ID
                )

                if (!isBetaPurchase) {
                    console.log(
                        'Checkout is not the Jbot beta product:',
                        session.id
                    )
                    break
                }

                const email = (
                    session.customer_details?.email ||
                    session.customer_email ||
                    ''
                ).trim().toLowerCase()

                if (!email) {
                    console.error(
                        'Paid beta checkout has no customer email:',
                        session.id
                    )
                    return new Response('Missing customer email', {
                        status: 400,
                    })
                }

                const purchasedAt = new Date(session.created * 1000)
                const expiresAt = addSixMonths(purchasedAt)

                await recordAndApplyBetaPurchase(
                    session,
                    email,
                    purchasedAt,
                    expiresAt
                )

                break
            }

            case 'customer.subscription.created': {
                const subscription = event.data.object as Stripe.Subscription
                const customerId =
                    typeof subscription.customer === 'string'
                        ? subscription.customer
                        : subscription.customer.id

                console.log('Subscription created:', subscription.id)

                await db.update(usersTable)
                    .set({ plan: subscription.id })
                    .where(eq(usersTable.stripe_id, customerId))

                break
            }

            case 'customer.subscription.updated': {
                console.log('Subscription updated:', event.id)
                break
            }

            case 'customer.subscription.deleted': {
                console.log('Subscription deleted:', event.id)
                break
            }

            default: {
                console.log(`Unhandled event type: ${event.type}`)
                break
            }
        }

        return new Response('Success', { status: 200 })
    } catch (err) {
        console.error(
            'Stripe webhook error:',
            err instanceof Error ? err.message : 'Unknown error'
        )

        return new Response(
            `Webhook error: ${err instanceof Error ? err.message : 'Unknown error'}`,
            { status: 500 }
        )
    }
}
