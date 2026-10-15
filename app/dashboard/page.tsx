import Link from 'next/link'
import Image from 'next/image'
import JourneyProgress from '@/components/journey-progress'
import { createClient } from '@/utils/supabase/server'

export default async function DashboardPage() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const firstName =
        user?.user_metadata?.name?.split(' ')[0] ||
        user?.user_metadata?.full_name?.split(' ')[0] ||
        'there'

    const [{ data: intake }, { data: assessments }] = user
        ? await Promise.all([
            supabase.from('jbot_onboarding_data').select('tell_me_about_you,hindrances,personality,pain_points,goals,what_have_you_tried,history').eq('user_id', user.id).maybeSingle(),
            supabase.from('jbot_stage_assessments').select('milestone_number,status,assessment').eq('user_id', user.id).in('milestone_number', [4, 5, 7]),
        ])
        : [{ data: null }, { data: [] }]

    const intakeFields = ['tell_me_about_you', 'hindrances', 'personality', 'pain_points', 'goals', 'what_have_you_tried', 'history'] as const
    const onboardingComplete = Boolean(intake && intakeFields.every(field => typeof intake[field] === 'string' && intake[field].trim().length > 0))
    const { data: coachingJourney } = user
        ? await supabase.from('jbot_coaching_journey').select('first_coaching_experience,coaching_journey').eq('user_id', user.id).maybeSingle()
        : { data: null }
    const coachingJourneyComplete = Boolean(coachingJourney && (coachingJourney.first_coaching_experience || coachingJourney.coaching_journey?.trim()))
    if (user && (!onboardingComplete || !coachingJourneyComplete)) {
        const { redirect } = await import('next/navigation')
        redirect('/intake')
    }
    const assessmentStatuses: Record<number, string> = Object.fromEntries((assessments ?? []).map(item => [item.milestone_number, item.status as string]))

    return (
        <main className="min-h-screen bg-[#f4f2ee] px-4 py-10 text-[#111111] sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl space-y-10">
                <section className="relative overflow-hidden bg-[#111111] px-7 py-10 text-white sm:px-10 sm:py-14 lg:px-14">
                    <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full border border-white/10" />
                    <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 h-48 w-48 rounded-full border border-white/10" />
                    <Image src="/31-Jaemin_Frazer-44.jpg" alt="Jaemin Frazer" width={420} height={560} className="absolute right-0 top-0 hidden h-full max-h-[420px] w-auto object-cover object-top opacity-80 lg:block" />
                    <div className="relative max-w-3xl lg:max-w-[58%]">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/50">The Insecurity Project · A personal experience with Jbot</p>
                        <h1 className="mt-8 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">Welcome, {firstName}.</h1>
                        <p className="mt-6 max-w-2xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">AI trained to understand the precise structure of personal insecurity and human aliveness.</p>
                        <Link href={onboardingComplete && coachingJourneyComplete ? "/chat" : "/intake"} className="mt-8 inline-flex h-12 items-center bg-white px-6 text-sm font-semibold text-black transition hover:bg-neutral-200">{onboardingComplete && coachingJourneyComplete ? "Start a conversation" : "Complete your intake"} <span aria-hidden="true" className="ml-3">↗</span></Link>
                        <p className="mt-8 text-[10px] font-medium uppercase tracking-[0.24em] text-white/40">Created by Jaemin Frazer</p>
                    </div>
                </section>

                <section className="border-b border-black/10 pb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">Your workspace</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">Your journey</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">A record of the work you’re doing, the resources you’ve explored, and the evidence of change that emerges along the way.</p>
                </section>

                <section className="rounded-sm border border-black/10 bg-white p-5 sm:p-7">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Under active development</p>
                            <h2 className="mt-2 text-lg font-semibold">Jbot journey assessment</h2>
                        </div>
                        <span className="w-fit border border-black/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Beta feature</span>
                    </div>
                    <p className="mt-3 max-w-4xl text-sm leading-6 text-neutral-600">We’re building Jbot’s ability to recognise and assess genuine progress through each stage — not simply whether you’ve completed the resources. Jbot assesses selected milestones at natural points in the conversation, testing evidence rather than counting messages or completed resources. These assessments are provisional and can change when new evidence emerges. Completing a resource does not, by itself, mean a milestone is resolved.</p>
                </section>

                <JourneyProgress onboardingComplete={onboardingComplete} assessmentStatuses={assessmentStatuses} />

                <section className="flex flex-col gap-5 border border-black/10 bg-white p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Your library</p>
                        <h2 className="mt-2 text-xl font-semibold tracking-tight">Explore your resources</h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">Browse videos, readings, audio and practical exercises in one place. Open a resource to view it or access its file.</p>
                    </div>
                    <Link href="/resources" className="inline-flex h-11 shrink-0 items-center bg-black px-5 text-sm font-medium text-white transition hover:bg-neutral-800">Open resource library ↗</Link>
                </section>

                <div className="grid gap-4 md:grid-cols-2">
                    <section className="border border-black/10 bg-white p-6 sm:p-8">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Continue</p>
                        <h2 className="mt-3 text-xl font-semibold">Work with Jbot</h2>
                        <p className="mt-3 text-sm leading-6 text-neutral-600">Bring a real situation, question or pattern you want to understand more clearly.</p>
                        <Link href={onboardingComplete && coachingJourneyComplete ? "/chat" : "/intake"} className="mt-6 inline-flex h-11 items-center bg-black px-5 text-sm font-medium text-white transition hover:bg-neutral-800">{onboardingComplete && coachingJourneyComplete ? "Continue with Jbot ↗" : "Complete your intake ↗"}</Link>
                    </section>
                    <section className="border border-black/10 bg-white p-6 sm:p-8">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Work with Jaemin</p>
                        <h2 className="mt-3 text-xl font-semibold">Book a private call with Jaemin</h2>
                        <p className="mt-3 text-sm leading-6 text-neutral-600">Book a one-to-one session to explore what you’re working through in a personal conversation.</p>
                        <a href="https://calendly.com/jaeminfrazer/personal-coaching-session" target="_blank" rel="noreferrer" className="mt-6 inline-flex h-11 items-center border border-black/20 px-5 text-sm font-medium transition hover:bg-neutral-100">Book a private call ↗</a>
                    </section>
                    <section className="border border-black/10 bg-white p-6 sm:p-8 md:col-span-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">This week</p>
                        <h2 className="mt-3 text-xl font-semibold">Group coaching</h2>
                        <p className="mt-3 text-sm leading-6 text-neutral-600">Join the weekly group coaching call and bring whatever you are working through.</p>
                        <button type="button" className="mt-6 inline-flex h-11 items-center border border-black/20 px-5 text-sm font-medium transition hover:bg-neutral-100">Book your place</button>
                    </section>
                    <section className="border border-black/10 bg-white p-6 sm:p-8">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Explore</p>
                        <h2 className="mt-3 text-xl font-semibold">The resource library</h2>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">Things to watch, read, listen to and do when a particular idea or distinction would expand your map.</p>
                        <Link href="/resources" className="mt-6 inline-flex h-11 items-center border border-black/20 px-5 text-sm font-medium transition hover:bg-neutral-100">Explore resources ↗</Link>
                    </section>
                </div>
                <footer className="border-t border-black/10 pt-6 text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-400">Jbot · By Jaemin Frazer · The Insecurity Project</footer>
            </div>
        </main>
    )
}
