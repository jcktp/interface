import { useState } from 'react'
import {
  TrashIcon,
  PlayIcon,
  GlobeAltIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  TagIcon,
} from '@heroicons/react/24/outline'
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid'

interface SavedQuery {
  id: string
  name: string
  description: string | null
  sql_query: string
  tags: string[]
  is_public: boolean
  created_by: string
  created_at: string | null
  updated_at: string | null
}

interface SavedQueriesProps {
  queries: SavedQuery[]
  currentUserId: string
  onLoad: (query: SavedQuery) => void
  onDelete: (queryId: string) => void
  isLoading: boolean
}

export default function SavedQueries({
  queries,
  currentUserId,
  onLoad,
  onDelete,
  isLoading,
}: SavedQueriesProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  // Get unique tags
  const allTags = Array.from(new Set(queries.flatMap((q) => q.tags || [])))

  // Filter queries
  const filteredQueries = queries.filter((q) => {
    const matchesSearch =
      searchTerm === '' ||
      q.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.sql_query.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesTag = selectedTag === null || (q.tags || []).includes(selectedTag)

    return matchesSearch && matchesTag
  })

  // Separate own queries and shared queries
  const myQueries = currentUserId ? filteredQueries.filter((q) => q.created_by === currentUserId) : []
  const sharedQueries = currentUserId 
    ? filteredQueries.filter((q) => q.created_by !== currentUserId && q.is_public)
    : filteredQueries

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-4">Saved Queries</h3>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <BookmarkSolidIcon className="w-5 h-5 text-primary-500" />
          Saved Queries
        </h3>
      </div>

      {/* Search and filter */}
      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search queries..."
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            <button
              onClick={() => setSelectedTag(null)}
              className={`text-xs px-2 py-0.5 rounded ${
                selectedTag === null
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                className={`text-xs px-2 py-0.5 rounded ${
                  tag === selectedTag
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-h-[400px] overflow-auto">
        {filteredQueries.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            {queries.length === 0 ? 'No saved queries yet' : 'No matching queries'}
          </div>
        ) : (
          <>
            {/* My queries */}
            {myQueries.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                  My Queries ({myQueries.length})
                </div>
                {myQueries.map((query) => (
                  <QueryItem
                    key={query.id}
                    query={query}
                    isOwner={true}
                    onLoad={() => onLoad(query)}
                    onDelete={() => onDelete(query.id)}
                    formatDate={formatDate}
                  />
                ))}
              </div>
            )}

            {/* Shared queries */}
            {sharedQueries.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                  Shared Queries ({sharedQueries.length})
                </div>
                {sharedQueries.map((query) => (
                  <QueryItem
                    key={query.id}
                    query={query}
                    isOwner={false}
                    onLoad={() => onLoad(query)}
                    onDelete={() => {}}
                    formatDate={formatDate}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

interface QueryItemProps {
  query: SavedQuery
  isOwner: boolean
  onLoad: () => void
  onDelete: () => void
  formatDate: (date: string | null) => string
}

function QueryItem({ query, isOwner, onLoad, onDelete, formatDate }: QueryItemProps) {
  return (
    <div className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-gray-900 truncate">{query.name}</h4>
            {query.is_public ? (
              <GlobeAltIcon className="w-3.5 h-3.5 text-gray-400" title="Public" />
            ) : (
              <LockClosedIcon className="w-3.5 h-3.5 text-gray-400" title="Private" />
            )}
          </div>
          {query.description && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{query.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            {query.tags && query.tags.length > 0 && (
              <div className="flex items-center gap-1">
                <TagIcon className="w-3 h-3 text-gray-400" />
                {query.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="text-xs text-gray-400">
                    {tag}
                  </span>
                ))}
                {query.tags.length > 2 && (
                  <span className="text-xs text-gray-400">+{query.tags.length - 2}</span>
                )}
              </div>
            )}
            <span className="text-xs text-gray-400">{formatDate(query.updated_at || query.created_at)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onLoad}
            className="p-1.5 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded"
            title="Load query"
          >
            <PlayIcon className="w-4 h-4" />
          </button>
          {isOwner && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (confirm('Delete this query?')) {
                  onDelete()
                }
              }}
              className="p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded"
              title="Delete query"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* SQL preview */}
      <div className="mt-2 text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded truncate">
        {query.sql_query.slice(0, 100)}
        {query.sql_query.length > 100 && '...'}
      </div>
    </div>
  )
}
