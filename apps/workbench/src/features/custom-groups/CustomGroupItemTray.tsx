import { useState } from 'react'
import type { SmojiItem } from '../../../../../packages/smoji/src/types'
import { useWorkbench } from '../../app/WorkbenchContext'
import { useMediaQuery } from '../../hooks/use-media-query'
import { thumbnailSrc } from '../../images'

interface CustomGroupItemTrayProps {
  groupIndex: number
  items: readonly SmojiItem[]
}

export function CustomGroupItemTray({ groupIndex, items }: CustomGroupItemTrayProps) {
  const { dispatch } = useWorkbench()
  const isMobile = useMediaQuery('(max-width: 600px)')
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  if (items.length === 0) return null

  const limit = isMobile ? 8 : 36
  const visibleItems = items.slice(0, limit)
  const remaining = items.length - visibleItems.length

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, itemIndex: number, src: string) {
    setDraggedIndex(itemIndex)
    e.dataTransfer.setData('text/smoji-src', src)
    e.dataTransfer.setData('text/smoji-tray-index', String(itemIndex))
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, targetIndex: number) {
    e.preventDefault()
    e.stopPropagation()
    const sourceIndexStr = e.dataTransfer.getData('text/smoji-tray-index')
    if (!sourceIndexStr) return
    const fromIndex = parseInt(sourceIndexStr, 10)
    if (isNaN(fromIndex) || fromIndex === targetIndex) return

    dispatch({
      type: 'REORDER_CUSTOM_ITEMS',
      payload: { groupIndex, fromIndex, toIndex: targetIndex },
    })
    setDraggedIndex(null)
  }

  function handleViewAll() {
    dispatch({ type: 'SET_ACTIVE_CUSTOM_GROUP', payload: groupIndex })
    dispatch({ type: 'SET_GALLERY_VIEW', payload: 'picked' })
  }

  return (
    <div className="mt-1 flex flex-wrap gap-1 px-1 py-1">
      {visibleItems.map((item, itemIndex) => (
        <div
          key={item.src}
          data-tray-item={String(itemIndex)}
          draggable
          className={`relative h-7 w-7 shrink-0 cursor-grab rounded border border-border/60 bg-surface p-0.5 transition-opacity hover:border-primary/50 active:cursor-grabbing ${
            draggedIndex === itemIndex ? 'opacity-40' : 'opacity-100'
          }`}
          title={item.label}
          onDragStart={(e) => handleDragStart(e, itemIndex, item.src)}
          onDragEnd={() => setDraggedIndex(null)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, itemIndex)}
        >
          <img
            src={thumbnailSrc(item.src)}
            alt={item.label}
            className="h-full w-full object-contain pointer-events-none"
            loading="lazy"
          />
        </div>
      ))}

      {remaining > 0 && (
        <button
          type="button"
          className="inline-flex h-7 shrink-0 items-center rounded border border-dashed border-border bg-muted/50 px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={handleViewAll}
        >
          {isMobile ? `查看全部 ${items.length} 项` : `+${remaining}`}
        </button>
      )}
    </div>
  )
}
