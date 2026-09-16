import { Button } from '../../components/ui/button'
import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, MoveRight, X } from 'lucide-react'
import type { SmojiItem } from '../../../../../packages/smoji/src/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu'
import { useWorkbench } from '../../app/WorkbenchContext'
import { useMediaQuery } from '../../hooks/use-media-query'
import { EmojiImage } from '../gallery/EmojiImage'
import { thumbnailSrc } from '../../images'

interface CustomGroupItemTrayProps {
  groupIndex: number
  items: readonly SmojiItem[]
}

export function CustomGroupItemTray({ groupIndex, items }: CustomGroupItemTrayProps) {
  const { state, dispatch, setMobileDrawerOpen } = useWorkbench()
  const isMobile = useMediaQuery('(max-width: 600px)')
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)


  const limit = isMobile ? 8 : 36
  const visibleItems = items.slice(0, limit)
  const remaining = items.length - visibleItems.length
  const trayRef = useRef<HTMLDivElement | null>(null)
  const pendingFocus = useRef<{ src?: string; index: number; fallback: HTMLElement | null } | null>(null)
  const skipMenuReturn = useRef(false)

  function queueFocus(itemIndex: number, src?: string) {
    pendingFocus.current = {
      src, index: itemIndex,
      fallback: trayRef.current?.closest('[data-custom-index]')?.querySelector<HTMLElement>('.custom-pack-name') ?? null,
    }
  }

  function applyPendingFocus() {
    const pending = pendingFocus.current
    if (!pending) return
    pendingFocus.current = null
    const buttons = Array.from(trayRef.current?.querySelectorAll<HTMLElement>('[data-tray-item]') ?? [])
    const sameItem = pending.src && buttons.find(button => button.dataset.traySrc === pending.src)
    const target = sameItem || buttons[Math.min(pending.index, buttons.length - 1)] || pending.fallback
    target?.focus()
  }

  useLayoutEffect(applyPendingFocus, [items])

  const otherGroups = state.customGroups.groups
    .map((group, index) => ({ group, index }))
    .filter(({ index }) => index !== groupIndex)

  function handleDragStart(e: React.DragEvent<HTMLElement>, itemIndex: number, src: string) {
    e.stopPropagation()
    setDraggedIndex(itemIndex)
    e.dataTransfer.setData('text/smoji-src', src)
    e.dataTransfer.setData('text/smoji-tray-index', String(itemIndex))
    e.dataTransfer.setData('text/smoji-tray-group', String(groupIndex))
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent<HTMLElement>) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e: React.DragEvent<HTMLElement>, targetIndex: number) {
    e.preventDefault()
    if (e.dataTransfer.getData('text/smoji-tray-group') !== String(groupIndex)) return
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

  function moveItem(itemIndex: number, direction: -1 | 1) {
    const toIndex = itemIndex + direction
    if (toIndex < 0 || toIndex >= items.length) return
    queueFocus(itemIndex, items[itemIndex]?.src)
    dispatch({
      type: 'REORDER_CUSTOM_ITEMS',
      payload: { groupIndex, fromIndex: itemIndex, toIndex },
    })
  }

  function removeItem(item: SmojiItem) {
    const itemIndex = items.findIndex((entry) => entry.src === item.src)
    if (itemIndex === -1) return
    queueFocus(itemIndex)
    dispatch({ type: 'REMOVE_CUSTOM_ITEM', payload: { groupIndex, itemIndex } })
  }

  function previewItem(item: SmojiItem) {
    dispatch({ type: 'OPEN_INSPECTOR', payload: item.src })
  }

  /** Touch/keyboard parity: no drag required to reorder, remove, or move across groups. */
  function handleItemKeyDown(e: React.KeyboardEvent<HTMLElement>, item: SmojiItem, itemIndex: number) {
    if (e.defaultPrevented || e.nativeEvent.isComposing || e.ctrlKey || e.metaKey || e.shiftKey) return
    if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault()
      moveItem(itemIndex, -1)
    } else if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault()
      moveItem(itemIndex, 1)
    } else if (!e.altKey && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault()
      removeItem(item)
    }
  }

  function handleViewAll() {
    dispatch({ type: 'SET_ACTIVE_CUSTOM_GROUP', payload: groupIndex })
    dispatch({ type: 'SET_GALLERY_VIEW', payload: 'picked' })
    // Finishing the "go to gallery" action must not leave the drawer covering the result.
    setMobileDrawerOpen(false)
    requestAnimationFrame(() => document.getElementById('grid')?.focus())
  }

  if (items.length === 0) return null

  return (
    <div ref={trayRef} role="list" aria-label="分组内表情缩略图" className="mt-1 flex flex-wrap gap-2 px-1 py-1">
      {visibleItems.map((item, itemIndex) => (
        <div key={item.src} role="listitem" className="group/tray relative pb-7">
          <Button variant="ghost"
            type="button"
            data-tray-item={String(itemIndex)}
            data-tray-src={item.src}
            draggable
            className={`relative flex h-12 w-12 shrink-0 cursor-grab items-center justify-center rounded border border-border/60 bg-surface p-0.5 transition-opacity hover:border-primary/50 active:cursor-grabbing ${
              draggedIndex === itemIndex ? 'opacity-40' : 'opacity-100'
            }`}
            tooltip={`${item.label}（Enter 预览，Alt+←/→ 排序，Delete 移出）`}
            aria-label={`${item.label}：Enter 预览，Alt 加左右方向键排序，Delete 移出`}
            onDragStart={(e) => handleDragStart(e, itemIndex, item.src)}
            onDragEnd={() => setDraggedIndex(null)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, itemIndex)}
            onClick={() => previewItem(item)}
            onKeyDown={(e) => handleItemKeyDown(e, item, itemIndex)}
          >
            <EmojiImage
              src={thumbnailSrc(item.src)}
              alt=""
              className="pointer-events-none h-full w-full"
              imgClassName="h-full w-full object-contain"
            />
          </Button>

          {/* Pointer users keep quick actions; keyboard users have the same actions on the item. */}
          <div className="absolute bottom-0 left-0 z-10 flex gap-1 opacity-0 transition-opacity group-hover/tray:opacity-100 group-focus-within/tray:opacity-100 [@media(hover:none)]:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost"
                  type="button"
                  className="flex h-6 w-6 p-0 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground shadow-xs hover:text-foreground"
                  aria-label={`排序或移动 ${item.label}`}
                  tooltip="排序或移动到其他分组"
                >
                  <MoveRight className="h-2.5 w-2.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36 text-xs"
                onCloseAutoFocus={(e) => {
                  if (skipMenuReturn.current) {
                    e.preventDefault()
                    requestAnimationFrame(applyPendingFocus)
                  }
                  skipMenuReturn.current = false
                }}
              >
                <DropdownMenuLabel>排序与移动</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  data-tray-move-left={String(itemIndex)}
                  disabled={itemIndex === 0}
                  onSelect={() => { skipMenuReturn.current = true; moveItem(itemIndex, -1) }}
                >
                  <ArrowLeft className="mr-2 h-3.5 w-3.5" />
                  <span>左移</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  data-tray-move-right={String(itemIndex)}
                  disabled={itemIndex === items.length - 1}
                  onSelect={() => { skipMenuReturn.current = true; moveItem(itemIndex, 1) }}
                >
                  <ArrowRight className="mr-2 h-3.5 w-3.5" />
                  <span>右移</span>
                </DropdownMenuItem>
                {otherGroups.length > 0 && <DropdownMenuSeparator />}
                {otherGroups.map(({ group, index }) => (
                  <DropdownMenuItem
                    key={group.id}
                    data-tray-move-to={String(index)}
                    onSelect={() => {
                      skipMenuReturn.current = true
                      queueFocus(itemIndex)
                      dispatch({
                        type: 'MOVE_CUSTOM_ITEM_TO_GROUP',
                        payload: { itemSrc: item.src, targetGroupIndex: index, sourceGroupIndex: groupIndex },
                      })
                    }}
                  >
                    <span className="truncate">移至「{group.label}」</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost"
              type="button"
              className="flex h-6 w-6 p-0 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground shadow-xs hover:text-destructive"
              aria-label={`移出 ${item.label}`}
              tooltip="从分组移出"
              onClick={() => removeItem(item)}
            >
              <X className="h-2.5 w-2.5" />
            </Button>
          </div>
        </div>
      ))}

      {remaining > 0 && (
        <Button variant="ghost"
          type="button"
          className="inline-flex h-7 shrink-0 items-center rounded border border-dashed border-border bg-muted/50 px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={handleViewAll}
        >
          {isMobile ? `查看全部 ${items.length} 项` : `+${remaining}`}
        </Button>
      )}
    </div>
  )
}
