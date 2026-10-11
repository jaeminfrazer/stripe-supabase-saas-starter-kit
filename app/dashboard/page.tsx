import Link from 'next/link'

import JourneyProgress from '@/components/journey-progress'
import ResourceCompletion from '@/components/resource-completion'
import { createClient } from '@/utils/supabase/server'

export default async function DashboardPage() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const firstName =
        user?.user_metadata?.name?.split(' ')[0] ||
        user?.user_metadata?.full_name?.split(' ')[0] ||
        'there'

    const [{ data: intake }, { data: assessment }, { data: resources }, { data: resourceProgress }] = user
        ? await Promise.all([
            supabase.from('jbot_onboarding_data').select('tell_me_about_you,hindrances,personality,pain_points,goals,what_have_you_tried,history').eq('user_id', user.id).maybeSingle(),
            supabase.from('jbot_stage_assessments').select('status,assessment').eq('user_id', user.id).eq('milestone_number', 4).maybeSingle(),
            supabase.from('jbot_resources').select('id,title,description,category,tags').order('created_at', { ascending: true }),
            supabase.from('user_resource_progress').select('resource_id').eq('user_id', user.id),
        ])
        : [{ data: null }, { data: null }, { data: [] }, { data: [] }]

    const intakeFields = ['tell_me_about_you', 'hindrances', 'personality', 'pain_points', 'goals', 'what_have_you_tried', 'history'] as const
    const onboardingComplete = Boolean(intake && intakeFields.every(field => typeof intake[field] === 'string' && intake[field].trim().length > 0))
    const assessmentSummary = assessment?.assessment && typeof assessment.assessment === 'object'
        ? (assessment.assessment as { client_facing_summary?: string }).client_facing_summary
        : undefined

    return (
        <main className="min-h-screen bg-muted/30 px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl space-y-8">
                <section>
                    <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">The Unhindered Experience</p>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Welcome, {firstName}.</h1>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                        Six months to understand what has been getting in your way, dissolve the structures that keep you stuck, and create more of what you actually want.
                    </p>
                </section>

                <section className="rounded-xl border border-dashed bg-background p-5 sm:p-6">
                    <div className="flex items-center gap-2">
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">In development</span>
                        <h2 className="text-lg font-semibold">Jbot journey assessment</h2>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        We’re building Jbot’s ability to recognise and assess genuine progress through each stage — not simply whether you’ve completed the resources. The first prototype is learning to test the original accusation against your language, behaviour and the evidence of the defining moment. This capability is still being developed and validated. Completing a resource does not, by itself, mean a milestone is resolved.
                    </p>
                </section>

                <JourneyProgress onboardingComplete={onboardingComplete} assessmentStatus={assessment?.status ?? 'pending'} />

                <section className="rounded-xl border bg-background p-6 shadow-sm sm:p-8">
                    <h2 className="text-xl font-semibold">Resources you’ve completed</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Tick off resources as you finish them. This is a record of participation, separate from milestone assessment.</p>
                    <div className="mt-5">
                        <ResourceCompletion
                            resources={(resources ?? []) as { id: string; title: string; category: string | null; description: string | null; tags: string[] | null }[]}
                            completedIds={(resourceProgress ?? []).map(item => item.resource_id)}
                        />
                    </div>
                </section>

                <div className="grid gap-6 md:grid-cols-2">
                    <section className="rounded-xl border bg-background p-6 shadow-sm sm:p-8">
                        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Continue</p>
                        <h2 className="mt-2 text-xl font-semibold">Work with Jbot</h2>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">Continue exploring whatever is currently alive, difficult or interesting for you.</p>
                        <Link href="/chat" className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">Continue with Jbot</Link>
                    </section>
                    <section className="rounded-xl border bg-background p-6 shadow-sm sm:p-8">
                        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">This Week</p>
                        <h2 className="mt-2 text-xl font-semibold">Group Coaching</h2>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">Join the weekly group coaching call and bring whatever you are working through.</p>
                        <button type="button" className="mt-6 inline-flex h-10 items-center justify-center rounded-md border bg-background px-5 text-sm font-medium shadow-sm transition-colors hover:bg-muted">Book your place</button>
                    </section>
                    <section className="rounded-xl border bg-background p-6 shadow-sm sm:p-8">
                        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Resources</p>
                        <h2 className="mt-2 text-xl font-semibold">Explore the Library</h2>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">Things to watch, read, listen to and do when a particular idea or distinction would expand your map.</p>
                        <Link href="/resources" className="mt-6 inline-flex h-10 items-center justify-center rounded-md border bg-background px-5 text-sm font-medium shadow-sm transition-colors hover:bg-muted">Explore resources</Link>
                    </section>
                    <section className="rounded-xl border bg-background p-6 shadow-sm sm:p-8">
                        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Private Access</p>
                        <h2 className="mt-2 text-xl font-semibold">Book a session with Jaemin</h2>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">Sometimes you want to take something further, privately.</p>
                        <button type="button" className="mt-6 inline-flex h-10 items-center justify-center rounded-md border bg-background px-5 text-sm font-medium shadow-sm transition-colors hover:bg-muted">Book a 1:1</button>
                    </section>
                </div>
            </div>
        </main>
    )
}
