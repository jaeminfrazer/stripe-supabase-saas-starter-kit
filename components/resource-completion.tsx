'use client'

import { useState } from 'react'
import Link from 'next/link'

type Resource = { id: string; title: string; category: string | null; description: string | null; tags: string[] | null }

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

  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">Tick a resource when you have completed it. This records participation only; it does not mean a milestone is resolved.</p>
    {resources.map(resource => {
      const done = completed.includes(resource.id)
      return <div key={resource.id} className="flex items-start gap-3 rounded-lg border p-4">
        <input aria-label={`Mark ${resource.title} completed`} type="checkbox" checked={done} disabled={saving !== null} onChange={() => toggle(resource.id)} className="mt-1 h-4 w-4" />
        <div className="min-w-0 flex-1">
          <Link href={`/resources/${resource.id}`} className={`font-medium underline-offset-4 hover:underline ${done ? 'text-muted-foreground line-through' : ''}`}>{resource.title}</Link>
          {resource.description && <p className="mt-1 text-sm text-muted-foreground">{resource.description}</p>}
          {resource.tags?.length ? <p className="mt-2 text-xs text-muted-foreground">{resource.tags.filter(tag => /milestone/i.test(tag)).join(' · ')}</p> : null}
        </div>
        <span className="text-xs text-muted-foreground">{saving === resource.id ? 'Saving…' : done ? 'Completed' : 'Not completed'}</span>
      </div>
    })}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>
}
