import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import api from '../api'
import { usePermissions } from '../hooks/usePermissions'
import ChatMessage from '../components/ai/ChatMessage'
import AIChart from '../components/ai/AIChart'
import {
  PaperAirplaneIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sql?: string | null
  results?: Record<string, any>[] | null
  chart_config?: any | null
  created_at: string
}

interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

const SUGGESTED_QUESTIONS = [
  'What is our current headcount by department?',
  'Show me the attrition trend over the past 12 months',
  'What is the average salary by department?',
  'Which departments have the lowest engagement scores?',
  'How many open positions do we have?',
  'What is our attendance rate this month?',
]

export default function AIChat() {
  const { hasPermission } = usePermissions()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversations = async () => {
    try {
      const res = await api.get('/ai/conversations')
      setConversations(res.data?.data?.conversations || res.data?.conversations || [])
    } catch {
      // No conversations yet
    }
  }

  const loadMessages = async (convoId: string) => {
    try {
      const res = await api.get(`/ai/conversations/${convoId}/messages`)
      setMessages(res.data?.data?.messages || res.data?.messages || [])
      setActiveConvoId(convoId)
    } catch {
      toast.error('Failed to load conversation')
    }
  }

  const handleNewConversation = () => {
    setActiveConvoId(null)
    setMessages([])
    setInput('')
  }

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent selecting the conversation
    if (!window.confirm('Are you sure you want to delete this chat?')) return
    
    try {
      await api.delete(`/ai/conversations/${id}`)
      toast.success('Chat deleted')
      if (activeConvoId === id) {
        handleNewConversation()
      }
      loadConversations()
    } catch {
      toast.error('Failed to delete chat')
    }
  }

  const handleAsk = async (question?: string) => {
    const q = question || input.trim()
    if (!q || isAsking) return

    if (!hasPermission('ai_qa:use')) {
      toast.error('You do not have permission to use AI Q&A')
      return
    }

    setInput('')
    setIsAsking(true)

    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: q,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])

    try {
      const res = await api.post('/ai/ask', {
        question: q,
        conversation_id: activeConvoId,
      })

      const data = res.data?.data || res.data
      if (data.conversation_id && !activeConvoId) {
        setActiveConvoId(data.conversation_id)
        loadConversations()
      }

      const assistantMsg: Message = {
        id: `resp-${Date.now()}`,
        role: 'assistant',
        content: data.answer || 'I was unable to generate an answer.',
        sql: data.sql,
        results: data.results,
        chart_config: data.chart_config,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err: any) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: err.response?.data?.detail || 'Something went wrong. Please try again.',
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsAsking(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAsk()
    }
  }

  return (
    <div className="flex h-[calc(100vh-6.75rem)] -mt-2">
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="p-3">
          <button onClick={handleNewConversation} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <PlusIcon className="h-4 w-4" />
            New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
          {conversations.map(convo => (
            <div
              key={convo.id}
              onClick={() => loadMessages(convo.id)}
              className={`w-full group flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${
                activeConvoId === convo.id
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="truncate pr-2">{convo.title}</span>
              <button
                onClick={(e) => handleDeleteConversation(convo.id, e)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="bg-primary-50 p-4 rounded-2xl mb-6">
              <SparklesIcon className="h-10 w-10 text-primary-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">AI HR Assistant</h2>
            <p className="text-gray-500 text-sm mb-8 text-center max-w-md">
              Ask questions about your organization's data in natural language. I'm connected to your live workforce data via a local AI.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleAsk(q)}
                  className="text-left text-sm text-gray-600 bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-primary-300 hover:text-primary-600 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-2">
            {messages.map(msg => (
              <div key={msg.id}>
                <ChatMessage role={msg.role} content={msg.content} sql={msg.sql} timestamp={msg.created_at} />
                {msg.chart_config && msg.results && (
                  <div className="ml-0 mb-4">
                    <AIChart config={msg.chart_config} data={msg.results} />
                  </div>
                )}
              </div>
            ))}
            {isAsking && (
              <div className="flex justify-start mb-4">
                <div className="bg-gray-100 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="animate-spin h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full" />
                    Thinking...
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        <div className="border-t border-gray-200 p-4 bg-white">
          <div className="flex items-end gap-3 max-w-4xl mx-auto">
            <div className="flex-1">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your organization..."
                rows={1}
                className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                style={{ minHeight: '44px', maxHeight: '120px' }}
              />
            </div>
            <button
              onClick={() => handleAsk()}
              disabled={!input.trim() || isAsking}
              className="p-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
