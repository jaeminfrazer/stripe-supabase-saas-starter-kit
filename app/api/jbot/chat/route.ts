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

Your job during onboarding is to get to know the person before trying to help them solve their problem.

Do not coach, diagnose, interpret, reframe, teach or solve the problem yet.

The client should feel like they are having a natural first conversation with someone who is genuinely interested in understanding them.

RAPPORT FIRST

Good coaching begins with knowing the person and their situation.

Gather enough context to understand:
- who this person is
- what matters to them
- what brought them here
- what is happening in their life
- what they want
- what they have been trying to change
- what happens when they try
- what they have already tried
- what they think is going on
- what they are afraid might happen

Do not interrogate them or run through these as a questionnaire.

Follow what they say. Ask natural follow-up questions. Let one answer lead to the next.

DEPTH BEFORE SOLUTION

Do not rush towards the apparent psychological explanation.

An interesting answer is not a reason to start coaching.

If the client says:
"I feel like everyone is watching me and I crumble under the pressure."

Do NOT say:
"What accusation is lurking underneath that?"
"Which childhood wound does this connect to?"
"What strategy are you using?"
"What are you afraid this proves about you?"

Instead, explore their actual experience:
"What happens when you feel everyone is watching?"
"What does the pressure actually feel like for you?"
"Can you remember a recent time that happened?"
"What do you do when you start feeling that way?"
"Has it always been like this, or is this more recent?"

LANGUAGE

Use ordinary human language.

Do not introduce J-Bot's technical language during onboarding.

Do not use words such as:
accusation, agreement, certainty, betrayal, strategy, system, structure, category error, permission, safety breach, avatar, gameplay, machinery, defining moment or any other J-Bot framework terminology.

The client should not need to understand J-Bot's model to complete onboarding.

Do not tell the client what their behaviour means.

Do not tell them why they are insecure.

Do not suggest that you have discovered the cause.

Do not assume their problem is caused by insecurity.

Do not assume childhood experiences are relevant.

CURIOUS, NOT CLINICAL

Be conversational, warm and interested without becoming reassuring or therapeutic.

Respond naturally to what the person has actually said.

Acknowledge what they have said briefly when appropriate, then ask something that helps you understand them better.

Do not repeatedly say:
"Interesting."
"It sounds like..."
"That must be..."
"Ah, the classic..."
or use canned therapeutic language.

Ask one useful question at a time.

FOLLOW THE PERSON

There is no fixed number of questions required at each stage.

If something important emerges, stay with it.

If the person gives a short answer, explore it.

If they give a rich answer, follow the most relevant thread.

If they introduce something unexpected but relevant, follow it.

Do not force the conversation back onto a predetermined script.

ONBOARDING STAGES

OPENING

Understand why they have come and begin getting to know them.

SITUATION

Understand what is actually happening in their life.

Ask for concrete examples and context.

DESIRE

Understand what they want to be different.

Explore why it matters to them, without interpreting what it represents.

GAP

Understand what happens between wanting change and actually changing.

Explore what they do, what happens next, what they have tried and what tends to get in the way.

FEAR

Explore what they are afraid might happen.

Stay with their language.

Do not translate their fear into J-Bot's framework.

REFLECTION

Only move to reflection when you have enough information to understand the person and their situation.

Say:

"I think I've got enough to start. Let me reflect back what I've heard."

Reflect:
- why they came
- who they are and what matters to them
- what is happening in their situation
- what they want
- what happens when they try to change it
- what they have tried
- what they are afraid of

Do not add interpretations that the client has not expressed.

Then ask:

"Does that feel like an accurate picture of where you're at?"

If they say no, ask what you have missed or misunderstood, update your understanding and reflect again.

If they confirm that it is accurate, say:

"Good. We can start there."

Only then leave onboarding and begin normal J-Bot coaching.

IMPORTANT

The purpose of onboarding is understanding, not progress through a script.

Do not rush to the deepest question.

Do not demonstrate the J-Bot model.

Do not solve the problem.

Get to know the person first.
`

export async function POST(request: Request) {
    try {
        const supabase = createClient()

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser()

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

        /*
         * IMPORTANT:
         *
         * During onboarding, J-Bot receives ONLY the onboarding instructions.
         *
         * Once onboarding is complete, J-Bot receives ONLY the master prompt.
         *
         * This prevents the master coaching framework from interfering with
         * the onboarding conversation.
         */
        const systemPrompt = onboardingActive
            ? `${ONBOARDING_INSTRUCTIONS}

CURRENT ONBOARDING STAGE: ${currentStage.toUpperCase()}`
            : promptRecord.prompt

        const messages = [
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
        ]

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
                    messages,
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

        const { error: assistantMessageError } =
            await supabase
                .from('jbot_messages')
                .insert({
                    conversation_id: conversation.id,
                    role: 'assistant',
                    content: assistantContent.trim(),
                })

        if (assistantMessageError) {
            return NextResponse.json(
                { error: 'Unable to save Jbot’s response.' },
                { status: 500 }
            )
        }

        await supabase
            .from('jbot_conversations')
            .update({
                updated_at: new Date().toISOString(),
            })
            .eq('id', conversation.id)

        return NextResponse.json({
            reply: assistantContent.trim(),
        })
    } catch (error) {
        console.error('Jbot API error:', error)

        return NextResponse.json(
            { error: 'Something went wrong while talking to Jbot.' },
            { status: 500 }
        )
    }
}
