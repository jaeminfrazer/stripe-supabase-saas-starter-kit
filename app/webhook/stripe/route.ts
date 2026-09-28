
import { db } from '@/utils/db/db'
import { betaPurchases, usersTable } from '@/utils/db/schema'
import { stripe } from '@/utils/stripe/api'
import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

const BETA_PRICE_ID = 'price_1UKVfyGIHHpJQEluh2w4gG5F'

function addSixMonths(date: Date): Date {
    const result = new Date(date)
    result.setUTCMonth(result.getUTCMonth() + 6)
    return result
}

export async function POST(req: Request) {
    try {
        const signature = req.headers.get('stripe-signature')
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

        if (!signature || !webhookSecret) {
            console.error('Missing Stripe signature or webhook secret')
            return new Response('Webhook configuration error', { status: 400 })
        }

        const payload = await req.text()

        let event: Stripe.Event

        try {
            event = stripe.webhooks.constructEvent(
                payload,
                signature,
                webhookSecret
            )
        } catch (err) {
            console.error(
                'Stripe signature verification failed:',
                err instanceof Error ? err.message : 'Unknown error'
            )
            return new Response('Invalid Stripe signature', { status: 400 })
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
                    console.log('Checkout is not the Jbot beta product:', session.id)
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
                    return new Response('Missing customer email', { status: 400 })
                }

                const purchasedAt = new Date(session.created * 1000)
                const expiresAt = addSixMonths(purchasedAt)

                await db.insert(betaPurchases).values({
                    stripe_checkout_session_id: session.id,
                    email,
                    payment_status: 'paid',
                    purchased_at: purchasedAt,
                    expires_at: expiresAt,
                }).onConflictDoNothing({
                    target: betaPurchases.stripe_checkout_session_id,
                })

                console.log('Beta purchase recorded:', {
                    sessionId: session.id,
                    email,
                    expiresAt: expiresAt.toISOString(),
                })

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
