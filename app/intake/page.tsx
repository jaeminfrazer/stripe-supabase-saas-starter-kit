"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { createClient } from "@/utils/supabase/client"

const questions = [
    {
        key: "tell_me_about_you",
        title: "1. Tell me about you.",
        prompt:
            "I would love to hear about what is happening in your world right now. What has brought you to this moment where you are ready for lasting change?\n\nGive me the current state of play in your health, finances, relationships and sense of self.",
    },
    {
        key: "hindrances",
        title: "2. Hindrances",
        prompt:
            "What do you think are the major or minor issues holding you back right now?",
    },
    {
        key: "personality",
        title: "3. Personality",
        prompt:
            "What do you think are your natural strengths and weaknesses?",
    },
    {
        key: "pain_points",
        title: "4. Pain points",
        prompt:
            "What area of your life is causing you the most pain right now?",
    },
    {
        key: "goals",
        title: "5. What do you want?",
        prompt:
            "What are the most important goals in your life right now? What would you love to have happen over the next six months through this experience?",
    },
    {
        key: "what_have_you_tried",
        title: "6. What have you tried?",
        prompt:
            "What have you tried to change, fix or overcome these problems? What has not worked?",
    },
    {
        key: "history",
        title: "7. History",
        prompt:
            "Is there anything from your past that is relevant for me to understand that may have contributed to your current pain points?",
    },
] as const

type IntakeData = {
    tell_me_about_you: string
    hindrances: string
    personality: string
    pain_points: string
    goals: string
    what_have_you_tried: string
    history: string
}

const emptyForm: IntakeData = {
    tell_me_about_you: "",
    hindrances: "",
    personality: "",
    pain_points: "",
    goals: "",
    what_have_you_tried: "",
    history: "",
}

