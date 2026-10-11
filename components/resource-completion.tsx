'use client'

import { useState } from 'react'
import Link from 'next/link'

type Resource = { id: string; title: string; category: string | null; description: string | null; tags: string[] | null }

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

export default function ResourceCompletion({ resources, completedIds }: { resources: Resource[]; completedIds: string[] }) {
  const [completed, setCompleted] = useState<string[]>(completedIds)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function toggle(id: string) {
    const done = completed.includes(id)
    setSaving(id); setError('')
    try {
      const response = await fetch('/api/resource-progress', {
        method: done ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: id }),
      })
      if (!response.ok) throw new Error('Could not save resource progress. Please try again.')
      setCompleted(current => done ? current.filter(value => value !== id) : [...current, id])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save resource progress.')
    } finally { setSaving(null) }
  }

  if (!resources.length) return <p className="text-sm text-muted-foreground">Resources will appear here as they are added.</p>

  const grouped = new Map<number, Resource[]>()
  const otherResources: Resource[] = []
  for (const resource of resources) {
    const milestoneTag = resource.tags?.find(tag => /^Milestone\s+\d+/i.test(tag))
    const milestoneNumber = milestoneTag ? Number(milestoneTag.match(/^Milestone\s+(\d+)/i)?.[1]) : NaN
    if (Number.isInteger(milestoneNumber) && milestoneNumber >= 1 && milestoneNumber <= milestones.length) {
      const group = grouped.get(milestoneNumber) ?? []
      group.push(resource)
      grouped.set(milestoneNumber, group)
    } else {
      otherResources.push(resource)
    }
  }

  function renderResource(resource: Resource) {
    const done = completed.includes(resource.id)
    return <div key={resource.id} className="flex items-start gap-3 rounded-lg border p-4">
      <input aria-label={`Mark ${resource.title} completed`} type="checkbox" checked={done} disabled={saving !== null} onChange={() => toggle(resource.id)} className="mt-1 h-4 w-4" />
      <div className="min-w-0 flex-1">
        <Link href={`/resources/${resource.id}`} className={`font-medium underline-offset-4 hover:underline ${done ? 'text-muted-foreground line-through' : ''}`}>{resource.title}</Link>
        {resource.description && <p className="mt-1 text-sm text-muted-foreground">{resource.description}</p>}
        {resource.category && <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">{resource.category}</p>}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">{saving === resource.id ? 'Saving…' : done ? 'Completed' : 'Not completed'}</span>
    </div>
  }

  return <div className="space-y-6">
    <p className="text-sm text-muted-foreground">Resources are grouped by the milestone they support. Tick a resource when you have completed it. This records participation only; it does not mean a milestone is resolved.</p>
    {milestones.map((milestone, index) => {
      const milestoneResources = grouped.get(index + 1)
      if (!milestoneResources?.length) return null
      return <section key={milestone} className="space-y-3">
        <div>
          <h3 className="font-semibold">Milestone {index + 1}: {milestone}</h3>
          <p className="text-xs text-muted-foreground">{milestoneResources.length} {milestoneResources.length === 1 ? 'resource' : 'resources'}</p>
        </div>
        <div className="space-y-2">{milestoneResources.map(renderResource)}</div>
      </section>
    })}
    {otherResources.length > 0 && <section className="space-y-3">
      <h3 className="font-semibold">Additional resources</h3>
      <div className="space-y-2">{otherResources.map(renderResource)}</div>
    </section>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>
}
