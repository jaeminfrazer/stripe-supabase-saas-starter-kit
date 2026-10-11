import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  let body: { resourceId?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  if (typeof body.resourceId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.resourceId)) {
    return NextResponse.json({ error: 'Invalid resource ID' }, { status: 400 })
  }
  const { data: resource } = await supabase.from('jbot_resources').select('id').eq('id', body.resourceId).maybeSingle()
  if (!resource) return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
  const { error } = await supabase.from('user_resource_progress').upsert({ user_id: user.id, resource_id: body.resourceId }, { onConflict: 'user_id,resource_id' })
  if (error) { console.error('Resource progress save failed:', error.message); return NextResponse.json({ error: 'Could not save resource progress' }, { status: 500 }) }
  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  let body: { resourceId?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  if (typeof body.resourceId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.resourceId)) {
    return NextResponse.json({ error: 'Invalid resource ID' }, { status: 400 })
  }
  const { error } = await supabase.from('user_resource_progress').delete().eq('user_id', user.id).eq('resource_id', body.resourceId)
  if (error) { console.error('Resource progress delete failed:', error.message); return NextResponse.json({ error: 'Could not update resource progress' }, { status: 500 }) }
  return NextResponse.json({ success: true })
}
