import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'

import { createClient } from '@/utils/supabase/server'
import { db } from '@/utils/db/db'

type StoredMessage = {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    created_at: string
}

type OnboardingStage =
    | 'opening'
    | 'situation'
    | 'desire'
    | 'gap'
    | 'fear'
    | 'reflection'
    | 'complete'

const ONBOARDING_BASE = `
J_BOT ONBOARDING MODE

You are onboarding a new client.

Your job is to understand enough about the client's current reality to
begin normal J-Bot coaching intelligently.

Do NOT apply the normal J-Bot coaching model yet.

Do NOT look for or introduce accusation, agreement, certainty, betrayal,
strategy, system, safety, permission, insecurity or other J-Bot framework
concepts unless the client naturally introduces something that genuinely
needs clarification.

The client does not need to understand their problem before coaching
begins. Discovering the underlying structure is J-Bot's job later.

Onboarding is a natural coaching conversation, not a questionnaire.

Follow the client's language.

Do not repeat questions the client has already answered.

Do not rush to explain, reassure, motivate, advise or solve.

Do not assume the client's current explanation is correct. Treat it as
their current understanding.

Do not assume childhood is relevant.

When a client gives a vague label, move toward the observable experience
when necessary.

Do not manufacture deeper meaning.

Do not ask what the client has made something mean about themselves.

Do not ask what conclusion they have drawn about themselves.

Do not ask what something says about them.

Do not introduce insecurity as an explanation during onboarding.

The conversation should feel like a natural conversation with a skilled
coach, not an intake form.

IMPORTANT:

Your response must be returned as JSON with exactly these two fields:

{
  "reply": "the natural response to the client",
  "next_stage": "the next onboarding stage"
}

The next_stage must be one of:

opening
situation
desire
gap
fear
reflection
complete

Keep the reply natural and concise.

Only advance to the next stage when the current stage has enough
information.

You may remain in the current stage if more understanding is needed.

Do not skip ahead simply because a later question might be interesting.
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
            (onboarding?.current_stage as OnboardingStage) || 'opening'

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
        let isOnboardingResponse = false

        if (onboardingActive && currentStage !== 'complete') {
            isOnboardingResponse = true

            const stageResult = await db.execute<{ instructions: string }>(
                sql`
                    select instructions
                    from jbot_onboarding_instructions
                    where stage = ${currentStage}
                      and active = true
                    limit 1
                `
            )

            const stageInstructions = stageResult[0]?.instructions

            if (!stageInstructions) {
                console.error(
                    `No active onboarding instructions found for stage: ${currentStage}`
                )

                return NextResponse.json(
                    {
                        error:
                            'Jbot onboarding is not configured for the current stage.',
                    },
                    { status: 503 }
                )
            }

            systemPrompt = `${ONBOARDING_BASE}

${stageInstructions}

CURRENT DATABASE STAGE: ${currentStage}`
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

        const requestBody: Record<string, unknown> = {
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages,
        }

        if (isOnboardingResponse) {
            requestBody.response_format = {
                type: 'json_object',
            }
        }

        const openAIResponse = await fetch(
            'https://api.openai.com/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                },
                body: JSON.stringify(requestBody),
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

        const rawAssistantContent =
            completion.choices?.[0]?.message?.content

        if (
            typeof rawAssistantContent !== 'string' ||
            !rawAssistantContent.trim()
        ) {
            return NextResponse.json(
                { error: 'Jbot returned an empty response.' },
                { status: 502 }
            )
        }

        let assistantContent = rawAssistantContent
        let nextStage: OnboardingStage = currentStage

        if (isOnboardingResponse) {
            try {
                const parsed = JSON.parse(rawAssistantContent)

                if (
                    typeof parsed.reply !== 'string' ||
                    !parsed.reply.trim()
                ) {
                    throw new Error('Invalid onboarding reply.')
                }

                assistantContent = parsed.reply.trim()

                const allowedStages: OnboardingStage[] = [
                    'opening',
                    'situation',
                    'desire',
                    'gap',
                    'fear',
                    'reflection',
                    'complete',
                ]

                if (
                    typeof parsed.next_stage === 'string' &&
                    allowedStages.includes(parsed.next_stage)
                ) {
                    nextStage = parsed.next_stage as OnboardingStage
                }
            } catch (error) {
                console.error(
                    'Unable to parse onboarding response:',
                    error
                )

                return NextResponse.json(
                    {
                        error:
                            'Jbot returned an invalid onboarding response.',
                    },
                    { status: 502 }
                )
            }
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

        if (isOnboardingResponse && nextStage !== currentStage) {
            if (nextStage === 'complete') {
                const { error: completionError } =
                    await supabase
                        .from('jbot_onboarding')
                        .update({
                            status: 'completed',
                            current_stage: 'complete',
                            completed_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                        .eq('user_id', user.id)

                if (completionError) {
                    console.error(
                        'Unable to complete onboarding:',
                        completionError
                    )
                }
            } else {
                const { error: stageUpdateError } =
                    await supabase
                        .from('jbot_onboarding')
                        .update({
                            current_stage: nextStage,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('user_id', user.id)

                if (stageUpdateError) {
                    console.error(
                        'Unable to update onboarding stage:',
                        stageUpdateError
                    )
                }
            }
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
