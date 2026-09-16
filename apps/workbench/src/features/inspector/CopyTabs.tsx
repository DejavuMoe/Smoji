import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { isEditing, ownsArrowKeys } from '../../keyboard'
import { useEffect, useRef, useState, useCallback } from 'react'
import type { SmojiItem } from '../../../../../packages/smoji/src/types'
import { toExportItemSrc } from '../../export'
import { formatEmoji } from '../../domain/copy-format'
import type { CopyFormat } from '../../domain/state'
import { useWorkbench } from '../../app/WorkbenchContext'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'

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
      if (!(e.target instanceof HTMLElement) || e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey ||
        isEditing(e.target, true)) return
      const dialog = inputRef.current?.closest('[role="dialog"]')
      const overlays = document.querySelectorAll('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')
      if (!dialog || overlays[overlays.length - 1] !== dialog || !dialog.contains(e.target)) return
      if (ownsArrowKeys(e.target) && !(e.target instanceof HTMLElement && e.target.closest('[role="tablist"]'))) return
      const match = FORMATS.find((f) => f.key === e.key)
      if (match) {
        e.preventDefault()
        dispatch({ type: 'SET_INSPECTOR_COPY_FORMAT', payload: match.id })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dispatch])

  return (
    <Tabs
      value={activeFormat}
      onValueChange={(next) => dispatch({ type: 'SET_INSPECTOR_COPY_FORMAT', payload: next as CopyFormat })}
      className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-2"
    >
      {/* One copy panel: content-sized minimums keep five aligned columns readable on phones. */}
      <TabsList className="grid w-full grid-cols-[repeat(5,minmax(max-content,1fr))]">
        {FORMATS.map((fmt) => (
          <TabsTrigger
            key={fmt.id}
            id={`copy-tab-${fmt.id}`}
            value={fmt.id}
            data-copy-format={fmt.id}
            className="px-1"
          >
            {fmt.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value={activeFormat} className="flex flex-col gap-2">
        <div className="flex gap-1.5">
          <Input
            ref={inputRef}
            id="copy-active-input"
            type="text"
            readOnly
            aria-label={`${FORMATS.find((f) => f.id === activeFormat)?.label ?? ''} 复制内容`}
            value={value}
            className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-muted/40 px-2.5 font-mono text-xs text-foreground "
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <Button variant="ghost"
            id="btn-copy-active"
            type="button"
            className="w-[4.5rem] shrink-0 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 "
            onClick={handleCopy}
          >
            {feedback === '已复制' ? '已复制' : '复制'}
          </Button>
        </div>

        {/* Inline feedback announced to assistive tech */}
        {feedback && (
          <div
            id="copy-feedback"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={feedback === '已复制' ? 'sr-only' : 'text-xs text-muted-foreground'}
          >
            {feedback}
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}
