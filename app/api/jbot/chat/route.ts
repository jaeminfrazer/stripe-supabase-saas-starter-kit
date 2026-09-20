import { NextResponse } from 'next/server'

import { createClient } from '@/utils/supabase/server'

type StoredMessage = {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    created_at: string
}

const ONBOARDING_INSTRUCTIONS = `
J_BOT ONBOARDING MODE

You are currently onboarding a new client.

IMPORTANT:
These instructions are the complete operating instructions for this
conversation while onboarding is active.

Do NOT apply the normal J-Bot coaching model yet.
Do NOT look for accusation, agreement, certainty, betrayal, strategy,
system, safety, permission, insecurity or any other J-Bot framework
concept unless the client naturally introduces something that needs to
be clarified.

The purpose of onboarding is to understand the client's starting point.
Discovering the deeper structure is J-Bot's job later.

The client does not need to understand their problem before coaching
begins.

CONVERSATIONAL METHOD

Onboarding is a natural coaching conversation, not a questionnaire.

Follow the client's language and choose the next question based on what
they have just said.

Do not mechanically work through every stage.

Do not ask a question simply because it belongs to the next stage.

If the client's answer already provides information relevant to a stage,
use that information rather than asking for it again.

Do not repeat a question the client has already answered.

Do not rush to explain, reassure, motivate, advise or solve.

Do not assume the client's current explanation is correct. Treat it as
their current understanding and investigate it.

Do not assume childhood is relevant.

When the client gives a vague label, interpretation or conclusion,
explore the experience underneath it.

For example:

"I feel stuck."
Ask what being stuck actually looks like.

"I'm a perfectionist."
Ask what they are actually doing that they call perfectionism.

"I'm self-sabotaging."
Ask what they are actually doing.

Move from labels and interpretations toward observable experience when
necessary.

ONBOARDING STAGES

The current onboarding stage is provided below.

OPENING

Purpose:
Understand what brought the client here.

Begin with:

"What brought you here?"

But if the client's first message has already clearly explained why they
are here, do NOT ask this question again. Use what they have already told
you and explore it.

SITUATION

Purpose:
Understand what is actually happening in concrete terms.

Useful questions include:

"What does that actually look like?"

"Can you give me an example?"

"What happened the last time?"

Move from broad labels and interpretations toward observable experience
when necessary.

DESIRE

Purpose:
Understand what the client wants to be different.

Useful questions include:

"What would you like to be different?"

"What would you be doing instead?"

Do not turn this into a generic goal-setting exercise.

GAP

Purpose:
Understand the discrepancy between what the client wants and what is
currently happening.

Explore what happens when they try to change it.

Useful questions include:

"What's getting in the way?"

"What happens when you try to change it?"

"What do you find yourself doing instead?"

"And then what do you do?"

"What have you tried to change this?"

Understand behaviour without prematurely labelling it as self-sabotage,
avoidance, perfectionism or another framework category.

FEAR

Purpose:
Explore what the client is most afraid of and follow that fear deeper.

Once there is enough context, ask:

"So what are you most afraid of here?"

Follow the client's fear rather than accepting the first answer as the
endpoint.

Useful follow-ups include:

"And then what?"

"What specifically would be so bad about that?"

"What would be terrible about that happening?"

"What are you actually afraid would be true?"

Continue following the fear while the exploration is revealing something
useful.

Do NOT replace a fear question with a question about meaning.

Do NOT jump from the presenting problem to:

"What have you made this mean about yourself?"

"What conclusion have you drawn about yourself?"

"What does this say about you?"

"What does this mean about you?"

Those questions are not appropriate during onboarding.

Do not force an accusation to emerge.

The client is not expected to identify their own accusation.

If an accusation becomes visible through their language, do not announce
or diagnose it. Simply explore what the client is actually saying if that
helps the conversation.

If it does not emerge, leave it unresolved.

REFLECTION

Purpose:
Reflect back the starting picture and confirm that J-Bot has understood
the client accurately.

When enough understanding has been established, say:

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

On the next conversation turn, normal J-Bot coaching will begin.

GENERAL RULE

The goal of onboarding is not to solve the client's problem.

The goal is to understand enough of the client's current reality to begin
normal J-Bot coaching intelligently.

The client should experience onboarding as a natural coaching
conversation, not as an intake form.
`

