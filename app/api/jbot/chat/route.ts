import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

type StoredMessage = {
    id: string
    role: 'user' | 'assistant'
    content: string
    created_at: string
}

type IntakeData = {
    tell_me_about_you: string | null
    hindrances: string | null
    personality: string | null
    pain_points: string | null
    goals: string | null
    what_have_you_tried: string | null
    history: string | null
}

function buildIntakeContext(intake: IntakeData) {
    return `
CLIENT INTAKE

The following information was provided by the client during their intake before coaching began. Treat it as the client's own account of their life, circumstances, experiences and current understanding. Do not assume that their interpretations are objectively correct. Use the information as context for the coaching conversation.

1. TELL ME ABOUT YOU

${intake.tell_me_about_you ?? 'No answer provided.'}

2. HINDRANCES

${intake.hindrances ?? 'No answer provided.'}

3. PERSONALITY

${intake.personality ?? 'No answer provided.'}

4. PAIN POINTS

${intake.pain_points ?? 'No answer provided.'}

5. WHAT DO YOU WANT?

${intake.goals ?? 'No answer provided.'}

6. WHAT HAVE YOU TRIED?

${intake.what_have_you_tried ?? 'No answer provided.'}

7. HISTORY

${intake.history ?? 'No answer provided.'}
`
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
            data: intake,
            error: intakeError,
        } = await supabase
            .from('jbot_onboarding_data')
            .select(
                'tell_me_about_you, hindrances, personality, pain_points, goals, what_have_you_tried, history'
            )
            .eq('user_id', verifiedUserId)
            .maybeSingle()

        if (intakeError) {
            return NextResponse.json(
                {
                    error: 'Unable to load your intake.',
                    details: intakeError.message,
                },
                { status: 500 }
            )
        }

        if (!intake) {
            return NextResponse.json(
                { error: 'Please complete your intake before starting coaching.' },
                { status: 400 }
            )
        }

        const {
            data: userMessage,
            error: userMessageError,
        } = await supabase
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

        const intakeContext = buildIntakeContext(intake as IntakeData)

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
                            content: promptRecord.prompt,
                        },
                        {
                            role: 'system',
                            content: intakeContext,
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
