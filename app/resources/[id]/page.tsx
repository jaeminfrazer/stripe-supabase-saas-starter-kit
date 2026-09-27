import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/utils/supabase/server"

export default async function ResourcePage({
    params,
}: {
    params: { id: string }
}) {
    const supabase = createClient()

    const { data: resource, error } = await supabase
        .from("jbot_resources")
        .select("*")
        .eq("id", params.id)
        .single()

    if (error || !resource) {
        notFound()
    }

    return (
        <main className="min-h-screen bg-background">
            <div className="container max-w-3xl px-6 py-12">
                <Link
                    href="/resources"
                    className="text-sm text-muted-foreground hover:text-foreground"
                >
                    ← Back to Resource Library
                </Link>

                <article className="mt-10">
                    <p className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                        {resource.category}
                    </p>

                    <h1 className="text-4xl font-semibold tracking-tight">
                        {resource.title}
                    </h1>

                    {resource.description && (
                        <p className="mt-5 text-xl leading-8 text-muted-foreground">
                            {resource.description}
                        </p>
                    )}

                    {resource.tags && resource.tags.length > 0 && (
                        <div className="mt-6 flex flex-wrap gap-2">
                            {resource.tags.map((tag: string) => (
                                <span
                                    key={tag}
                                    className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {resource.content && (
                        <div className="mt-12 whitespace-pre-wrap text-base leading-8">
                            {resource.content}
                        </div>
                    )}

                    {resource.url && (
                        <div className="mt-10">
                            <a
                                href={resource.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
                            >
                                Open resource
                            </a>
                        </div>
                    )}
                </article>
            </div>
        </main>
    )
}
