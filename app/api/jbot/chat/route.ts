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

type KnowledgeRecord = {
    id: string
    title: string
    category: string | null
    content: string
    when_to_use: string | null
    retrieval_rules: string | null
}

type KnowledgeMetadata = Pick<
    KnowledgeRecord,
    'id' | 'title' | 'category' | 'when_to_use' | 'retrieval_rules'
>

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

async function selectKnowledgeRecords(
    content: string,
    history: StoredMessage[],
    records: KnowledgeMetadata[]
): Promise<string[]> {
    if (!records.length) return []

    const recentHistory = history.slice(-8).map((item) => ({
        role: item.role,
        content: item.content.slice(0, 1500),
    }))

    try {
        const response = await fetch(
            'https://api.openai.com/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                    response_format: { type: 'json_object' },
                    messages: [
                        {
                            role: 'system',
                            content: `You select internal coaching knowledge for J-Bot. Choose only records that would materially help J-Bot respond to the user's latest message in the context of the recent conversation. Use the record descriptions and retrieval rules, not keyword matching alone. Choose zero to three records; prefer fewer when sufficient. Do not choose a record just because it might be generally relevant. Return only valid JSON in this shape: {"ids":["record-id"]}. Use only exact IDs from the supplied list. If no record would materially help, return {"ids":[]}.`,
                        },
                        {
                            role: 'user',
                            content: JSON.stringify({
                                latest_user_message: content,
                                recent_conversation: recentHistory,
                                available_knowledge: records,
                            }),
                        },
                    ],
                }),
            }
        )

        if (!response.ok) {
            console.error('Jbot knowledge selection failed:', await response.text())
            return []
        }

        const result = await response.json()
        const raw = result.choices?.[0]?.message?.content
        if (typeof raw !== 'string') return []

        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed.ids)) return []

        const allowedIds = new Set(records.map((record) => record.id))
        const validIds = parsed.ids.filter(
            (id: unknown): id is string =>
                typeof id === 'string' && allowedIds.has(id)
        )
        const uniqueIds: string[] = []
        for (const id of validIds) {
            if (!uniqueIds.includes(id)) uniqueIds.push(id)
            if (uniqueIds.length === 3) break
        }
        return uniqueIds
    } catch (error) {
        // Knowledge retrieval must not make an otherwise working chat unavailable.
        console.error('Jbot knowledge selection error:', error)
        return []
    }
}

