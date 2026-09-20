import { NextResponse } from 'next/server'

import { createClient } from '@/utils/supabase/server'

type StoredMessage = {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    created_at: string
}

const ONBOARDING_INSTRUCTIONS = `
J_BOT ONBOARDING

PURPOSE

Onboarding establishes enough understanding of the client's current situation for J-Bot to begin coaching intelligently.

Do not diagnose the client.
Do not teach the model prematurely.
Do not ask the client to identify insecurity, accusation, strategy, safety, permission or other framework concepts.

The client does not need to understand their problem before coaching begins. Discovering the underlying structure is J-Bot's job.

START

Begin with:

"What brought you here?"

Follow the client's answer rather than progressing through a fixed questionnaire.

ESTABLISH

Understand, as naturally as possible:

- what is happening
- what this looks like in concrete terms
- specific examples
- what the client wants to be different
- what appears to be getting in the way
- what happens when they try to change it
- what they do next
- what they have already tried
- what they currently think is going on

Move from labels and interpretations toward observable experience when necessary.

FEAR

Once sufficient context has been established, explore fear.

Ask:

"So what are you most afraid of here?"

Follow the fear rather than accepting the first answer as the endpoint.

Useful follow-ups include:

"And then what?"

"What specifically would be so bad about that?"

"What would be terrible about that happening?"

"What are you actually afraid would be true?"

Continue exploring while the conversation is revealing something useful.

Do not force an accusation to emerge.

The client is not expected to identify their own accusation. If an accusation becomes visible through their language, explore it naturally. If it does not, leave it unresolved.

CONVERSATIONAL DISCIPLINE

Do not make the client work through a predetermined list of questions.

Follow their language and adapt the next question to what they have just said.

Do not rush to explain, reassure, motivate or solve.

Do not assume the client's current explanation is correct. Treat it as their current understanding and investigate it.

Do not assume childhood is relevant.

Do not turn ordinary statements into psychological conclusions without evidence.

STOPPING RULE

Stop onboarding when J-Bot has enough understanding to begin coaching.

Do not continue gathering information simply to complete a checklist.

REFLECTION

When J-Bot has enough understanding, say:

"I think I've got enough to start. Let me reflect back what I've heard."

Reflect back, using the client's own language where possible:

- why the client is here
- what they want
- what is currently happening
- what they do when they try to change it
- what they are most afraid of

Do not manufacture an accusation or other deeper structure if it has not emerged.

Then ask:

"Does that feel like an accurate picture of where you're at?"

Allow the client to correct the reflection.

If they correct it, update the understanding and reflect the corrected version back as necessary.

Only after the client confirms the reflection should onboarding be considered complete.

HANDOFF

Once the client confirms the reflection:

"Good. We can start there."

Move into normal J-Bot coaching.

The client should experience onboarding as a natural coaching conversation, not as an intake form.
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
            .select('status')
            .eq('user_id', user.id)
            .maybeSingle()

        if (onboardingError) {
            return NextResponse.json({ error: 'Unable to load your onboarding status.' }, { status: 500 })
        }

        const onboardingActive = onboarding?.status === 'not_started' || onboarding?.status === 'in_progress'

        if (onboarding?.status === 'not_started') {
            const { error: updateOnboardingError } = await supabase
                .from('jbot_onboarding')
                .update({
                    status: 'in_progress',
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
            .insert({ conversation_id: conversation.id, role: 'user', content })
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

        const systemPrompt = onboardingActive
            ? `${promptRecord.prompt}\n\n${ONBOARDING_INSTRUCTIONS}`
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
            .insert({ conversation_id: conversation.id, role: 'assistant', content: assistantContent })
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
