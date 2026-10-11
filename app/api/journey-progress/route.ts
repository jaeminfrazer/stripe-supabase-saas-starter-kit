import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { hasJbotAccess } from '@/utils/access/has-jbot-access'

export async function POST(request: Request) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
    if (!(await hasJbotAccess(user.id, user.email ?? ''))) {
        return NextResponse.json({ error: 'Your J-Bot access has expired. Please renew your subscription or contact us for help.' }, { status: 403 })
    }

    let body: { milestoneNumber?: number }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const milestoneNumber = body.milestoneNumber
    if (!Number.isInteger(milestoneNumber) || milestoneNumber! < 1 || milestoneNumber! > 12) {
        return NextResponse.json({ error: 'Invalid milestone number' }, { status: 400 })
    }

    const { error } = await supabase
        .from('user_journey_progress')
        .upsert({
            user_id: user.id,
            milestone_number: milestoneNumber,
            completed_at: new Date().toISOString(),
        }, { onConflict: 'user_id,milestone_number' })

    if (error) {
        console.error('Could not save journey progress:', error.message)
        return NextResponse.json({ error: 'Could not save progress' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
    if (!(await hasJbotAccess(user.id, user.email ?? ''))) {
        return NextResponse.json({ error: 'Your J-Bot access has expired. Please renew your subscription or contact us for help.' }, { status: 403 })
    }

    let body: { milestoneNumber?: number }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const milestoneNumber = body.milestoneNumber
    if (!Number.isInteger(milestoneNumber) || milestoneNumber! < 1 || milestoneNumber! > 12) {
        return NextResponse.json({ error: 'Invalid milestone number' }, { status: 400 })
    }

    const { error } = await supabase
        .from('user_journey_progress')
        .delete()
        .eq('user_id', user.id)
        .eq('milestone_number', milestoneNumber)

    if (error) {
        console.error('Could not update journey progress:', error.message)
        return NextResponse.json({ error: 'Could not update progress' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
