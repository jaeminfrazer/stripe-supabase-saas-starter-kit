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

type Props = { onboardingComplete: boolean; assessmentStatuses: Record<number, string> }

export default function JourneyProgress({ onboardingComplete, assessmentStatuses }: Props) {
  const complete = new Set<number>()
  if (onboardingComplete) complete.add(1)
  for (const milestone of [4, 5, 7]) {
    if (assessmentStatuses[milestone] === 'complete') complete.add(milestone)
  }
  const count = complete.size

  return <section className="rounded-xl border bg-background p-6 shadow-sm sm:p-8">
    <div className="mb-6">
      <h2 className="text-xl font-semibold">Your Journey</h2>
      <p className="mt-1 text-sm text-muted-foreground">Resource completion and milestone resolution are tracked separately.</p>
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Milestones resolved</span>
          <span className="text-muted-foreground">{count} of 12</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Milestones resolved" aria-valuemin={0} aria-valuemax={12} aria-valuenow={count}>
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(count / 12) * 100}%` }} />
        </div>
      </div>
    </div>
    <ol className="space-y-3">
      {milestones.map((milestone, index) => {
        const number = index + 1
        const done = complete.has(number)
        const assessmentStatus = assessmentStatuses[number] ?? 'pending'
        const assessing = [4, 5, 7].includes(number) && assessmentStatus === 'investigating'
        return <li key={milestone} className="flex items-center gap-3 rounded-lg border p-3 sm:gap-4">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm ${done ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{done ? '✓' : number}</div>
          <div className="min-w-0 flex-1">
            <p className={`font-medium ${done ? 'text-muted-foreground' : ''}`}>{milestone}</p>
            {number === 1 && <p className="mt-1 text-xs text-muted-foreground">Complete when all seven onboarding answers have been provided.</p>}
            {number === 4 && <p className="mt-1 text-xs text-muted-foreground">Prototype assessment: Jbot tests the original accusation against behaviour and evidence from the defining moment.</p>}
            {number === 5 && <p className="mt-1 text-xs text-muted-foreground">Assessment examines the early experience, the child’s interpretation, and whether the evidence connects coherently to the original accusation and proving/defending strategy.</p>}
            {number === 7 && <p className="mt-1 text-xs text-muted-foreground">Assessment examines whether the desired outcome is clear, aligned with the client’s highest intention, supported by a considered vehicle, and ready to be acted upon.</p>}
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${done ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{done ? 'Complete' : assessing ? 'Investigating' : assessmentStatus === 'pending' ? 'Pending' : 'In progress'}</span>
        </li>
      })}
    </ol>
  </section>
}
