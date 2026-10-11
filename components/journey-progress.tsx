'use client'

import { useState } from 'react'

const milestones = [
    'Introducing yourself to Jbot',
    'See the game',
    'See the structure of insecurity',
    'Identify the accusation',
    'Discover the defining moment',
    "Understand the system's purpose",
    'Well-formed outcomes',
    'Become ready',
    'See beyond the category',
    'Reclaim sovereignty',
    'Restore full trust and permission',
    'Live in aliveness and play',
]

type JourneyProgressProps = {
    completedMilestones: number[]
}

export default function JourneyProgress({
    completedMilestones,
}: JourneyProgressProps) {
    const [completed, setCompleted] = useState<number[]>(completedMilestones)
    const [saving, setSaving] = useState<number | null>(null)
    const [error, setError] = useState('')

    async function toggleMilestone(number: number) {
        const wasCompleted = completed.includes(number)
        setSaving(number)
        setError('')

        try {
            const response = await fetch('/api/journey-progress', {
                method: wasCompleted ? 'DELETE' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ milestoneNumber: number }),
            })

            if (!response.ok) {
                throw new Error('Progress could not be saved. Please try again.')
            }

            setCompleted((current) =>
                wasCompleted
                    ? current.filter((item) => item !== number)
                    : [...current, number].sort((a, b) => a - b)
            )
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Progress could not be saved.')
        } finally {
            setSaving(null)
        }
    }

    const count = completed.length
    const current = milestones.findIndex((_, index) => !completed.includes(index + 1))

    return (
        <section className="rounded-xl border bg-background p-6 shadow-sm sm:p-8">
            <div className="mb-6">
                <h2 className="text-xl font-semibold">Your Journey</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Your progress through The Unhindered Experience.
                </p>
                <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium">Progress</span>
                        <span className="text-muted-foreground">{count} of {milestones.length} complete</span>
                    </div>
                    <div
                        className="h-2 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-label="Journey completion"
                        aria-valuemin={0}
                        aria-valuemax={milestones.length}
                        aria-valuenow={count}
                    >
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(count / milestones.length) * 100}%` }} />
                    </div>
                </div>
            </div>

            <ol className="space-y-3">
                {milestones.map((milestone, index) => {
                    const number = index + 1
                    const isComplete = completed.includes(number)
                    const isCurrent = !isComplete && number === current + 1
                    return (
                        <li key={milestone} className="flex items-center gap-3 rounded-lg border border-transparent p-2 sm:gap-4">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm ${isComplete ? 'border-primary bg-primary text-primary-foreground' : isCurrent ? 'border-primary text-primary' : 'text-muted-foreground'}`}>
                                {isComplete ? '✓' : number}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className={`font-medium ${isComplete ? 'text-muted-foreground' : ''}`}>{milestone}</p>
                                {isCurrent && <p className="mt-0.5 text-sm text-muted-foreground">Your current focus</p>}
                                {isComplete && <p className="mt-0.5 text-sm text-muted-foreground">Complete</p>}
                            </div>
                            <button
                                type="button"
                                onClick={() => toggleMilestone(number)}
                                disabled={saving !== null}
                                aria-pressed={isComplete}
                                className="shrink-0 rounded-md border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50 sm:text-sm"
                            >
                                {saving === number ? 'Saving…' : isComplete ? 'Undo' : 'Mark complete'}
                            </button>
                        </li>
                    )
                })}
            </ol>
            {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        </section>
    )
}
