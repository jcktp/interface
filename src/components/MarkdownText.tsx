/**
 * MarkdownText — lightweight inline markdown renderer (no external dependency).
 *
 * Supports:
 *  - Paragraphs (blank line = new paragraph)
 *  - Headings ## / ###
 *  - **bold**, *italic*
 *  - `inline code`
 *  - ```code blocks```
 *  - Unordered lists: - item / * item
 *  - Ordered lists: 1. item
 *  - Horizontal rules: ---
 */

import { Fragment } from 'react'

interface Props {
  content: string
  className?: string
  compact?: boolean  // smaller spacing, e.g. in chat bubbles
}

function parseInline(text: string): React.ReactNode[] {
  // Process: **bold**, *italic*, `code`
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    if (match[2] !== undefined) {
      parts.push(<strong key={match.index} className="font-semibold">{match[2]}</strong>)
    } else if (match[3] !== undefined) {
      parts.push(<em key={match.index}>{match[3]}</em>)
    } else if (match[4] !== undefined) {
      parts.push(
        <code key={match.index} className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded text-[0.85em] font-mono">
          {match[4]}
        </code>
      )
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts
}

export default function MarkdownText({ content, className = '', compact = false }: Props) {
  const gap = compact ? 'mb-1.5' : 'mb-3'

  // Split into blocks by code fences first
  const blocks: React.ReactNode[] = []
  const codeFenceRegex = /```(\w*)\n?([\s\S]*?)```/g
  let lastPos = 0
  let fenceMatch: RegExpExecArray | null
  let key = 0

  while ((fenceMatch = codeFenceRegex.exec(content)) !== null) {
    // Process text before the code block
    if (fenceMatch.index > lastPos) {
      renderTextBlocks(content.slice(lastPos, fenceMatch.index), blocks, gap, key)
      key += 100
    }
    blocks.push(
      <pre key={`code-${key++}`} className={`${gap} bg-gray-900 text-green-400 rounded-lg p-3 overflow-x-auto text-xs font-mono leading-relaxed`}>
        <code>{fenceMatch[2].trim()}</code>
      </pre>
    )
    lastPos = codeFenceRegex.lastIndex
  }

  // Remaining text after last code block
  if (lastPos < content.length) {
    renderTextBlocks(content.slice(lastPos), blocks, gap, key)
  }

  return (
    <div className={`text-inherit leading-relaxed ${className}`}>
      {blocks}
    </div>
  )
}

function renderTextBlocks(text: string, out: React.ReactNode[], gap: string, startKey: number) {
  // Split by double newlines (paragraphs) or single newlines
  const lines = text.split('\n')
  let key = startKey
  let listItems: React.ReactNode[] = []
  let orderedListItems: React.ReactNode[] = []

  const flushList = () => {
    if (listItems.length > 0) {
      out.push(
        <ul key={`ul-${key++}`} className={`${gap} list-disc pl-5 space-y-0.5`}>
          {listItems}
        </ul>
      )
      listItems = []
    }
    if (orderedListItems.length > 0) {
      out.push(
        <ol key={`ol-${key++}`} className={`${gap} list-decimal pl-5 space-y-0.5`}>
          {orderedListItems}
        </ol>
      )
      orderedListItems = []
    }
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      flushList()
      i++
      continue
    }

    // H2 heading
    if (/^##\s/.test(trimmed)) {
      flushList()
      out.push(
        <h2 key={`h2-${key++}`} className={`${gap} text-sm font-bold text-gray-900 dark:text-white`}>
          {parseInline(trimmed.replace(/^##\s+/, ''))}
        </h2>
      )
      i++
      continue
    }

    // H3 heading
    if (/^###\s/.test(trimmed)) {
      flushList()
      out.push(
        <h3 key={`h3-${key++}`} className={`${gap} text-sm font-semibold text-gray-800 dark:text-gray-200`}>
          {parseInline(trimmed.replace(/^###\s+/, ''))}
        </h3>
      )
      i++
      continue
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      flushList()
      out.push(<hr key={`hr-${key++}`} className={`${gap} border-gray-200 dark:border-gray-700`} />)
      i++
      continue
    }

    // Unordered list item
    if (/^[-*]\s/.test(trimmed)) {
      listItems.push(
        <li key={`li-${key++}`} className="text-inherit">
          {parseInline(trimmed.replace(/^[-*]\s+/, ''))}
        </li>
      )
      i++
      continue
    }

    // Ordered list item
    if (/^\d+\.\s/.test(trimmed)) {
      orderedListItems.push(
        <li key={`oli-${key++}`} className="text-inherit">
          {parseInline(trimmed.replace(/^\d+\.\s+/, ''))}
        </li>
      )
      i++
      continue
    }

    // Regular paragraph line — accumulate into paragraph
    flushList()
    const paraLines: string[] = []
    while (i < lines.length && lines[i].trim() && !/^#{1,3}\s|^[-*]\s|^\d+\.\s/.test(lines[i].trim())) {
      paraLines.push(lines[i].trim())
      i++
    }
    if (paraLines.length > 0) {
      out.push(
        <p key={`p-${key++}`} className={gap}>
          {paraLines.map((pline, idx) => (
            <Fragment key={idx}>
              {idx > 0 && ' '}
              {parseInline(pline)}
            </Fragment>
          ))}
        </p>
      )
    }
  }

  flushList()
}
