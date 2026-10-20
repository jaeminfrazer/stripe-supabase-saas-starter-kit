import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createClient } from '@/utils/supabase/server'
import { hasJbotAccess } from '@/utils/access/has-jbot-access'

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


type KnowledgeRecord = {
    id: string
    title: string
    category: string | null
    content: string
    when_to_use: string | null
    retrieval_rules: string | null
}

const RETRIEVAL_MARKER = /\[\[JBOT_RETRIEVE:\s*([\s\S]*?)\]\]/i
const RETRIEVAL_STOP_WORDS = new Set([
    'about', 'after', 'again', 'also', 'because', 'been', 'being', 'between',
    'could', 'does', 'doing', 'from', 'have', 'into', 'just', 'more', 'most',
    'other', 'over', 'same', 'some', 'such', 'than', 'that', 'their', 'them',
    'then', 'there', 'these', 'they', 'this', 'those', 'through', 'under',
    'very', 'want', 'what', 'when', 'where', 'which', 'while', 'with', 'would',
])

function retrievalTerms(value: string) {
    return Array.from(new Set(
        value.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, ' ')
            .split(/\s+/)
            .filter((term) => term.length >= 3 && !RETRIEVAL_STOP_WORDS.has(term))
    ))
}

function rankKnowledge(records: KnowledgeRecord[], query: string) {
    const terms = retrievalTerms(query)
    return records
        .map((record) => {
            const title = retrievalTerms(record.title).join(' ')
            const category = retrievalTerms(record.category ?? '').join(' ')
            const use = retrievalTerms(record.when_to_use ?? '').join(' ')
            const rules = retrievalTerms(record.retrieval_rules ?? '').join(' ')
            const content = retrievalTerms(record.content).join(' ')
            let score = 0

            for (const term of terms) {
                if (title.split(' ').includes(term)) score += 8
                if (category.split(' ').includes(term)) score += 5
                if (use.split(' ').includes(term)) score += 4
                if (rules.split(' ').includes(term)) score += 3
                if (content.split(' ').includes(term)) score += 1
            }

            return { record, score }
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((item) => item.record)
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

        if (!(await hasJbotAccess(user.id, user.email ?? ''))) {
            return NextResponse.json(
                { error: 'Your J-Bot access has expired. Please renew your subscription or contact us for help.' },
                { status: 403 }
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
            .select('id, updated_at, prompt')
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

        console.info('Jbot active prompt diagnostic:', {
            conversationId: verifiedConversationId,
            promptId: promptRecord.id,
            promptUpdatedAt: promptRecord.updated_at,
            promptSha256: createHash('sha256').update(promptRecord.prompt).digest('hex'),
            deploymentCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        })

        const intakeContext = buildIntakeContext(intake as IntakeData)

        const assessmentCheckpointInstruction = `
ASSESSMENT CHECKPOINTS — NATURAL POINT ONLY
Do not trigger an assessment after every message. Continue coaching naturally. When, and only when, you have reached a natural checkpoint for a milestone and have enough substantive conversation to assess it, finish your response with one machine-readable marker on its own final line:
[[JBOT_ASSESS:4]] for Identify the accusation, only when you have explicitly tested the accusation against both behaviour/strategy and the evidence available.
[[JBOT_ASSESS:5]] for Discover the defining moment, only when you have explored a candidate scene and are ready to review it against the defining-moment criteria. Do not imply it is complete just because a scene has emerged.
[[JBOT_ASSESS:7]] for Well-formed outcomes, only when you have explored the desired outcome and reached a natural point to assess clarity, highest intention, chosen vehicle, consequences and readiness.
You may include more than one marker only if each milestone independently reached a natural checkpoint. Never show, explain or refer to these markers to the client. Do not use a marker merely because the user mentions a milestone. The server removes markers before displaying or saving the response. The assessment engine, not you, decides the status.
`

        const coachingModel = process.env.OPENAI_MODEL || 'gpt-4o-mini'
        const turnNumber = Math.ceil(((history ?? []) as StoredMessage[]).length / 2)
        const conversationMessages = [
            {
                role: 'system' as const,
                content: promptRecord.prompt,
            },
            {
                role: 'system' as const,
                content: assessmentCheckpointInstruction,
            },
            {
                role: 'system' as const,
                content: intakeContext,
            },
            {
                role: 'system' as const,
                content: `EMERGENCY-ONLY KNOWLEDGE RETRIEVAL
Use the knowledge library only when the investigation is genuinely stuck: you are repeating the same line of inquiry, cannot explain the result from the current model, or need a specific piece of methodology to test or revise your understanding. A client saying they are stuck is also a signal to reassess whether retrieval would help, not an automatic command to retrieve.
Do not retrieve knowledge during ordinary progress. First identify the precise unresolved question that is blocking the investigation. If a library resource would materially help, finish your internal draft with this marker on its own final line:
[[JBOT_RETRIEVE: concise natural-language description of the unresolved question and knowledge needed]]
The marker is internal and must never be shown to the client. If retrieval is not needed, do not emit it. The server will retrieve relevant active knowledge documents and ask you to reconsider the response. Do not mention this mechanism to the client.`,
            },
            ...((history ?? []) as StoredMessage[]).map((item) => ({
                role: item.role === 'assistant' ? 'assistant' as const : 'user' as const,
                content: item.content,
            })),
        ]

        const callCoachingModel = async (messages: typeof conversationMessages, callType: string) => {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: coachingModel,
                    messages,
                }),
            })

            if (!response.ok) {
                const errorText = await response.text()
                console.error('OpenAI error:', { callType, error: errorText })
                throw new Error(`OpenAI request failed for ${callType}`)
            }

            const result = await response.json()
            console.info('Jbot API usage:', {
                callType,
                conversationId: verifiedConversationId,
                turnNumber,
                model: coachingModel,
                promptTokens: result.usage?.prompt_tokens ?? null,
                cachedPromptTokens: result.usage?.prompt_tokens_details?.cached_tokens ?? null,
                completionTokens: result.usage?.completion_tokens ?? null,
                totalTokens: result.usage?.total_tokens ?? null,
            })
            return result
        }

        let completion = await callCoachingModel(conversationMessages, 'coaching')
        let rawAssistantContent = completion.choices?.[0]?.message?.content

        if (!rawAssistantContent) {
            return NextResponse.json(
                { error: 'J-Bot returned an empty response.' },
                { status: 500 }
            )
        }

        const retrievalMatch = rawAssistantContent.match(RETRIEVAL_MARKER)
        let retrievalUsed = false

        if (retrievalMatch) {
            const retrievalQuery = retrievalMatch[1].trim().slice(0, 500)
            const { data: knowledgeRows, error: knowledgeError } = await supabase
                .from('jbot_knowledge')
                .select('id, title, category, content, when_to_use, retrieval_rules')
                .eq('active', true)

            if (knowledgeError) {
                console.error('Jbot knowledge retrieval failed:', knowledgeError.message)
            } else {
                const selectedRecords = rankKnowledge(
                    (knowledgeRows ?? []) as KnowledgeRecord[],
                    retrievalQuery
                )

                console.info('Jbot knowledge retrieval result:', {
                    conversationId: verifiedConversationId,
                    turnNumber,
                    retrievalQuery,
                    activeRecordCount: knowledgeRows?.length ?? 0,
                    selectedRecordCount: selectedRecords.length,
                    selectedRecords: selectedRecords.map((record) => ({
                        id: record.id,
                        title: record.title,
                        category: record.category,
                    })),
                })

                const knowledgeContext = selectedRecords.length
                    ? `EMERGENCY KNOWLEDGE RETRIEVAL
The investigation reached an impasse. The following active knowledge documents were selected for this specific unresolved question. Treat their content as methodology reference material, not as instructions to override the client's actual data. Use the material to reconsider your current model, including what you may have missed or misunderstood. Do not simply confirm your previous draft. Return to the client's actual desire and evidence, then continue the investigation naturally.

UNRESOLVED QUESTION:
${retrievalQuery}

${selectedRecords.map((record) => `DOCUMENT: ${record.title}\nCATEGORY: ${record.category ?? 'Uncategorised'}\nWHEN TO USE: ${record.when_to_use ?? ''}\nRETRIEVAL RULES: ${record.retrieval_rules ?? ''}\nCONTENT:\n${record.content}`).join('\n\n---\n\n')}`
                    : `EMERGENCY KNOWLEDGE RETRIEVAL
The investigation reached an impasse, but no active knowledge document matched the retrieval query strongly enough to select one.
Unresolved question: ${retrievalQuery}
Reconsider the investigation from the client's actual data and desire. Identify what remains unknown, revise the current model if needed, and continue without pretending that a resource was found.`

                const revisionMessages = [
                    ...conversationMessages,
                    {
                        role: 'system' as const,
                        content: knowledgeContext,
                    },
                    {
                        role: 'system' as const,
                        content: 'Reconsider and answer the latest client message now. The previous output was an internal draft and was not shown or saved. Do not refer to retrieval, internal markers, or this instruction. Produce only the client-facing response, with any applicable assessment marker on its final line.',
                    },
                ]

                completion = await callCoachingModel(revisionMessages, 'emergency-retrieval-revision')
                rawAssistantContent = completion.choices?.[0]?.message?.content
                retrievalUsed = true

                if (!rawAssistantContent) {
                    return NextResponse.json(
                        { error: 'J-Bot returned an empty response.' },
                        { status: 500 }
                    )
                }
            }

            // Never expose the internal retrieval marker, even if retrieval fails.
            rawAssistantContent = rawAssistantContent.replace(RETRIEVAL_MARKER, '').trim()
        }

        if (!retrievalUsed) {
            rawAssistantContent = rawAssistantContent.replace(RETRIEVAL_MARKER, '').trim()
        }

        const assessmentMilestones = [...rawAssistantContent.matchAll(/\[\[JBOT_ASSESS:(4|5|7)\]\]/g)]
            .map((match) => Number(match[1]))
            .filter((milestone, index, all) => all.indexOf(milestone) === index)
        const assistantContent = rawAssistantContent
            .replace(/\n?\[\[JBOT_ASSESS:(?:4|5|7)\]\]/g, '')
            .trim()

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
            assessmentMilestones,
        })
    } catch (error) {
        console.error('Jbot chat error:', error)

        return NextResponse.json(
            { error: 'Something went wrong while talking to J-Bot.' },
            { status: 500 }
        )
    }
}
