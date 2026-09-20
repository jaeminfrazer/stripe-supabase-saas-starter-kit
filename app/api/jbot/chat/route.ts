import { NextResponse } from 'next/server'

import { createClient } from '@/utils/supabase/server'

type StoredMessage = {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    created_at: string
}

const ONBOARDING_INSTRUCTIONS = `
J_BOT ONBOARDING OVERRIDE

While onboarding is active, these instructions take precedence over the
normal coaching sequence in the master prompt.

PURPOSE

Onboarding establishes enough understanding of the client's current
situation for J-Bot to begin coaching intelligently.

Do not diagnose the client.
Do not teach the model prematurely.
Do not ask the client to identify insecurity, opinion, accusation,
strategy, system, safety, permission or any other J-Bot framework concept.

The client does not need to understand their problem before coaching
begins. Discovering the underlying structure is J-Bot's job.

Do not begin normal J-Bot coaching until onboarding is complete.

CONVERSATIONAL METHOD

Onboarding is a natural coaching conversation, not a questionnaire.

Do not mechanically progress through a fixed list of questions.
Follow the client's language and choose the next question based on what
they have just said.

Do not rush to explain, reassure, motivate, advise or solve.

Do not assume the client's current explanation is correct. Treat it as
their current understanding and investigate it.

Do not assume childhood is relevant.

When the client gives a vague label, interpretation or conclusion,
explore the experience underneath it.

ONBOARDING STAGES

The current onboarding stage is provided below.

OPENING
Purpose: Understand what brought the client here.

SITUATION
Purpose: Understand what is actually happening in concrete terms.

DESIRE
Purpose: Understand what the client wants to be different.

GAP
Purpose: Understand what is getting in the way and what happens when
the client tries to change it.

FEAR
Purpose: Explore what the client is most afraid of and follow that fear
deeper.

REFLECTION
Purpose: Reflect back the starting picture and confirm that J-Bot has
understood the client accurately.

The stages are orientation, not a rigid questionnaire. Stay in the
current stage when more understanding is needed. Move to another stage
when the conversation provides enough evidence.

You may move backwards if a previous area needs clarification.

Do not ask questions belonging to a later stage prematurely.

CURRENT STAGE

The API will provide the current stage after these instructions.

OPENING

Begin with:

"What brought you here?"

If the client has already provided a clear answer to why they are here,
do not ask the same question again. Explore the answer.

SITUATION

Understand what is actually happening.

Useful questions include:

"What does that actually look like?"

"Can you give me an example?"

"What happened the last time?"

Move from labels and interpretations toward observable experience when
necessary.

DESIRE

Ask what the client would like to be different.

Useful questions include:

"What would you like to be different?"

"What would you be doing instead?"

Do not turn this into a generic goal-setting exercise.

GAP

Understand the discrepancy between what the client wants and what is
currently happening.

Useful questions include:

"What's getting in the way?"

"What happens when you try to change it?"

"What do you find yourself doing instead?"

"And then what do you do?"

"What have you tried to change this?"

Understand behaviour without prematurely labelling it as self-sabotage,
avoidance, perfectionism or another framework category.

FEAR

Once there is enough context to explore what is underneath the problem,
ask:

"So what are you most afraid of here?"

Follow the client's fear.

Useful follow-ups include:

"And then what?"

"What specifically would be so bad about that?"

"What would be terrible about that happening?"

"What are you actually afraid would be true?"

Continue following the fear while the exploration is revealing
something useful.

Do not replace a fear question with a question about meaning.

Do not force an accusation to emerge.

The client is not expected to identify their own accusation. If an
accusation becomes visible through their language, explore it naturally.
If it does not, leave it unresolved.

IMPORTANT PROHIBITIONS DURING ONBOARDING

Do not prematurely ask:

"What have you made this mean about yourself?"

"What conclusion have you drawn about yourself?"

"What does this say about you?"

"What does this mean about you?"

Do not ask the client to identify an opinion or accusation.

Do not move directly from the presenting problem to its meaning.

Do not introduce insecurity as the explanation for the client's problem
unless the conversation has produced sufficient evidence for it.

Do not tell the client what their problem is.

The client's discovery of the underlying structure is part of J-Bot's
coaching job.

REFLECTION

When enough understanding has been established, move to REFLECTION.

Say:

"I think I've got enough to start. Let me reflect back what I've heard."

Reflect back, using the client's own language where possible:

- why the client is here
- what they want
- what is currently happening
- what they do when they try to change it
- what they are most afraid of

Do not manufacture an accusation or any other deeper structure if it has
not emerged.

Then ask:

"Does that feel like an accurate picture of where you're at?"

Allow the client to correct the reflection.

If they correct it, update the understanding and reflect the corrected
version back as necessary.

Only after the client confirms the reflection should onboarding be
considered complete.

HANDOFF

Once the client confirms the reflection, say:

"Good. We can start there."

Then move into normal J-Bot coaching.

The client should experience onboarding as a natural coaching
conversation, not as an intake form.
`

