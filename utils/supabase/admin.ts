import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Server-only client for trusted database writes. Never import into client components.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase admin configuration is missing.')
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
