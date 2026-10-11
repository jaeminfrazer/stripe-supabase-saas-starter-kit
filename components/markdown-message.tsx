"use client"

import { Fragment, ReactNode } from 'react'

function renderInline(text: string): ReactNode[] {
    const pattern = /(\*\*.+?\*\*|(?<!\*)\*[^*]+\*(?!\*)|`[^`]+`)/g
    const parts = text.split(pattern)

    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={index}>{part.slice(1, -1)}</em>
        }
        if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={index} className="rounded bg-black/5 px-1 py-0.5 font-mono text-[0.95em]">{part.slice(1, -1)}</code>
        }
        return <Fragment key={index}>{part}</Fragment>
    })
}

/**
 * Renders the lightweight Markdown commonly used in Jbot replies.
 * Text remains React text (never injected as HTML), so model output is not trusted markup.
 */
export default function MarkdownMessage({ content }: { content: string }) {
    const paragraphs = content.trim().split(/\n\s*\n/)

    return (
        <div className="space-y-3">
            {paragraphs.map((paragraph, paragraphIndex) => (
                <p key={paragraphIndex} className="whitespace-pre-wrap">
                    {paragraph.split('\n').map((line, lineIndex) => (
                        <Fragment key={lineIndex}>
                            {lineIndex > 0 && <br />}
                            {renderInline(line)}
                        </Fragment>
                    ))}
                </p>
            ))}
        </div>
    )
}
