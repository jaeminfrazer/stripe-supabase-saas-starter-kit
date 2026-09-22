import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

type StoredMessage = {
    id: string
    role: 'user' | 'assistant'
    content: string
    created_at: string
}

type OnboardingData = {
    who_they_are: string | null
    here_and_now: string | null
    goals: string | null
    current_problem: string | null
    history: string | null
    their_map: string | null
    open: string | null
}

const ONBOARDING_INSTRUCTIONS = `
You are J-Bot during the client's onboarding process.

IMPORTANT:
The client is being onboarded before the actual coaching begins.

Your job during onboarding is to get a useful picture of the person and their situation. You are gathering context, not coaching them.

Do not diagnose them.
Do not interpret their psychology.
Do not introduce J-Bot's coaching framework.
Do not talk about accusations, insecurity structures, safety, permission, strategies, needs, or other J-Bot concepts unless the client introduces the subject themselves.
Do not try to solve their problems.
Do not turn their answers into coaching.
Do not tell them what their answers mean.

Be naturally curious, conversational and interested in getting to know them.

Gather information across these seven areas:

1. WHO THEY ARE
Learn about the person, their age or life stage, family, relationships, children, work or business, health, finances, lifestyle and other people or circumstances that are relevant to understanding their life.

2. HERE AND NOW
Understand what life looks like at the moment. What's going well, what's difficult, what's putting pressure on them, what's changing, what opportunities exist and what is currently occupying their attention.

3. GOALS
Understand what they want. Ask about important goals, desired outcomes and what they would like their life to look like.

4. CURRENT PROBLEM
Understand what has brought them here. What is the problem they are experiencing? What does it look like in real life? How long has it been happening and what impact is it having?

5. HISTORY
Understand relevant history. Previous experiences, important events, previous versions of the current problem and previous coaching, therapy or other support where relevant.

6. THEIR MAP
Understand how they currently see the situation. What do they think is going on? What do they think is causing the problem? What do they think needs to change?

7. OPEN
Give them room to tell you anything else they think J-Bot should know before the coaching begins.

Do not interrogate them with a rigid questionnaire. Let the conversation flow naturally. Ask one useful question at a time and follow what they give you.

You may acknowledge what they have said, but do not coach it.

The client should feel that this is preliminary setup, not a coaching session.

Opening message:

"Before we get into the actual coaching, I’m going to get you onboarded first.

This is just a chance for me to get a picture of who you are, what’s going on in your life, what you want, and what’s brought you here. Nothing to solve yet and no need to have the right answers.

We’ll take it from there once I’ve got a bit of context. Let’s start with you. Tell me a little about yourself and what your life looks like at the moment."
`

const EXTRACTION_INSTRUCTIONS = `
You are maintaining a concise onboarding record for a coaching client.

Extract only information the client has actually provided in the conversation.

Do not diagnose, interpret or infer psychological structures.
Do not add information that the client has not stated.
Do not convert ordinary facts into coaching conclusions.

Maintain these seven fields:

who_they_are:
Information about who the person is and relevant life context.

here_and_now:
Their current situation and what is happening in their life now.

goals:
What they want and important goals or desired outcomes.

current_problem:
The problem or problems that brought them here, including concrete examples and impact.

history:
Relevant history and previous experiences.

their_map:
What the client themselves says they think is going on, causing the problem, or needs to change.

open:
Other information the client says J-Bot should know.

For each field, produce a concise consolidated summary of everything relevant currently known from the conversation.

If a field has no information, return null.

Return valid JSON only.
`