export async function POST(request: Request) {
    try {
        const supabase = createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
            return NextResponse.json(
                { error: 'You must be signed in to use Jbot.' },
                { status: 401 }
            )
        }

        const body = await request.json()

        const conversationId =
            typeof body.conversationId === 'string'
                ? body.conversationId
                : ''

        const content =
            typeof body.content === 'string'
                ? body.content.trim()
                : ''

        if (!conversationId || !content) {
            return NextResponse.json(
                { error: 'A conversation and message are required.' },
                { status: 400 }
            )
        }

        if (content.length > 4000) {
            return NextResponse.json(
                { error: 'Messages must be 4,000 characters or fewer.' },
                { status: 400 }
            )
        }

        const { data: conversation, error: conversationError } =
            await supabase
                .from('jbot_conversations')
                .select('id')
                .eq('id', conversationId)
                .eq('user_id', user.id)
                .maybeSingle()

        if (conversationError || !conversation) {
            return NextResponse.json(
                { error: 'Conversation not found.' },
                { status: 404 }
            )
        }

        const { data: onboarding, error: onboardingError } =
            await supabase
                .from('jbot_onboarding')
                .select('status, current_stage')
                .eq('user_id', user.id)
                .maybeSingle()

        if (onboardingError) {
            return NextResponse.json(
                { error: 'Unable to load your onboarding status.' },
                { status: 500 }
            )
        }

        const onboardingActive =
            onboarding?.status === 'not_started' ||
            onboarding?.status === 'in_progress'

        const currentStage =
            onboarding?.current_stage || 'opening'

        if (onboarding?.status === 'not_started') {
            const { error: updateOnboardingError } =
                await supabase
                    .from('jbot_onboarding')
                    .update({
                        status: 'in_progress',
                        current_stage: 'opening',
                        started_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('user_id', user.id)

            if (updateOnboardingError) {
                console.error(
                    'Unable to update onboarding status:',
                    updateOnboardingError
                )
            }
        }

        const { data: userMessage, error: userMessageError } =
            await supabase
                .from('jbot_messages')
                .insert({
                    conversation_id: conversation.id,
                    role: 'user',
                    content,
                })
                .select('id, role, content, created_at')
                .single()

        if (userMessageError || !userMessage) {
            return NextResponse.json(
                { error: 'Unable to save your message.' },
                { status: 500 }
            )
        }

        const { data: history, error: historyError } =
            await supabase
                .from('jbot_messages')
                .select('id, role, content, created_at')
                .eq('conversation_id', conversation.id)
                .order('created_at', { ascending: true })
                .limit(100)

        if (historyError) {
            return NextResponse.json(
                { error: 'Unable to load the conversation history.' },
                { status: 500 }
            )
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json(
                { error: 'OpenAI is not configured on the server.' },
                { status: 503 }
            )
        }

        let systemPrompt: string

        if (onboardingActive) {
            systemPrompt = `${ONBOARDING_INSTRUCTIONS}

CURRENT ONBOARDING STAGE: ${currentStage.toUpperCase()}`
        } else {
            const { data: promptRecord, error: promptError } =
                await supabase
                    .from('jbot_system_prompt')
                    .select('prompt')
                    .eq('active', true)
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

            if (promptError || !promptRecord?.prompt) {
                return NextResponse.json(
                    { error: 'Jbot is not configured yet.' },
                    { status: 503 }
                )
            }

            systemPrompt = promptRecord.prompt
        }

        const openAIResponse = await fetch(
            'https://api.openai.com/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt,
                        },
                        ...((history ?? []) as StoredMessage[]).map((item) => ({
                            role:
                                item.role === 'assistant'
                                    ? 'assistant'
                                    : 'user',
                            content: item.content,
                        })),
                    ],
                }),
            }
        )

        if (!openAIResponse.ok) {
            console.error(
                'OpenAI request failed:',
                await openAIResponse.text()
            )

            return NextResponse.json(
                { error: 'Jbot could not respond right now.' },
                { status: 502 }
            )
        }

        const completion = await openAIResponse.json()

        const assistantContent =
            completion.choices?.[0]?.message?.content

        if (
            typeof assistantContent !== 'string' ||
            !assistantContent.trim()
        ) {
            return NextResponse.json(
                { error: 'Jbot returned an empty response.' },
                { status: 502 }
            )
        }

        const { data: assistantMessage, error: assistantMessageError } =
            await supabase
                .from('jbot_messages')
                .insert({
                    conversation_id: conversation.id,
                    role: 'assistant',
                    content: assistantContent,
                })
                .select('id, role, content, created_at')
                .single()

        if (assistantMessageError || !assistantMessage) {
            return NextResponse.json(
                {
                    error:
                        'Jbot replied, but the response could not be saved.',
                },
                { status: 500 }
            )
        }

        const { error: updateError } =
            await supabase
                .from('jbot_conversations')
                .update({
                    updated_at: new Date().toISOString(),
                })
                .eq('id', conversation.id)
                .eq('user_id', user.id)

        if (updateError) {
            console.error(
                'Conversation timestamp update failed:',
                updateError
            )
        }

        return NextResponse.json({
            userMessage: userMessage as StoredMessage,
            assistantMessage: assistantMessage as StoredMessage,
        })
    } catch (error) {
        console.error('Jbot chat error:', error)

        return NextResponse.json(
            { error: 'Unable to process your message.' },
            { status: 500 }
        )
    }
}
