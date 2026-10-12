import { redirect } from 'next/navigation'
import Link from 'next/link'

import JbotChat from '@/components/JbotChat'
import { createClient } from '@/utils/supabase/server'

type ChatMessage = {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    created_at: string
}

export default async function ChatPage() {
    const supabase = createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
        redirect('/login')
    }

    const { data: intake, error: intakeError } = await supabase
        .from('jbot_onboarding_data')
        .select('tell_me_about_you,hindrances,personality,pain_points,goals,what_have_you_tried,history')
        .eq('user_id', user.id)
        .maybeSingle()

    if (intakeError) {
        throw new Error('Unable to load your intake status.')
    }

    const intakeFields = ['tell_me_about_you', 'hindrances', 'personality', 'pain_points', 'goals', 'what_have_you_tried', 'history'] as const
    const intakeComplete = Boolean(intake && intakeFields.every(field => typeof intake[field] === 'string' && intake[field].trim().length > 0))

    const { data: journey, error: journeyError } = await supabase
        .from('jbot_coaching_journey')
        .select('first_coaching_experience,coaching_journey')
        .eq('user_id', user.id)
        .maybeSingle()

    if (journeyError) {
        throw new Error('Unable to load your coaching history.')
    }

    const journeyComplete = Boolean(journey && (journey.first_coaching_experience || journey.coaching_journey?.trim()))
    if (!intakeComplete || !journeyComplete) {
        redirect('/intake')
    }

    const { data: existingConversation, error: conversationError } = await supabase
        .from('jbot_conversations')
        .select('id')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (conversationError) {
        throw new Error('Unable to load your Jbot conversation.')
    }

    let conversationId = existingConversation?.id as string | undefined

    if (!conversationId) {
        const { data: newConversation, error: createError } = await supabase
            .from('jbot_conversations')
            .insert({ user_id: user.id })
            .select('id')
            .single()

        if (createError || !newConversation) {
            throw new Error('Unable to create your Jbot conversation.')
        }

        conversationId = newConversation.id
    }

    if (!conversationId) {
        throw new Error('Unable to determine your Jbot conversation.')
    }

    const { data: messages, error: messagesError } = await supabase
        .from('jbot_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

    if (messagesError) {
        throw new Error('Unable to load your Jbot messages.')
    }

    return (
        <main className="min-h-screen bg-[#f4f2ee] px-4 py-8 text-[#111111] sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-5xl flex-col">
                <header className="mb-6 flex flex-col justify-between gap-5 border-b border-black/10 pb-6 sm:flex-row sm:items-end">
                    <div>
                        <Link href="/dashboard" className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500 hover:text-black">Jbot · Your journey</Link>
                        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Jbot<span className="text-neutral-400">.</span></h1>
                        <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600">AI trained to understand the precise structure of personal insecurity and human aliveness.</p>
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">Jaemin Frazer · The Insecurity Project</p>
                </header>
                <JbotChat
                    conversationId={conversationId}
                    initialMessages={(messages ?? []) as ChatMessage[]}
                />
            </div>
        </main>
    )
}
