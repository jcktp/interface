import { useRef, useEffect, useState } from 'react'
import Editor, { OnMount, OnChange } from '@monaco-editor/react'
import { PlayIcon } from '@heroicons/react/24/solid'

interface SqlEditorProps {
  value: string
  onChange: (value: string) => void
  onExecute: () => void
  isExecuting: boolean
  schema?: Record<string, { columns: { name: string; type: string; nullable: boolean }[] }>
}

export default function SqlEditor({ value, onChange, onExecute, isExecuting, schema }: SqlEditorProps) {
  const editorRef = useRef<any>(null)
  const [theme, setTheme] = useState<'vs-light' | 'vs-dark'>('vs-light')

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark')
    setTheme(isDark ? 'vs-dark' : 'vs-light')

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const dark = document.documentElement.classList.contains('dark')
          setTheme(dark ? 'vs-dark' : 'vs-light')
        }
      })
    })

    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [])

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor

    // Register SQL language configuration
    monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position)
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        }

        const suggestions: any[] = []

        // SQL keywords
        const keywords = [
          'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN',
          'IS', 'NULL', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET',
          'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'ON',
          'AS', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CASE', 'WHEN',
          'THEN', 'ELSE', 'END', 'CAST', 'COALESCE', 'NULLIF', 'ASC', 'DESC'
        ]

        keywords.forEach((kw) => {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            range,
          })
        })

        // Table names from schema
        if (schema) {
          Object.keys(schema).forEach((tableName) => {
            suggestions.push({
              label: tableName,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: tableName,
              detail: 'Table',
              range,
            })

            // Column names
            schema[tableName].columns.forEach((col) => {
              suggestions.push({
                label: `${tableName}.${col.name}`,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: `${tableName}.${col.name}`,
                detail: `${col.type}${col.nullable ? ' (nullable)' : ''}`,
                range,
              })
              suggestions.push({
                label: col.name,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: col.name,
                detail: `${tableName}.${col.name} (${col.type})`,
                range,
              })
            })
          })
        }

        return { suggestions }
      },
    })

    // Add keyboard shortcut for execute (Ctrl/Cmd + Enter)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onExecute()
    })
  }

  const handleChange: OnChange = (value) => {
    onChange(value || '')
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">SQL Query</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">(Ctrl+Enter to execute)</span>
        </div>
        <button
          onClick={onExecute}
          disabled={isExecuting || !value.trim()}
          className="btn-primary inline-flex items-center gap-2 text-sm py-1.5 px-3"
        >
          {isExecuting ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Running...
            </>
          ) : (
            <>
              <PlayIcon className="w-4 h-4" />
              Run Query
            </>
          )}
        </button>
      </div>
      <Editor
        height="300px"
        language="sql"
        value={value}
        onChange={handleChange}
        onMount={handleEditorMount}
        theme={theme}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          padding: { top: 10 },
        }}
      />
    </div>
  )
}
