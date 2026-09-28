
"use server"

import { createClient } from '@/utils/supabase/server'
import { redirect } from "next/navigation"
import { revalidatePath } from 'next/cache'
import { createStripeCustomer } from '@/utils/stripe/api'
import { db } from '@/utils/db/db'
import { usersTable, betaPurchases } from '@/utils/db/schema'
import { eq, and, isNull, gt } from 'drizzle-orm'

const PUBLIC_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || "http://localhost:3000"

export async function resetPassword(currentState: { message: string }, formData: FormData) {
    const supabase = createClient()

    const passwordData = {
        password: formData.get('password') as string,
        confirm_password: formData.get('confirm_password') as string,
        code: formData.get('code') as string
    }

    if (passwordData.password !== passwordData.confirm_password) {
        return { message: "Passwords do not match" }
    }

    const { data } = await supabase.auth.exchangeCodeForSession(passwordData.code)

    let { error } = await supabase.auth.updateUser({
        password: passwordData.password
    })

    if (error) {
        return { message: error.message }
    }

    redirect(`/forgot-password/reset/success`)
}

export async function forgotPassword(currentState: { message: string }, formData: FormData) {
    const supabase = createClient()
    const email = formData.get('email') as string

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${PUBLIC_URL}/forgot-password/reset`
    })

    if (error) {
        return { message: error.message }
    }

    redirect(`/forgot-password/success`)
}

export async function signup(currentState: { message: string }, formData: FormData) {
    const supabase = createClient()

    const data = {
        email: (formData.get('email') as string).trim().toLowerCase(),
        password: formData.get('password') as string,
        name: (formData.get('name') as string).trim(),
    }

    // Check if user exists in our database first
    const existingDBUser = await db.select()
        .from(usersTable)
        .where(eq(usersTable.email, data.email))

    if (existingDBUser.length > 0) {
        return {
            message: "An account with this email already exists. Please login instead."
        }
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
            emailRedirectTo: `${PUBLIC_URL}/auth/callback`,
            data: {
                email_confirm: process.env.NODE_ENV !== 'production',
                full_name: data.name
            }
        }
    })

    if (signUpError) {
        if (signUpError.message.includes("already registered")) {
            return {
                message: "An account with this email already exists. Please login instead."
            }
        }

        return { message: signUpError.message }
    }

    if (!signUpData?.user || !signUpData.user.email) {
        return { message: "Failed to create user" }
    }

    try {
        // Create Stripe customer linked to the Supabase user
        const stripeID = await createStripeCustomer(
            signUpData.user.id,
            signUpData.user.email,
            data.name
        )

        // Create the user database record
        await db.insert(usersTable).values({
            id: signUpData.user.id,
            name: data.name,
            email: signUpData.user.email.toLowerCase(),
            stripe_id: stripeID,
            plan: 'none'
        })

        // Find a paid, unclaimed beta purchase for this email
        const now = new Date()

        const purchases = await db.select()
            .from(betaPurchases)
            .where(
                and(
                    eq(
                        betaPurchases.email,
                        signUpData.user.email.toLowerCase()
                    ),
                    eq(betaPurchases.payment_status, 'paid'),
                    isNull(betaPurchases.claimed_user_id),
                    gt(betaPurchases.expires_at, now)
                )
            )
            .limit(1)

        const betaPurchase = purchases[0]

        if (betaPurchase && betaPurchase.expires_at) {
            // Grant beta access until the recorded expiry date
            await db.update(usersTable)
                .set({
                    beta_access_expires_at: betaPurchase.expires_at
                })
                .where(eq(usersTable.id, signUpData.user.id))

            // Mark the purchase as claimed
            await db.update(betaPurchases)
                .set({
                    claimed_user_id: signUpData.user.id,
                    claimed_at: now
                })
                .where(
                    and(
                        eq(betaPurchases.id, betaPurchase.id),
                        isNull(betaPurchases.claimed_user_id)
                    )
                )
        }
    } catch (err) {
        console.error(
            "Error in signup:",
            err instanceof Error ? err.message : "Unknown error"
        )

        return { message: "Failed to setup user account" }
    }

    revalidatePath("/", "layout")

    // Send new users to the dashboard.
    // Access enforcement is handled separately by the dashboard.
    redirect("/dashboard")
}

export async function loginUser(currentState: { message: string }, formData: FormData) {
    const supabase = createClient()

    const data = {
        email: formData.get('email') as string,
        password: formData.get('password') as string,
    }

    const { error } = await supabase.auth.signInWithPassword(data)

    if (error) {
        return { message: error.message }
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
}

export async function logout() {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()

    redirect('/login')
}

export async function signInWithGoogle() {
    const supabase = createClient()

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${PUBLIC_URL}/auth/callback`,
        },
    })

    if (data.url) {
        redirect(data.url)
    }
}

export async function signInWithGithub() {
    const supabase = createClient()

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
            redirectTo: `${PUBLIC_URL}/auth/callback`,
        },
    })

    if (data.url) {
        redirect(data.url)
    }
}
