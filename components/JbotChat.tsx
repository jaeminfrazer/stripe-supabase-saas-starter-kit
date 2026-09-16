"use client"

import { FormEvent, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type ChatMessage = {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    created_at: string
}

type JbotChatProps = {
    conversationId: string
    initialMessages: ChatMessage[]
}

export default function JbotChat({ conversationId, initialMessages }: JbotChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
    const [message, setMessage] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    async function submitMessage(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const content = message.trim()

        if (!content || isLoading) {
            return
        }

        setError('')
        setMessage('')
        setIsLoading(true)

        const optimisticMessage: ChatMessage = {
            id: `pending-${Date.now()}`,
            role: 'user',
            content,
            created_at: new Date().toISOString(),
        }
        setMessages((current) => [...current, optimisticMessage])

        try {
            const response = await fetch('/api/jbot/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationId, content }),
            })
            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Unable to send your message.')
            }

            setMessages((current) => [
                ...current.filter((item) => item.id !== optimisticMessage.id),
                result.userMessage,
                result.assistantMessage,
            ])
        } catch (submissionError) {
            setMessages((current) => current.filter((item) => item.id !== optimisticMessage.id))
            setError(submissionError instanceof Error ? submissionError.message : 'Unable to send your message.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Card className="flex min-h-[70vh] flex-col">
            <CardHeader className="border-b">
                <CardTitle className="text-lg">Chat with Jbot</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
                {messages.length === 0 && (
                    <div className="flex min-h-[45vh] items-center justify-center text-center text-sm text-muted-foreground">
                        <p>Start a conversation with Jbot by sending your first message.</p>
                    </div>
                )}

                {messages.map((item) => (
                    <div
                        key={item.id}
                        className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-3 text-sm ${
                                item.role === 'user'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-foreground'
                            }`}
                        >
                            {item.content}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                            Jbot is thinking…
                        </div>
                    </div>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}
            </CardContent>
            <CardFooter className="border-t p-4 sm:p-6">
                <form onSubmit={submitMessage} className="flex w-full gap-2">
                    <Input
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder="Write a message to Jbot..."
                        disabled={isLoading}
                        aria-label="Message for Jbot"
                        maxLength={4000}
                    />
                    <Button type="submit" disabled={isLoading || !message.trim()}>
                        Send
                    </Button>
                </form>
            </CardFooter>
        </Card>
    )
}