function cleanValue(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null
    }

    const cleaned = value.trim()
    return cleaned ? cleaned : null
}

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

        const verifiedUserId = user.id
        const body = await request.json()

        const conversationId =
            typeof body.conversationId === 'string'
                ? body.conversationId
                : ''

        const content =
            typeof body.content === 'string'
                ? body.content.trim()
                : ''

        if (!conversationId) {
            return NextResponse.json(
                { error: 'A conversation is required.' },
                { status: 400 }
            )
        }

        if (!content) {
            return NextResponse.json(
                { error: 'A message is required.' },
                { status: 400 }
            )
        }

        const {
            data: conversation,
            error: conversationError,
        } = await supabase
            .from('jbot_conversations')
            .select('id')
            .eq('id', conversationId)
            .eq('user_id', verifiedUserId)
            .maybeSingle()

        if (conversationError || !conversation) {
            return NextResponse.json(
                { error: 'Conversation not found.' },
                { status: 404 }
            )
        }

        const verifiedConversationId = conversation.id

        const {
            data: onboarding,
            error: onboardingError,
        } = await supabase
            .from('jbot_onboarding')
            .select('status, current_stage')
            .eq('user_id', verifiedUserId)
            .maybeSingle()

        if (onboardingError) {
            return NextResponse.json(
                {
                    error: 'Unable to load onboarding status.',
                    details: onboardingError.message,
                },
                { status: 500 }
            )
        }

        const onboardingActive =
            onboarding?.status === 'not_started' ||
            onboarding?.status === 'in_progress'

        if (onboarding?.status === 'not_started') {
            const { error: startError } = await supabase
                .from('jbot_onboarding')
                .update({
                    status: 'in_progress',
                    started_at: new Date().toISOString(),
                    current_stage: 'opening',
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', verifiedUserId)

            if (startError) {
                return NextResponse.json(
                    {
                        error: 'Unable to start onboarding.',
                        details: startError.message,
                    },
                    { status: 500 }
                )
            }
        }

        const { data: userMessage, error: userMessageError } = await supabase
            .from('jbot_messages')
            .insert({
                conversation_id: verifiedConversationId,
                role: 'user',
                content,
            })
            .select('id, role, content, created_at')
            .single()

        if (userMessageError || !userMessage) {
            return NextResponse.json(
                {
                    error: 'Unable to save your message.',
                    details: userMessageError?.message,
                },
                { status: 500 }
            )
        }

        const { data: history, error: historyError } = await supabase
            .from('jbot_messages')
            .select('id, role, content, created_at')
            .eq('conversation_id', verifiedConversationId)
            .order('created_at', { ascending: true })

        if (historyError) {
            return NextResponse.json(
                {
                    error: 'Unable to load conversation history.',
                    details: historyError.message,
                },
                { status: 500 }
            )
        }

        let systemPrompt = ONBOARDING_INSTRUCTIONS

        if (!onboardingActive) {
            const {
                data: promptRecord,
                error: promptError,
            } = await supabase
                .from('jbot_system_prompt')
                .select('prompt')
                .eq('active', true)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (promptError || !promptRecord) {
                return NextResponse.json(
                    {
                        error: 'Unable to load J-Bot instructions.',
                        details: promptError?.message,
                    },
                    { status: 500 }
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
            const errorText = await openAIResponse.text()

            console.error('OpenAI error:', errorText)

            return NextResponse.json(
                { error: 'J-Bot was unable to respond.' },
                { status: 500 }
            )
        }

        const completion = await openAIResponse.json()
        const assistantContent =
            completion.choices?.[0]?.message?.content

        if (!assistantContent) {
            return NextResponse.json(
                { error: 'J-Bot returned an empty response.' },
                { status: 500 }
            )
        }

        const {
            data: assistantMessage,
            error: assistantMessageError,
        } = await supabase
            .from('jbot_messages')
            .insert({
                conversation_id: verifiedConversationId,
                role: 'assistant',
                content: assistantContent,
            })
            .select('id, role, content, created_at')
            .single()

        if (assistantMessageError || !assistantMessage) {
            return NextResponse.json(
                {
                    error: 'Unable to save J-Bot response.',
                    details: assistantMessageError?.message,
                },
                { status: 500 }
            )
        }

        if (onboardingActive) {
            const extractionMessages = [
                {
                    role: 'system',
                    content: EXTRACTION_INSTRUCTIONS,
                },
                ...((history ?? []) as StoredMessage[]).map((item) => ({
                    role:
                        item.role === 'assistant'
                            ? 'assistant'
                            : 'user',
                    content: item.content,
                })),
                {
                    role: 'assistant',
                    content: assistantContent,
                },
            ]

            const extractionResponse = await fetch(
                'https://api.openai.com/v1/chat/completions',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                    },
                    body: JSON.stringify({
                        model:
                            process.env.OPENAI_MODEL || 'gpt-4o-mini',
                        messages: extractionMessages,
                        response_format: {
                            type: 'json_object',
                        },
                    }),
                }
            )

            if (extractionResponse.ok) {
                const extractionCompletion =
                    await extractionResponse.json()

                const extractionContent =
                    extractionCompletion.choices?.[0]?.message?.content

                if (extractionContent) {
                    try {
                        const extracted =
                            JSON.parse(extractionContent) as OnboardingData

                        const onboardingData = {
                            user_id: verifiedUserId,
                            who_they_are: cleanValue(
                                extracted.who_they_are
                            ),
                            here_and_now: cleanValue(
                                extracted.here_and_now
                            ),
                            goals: cleanValue(extracted.goals),
                            current_problem: cleanValue(
                                extracted.current_problem
                            ),
                            history: cleanValue(extracted.history),
                            their_map: cleanValue(
                                extracted.their_map
                            ),
                            open: cleanValue(extracted.open),
                            updated_at: new Date().toISOString(),
                        }

                        const { error: onboardingDataError } =
                            await supabase
                                .from('jbot_onboarding_data')
                                .upsert(onboardingData, {
                                    onConflict: 'user_id',
                                })

                        if (onboardingDataError) {
                            console.error(
                                'Onboarding data update error:',
                                onboardingDataError
                            )
                        }
                    } catch (parseError) {
                        console.error(
                            'Unable to parse onboarding extraction:',
                            parseError
                        )
                    }
                }
            } else {
                console.error(
                    'Onboarding extraction failed:',
                    await extractionResponse.text()
                )
            }
        }

        await supabase
            .from('jbot_conversations')
            .update({
                updated_at: new Date().toISOString(),
            })
            .eq('id', verifiedConversationId)

        return NextResponse.json({
            userMessage: userMessage as StoredMessage,
            assistantMessage: assistantMessage as StoredMessage,
        })
    } catch (error) {
        console.error('Jbot chat error:', error)

        return NextResponse.json(
            { error: 'Something went wrong while talking to J-Bot.' },
            { status: 500 }
        )
    }
}