function buildKnowledgeContext(records: KnowledgeRecord[]) {
    if (!records.length) return ''

    return `INTERNAL COACHING KNOWLEDGE

The following records were selected because they may be relevant to this turn. Use them as specialised reference material, following their retrieval rules. Apply the relevant ideas to the user's actual experience; do not recite the records or mention this internal retrieval process. Do not force a framework when it does not fit.

${records.map((record) => `
---
TITLE: ${record.title}
CATEGORY: ${record.category ?? 'Uncategorised'}
WHEN TO USE: ${record.when_to_use ?? 'Not specified'}
RETRIEVAL RULES: ${record.retrieval_rules ?? 'Not specified'}
CONTENT:
${record.content}
---`).join('\n')}
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

        // Load lightweight metadata first, then let OpenAI choose the records
        // that are relevant to this turn. Full record contents are fetched only
        // for the selected IDs.
        const { data: knowledgeMetadata, error: knowledgeMetadataError } =
            await supabase
                .from('jbot_knowledge')
                .select('id, title, category, when_to_use, retrieval_rules')
                .eq('active', true)

        let selectedKnowledge: KnowledgeRecord[] = []

        if (knowledgeMetadataError) {
            // Keep chat available if the optional knowledge library is unavailable.
            console.error('Unable to load Jbot knowledge metadata:', knowledgeMetadataError)
        } else {
            const selectedIds = await selectKnowledgeRecords(
                content,
                (history ?? []) as StoredMessage[],
                (knowledgeMetadata ?? []) as KnowledgeMetadata[]
            )

            if (selectedIds.length) {
                const { data: knowledgeRecords, error: knowledgeRecordsError } =
                    await supabase
                        .from('jbot_knowledge')
                        .select('id, title, category, content, when_to_use, retrieval_rules')
                        .eq('active', true)
                        .in('id', selectedIds)

                if (knowledgeRecordsError) {
                    console.error('Unable to load selected Jbot knowledge:', knowledgeRecordsError)
                } else {
                    selectedKnowledge = (knowledgeRecords ?? []) as KnowledgeRecord[]
                }
            }
        }

        // Diagnostic only: log selected record metadata, never user messages or record content.
        console.info('Jbot knowledge retrieval result:', {
            activeRecordCount: knowledgeMetadata?.length ?? 0,
            selectedRecordCount: selectedKnowledge.length,
            selectedRecords: selectedKnowledge.map((record) => ({
                id: record.id,
                title: record.title,
                category: record.category,
            })),
        })

        const intakeContext = buildIntakeContext(intake as IntakeData)
        const knowledgeContext = buildKnowledgeContext(selectedKnowledge)

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
                            content: "DEFINING-MOMENT METHOD — AUTHORITATIVE OPERATING INSTRUCTIONS\n\nThis method depends on discovering the single exact defining moment that the person's insecurity system was built around. Do not treat the defining moment as optional, merely one possible explanation, or something to abandon because the client initially says they cannot remember. The moment is always there and is discoverable; the existing system is organised around the conclusion formed there. Resistance, vagueness or missing recall is to be understood within this model as strategic protection around a conclusion that feels dangerous to revisit. Do not shame the client or announce that you know a specific hidden event before the evidence emerges; persist in the inquiry rather than converting uncertainty into a conclusion or giving up the search.\n\nTHE SETUP, NOT THE TRAGEDY\nThe child begins relaxed, at ease and operating from an untroubled sense of enoughness and safety. Then the child encounters a surprising, potentially shocking and embarrassing collision with the adult world: showing up naturally or at ease is punished, scolded, hurt, exposed, excluded, rejected or otherwise met in a way the child was not prepared for. The child is unequivocally ill-equipped for the adult world and lacks the objective, nuanced emotional intelligence needed to interpret the event in context. As a sense-making creature, the child urgently tries to answer: (a) Why did this happen? (b) What does this mean about me? The child implicates their own nature in the event and concludes there is a clear inadequacy or something fundamentally wrong with them. This is the setup for the system, not the tragedy itself. The event may be objectively minor or horrific; do not confuse objective severity with the meaning made by the child.\n\nTHE SEARCH SEQUENCE\nKeep these distinct and investigate them in order:\n1. THE EXACT SCENE: what happened, where, who was present, what was said or done, and what the child was doing immediately before the collision. Seek one specific moment in time, not a broad period or a generic pattern.\n2. SURPRISE / SHOCK: what made the event painfully unexpected? What did the child assume would happen instead? What map of the world was contradicted?\n3. EMBARRASSMENT / EXPOSURE: how did the child become aware of being seen, judged, scolded, excluded, rejected, hurt or exposed? What made the moment personally disorienting?\n4. THE TWO SENSE-MAKING QUESTIONS: why did this happen, and what does it mean about me?\n5. THE SELF-IMPLICATING CONCLUSION: what did the child decide this revealed about their nature? Connect that conclusion to the already-identified accusation.\n6. SYSTEMATIC CONFIRMATION: test whether the person's current strategies, behaviours, fears, permissions and recurring patterns make sense as a system built to prevent the original conclusion from being exposed or confirmed. Use this evidence to guide the search and test the proposed scene; do not use it to fabricate scene details.\n\nDo not keep asking the client to explain an accusation they have already clearly named. Once the accusation is known, move the inquiry upstream to the scene and the child's meaning-making. Do not substitute a discussion of present-day wants or behaviour management for the defining-moment investigation. Present-day examples can illuminate the system, but they do not replace the exact childhood scene.\n\nTHE REVIEW IS SAFE BECAUSE THE CONCLUSION IS FICTION, NOT BECAUSE THE EVENT WAS HARMLESS\nThe review does not minimise, excuse or reframe the event as beneficial. Even in horrific trauma or abuse, the inquiry is into what the frightened, shocked, embarrassed and ill-equipped child concluded the event meant about their own nature. The event is not being declared harmless; the child's unreviewed interpretation and self-accusation are what must be examined with adult objectivity. The conclusion felt like a discovery of terrible truth, which is precisely why the system protects against looking directly at the moment. Help the client review it as a meaning-making process, not relive it as proof that the accusation was correct.\n\nMETHOD DISCIPLINE\nInsist on finding the single specific scene. Do not settle for a broad childhood theme, a list of possible events or an intellectual explanation. Ask concrete, narrowing questions one at a time. Do not invent or implant details, supply a memory, or treat a hypothesis as a reported fact. If recall is vague or blocked, regard that as strategic protection in this model and continue patiently from known fragments, current system patterns and the client's own associations until the scene becomes clearer. Clearly distinguish what the client reports from what is inferred, and do not claim a scene is established until the client recognises the specific event. Do not repeatedly make the client restate the accusation; use it as the hypothesis the defining-moment search must explain.",
                        },
                        {
                            role: 'system',
                            content: intakeContext,
                        },
                        ...(knowledgeContext
                            ? [{ role: 'system', content: knowledgeContext }]
                            : []),
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
