/**
 * AIInsightsPanel — per-page AI analysis button + results panel.
 *
 * Usage:
 *   <AIInsightsPanel
 *     pageContext="Recruitment pipeline"
 *     prompt="Analyse the current recruitment pipeline data and provide key insights, bottlenecks, and actionable recommendations."
 *   />
 */
import { useState } from 'react'
import { SparklesIcon, ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline'
import api from '../api'
import MarkdownText from './MarkdownText'
import { usePermissions } from '../hooks/usePermissions'
import clsx from 'clsx'

interface Props {
  pageContext: string   // Short label, e.g. "Recruitment"
  prompt: string        // The question sent to the AI
  className?: string
}

type Status = 'idle' | 'loading' | 'done' | 'error'

export default function AIInsightsPanel({ pageContext, prompt, className = '' }: Props) {
  const { hasPermission } = usePermissions()
  const [status, setStatus] = useState<Status>('idle')
  const [insight, setInsight] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [conversationId, setConversationId] = useState<string | null>(null)

  const canUseAI = hasPermission('ai_qa:use')

  const generate = async () => {
    if (!canUseAI || status === 'loading') return
    setStatus('loading')
    setInsight(null)
    setExpanded(true)
    try {
      const res = await api.post('/ai/ask', {
        question: prompt,
        conversation_id: conversationId ?? undefined,
      }, { timeout: 90000 })
      const { answer, conversation_id } = res.data.data
      setInsight(answer || 'No insights available.')
      setConversationId(conversation_id)
      setStatus('done')
    } catch (err: any) {
      setInsight(err?.response?.data?.detail || 'Failed to generate insights. Please try again.')
      setStatus('error')
    }
  }

  const dismiss = () => {
    setStatus('idle')
    setInsight(null)
  }

  return (
    <div className={clsx('rounded-xl border border-blue-200 dark:border-blue-800/50 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10', className)}>
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <SparklesIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">AI Insights — {pageContext}</p>
            {status === 'idle' && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Generate AI-powered analysis of this page's data</p>
            )}
            {status === 'loading' && (
              <p className="text-xs text-blue-600 dark:text-blue-400 animate-pulse">Analysing data…</p>
            )}
            {status === 'done' && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Click Regenerate to refresh</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === 'idle' && canUseAI && (
            <button
              onClick={generate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
            >
              <SparklesIcon className="h-3.5 w-3.5" />
              Generate Insights
            </button>
          )}
          {status === 'loading' && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
              </div>
              <span className="text-xs text-blue-600 dark:text-blue-400">Thinking…</span>
            </div>
          )}
          {(status === 'done' || status === 'error') && (
            <>
              <button
                onClick={generate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg hover:border-blue-400 transition-colors"
              >
                <SparklesIcon className="h-3.5 w-3.5" />
                Regenerate
              </button>
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-white/70 dark:hover:bg-gray-800 transition-colors"
              >
                {expanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
              </button>
              <button
                onClick={dismiss}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-white/70 dark:hover:bg-gray-800 transition-colors"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </>
          )}
          {!canUseAI && (
            <span className="text-xs text-gray-400 italic">AI access not enabled for your role</span>
          )}
        </div>
      </div>

      {/* Insights content */}
      {(status === 'done' || status === 'error') && expanded && insight && (
        <div className="px-4 pb-4">
          <div className={clsx(
            'rounded-lg p-4 text-sm',
            status === 'error'
              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
              : 'bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-800/40 text-gray-700 dark:text-gray-300'
          )}>
            <MarkdownText content={insight} />
          </div>
        </div>
      )}
    </div>
  )
}