export default function IntakePage() {
    const supabase = createClient()
    const router = useRouter()

    const [form, setForm] = useState<IntakeData>(emptyForm)
    const [firstCoachingExperience, setFirstCoachingExperience] = useState(false)
    const [coachingJourney, setCoachingJourney] = useState("")
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState("")

    useEffect(() => {
        async function loadIntake() {
            setError("")

            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser()

            if (userError || !user) {
                setError("We could not identify your account.")
                setIsLoading(false)
                return
            }

            const { data, error: intakeError } = await supabase
                .from("jbot_onboarding_data")
                .select(
                    "tell_me_about_you, hindrances, personality, pain_points, goals, what_have_you_tried, history"
                )
                .eq("user_id", user.id)
                .maybeSingle()

            if (intakeError) {
                setError("We could not load your intake. Please try again.")
                setIsLoading(false)
                return
            }

            if (data) {
                setForm({
                    tell_me_about_you: data.tell_me_about_you ?? "",
                    hindrances: data.hindrances ?? "",
                    personality: data.personality ?? "",
                    pain_points: data.pain_points ?? "",
                    goals: data.goals ?? "",
                    what_have_you_tried: data.what_have_you_tried ?? "",
                    history: data.history ?? "",
                })
            }

            const { data: journey, error: journeyError } = await supabase
                .from("jbot_coaching_journey")
                .select("first_coaching_experience, coaching_journey")
                .eq("user_id", user.id)
                .maybeSingle()

            if (journeyError) {
                console.error("Could not load coaching journey:", journeyError)
                setError("We could not load your coaching history. Please try again.")
                setIsLoading(false)
                return
            }

            if (journey) {
                setFirstCoachingExperience(journey.first_coaching_experience)
                setCoachingJourney(journey.coaching_journey ?? "")
            }

            setIsLoading(false)
        }

        loadIntake()
    }, [supabase])

    function updateField(key: keyof IntakeData, value: string) {
        setForm((current) => ({
            ...current,
            [key]: value,
        }))
        setError("")
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        if (!firstCoachingExperience && !coachingJourney.trim()) {
            setError("Please describe your coaching journey, or tick the box if this is your first coaching experience with Jaemin.")
            return
        }

        setIsSaving(true)
        setError("")

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
            setError("We could not identify your account.")
            setIsSaving(false)
            return
        }

        const { error: saveError } = await supabase
            .from("jbot_onboarding_data")
            .upsert(
                {
                    user_id: user.id,
                    ...form,
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: "user_id",
                }
            )

        if (saveError) {
            setError("We could not save your intake. Please try again.")
            setIsSaving(false)
            return
        }

        const { error: journeySaveError } = await supabase
            .from("jbot_coaching_journey")
            .upsert(
                {
                    user_id: user.id,
                    first_coaching_experience: firstCoachingExperience,
                    coaching_journey: coachingJourney.trim() || null,
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: "user_id",
                }
            )

        if (journeySaveError) {
            console.error("Could not save coaching journey:", journeySaveError)
            setError("Your intake was saved, but we could not save your coaching history. Please try again.")
            setIsSaving(false)
            return
        }

        router.push("/chat")
    }

    if (isLoading) {
        return (
            <main className="mx-auto max-w-3xl px-6 py-12">
                <p className="text-sm text-muted-foreground">
                    Loading your intake...
                </p>
            </main>
        )
    }

    return (
        <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
            <div className="mb-10">
                <p className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    The Unhindered Experience
                </p>

                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                    Your Intake
                </h1>

                <p className="mt-4 text-base leading-7 text-muted-foreground">
                    Before we begin, I would like to get a picture of who you
                    are, what is happening in your life, what is getting in the
                    way and what you want.
                </p>

                <p className="mt-2 text-base leading-7 text-muted-foreground">
                    There are no right answers. Just tell me what you think, in
                    your own words.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-10">
                {questions.map((question) => (
                    <section key={question.key} className="space-y-3">
                        <h2 className="text-xl font-semibold">
                            {question.title}
                        </h2>

                        <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
                            {question.prompt}
                        </p>

                        <textarea
                            value={form[question.key]}
                            onChange={(event) =>
                                updateField(question.key, event.target.value)
                            }
                            rows={7}
                            className="flex w-full rounded-md border border-input bg-background px-3 py-3 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                            placeholder="Your answer..."
                        />
                    </section>
                ))}

                <section className="space-y-4 border-t pt-8">
                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold">
                            8. Your Coaching Journey
                        </h2>
                        <p className="text-sm leading-6 text-muted-foreground">
                            Is this your first coaching experience with Jaemin?
                        </p>
                    </div>

                    <label className="flex items-start gap-3 rounded-md border p-4 text-sm leading-6">
                        <input
                            type="checkbox"
                            checked={firstCoachingExperience}
                            onChange={(event) => {
                                setFirstCoachingExperience(event.target.checked)
                                setError("")
                            }}
                            className="mt-1 h-4 w-4 shrink-0"
                        />
                        <span>
                            Yes — this is my first coaching experience with Jaemin.
                        </span>
                    </label>

                    <div className="space-y-3">
                        <label htmlFor="coaching-journey" className="block text-sm font-medium">
                            If you have worked with Jaemin before, please describe your coaching journey so far.
                        </label>
                        <p className="text-sm leading-6 text-muted-foreground">
                            What have been your key breakthroughs, insights and milestones in personal growth? What has changed in how you see yourself or live your life?
                        </p>
                        <p className="text-sm leading-6 text-muted-foreground">
                            Where do you feel you are currently up to? What have you integrated into your life, what remains unresolved, and where do you feel stuck or find yourself returning to old patterns?
                        </p>
                        <textarea
                            id="coaching-journey"
                            value={coachingJourney}
                            onChange={(event) => {
                                setCoachingJourney(event.target.value)
                                setError("")
                            }}
                            rows={7}
                            required={!firstCoachingExperience}
                            className="flex w-full rounded-md border border-input bg-background px-3 py-3 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                            placeholder="Your coaching journey, breakthroughs and where you are now..."
                        />
                        <p className="text-xs text-muted-foreground">
                            If this is your first coaching experience with Jaemin, you can leave this field blank.
                        </p>
                    </div>
                </section>

                {error && (
                    <p className="text-sm text-destructive">
                        {error}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                >
                    {isSaving ? "Saving..." : "Complete Intake"}
                </button>
            </form>
        </main>
    )
}
