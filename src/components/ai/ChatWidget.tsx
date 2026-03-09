import { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import api from '../../api'
import { usePermissions } from '../../hooks/usePermissions'
import { useStore } from '../../store'
import {
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  ChevronDownIcon,
  TrashIcon,
  PlusIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface Conversation {
  id: string
  title: string
  updated_at: string
}

export default function ChatWidget() {
  const { hasPermission } = usePermissions()
  const { aiWidgetState, setAiWidgetState } = useStore()
  const { isOpen, isMinimized, activeConversationId } = aiWidgetState
  
  const [view, setView] = useState<'chat' | 'history'>('chat')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesLoadedRef = useRef<string | null>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen && !isMinimized && view === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen, isMinimized, view])

  // Fetch history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get('/ai/conversations')
      setConversations(res.data.data?.conversations || [])
    } catch (err) {
      console.error('Failed to fetch chat history')
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchHistory()
    }
  }, [isOpen, fetchHistory])

  // Fetch messages for a conversation
  const loadConversation = useCallback(async (id: string) => {
    try {
      const res = await api.get(`/ai/conversations/${id}/messages`)
      setMessages(res.data.data?.messages || [])
      messagesLoadedRef.current = id
      setAiWidgetState({ activeConversationId: id })
      setView('chat')
    } catch (err: any) {
      // Stale conversation ID (e.g. after a DB reseed) — clear it silently
      if (err?.response?.status === 404 || err?.response?.status === 422) {
        setAiWidgetState({ activeConversationId: null })
        setMessages([])
        messagesLoadedRef.current = null
      } else {
        toast.error('Failed to load conversation')
      }
    }
  }, [setAiWidgetState])

  // On mount, if there was an active conversation, load it
  useEffect(() => {
    if (activeConversationId && messagesLoadedRef.current !== activeConversationId) {
      loadConversation(activeConversationId)
    }
  }, [activeConversationId, loadConversation])

  const deleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      await api.delete(`/ai/conversations/${id}`)
      setConversations(prev => prev.filter(c => c.id !== id))
      if (activeConversationId === id) {
        setAiWidgetState({ activeConversationId: null })
        setMessages([])
        messagesLoadedRef.current = null
      }
      toast.success('Conversation deleted')
    } catch (err) {
      toast.error('Failed to delete conversation')
    }
  }

  const startNewChat = () => {
    setAiWidgetState({ activeConversationId: null })
    setMessages([])
    messagesLoadedRef.current = null
    setView('chat')
  }

  const handleAsk = async () => {
    const q = input.trim()
    if (!q || isAsking) return

    if (!hasPermission('ai_qa:use')) {
      toast.error('AI Q&A access restricted')
      return
    }

    setInput('')
    setIsAsking(true)

    // Optimistic UI for user message
    const tempUserMsg: Message = {
      id: `temp-u-${Date.now()}`,
      role: 'user',
      content: q,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempUserMsg])

    try {
      const res = await api.post('/ai/ask', { 
        question: q,
        conversation_id: activeConversationId 
      })
      
      const { answer, conversation_id, message_id } = res.data.data
      
      if (!activeConversationId) {
        setAiWidgetState({ activeConversationId: conversation_id })
        messagesLoadedRef.current = conversation_id
        fetchHistory()
      }

      const assistantMsg: Message = {
        id: message_id,
        role: 'assistant',
        content: answer || 'I am sorry, I could not process that.',
        created_at: new Date().toISOString(),
      }
      setMessages(prev => {
        // Remove temp and add real messages
        const filtered = prev.filter(m => !m.id.startsWith('temp-'))
        return [...filtered, tempUserMsg, assistantMsg]
      })
    } catch (err: any) {
      toast.error('Error communicating with AI')
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

  const toggleWidget = () => {
    if (!isOpen) {
      setAiWidgetState({ isOpen: true, isMinimized: false })
    } else {
      setAiWidgetState({ isMinimized: !isMinimized })
    }
  }

  const closeWidget = (e: React.MouseEvent) => {
    e.stopPropagation()
    setAiWidgetState({ isOpen: false, isMinimized: false })
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      {/* Chat Window */}
      {isOpen && !isMinimized && (
        <div className="w-[350px] sm:w-[400px] h-[550px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="bg-[#0F172A] p-4 flex items-center justify-between text-white shadow-lg">
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-primary-200" />
              <span className="font-semibold text-sm">Workforce Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setView(view === 'chat' ? 'history' : 'chat')}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                title={view === 'chat' ? 'History' : 'Back to chat'}
              >
                {view === 'chat' ? <ClockIcon className="h-4 w-4" /> : <ChatBubbleLeftRightIcon className="h-4 w-4" />}
              </button>
              <button 
                onClick={() => setAiWidgetState({ isMinimized: true })}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ChevronDownIcon className="h-4 w-4" />
              </button>
              <button 
                onClick={(e) => closeWidget(e)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {view === 'chat' ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-gray-900/50">
                {messages.length === 0 && (
                  <div className="text-center py-12 px-6">
                    <div className="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-full w-fit mx-auto mb-4">
                      <SparklesIcon className="h-8 w-8 text-[#0F172A]" />
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Ask me anything</h4>
                    <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                      I can help you analyze turnover, track headcount, or find diversity insights across Interface.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-2 justify-center">
                      {['Show headcount', 'What is our turnover?'].map(q => (
                        <button 
                          key={q}
                          onClick={() => { setInput(q); }}
                          className="text-[10px] px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full hover:border-primary-500 transition-colors shadow-sm"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {messages.map(msg => (
                  <div key={msg.id} className={clsx(
                    "flex flex-col",
                    msg.role === 'user' ? "items-end" : "items-start"
                  )}>
                    <div className={clsx(
                      "max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm shadow-sm leading-relaxed",
                      msg.role === 'user' 
                        ? "bg-[#0F172A] text-white rounded-tr-none" 
                        : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-tl-none"
                    )}>
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1 px-1">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
                
                {isAsking && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 border border-gray-100 dark:border-gray-700 flex items-center gap-2 shadow-sm">
                      <div className="flex gap-1.5">
                        <div className="w-1.5 h-1.5 bg-[#0F172A] rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 bg-[#0F172A] rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 bg-[#0F172A] rounded-full animate-bounce" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Footer Input */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-900/50 rounded-2xl px-4 py-2 border border-transparent focus-within:border-primary-500 focus-within:bg-white dark:focus-within:bg-gray-900 transition-all">
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Message AI..."
                    rows={1}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-1.5 resize-none no-scrollbar dark:text-white placeholder:text-gray-400"
                    style={{ maxHeight: '120px' }}
                  />
                  <button 
                    onClick={handleAsk}
                    disabled={!input.trim() || isAsking}
                    className="p-1.5 text-[#0F172A] hover:text-black disabled:opacity-30 transition-colors flex-shrink-0"
                  >
                    <PaperAirplaneIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* History View */
            <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-gray-400" />
                  Recent Conversations
                </h4>
                <button 
                  onClick={startNewChat}
                  className="p-1.5 text-[#0F172A] hover:bg-slate-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium"
                >
                  <PlusIcon className="h-4 w-4" />
                  New Chat
                </button>
              </div>
              
              <div className="space-y-2">
                {conversations.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-xs">
                    No history found
                  </div>
                ) : (
                  conversations.map(convo => (
                    <div 
                      key={convo.id}
                      onClick={() => loadConversation(convo.id)}
                      className={clsx(
                        "group flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all",
                        activeConversationId === convo.id 
                          ? "bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700" 
                          : "bg-white border-gray-100 hover:border-slate-300 dark:bg-gray-900/30 dark:border-gray-700"
                      )}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{convo.title || 'Untitled Chat'}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{new Date(convo.updated_at).toLocaleDateString()}</p>
                      </div>
                      <button 
                        onClick={(e) => deleteConversation(e, convo.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={toggleWidget}
        className={clsx(
          "w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-all duration-200 active:scale-95 relative border",
          isOpen && !isMinimized
            ? "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-700"
            : "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
        )}
      >
        {isOpen && !isMinimized ? (
          <XMarkIcon className="h-5 w-5" />
        ) : (
          <ChatBubbleLeftRightIcon className="h-5 w-5" />
        )}
      </button>
    </div>
  )
}
