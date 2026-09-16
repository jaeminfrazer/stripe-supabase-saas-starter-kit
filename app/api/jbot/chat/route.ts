import { NextResponse } from 'next/server'

import { createClient } from '@/utils/supabase/server'

type StoredMessage = {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    created_at: string
}

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

        const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: promptRecord.prompt },
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
