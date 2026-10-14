import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { hasJbotAccess } from '@/utils/access/has-jbot-access'
import { createAdminClient } from '@/utils/supabase/admin'

const assessmentInstructions: Record<number, string> = {
  4: `You are Jbot's provisional assessment engine for milestone 4: Identify the accusation. Assess evidence, not client self-rating and not keyword matches alone.

Seven core accusations: morality (bad), intelligence (stupid), value (worthless), capacity (weak), appearance (ugly/disgusting), normality (weird), status (loser). The core fear is that the world will confirm the person's worst childhood accusation of inadequacy. Behaviour is evidence. Ask what the person would need to believe about themselves for their behaviour to make sense. Test in both directions: forward, does the accusation explain strategies and behaviour? backward, does observed behaviour point back to that accusation? A person may have several accusations; seek the earliest/original accusation, not just the most frequently mentioned one.

Return JSON only:
{"status":"pending|investigating|complete","candidate_accusations":[{"category":"morality|intelligence|value|capacity|appearance|normality|status","label":"...","evidence":"..."}],"original_accusation":null,"forward_test":{"result":"supports|contradicts|unclear","reasoning":"..."},"backward_test":{"result":"supports|contradicts|unclear","reasoning":"..."},"supporting_evidence":[],"counter_evidence":[],"unknowns":[],"confidence":"low|moderate|high","client_facing_summary":"..."}

Set complete ONLY if there is specific client-reported evidence for a single best-supported original accusation and both forward and backward behavioural tests support the same accusation, with counter-evidence and unknowns not undermining the conclusion. A defining moment is a separate milestone and must not be marked complete here. Do not invent memories, fill gaps, treat reconstructions as fact, or claim scientific validation. When uncertain, do not complete.`,
  5: `You are Jbot's provisional assessment engine for milestone 5: Discover the defining moment. Assess the complete saved conversation and intake. This is an evidence assessment, not a memory-recovery exercise. Never invent memories, lead the client toward a particular scene, or treat reconstructions or suggestions as facts. Distinguish client-reported recollection from inference and uncertainty.

Assess all criteria:
1. Early enough: reported to have occurred before age 7, with particular attention to before age 4. Record uncertainty; do not infer an age.
2. Surprise: specific evidence that the event was surprising to the child.
3. Embarrassment: specific evidence that the child experienced embarrassment.
4. Easily dismissed: the event could look insignificant or innocuous from the outside; explain what supports this.
5. Remaining emotional charge: the client reports that the memory still carries strong emotional charge when it surfaces. Do not infer charge solely from the story's content.
6. Structural coherence in both directions: forward, the event/child's interpretation coherently connects to the identified accusation and the proving/defending strategy; backward, the accusation and strategy point back to this event. Test whether the crime scene matches the accusation and the accusation matches the proving/defending. Explicitly identify mismatches and counter-evidence.

Return JSON only:
{"status":"pending|investigating|complete","defining_moment":{"reported_details":null,"reported_age":null,"surprise_evidence":null,"embarrassment_evidence":null,"innocuousness_evidence":null,"emotional_charge_evidence":null},"identified_accusation":null,"proving_and_defending":null,"forward_test":{"result":"supports|contradicts|unclear","reasoning":"..."},"backward_test":{"result":"supports|contradicts|unclear","reasoning":"..."},"criteria":{"early_enough":{"supported":false,"evidence":""},"surprise":{"supported":false,"evidence":""},"embarrassment":{"supported":false,"evidence":""},"easily_dismissed":{"supported":false,"evidence":""},"emotional_charge":{"supported":false,"evidence":""},"structural_coherence":{"supported":false,"evidence":""}},"supporting_evidence":[],"counter_evidence":[],"unknowns":[],"confidence":"low|moderate|high","client_facing_summary":"..."}

Complete only when all six criteria are supported by specific client-provided evidence, both structural tests support the same coherent structure, and no material contradiction remains unexplained. A candidate memory, an accusation alone, emotional intensity alone, or a story that merely sounds plausible is not enough. If evidence exists but criteria are missing, contradictory or uncertain, use investigating. Use pending only when there is no substantive evidence to assess. Do not claim scientific validation.`,
  7: `You are Jbot's provisional assessment engine for milestone 7: Well-formed outcomes. Assess whether the client has formed a considered, chosen outcome, not merely whether they have named a goal. Use the intake and conversation, distinguishing explicit client statements from inference.

Assess all five criteria:
1. Clear outcome: what specifically does the client want, in their own terms?
2. Highest intention understood: what matters most about the outcome and why do they want it? Do not impose your interpretation.
3. Chosen vehicle: the client has carefully considered a concrete vehicle/path for achieving it and is willing and able to use it. Record practical constraints and unresolved questions.
4. Consequences considered: the client has considered relevant costs, trade-offs, obligations and consequences of wanting/pursuing this outcome.
5. Ready to press go: the client explicitly indicates they want this outcome and are ready to act, rather than merely expressing interest, fantasy, external expectation or ambivalence.

Return JSON only:
{"status":"pending|investigating|complete","outcome":null,"highest_intention":null,"chosen_vehicle":{"description":null,"willingness_evidence":null,"ability_evidence":null,"unresolved_constraints":[]},"consequences_considered":[],"readiness_evidence":null,"criteria":{"clear_outcome":{"supported":false,"evidence":""},"highest_intention":{"supported":false,"evidence":""},"chosen_vehicle":{"supported":false,"evidence":""},"consequences_considered":{"supported":false,"evidence":""},"ready_to_press_go":{"supported":false,"evidence":""}},"supporting_evidence":[],"counter_evidence":[],"unknowns":[],"confidence":"low|moderate|high","client_facing_summary":"..."}

Complete only when all five criteria are supported by specific evidence from the client. A goal in the intake alone is not sufficient. A clear goal without a considered vehicle, consequences or explicit readiness is investigating, not complete. If substantive evidence is absent, use pending. Do not pressure the client into commitment or substitute Jbot's preferred outcome. Do not claim scientific validation.`
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!(await hasJbotAccess(user.id, user.email ?? ''))) {
    return NextResponse.json({ error: 'Your J-Bot access has expired. Please renew your subscription or contact us for help.' }, { status: 403 })
  }

  let body: { conversationId?: string; milestoneNumber?: number }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  if (typeof body.conversationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.conversationId)) {
    return NextResponse.json({ error: 'Invalid conversation' }, { status: 400 })
  }
  const milestoneNumber = body.milestoneNumber ?? 4
  if (![4, 5, 7].includes(milestoneNumber)) {
    return NextResponse.json({ error: 'Unsupported assessment milestone' }, { status: 400 })
  }

  const { data: conversation } = await supabase.from('jbot_conversations').select('id').eq('id', body.conversationId).eq('user_id', user.id).maybeSingle()
  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  const { data: messages, error: messageError } = await supabase.from('jbot_messages').select('role,content').eq('conversation_id', conversation.id).order('created_at', { ascending: true })
  if (messageError) return NextResponse.json({ error: 'Could not load conversation' }, { status: 500 })

  const { data: intake } = await supabase.from('jbot_onboarding_data').select('tell_me_about_you,hindrances,personality,pain_points,goals,what_have_you_tried,history').eq('user_id', user.id).maybeSingle()

  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
    const turnNumber = Math.ceil((messages ?? []).length / 2)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model, response_format: { type: 'json_object' }, messages: [
        { role: 'system', content: assessmentInstructions[milestoneNumber] },
        { role: 'user', content: JSON.stringify({ intake: intake ?? {}, conversation: messages ?? [] }) },
      ] }),
    })
    if (!response.ok) {
      console.error('Assessment model request failed:', await response.text())
      return NextResponse.json({ error: 'Assessment unavailable' }, { status: 502 })
    }
    const result = await response.json()
    console.info('Jbot API usage:', {
      callType: 'assessment',
      conversationId: conversation.id,
      turnNumber,
      milestoneNumber,
      model,
      promptTokens: result.usage?.prompt_tokens ?? null,
      cachedPromptTokens: result.usage?.prompt_tokens_details?.cached_tokens ?? null,
      completionTokens: result.usage?.completion_tokens ?? null,
      totalTokens: result.usage?.total_tokens ?? null,
    })
    const raw = result.choices?.[0]?.message?.content
    if (typeof raw !== 'string') return NextResponse.json({ error: 'Assessment returned no result' }, { status: 502 })
    const assessment = JSON.parse(raw)
    const status = ['pending', 'investigating', 'complete'].includes(assessment.status) ? assessment.status : 'investigating'
    const admin = createAdminClient()
    const { error: saveError } = await admin.from('jbot_stage_assessments').upsert({
      user_id: user.id, milestone_number: milestoneNumber, status, assessment, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,milestone_number' })
    if (saveError) {
      console.error('Assessment save failed:', saveError.message)
      return NextResponse.json({ error: 'Could not save assessment' }, { status: 500 })
    }
    const { error: historyError } = await admin.from('jbot_stage_assessment_history').insert({
      user_id: user.id, milestone_number: milestoneNumber, status, assessment,
    })
    if (historyError) {
      console.error('Assessment history save failed:', historyError.message)
      return NextResponse.json({ error: 'Could not save assessment history' }, { status: 500 })
    }
    return NextResponse.json({ status, milestoneNumber, assessment })
  } catch (error) {
    console.error('Assessment error:', error)
    return NextResponse.json({ error: 'Assessment failed' }, { status: 502 })
  }
}
