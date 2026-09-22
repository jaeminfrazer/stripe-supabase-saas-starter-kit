import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

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

        if (!conversationId) {
            return NextResponse.json(
                { error: 'A conversation is required.' },
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

        return NextResponse.json({
            debug: true,
            userId: verifiedUserId,
            conversationId: verifiedConversationId,
            onboardingStatus: onboarding?.status ?? null,
            currentStage: onboarding?.current_stage ?? null,
            onboardingActive,
            promptMode: onboardingActive ? 'ONBOARDING' : 'MASTER',
        })
    } catch (error) {
        console.error('Jbot diagnostic error:', error)

        return NextResponse.json(
            { error: 'Diagnostic request failed.' },
            { status: 500 }
        )
    }
}
