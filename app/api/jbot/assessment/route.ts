import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

const instructions = `You are Jbot's provisional assessment engine for the accusation milestone. Assess evidence, not client self-rating and not keyword matches alone.

Seven core accusations: morality (bad), intelligence (stupid), value (worthless), capacity (weak), appearance (ugly/disgusting), normality (weird), status (loser). The core fear is that the world will confirm the person's worst childhood accusation of inadequacy. This endpoint assesses milestone 4, Identify the accusation. Milestone 5, Discover the defining moment, is separate and must not be marked complete by this assessment.

Behaviour is evidence. Ask what the person would need to believe about themselves for their behaviour to make sense. Test in both directions: forward, does the accusation explain their strategies and behaviour? backward, does observed behaviour point back to that accusation? A person may have several accusations; seek the earliest/original accusation, not just the most frequently mentioned one.

Defining-moment context follows Jbot's model: the system is organised around one exact, discoverable childhood moment, usually before age 7 and most likely before age 4, when a relaxed child encountered a surprising/shocking and embarrassing collision with the adult world. The child was unequipped to interpret it objectively and tried to answer: why did this happen, and what does it mean about me? The child implicated their own nature and formed an inadequacy accusation. The event is setup, not the tragedy; the focus is the child's unreviewed conclusion, not minimising the event. A client saying they have poor recall is treated within this model as possible strategic protection and should not make the search disappear, but never fabricate scene details or report an inference as a client memory. Distinguish client-reported facts, inference and unknowns. This is supporting context only for milestone 4; do not mark milestone 5 complete here.

Return JSON only with this shape:
{"status":"pending|investigating|complete","candidate_accusations":[{"category":"morality|intelligence|value|capacity|appearance|normality|status","label":"bad|stupid|worthless|weak|ugly/disgusting|weird|loser","evidence":"..."}],"original_accusation":null,"defining_moment":{"reported_details":null,"reported_age":null,"surprise_evidence":null,"embarrassment_evidence":null,"innocuousness_evidence":null},"forward_test":{"result":"supports|contradicts|unclear","reasoning":"..."},"backward_test":{"result":"supports|contradicts|unclear","reasoning":"..."},"supporting_evidence":[],"counter_evidence":[],"unknowns":[],"confidence":"low|moderate|high","client_facing_summary":"..."}

Set status complete ONLY if there is specific client-reported evidence for a single best-supported original accusation AND both forward and backward behavioural tests support the same accusation, with counter-evidence and unknowns not undermining the conclusion. A defining moment is useful supporting evidence, but do NOT require a defining moment to complete milestone 4; that is a separate milestone. Do not mark milestone 5 complete here. Otherwise use investigating when substantive evidence exists, or pending when it does not. Do not claim scientific validation. When uncertain, do not complete.`

export async function POST(request: Request) {
  console.info('[jbot-assessment] request received')
  console.info('[jbot-assessment] configuration present', {
    openAiKey: Boolean(process.env.OPENAI_API_KEY),
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    adminKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  })
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    console.warn('[jbot-assessment] authentication failed', { hasUser: Boolean(user), hasAuthError: Boolean(authError) })
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  console.info('[jbot-assessment] authenticated')
  let body: { conversationId?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  if (typeof body.conversationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.conversationId)) {
    console.warn('[jbot-assessment] invalid conversation id')
    return NextResponse.json({ error: 'Invalid conversation' }, { status: 400 })
  }

  const { data: conversation, error: conversationError } = await supabase.from('jbot_conversations').select('id').eq('id', body.conversationId).eq('user_id', user.id).maybeSingle()
  if (conversationError || !conversation) {
    console.warn('[jbot-assessment] conversation lookup failed', { hasError: Boolean(conversationError), foundConversation: Boolean(conversation) })
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }
  console.info('[jbot-assessment] conversation verified')
  const { data: messages, error: messageError } = await supabase.from('jbot_messages').select('role,content').eq('conversation_id', conversation.id).order('created_at', { ascending: true })
  if (messageError) {
    console.error('[jbot-assessment] message query failed', messageError.message)
    return NextResponse.json({ error: 'Could not load conversation' }, { status: 500 })
  }
  console.info('[jbot-assessment] messages loaded', { count: messages?.length ?? 0 })
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
    console.info('[jbot-assessment] model response received')
    const result = await response.json()
    const raw = result.choices?.[0]?.message?.content
    if (typeof raw !== 'string') return NextResponse.json({ error: 'Assessment returned no result' }, { status: 502 })
    const assessment = JSON.parse(raw)
    const status = ['pending', 'investigating', 'complete'].includes(assessment.status) ? assessment.status : 'investigating'
    // Only this trusted server endpoint may write assessment results.
    const admin = createAdminClient()
    console.info('[jbot-assessment] saving assessment', { status })
    const { error: saveError } = await admin.from('jbot_stage_assessments').upsert({
      user_id: user.id, milestone_number: 4, status, assessment, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,milestone_number' })
    if (saveError) {
      console.error('Assessment save failed:', saveError.message)
      return NextResponse.json({ error: 'Could not save assessment' }, { status: 500 })
    }
    const { error: historyError } = await admin.from('jbot_stage_assessment_history').insert({
      user_id: user.id, milestone_number: 4, status, assessment,
    })
    if (historyError) {
      console.error('Assessment history save failed:', historyError.message)
      return NextResponse.json({ error: 'Could not save assessment history' }, { status: 500 })
    }
    console.info('[jbot-assessment] assessment saved successfully')
    return NextResponse.json({ status, assessment })
  } catch (error) {
    console.error('[jbot-assessment] unhandled assessment error:', error)
    return NextResponse.json({ error: 'Assessment failed' }, { status: 502 })
  }
}
