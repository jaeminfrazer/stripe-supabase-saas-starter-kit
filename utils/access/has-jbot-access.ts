import { db } from '@/utils/db/db'
import { usersTable } from '@/utils/db/schema'
import { eq } from 'drizzle-orm'

const DEVELOPER_EMAIL = 'jaemin@jaeminfrazer.com'

/**
 * Shared server-side entitlement check for protected J-Bot APIs.
 * Standard subscriptions retain the app's existing plan-based entitlement;
 * beta-only access is valid strictly before its recorded expiry timestamp.
 */
export async function hasJbotAccess(userId: string, email: string): Promise<boolean> {
    if (email.trim().toLowerCase() === DEVELOPER_EMAIL) return true

    const rows = await db
        .select({
            plan: usersTable.plan,
            betaAccessExpiresAt: usersTable.beta_access_expires_at,
        })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1)

    const account = rows[0]
    if (!account) return false

    const hasSubscription = account.plan !== 'none'
    const hasActiveBetaAccess = !!account.betaAccessExpiresAt &&
        new Date(account.betaAccessExpiresAt).getTime() > Date.now()

    return hasSubscription || hasActiveBetaAccess
}
