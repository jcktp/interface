interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  sql?: string | null
  timestamp?: string
}

export default function ChatMessage({ role, content, sql, timestamp }: ChatMessageProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%]`}>
        <div className={`rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-slate-900 text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
        }`}>
          <div className="text-sm whitespace-pre-wrap">{content}</div>
        </div>
        {sql && !isUser && (
          <details className="mt-2">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">View SQL</summary>
            <pre className="mt-1 text-xs bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto">{sql}</pre>
          </details>
        )}
        {timestamp && (
          <p className={`text-xs text-gray-400 mt-1 ${isUser ? 'text-right' : ''}`}>
            {new Date(timestamp).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  )
}
