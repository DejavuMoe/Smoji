import { useEffect, useRef, useState, useCallback } from 'react'
import type { SmojiItem } from '../../../../../packages/smoji/src/types'
import { toExportItemSrc } from '../../export'
import { formatEmoji } from '../../domain/copy-format'
import type { CopyFormat } from '../../domain/state'
import { useWorkbench } from '../../app/WorkbenchContext'

const FORMATS: { id: CopyFormat; label: string; key: string }[] = [
  { id: 'md', label: 'Markdown', key: '1' },
  { id: 'url', label: 'URL', key: '2' },
  { id: 'hugo', label: 'Hugo', key: '3' },
  { id: 'html', label: 'HTML', key: '4' },
  { id: 'bbcode', label: 'BBCode', key: '5' },
]

interface CopyTabsProps {
  item: SmojiItem
}

export function CopyTabs({ item }: CopyTabsProps) {
  const { state, dispatch, manifestUrl } = useWorkbench()
  const activeFormat = state.inspector.copyFormat
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const value = formatEmoji(item, activeFormat, (src) => toExportItemSrc(src, manifestUrl))

  const handleCopy = useCallback(async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API not available')
      }
      await navigator.clipboard.writeText(value)
      setFeedback('已复制')
      setTimeout(() => setFeedback(null), 2000)
    } catch {
      // Fallback: select text in input for manual copy
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.setSelectionRange(0, inputRef.current.value.length)
      }
      setFeedback('请按 ⌘/Ctrl+C 手动复制')
      setTimeout(() => setFeedback(null), 3000)
    }
  }, [value])

  // Keyboard shortcut 1-5 for format tabs
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement && !e.target.readOnly) return
      if (e.target instanceof HTMLTextAreaElement) return
      const match = FORMATS.find((f) => f.key === e.key)
      if (match) {
        dispatch({ type: 'SET_INSPECTOR_COPY_FORMAT', payload: match.id })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dispatch])

  return (
    <div className="flex flex-col gap-2">
      {/* Scrollable Tabs row */}
      <div className="flex overflow-x-auto rounded-lg bg-muted p-0.5 text-xs whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {FORMATS.map((fmt) => {
          const isSelected = activeFormat === fmt.id
          return (
            <button
              key={fmt.id}
              id={`copy-tab-${fmt.id}`}
              type="button"
              data-copy-format={fmt.id}
              aria-selected={isSelected}
              className={`flex-1 rounded-md px-2.5 py-1 text-center font-medium transition-colors ${
                isSelected
                  ? 'bg-surface text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => dispatch({ type: 'SET_INSPECTOR_COPY_FORMAT', payload: fmt.id })}
            >
              {fmt.label}
            </button>
          )
        })}
      </div>

      {/* Input and copy button */}
      <div className="flex gap-1.5">
        <input
          ref={inputRef}
          id="copy-active-input"
          type="text"
          readOnly
          value={value}
          className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-muted/40 px-2.5 font-mono text-xs text-foreground outline-none focus:border-primary"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <button
          id="btn-copy-active"
          type="button"
          className="shrink-0 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onClick={handleCopy}
        >
          复制
        </button>
      </div>

      {/* Inline Feedback */}
      {feedback && (
        <div id="copy-feedback" className="text-center text-xs font-medium text-primary animate-fade-in">
          {feedback}
        </div>
      )}
    </div>
  )
}
