import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const instructions = `You are Jbot's provisional assessment engine for the accusation milestone. Assess evidence, not client self-rating and not keyword matches alone.

Seven core accusations: morality (bad), intelligence (stupid), value (worthless), capacity (weak), appearance (ugly/disgusting), normality (weird), status (loser). The core fear is that the world will confirm the person's worst childhood accusation of inadequacy.

Behaviour is evidence. Ask what the person would need to believe about themselves for their behaviour to make sense. Test in both directions: forward, does the accusation explain their strategies and behaviour? backward, does observed behaviour point back to that accusation? A person may have several accusations; seek the earliest/original accusation, not just the most frequently mentioned one.

Investigate the proposed defining moment. It must be before age 7 (most likely before age 4), contain surprise and embarrassment, may look innocuous from outside, and have an evidence-based connection to the accusation. Do not invent memories, fill gaps or treat reconstructions as fact. Distinguish client-reported facts from inference.

Return JSON only with this shape:
{"status":"pending|investigating|complete","candidate_accusations":[{"category":"morality|intelligence|value|capacity|appearance|normality|status","label":"bad|stupid|worthless|weak|ugly/disgusting|weird|loser","evidence":"..."}],"original_accusation":null,"defining_moment":{"reported_details":null,"reported_age":null,"surprise_evidence":null,"embarrassment_evidence":null,"innocuousness_evidence":null},"forward_test":{"result":"supports|contradicts|unclear","reasoning":"..."},"backward_test":{"result":"supports|contradicts|unclear","reasoning":"..."},"supporting_evidence":[],"counter_evidence":[],"unknowns":[],"confidence":"low|moderate|high","client_facing_summary":"..."}

Set status complete ONLY if there is specific client-reported evidence for a single best-supported original accusation AND a specific defining moment with credible timing before age 7, evidence of surprise and embarrassment, a plausible connection to that accusation, and both forward and backward tests support the same accusation. Counter-evidence and unknowns must not undermine the conclusion. Otherwise use investigating when substantive evidence exists, or pending when it does not. Do not claim scientific validation. When uncertain, do not complete.`

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  let body: { conversationId?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  if (typeof body.conversationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.conversationId)) return NextResponse.json({ error: 'Invalid conversation' }, { status: 400 })

  const { data: conversation } = await supabase.from('jbot_conversations').select('id').eq('id', body.conversationId).eq('user_id', user.id).maybeSingle()
  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  const { data: messages, error: messageError } = await supabase.from('jbot_messages').select('role,content').eq('conversation_id', conversation.id).order('created_at', { ascending: true })
  if (messageError) return NextResponse.json({ error: 'Could not load conversation' }, { status: 500 })
  const { data: intake } = await supabase.from('jbot_onboarding_data').select('tell_me_about_you,hindrances,personality,pain_points,goals,what_have_you_tried,history').eq('user_id', user.id).maybeSingle()

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', response_format: { type: 'json_object' }, messages: [
        { role: 'system', content: instructions },
        { role: 'user', content: JSON.stringify({ intake: intake ?? {}, conversation: messages ?? [] }) },
      ] }),
    })
    if (!response.ok) {
      console.error('Assessment model request failed:', await response.text())
      return NextResponse.json({ error: 'Assessment unavailable' }, { status: 502 })
    }
    const result = await response.json()
    const raw = result.choices?.[0]?.message?.content
    if (typeof raw !== 'string') return NextResponse.json({ error: 'Assessment returned no result' }, { status: 502 })
    const assessment = JSON.parse(raw)
    const status = ['pending', 'investigating', 'complete'].includes(assessment.status) ? assessment.status : 'investigating'
    const { error: saveError } = await supabase.from('jbot_stage_assessments').upsert({
      user_id: user.id, milestone_number: 4, status, assessment, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,milestone_number' })
    if (saveError) {
      console.error('Assessment save failed:', saveError.message)
      return NextResponse.json({ error: 'Could not save assessment' }, { status: 500 })
    }
    return NextResponse.json({ status, assessment })
  } catch (error) {
    console.error('Assessment error:', error)
    return NextResponse.json({ error: 'Assessment failed' }, { status: 502 })
  }
}
