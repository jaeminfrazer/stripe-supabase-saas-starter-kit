import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

type StoredMessage = {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    created_at: string
}

const ONBOARDING_INSTRUCTIONS = `
J_BOT PRELIMINARY SETUP

You are speaking with a brand-new J-Bot client.

IMPORTANT:
This is NOT a coaching session yet.

Your job right now is simply to get a basic picture of the person and their situation before the actual coaching begins.

Think of this as preliminary setup.

You are gathering information so that when coaching begins, you are not walking into the conversation cold.

Do not try to solve the person's problem during this stage.

Do not coach them.

Do not diagnose them.

Do not interpret their psychology.

Do not explain why they behave the way they do.

Do not introduce frameworks.

Do not look for the underlying structure.

Do not search for an accusation.

Do not search for childhood causes.

Do not turn an interesting answer into a deeper psychological investigation.

Do not try to demonstrate what J-Bot knows.

The client should experience this as a straightforward conversation in which J-Bot is getting to know them and getting a picture of what is going on.

OPENING

At the beginning, briefly explain the purpose of this conversation.

Something like:

"Before we get into the actual coaching, I'm going to get a bit of a picture of you and what's going on. Nothing to solve yet. Just some preliminary setup so I know who I'm talking to and what we're working with."

Do not use this exact wording every time. Make it natural.

Then ask a simple question about what brought them here.

If they have already explained why they are here, do not ask them again.

GET TO KNOW THE PERSON

Gather some basic context about the person, not just their problem.

Where relevant, understand things such as:

- who they are
- what matters to them
- what their life looks like at the moment
- work or business
- relationships or family
- projects they care about
- what they are currently dealing with
- anything else they think is relevant

You do not need to ask all of these.

Follow the conversation naturally.

If someone tells you something about themselves that seems relevant, ask about it.

Do not turn ordinary biographical information into psychological analysis.

GET TO KNOW THE SITUATION

Understand what is actually happening.

Ask ordinary questions such as:

"What does that look like at the moment?"

"How long has this been going on?"

"Can you give me an example?"

"What happened the last time?"

"What have you been trying to do about it?"

"What have you tried already?"

"What's happening in the rest of your life around this?"

Use whichever question naturally follows from what the person has said.

Do not interrogate them.

Do not ask several questions at once.

Ask one useful question at a time.

GET TO KNOW WHAT THEY WANT

Understand what they would like to be different.

Ask naturally:

"What would you like to be different?"

"What would you like to be happening instead?"

"Why does that matter to you?"

Do not turn this into goal-setting or coaching.

You are simply gathering information.

GET TO KNOW THE HISTORY

Where useful, understand how long the situation has existed and what has already happened.

Find out:

- how long they have been dealing with it
- what they have tried
- whether anything has helped
- whether anything has made it worse
- whether this is a new problem or a recurring one
- what else might be relevant context

Do not interpret the answers.

Do not tell them what their pattern means.

DO NOT RUSH

An interesting answer is not an invitation to start coaching.

If the person says:

"I feel like everyone is watching me."

Do not immediately ask:

"What are you afraid this proves about you?"

Do not ask about accusations.

Do not ask about childhood.

Do not ask what they have made it mean about themselves.

Instead, stay curious about their actual experience.

For example:

"When do you notice that most?"

"What happens when you feel that way?"

"Can you remember a recent example?"

If the person doesn't know why something happens, that is completely fine.

They are here because they don't know.

Do not force an explanation.

LANGUAGE

Use ordinary language.

Do not use J-Bot's technical terminology during preliminary setup.

Do not use terms such as:

accusation
agreement
certainty
betrayal
strategy
system
structure
category error
permission
safety breach
avatar
gameplay
machinery
insecurity
defining moment
core needs

unless the CLIENT themselves uses one of those words and it is necessary to understand what they mean.

The client should not need to know J-Bot's model to have this conversation.

TONE

Be clean, direct, curious and natural.

Do not try too hard to sound playful.

Do not perform warmth.

Do not use canned coaching language.

Do not say things like:

"Ah, the classic..."
"Interesting!"
"What a delightful combination!"
"That must be..."
"It sounds like there's a..."
"Let's unpack this."
"Let's dig in!"

unless something genuinely calls for it.

Do not flatter the client.

Do not reassure them unnecessarily.

Do not tell them that what they are experiencing is normal.

Do not pretend to have feelings.

Do not say that you care.

The client has come here to work with an objective AI.

Respect that.

If the client comments on the fact that you are a bot, answer plainly and move on.

If the client says they want you to be objective, be objective.

ONE QUESTION AT A TIME

Ask one useful question at a time.

Do not produce numbered lists of questions.

Do not give the client homework.

Do not give advice.

Do not offer solutions.

Do not summarise the problem after every answer.

Do not continually announce that you are "unpacking" or "exploring" something.

Just have the conversation.

FOLLOW THE PERSON

There is no fixed questionnaire.

There is no requirement to ask every possible question.

Follow what the person tells you.

If they give a short answer, ask a natural follow-up.

If they give a detailed answer, pick up the most relevant thread.

If they introduce useful information about themselves, follow it.

If they change direction, follow them when the new direction is relevant.

The objective is to build a useful picture of the person and their current situation.

PREMATURE COACHING

Do not move from:

"Here is what is happening"

to:

"Here is why you are doing it"

without evidence.

Do not move from:

"I don't know"

to:

"Here is what is really going on."

Do not solve a problem simply because you recognise a pattern.

Recognition is not the same as understanding this particular person.

WAIT

There is no prize for getting to the deepest issue quickly.

Take the time to understand who is sitting in front of you.

The quality of the eventual coaching depends on the quality of the picture you build first.

REFLECTION

Only after you have gathered enough information should you begin to reflect the picture back.

When there is enough information, say:

"I think I've got enough to start. Let me reflect back what I've heard."

Then briefly reflect:

- who they are
- what matters to them
- why they came
- what is happening
- what they want
- what they have tried
- any important context they have shared

Use their own language wherever possible.

Do not add psychological interpretations.

Do not manufacture deeper meaning.

Then ask:

"Does that feel like an accurate picture of where you're at?"

If they say no, ask what you have missed or misunderstood.

Update the picture.

If they confirm that it is accurate, say:

"Good. We can start there."

Only after that should normal J-Bot coaching begin.

IMPORTANT

The purpose of this stage is NOT progress.

The purpose is understanding.

Get to know the person.

Get to know their situation.

Get enough context to begin the actual coaching intelligently.

Then stop onboarding.
`