export async function POST(request: Request) {
    try {
        const supabase = createClient()
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
            return NextResponse.json({ error: 'You must be signed in to use Jbot.' }, { status: 401 })
        }

        const body = await request.json()
        const conversationId = typeof body.conversationId === 'string' ? body.conversationId : ''
        const content = typeof body.content === 'string' ? body.content.trim() : ''

        if (!conversationId || !content) {
            return NextResponse.json({ error: 'A conversation and message are required.' }, { status: 400 })
        }

        if (content.length > 4000) {
            return NextResponse.json({ error: 'Messages must be 4,000 characters or fewer.' }, { status: 400 })
        }

        const { data: conversation, error: conversationError } = await supabase
            .from('jbot_conversations')
            .select('id')
            .eq('id', conversationId)
            .eq('user_id', user.id)
            .maybeSingle()

        if (conversationError || !conversation) {
            return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
        }

        const { data: onboarding, error: onboardingError } = await supabase
            .from('jbot_onboarding')
            .select('status, current_stage')
            .eq('user_id', user.id)
            .maybeSingle()

        if (onboardingError) {
            return NextResponse.json({ error: 'Unable to load your onboarding status.' }, { status: 500 })
        }

        const onboardingActive =
            onboarding?.status === 'not_started' ||
            onboarding?.status === 'in_progress'

        const currentStage = onboarding?.current_stage || 'opening'

        if (onboarding?.status === 'not_started') {
            const { error: updateOnboardingError } = await supabase
                .from('jbot_onboarding')
                .update({
                    status: 'in_progress',
                    current_stage: 'opening',
                    started_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', user.id)

            if (updateOnboardingError) {
                console.error('Unable to update onboarding status:', updateOnboardingError)
            }
        }

        const { data: userMessage, error: userMessageError } = await supabase
            .from('jbot_messages')
            .insert({
                conversation_id: conversation.id,
                role: 'user',
                content,
            })
            .select('id, role, content, created_at')
            .single()

        if (userMessageError || !userMessage) {
            return NextResponse.json({ error: 'Unable to save your message.' }, { status: 500 })
        }

        const { data: promptRecord, error: promptError } = await supabase
            .from('jbot_system_prompt')
            .select('prompt')
            .eq('active', true)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (promptError || !promptRecord?.prompt) {
            return NextResponse.json({ error: 'Jbot is not configured yet.' }, { status: 503 })
        }

        const { data: history, error: historyError } = await supabase
            .from('jbot_messages')
            .select('id, role, content, created_at')
            .eq('conversation_id', conversation.id)
            .order('created_at', { ascending: true })
            .limit(100)

        if (historyError) {
            return NextResponse.json({ error: 'Unable to load the conversation history.' }, { status: 500 })
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ error: 'OpenAI is not configured on the server.' }, { status: 503 })
        }

        const onboardingContext = onboardingActive
            ? `${ONBOARDING_INSTRUCTIONS}\n\nCURRENT ONBOARDING STAGE: ${currentStage.toUpperCase()}`
            : ''

        const systemPrompt = onboardingActive
            ? `${promptRecord.prompt}\n\n${onboardingContext}`
            : promptRecord.prompt

        const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...((history ?? []) as StoredMessage[]).map((item) => ({
                        role: item.role === 'assistant' ? 'assistant' : 'user',
                        content: item.content,
                    })),
                ],
            }),
        })

        if (!openAIResponse.ok) {
            console.error('OpenAI request failed:', await openAIResponse.text())
            return NextResponse.json({ error: 'Jbot could not respond right now.' }, { status: 502 })
        }

        const completion = await openAIResponse.json()
        const assistantContent = completion.choices?.[0]?.message?.content

        if (typeof assistantContent !== 'string' || !assistantContent.trim()) {
            return NextResponse.json({ error: 'Jbot returned an empty response.' }, { status: 502 })
        }

        const { data: assistantMessage, error: assistantMessageError } = await supabase
            .from('jbot_messages')
            .insert({
                conversation_id: conversation.id,
                role: 'assistant',
                content: assistantContent,
            })
            .select('id, role, content, created_at')
            .single()

        if (assistantMessageError || !assistantMessage) {
            return NextResponse.json({ error: 'Jbot replied, but the response could not be saved.' }, { status: 500 })
        }

        const { error: updateError } = await supabase
            .from('jbot_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversation.id)
            .eq('user_id', user.id)

        if (updateError) {
            console.error('Conversation timestamp update failed:', updateError)
        }

        return NextResponse.json({
            userMessage: userMessage as StoredMessage,
            assistantMessage: assistantMessage as StoredMessage,
        })
    } catch (error) {
        console.error('Jbot chat error:', error)
        return NextResponse.json({ error: 'Unable to process your message.' }, { status: 500 })
    }
}
