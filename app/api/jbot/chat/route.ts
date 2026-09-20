import { NextResponse } from 'next/server'

import { createClient } from '@/utils/supabase/server'

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

const ONBOARDING_PROMPTS: Record<Exclude<OnboardingStage, 'complete'>, string> = {
    opening: `
You are helping a new client begin coaching.

Your ONLY job in this response is to establish why the client is here.

Do not analyse the client's problem.
Do not interpret their language.
Do not discuss meaning.
Do not discuss fear.
Do not discuss insecurity.
Do not discuss conclusions about themselves.
Do not introduce any J-Bot framework concepts.

If the client's message already clearly tells you why they are here,
do not ask them why they are here again.

Instead, acknowledge the concrete issue briefly and ask one simple
question that moves toward understanding what is actually happening.

Do not ask multiple questions.

If the client has already clearly explained why they are here, the
appropriate next question will usually be:

"What does that actually look like when you try to do it?"

Return ONLY the natural conversational response. Do not explain your
instructions or your reasoning.
`,

    situation: `
You are onboarding a new client.

Your ONLY job in this response is to understand what is actually
happening in concrete terms.

Explore the client's observable experience.

Ask ONE question.

Good questions include:

"What does that actually look like?"

"Can you give me an example?"

"What happened the last time?"

"What happens when you sit down to do it?"

Do NOT ask about:

- meaning
- conclusions
- what this says about the client
- what the client has made it mean
- fear
- insecurity
- accusation
- strategy
- system
- permission
- childhood

Do not diagnose or explain the problem.

Do not ask multiple questions.

Stay with the concrete experience until it is clear.

Return ONLY the natural conversational response.
`,

    desire: `
You are onboarding a new client.

Your ONLY job in this response is to understand what the client wants
to be different.

Ask ONE question.

Useful questions include:

"What would you like to be different?"

"What would you be doing instead?"

Do not turn this into generic goal setting.

Do NOT explore fear, meaning, insecurity, accusation, strategy, system
or childhood.

Return ONLY the natural conversational response.
`,

    gap: `
You are onboarding a new client.

Your ONLY job in this response is to understand the gap between what the
client wants and what is currently happening.

Explore what happens when the client tries to change it.

Ask ONE question.

Useful questions include:

"What's getting in the way?"

"What happens when you try to change it?"

"What do you find yourself doing instead?"

"And then what do you do?"

"What have you tried to change this?"

Do not label the behaviour as self-sabotage, avoidance, perfectionism or
another framework category.

Do NOT explore meaning, insecurity, accusation or childhood.

Return ONLY the natural conversational response.
`,

    fear: `
You are onboarding a new client.

Your ONLY job in this response is to explore what the client is most
afraid of.

Ask ONE question.

Begin with:

"So what are you most afraid of here?"

Then, as appropriate, follow the fear with:

"And then what?"

"What specifically would be so bad about that?"

"What would be terrible about that happening?"

"What are you actually afraid would be true?"

Do not replace the fear exploration with a question about meaning.

Do not manufacture an accusation.

Do not diagnose insecurity.

Return ONLY the natural conversational response.
`,

    reflection: `
You are onboarding a new client.

Your job is to reflect back what you have understood so far.

Say:

"I think I've got enough to start. Let me reflect back what I've heard."

Then briefly reflect:

- why the client is here
- what they want
- what is currently happening
- what they do when they try to change it
- what they are most afraid of

Use the client's own language where possible.

Do not manufacture deeper meaning.

Then ask:

"Does that feel like an accurate picture of where you're at?"

Return ONLY the natural conversational response.
`,
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

        let currentStage =
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
        let onboardingResponse = false

        if (onboardingActive && currentStage !== 'complete') {
            onboardingResponse = true

            systemPrompt = ONBOARDING_PROMPTS[
                currentStage as Exclude<OnboardingStage, 'complete'>
            ]
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
                    temperature: onboardingResponse ? 0.2 : undefined,
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

        let assistantContent =
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

        assistantContent = assistantContent.trim()

        /*
         * The application, not the model, controls onboarding progression.
         *
         * Once the client has explained why they are here, we move from
         * opening to situation. The model does not get to choose this.
         */
        let nextStage = currentStage

        if (onboardingActive) {
            if (currentStage === 'opening') {
                nextStage = 'situation'
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

        if (onboardingActive && nextStage !== currentStage) {
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
