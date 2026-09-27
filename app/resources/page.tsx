import { createClient } from "@/utils/supabase/server"

const categories = [
    {
        key: "WATCH",
        title: "Watch",
        description: "Short videos to give you a new way of seeing something.",
    },
    {
        key: "READ",
        title: "Read",
        description: "Ideas and distinctions worth sitting with.",
    },
    {
        key: "LISTEN",
        title: "Listen",
        description: "Conversations and audio to explore while you live.",
    },
    {
        key: "DO",
        title: "Do",
        description: "Practical experiments to put the ideas into play.",
    },
]

export default async function ResourcesPage() {
    const supabase = createClient()

    const { data: resources, error } = await supabase
        .from("jbot_resources")
        .select("*")
        .order("created_at", { ascending: true })

    if (error) {
        console.error("Error loading resources:", error)
    }

    return (
        <main className="min-h-screen bg-background">
            <div className="container max-w-screen-xl px-6 py-12">
                <div className="mb-12">
                    <p className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                        The Unhindered Experience
                    </p>

                    <h1 className="text-4xl font-semibold tracking-tight">
                        Resource Library
                    </h1>

                    <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
                        Ideas, distinctions and practices to help you see
                        yourself and the game you&apos;re playing more clearly.
                    </p>
                </div>

                <div className="space-y-16">
                    {categories.map((category) => {
                        const categoryResources =
                            resources?.filter(
                                (resource) =>
                                    resource.category?.toUpperCase() ===
                                    category.key
                            ) ?? []

                        return (
                            <section key={category.key}>
                                <div className="mb-6">
                                    <h2 className="text-2xl font-semibold">
                                        {category.title}
                                    </h2>

                                    <p className="mt-2 text-muted-foreground">
                                        {category.description}
                                    </p>
                                </div>

                                {categoryResources.length === 0 ? (
                                    <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
                                        Resources coming soon.
                                    </div>
                                ) : (
                                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                        {categoryResources.map((resource) => (
                                            <div
                                                key={resource.id}
                                                className="rounded-xl border bg-card p-6"
                                            >
                                                <h3 className="text-lg font-semibold">
                                                    {resource.title}
                                                </h3>

                                                {resource.description && (
                                                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                                        {
                                                            resource.description
                                                        }
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        )
                    })}
                </div>
            </div>
        </main>
    )
}
