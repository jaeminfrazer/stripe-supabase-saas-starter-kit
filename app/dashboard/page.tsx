import Link from 'next/link'

import { createClient } from '@/utils/supabase/server'

export default async function DashboardPage() {
    const supabase = createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const firstName =
        user?.user_metadata?.name?.split(' ')[0] ||
        user?.user_metadata?.full_name?.split(' ')[0] ||
        'there'

    return (
        <main className="min-h-screen bg-muted/30 px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl space-y-8">

                {/* Header */}
                <section>
                    <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                        The Unhindered Experience
                    </p>

                    <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                        Welcome, {firstName}.
                    </h1>

                    <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                        Six months to understand what has been getting in your
                        way, dissolve the structures that keep you stuck, and
                        create more of what you actually want.
                    </p>
                </section>

                {/* Journey */}
                <section className="rounded-xl border bg-background p-6 shadow-sm sm:p-8">
                    <div className="mb-6">
                        <h2 className="text-xl font-semibold">
                            Your Journey
                        </h2>

                        <p className="mt-1 text-sm text-muted-foreground">
                            Your progress through The Unhindered Experience.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
                                ✓
                            </div>

                            <div>
                                <p className="font-medium">Intake</p>
                                <p className="text-sm text-muted-foreground">
                                    Complete
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-background text-sm">
                                →
                            </div>

                            <div>
                                <p className="font-medium">
                                    What do I actually want?
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Your current focus
                                </p>
                            </div>
                        </div>

                        {[
                            'Self-Trust',
                            'Neediness',
                            'Gameplay',
                            'Avatar',
                            'Self-Permission',
                        ].map((stage) => (
                            <div
                                key={stage}
                                className="flex items-center gap-4"
                            >
                                <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-background text-sm text-muted-foreground">
                                    ○
                                </div>

                                <p className="text-sm text-muted-foreground">
                                    {stage}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Main actions */}
                <div className="grid gap-6 md:grid-cols-2">

                    {/* Continue with Jbot */}
                    <section className="rounded-xl border bg-background p-6 shadow-sm sm:p-8">
                        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                            Continue
                        </p>

                        <h2 className="mt-2 text-xl font-semibold">
                            Work with Jbot
                        </h2>

                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                            Continue exploring whatever is currently alive,
                            difficult or interesting for you.
                        </p>

                        <Link
                            href="/chat"
                            className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
                        >
                            Continue with Jbot
                        </Link>
                    </section>

                    {/* Group coaching */}
                    <section className="rounded-xl border bg-background p-6 shadow-sm sm:p-8">
                        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                            This Week
                        </p>

                        <h2 className="mt-2 text-xl font-semibold">
                            Group Coaching
                        </h2>

                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                            Join the weekly group coaching call and bring
                            whatever you are working through.
                        </p>

                        <button
                            type="button"
                            className="mt-6 inline-flex h-10 items-center justify-center rounded-md border bg-background px-5 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
                        >
                            Book your place
                        </button>
                    </section>

                    {/* Resources */}
                    <section className="rounded-xl border bg-background p-6 shadow-sm sm:p-8">
                        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                            Resources
                        </p>

                        <h2 className="mt-2 text-xl font-semibold">
                            Explore the Library
                        </h2>

                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                            Things to watch, read, listen to and do when a
                            particular idea or distinction would expand your
                            map.
                        </p>

                        <Link
                            href="/resources"
                            className="mt-6 inline-flex h-10 items-center justify-center rounded-md border bg-background px-5 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
                        >
                            Explore resources
                        </Link>
                    </section>

                    {/* Private access */}
                    <section className="rounded-xl border bg-background p-6 shadow-sm sm:p-8">
                        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                            Private Access
                        </p>

                        <h2 className="mt-2 text-xl font-semibold">
                            Book a session with Jaemin
                        </h2>

                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                            Sometimes you want to take something further,
                            privately.
                        </p>

                        <button
                            type="button"
                            className="mt-6 inline-flex h-10 items-center justify-center rounded-md border bg-background px-5 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
                        >
                            Book a 1:1
                        </button>
                    </section>
                </div>
            </div>
        </main>
    )
}