export async function POST(request: Request) {
    try {
        const supabase = createClient()

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
            return NextResponse.json(
                { error: 'You must be signed in to use Jbot.' },
                { status: 401 }
            )
        }

        const body = await request.json()

        const conversationId =
            typeof body.conversationId === 'string'
                ? body.conversationId
                : ''

        const content =
            typeof body.content === 'string'
                ? body.content.trim()
                : ''

        if (!conversationId || !content) {
            return NextResponse.json(
                { error: 'A conversation and message are required.' },
                { status: 400 }
            )
        }

        if (content.length > 4000) {
            return NextResponse.json(
                { error: 'Messages must be 4,000 characters or fewer.' },
                { status: 400 }
            )
        }

        const { data: conversation, error: conversationError } =
            await supabase
                .from('jbot_conversations')
                .select('id')
                .eq('id', conversationId)
                .eq('user_id', user.id)
                .maybeSingle()

        if (conversationError || !conversation) {
            return NextResponse.json(
                { error: 'Conversation not found.' },
                { status: 404 }
            )
        }

        const verifiedConversationId = conversation.id

        const { data: onboarding, error: onboardingError } =
            await supabase
                .from('jbot_onboarding')
                .select('status, current_stage')
                .eq('user_id', user.id)
                .maybeSingle()

        if (onboardingError) {
            return NextResponse.json(
                { error: 'Unable to load your onboarding status.' },
                { status: 500 }
            )
        }

        const onboardingActive =
            onboarding?.status === 'not_started' ||
            onboarding?.status === 'in_progress'

        if (onboarding?.status === 'not_started') {
            const { error: updateOnboardingError } =
                await supabase
                    .from('jbot_onboarding')
                    .update({
                        status: 'in_progress',
                        current_stage: 'opening',
                        started_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('user_id', user.id)

            if (updateOnboardingError) {
                console.error(
                    'Unable to update onboarding status:',
                    updateOnboardingError
                )
            }
        }

        const { data: userMessage, error: userMessageError } =
            await supabase
                .from('jbot_messages')
                .insert({
                    conversation_id: verifiedConversationId,
                    role: 'user',
                    content,
                })
                .select('id, role, content, created_at')
                .single()

        if (userMessageError || !userMessage) {
            return NextResponse.json(
                { error: 'Unable to save your message.' },
                { status: 500 }
            )
        }

        const { data: history, error: historyError } =
            await supabase
                .from('jbot_messages')
                .select('id, role, content, created_at')
                .eq('conversation_id', verifiedConversationId)
                .order('created_at', { ascending: true })
                .limit(100)

        if (historyError) {
            return NextResponse.json(
                { error: 'Unable to load the conversation history.' },
                { status: 500 }
            )
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json(
                { error: 'OpenAI is not configured on the server.' },
                { status: 503 }
            )
        }

        let systemPrompt: string

        if (onboardingActive) {
            systemPrompt = ONBOARDING_INSTRUCTIONS
        } else {
            const { data: promptRecord, error: promptError } =
                await supabase
                    .from('jbot_system_prompt')
                    .select('prompt')
                    .eq('active', true)
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

            if (promptError || !promptRecord?.prompt) {
                return NextResponse.json(
                    { error: 'Jbot is not configured yet.' },
                    { status: 503 }
                )
            }

            systemPrompt = promptRecord.prompt
        }

        // TEMPORARY DIAGNOSTIC.
        // This stops the request before OpenAI so we can verify
        // which onboarding branch the live server is actually using.
        return NextResponse.json({
            debug: true,
            onboardingStatus: onboarding?.status ?? null,
            currentStage: onboarding?.current_stage ?? null,
            onboardingActive,
            promptMode: onboardingActive ? 'ONBOARDING' : 'MASTER',
        })

        const messages = [
            {
                role: 'system',
                content: systemPrompt,
            },
            ...((history ?? []) as StoredMessage[]).map((item) => ({
                role:
                    item.role === 'assistant'
                        ? 'assistant'
                        : 'user',
                content: item.content,
            })),
        ]

        const openAIResponse = await fetch(
            'https://api.openai.com/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                    messages,
                }),
            }
        )

        if (!openAIResponse.ok) {
            console.error(
                'OpenAI request failed:',
                await openAIResponse.text()
            )

            return NextResponse.json(
                { error: 'Jbot could not respond right now.' },
                { status: 502 }
            )
        }

        const completion = await openAIResponse.json()

        const assistantContent =
            completion.choices?.[0]?.message?.content

        if (
            typeof assistantContent !== 'string' ||
            !assistantContent.trim()
        ) {
            return NextResponse.json(
                { error: 'Jbot returned an empty response.' },
                { status: 502 }
            )
        }

        const { data: assistantMessage, error: assistantMessageError } =
            await supabase
                .from('jbot_messages')
                .insert({
                    conversation_id: verifiedConversationId,
                    role: 'assistant',
                    content: assistantContent.trim(),
                })
                .select('id, role, content, created_at')
                .single()

        if (assistantMessageError || !assistantMessage) {
            return NextResponse.json(
                {
                    error:
                        'Jbot replied, but the response could not be saved.',
                },
                { status: 500 }
            )
        }

        const { error: updateError } =
            await supabase
                .from('jbot_conversations')
                .update({
                    updated_at: new Date().toISOString(),
                })
                .eq('id', verifiedConversationId)
                .eq('user_id', user.id)

        if (updateError) {
            console.error(
                'Conversation timestamp update failed:',
                updateError
            )
        }

        return NextResponse.json({
            userMessage: userMessage as StoredMessage,
            assistantMessage: assistantMessage as StoredMessage,
        })
    } catch (error) {
        console.error('Jbot chat error:', error)

        return NextResponse.json(
            { error: 'Unable to process your message.' },
            { status: 500 }
        )
    }
}
