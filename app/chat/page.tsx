import { redirect } from 'next/navigation'

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

    // Get or create the user's onboarding record.
    const { data: onboarding, error: onboardingError } = await supabase
        .from('jbot_onboarding')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle()

    if (onboardingError) {
        throw new Error('Unable to load your Jbot onboarding status.')
    }

    if (!onboarding) {
        const { error: createOnboardingError } = await supabase
            .from('jbot_onboarding')
            .insert({
                user_id: user.id,
                status: 'not_started',
            })

        if (createOnboardingError) {
            throw new Error('Unable to create your Jbot onboarding record.')
        }
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
        <main className="min-h-screen bg-muted/30 px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-4xl flex-col">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold tracking-tight">Jbot</h1>
                    <p className="mt-2 text-muted-foreground">Your personal coaching assistant.</p>
                </div>
                <JbotChat
                    conversationId={conversationId}
                    initialMessages={(messages ?? []) as ChatMessage[]}
                />
            </div>
        </main>
    )
}
