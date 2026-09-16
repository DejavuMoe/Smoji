import { Button } from '../../components/ui/button'
import { useCallback, useRef, useEffect } from 'react'
import type { SmojiItem } from '../../../../../packages/smoji/src/types'
import { useWorkbench } from '../../app/WorkbenchContext'
import { useRovingGrid } from '../../hooks/use-roving-grid'
import { EmojiCard } from './EmojiCard'
import { EmptyState } from './EmptyState'

export function EmojiGrid() {
  const {
    state,
    dispatch,
    activePack,
    activeCustomGroup,
    activeGroupPickedSrcs,
  } = useWorkbench()

  const gridRef = useRef<HTMLDivElement | null>(null)
  const { handleKeyDown, handleFocus } = useRovingGrid(gridRef)

  const isCustom = state.mode === 'custom'
  const isPickedView = state.gallery.view === 'picked'
  const isComfortable = state.gallery.density === 'comfortable'

  // Items to display
  let items: readonly SmojiItem[] = []
  if (isCustom && isPickedView) {
    items = activeCustomGroup?.items ?? []
  } else {
    items = activePack?.items ?? []
  }

  // Progressive rendering chunk
  const renderLimit = state.gallery.renderLimit
  const visibleItems = items.slice(0, renderLimit)
  const hasMore = items.length > renderLimit

  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const main = gridRef.current?.closest('main')
    if (main) main.scrollTop = 0
  }, [state.catalog.activePackIndex, state.customGroups.activeGroupIndex, state.mode, state.gallery.view])

  // Expand render limit on scroll / intersection
  useEffect(() => {
    if (!hasMore) return

    const sentinel = sentinelRef.current
    if (sentinel && typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            dispatch({ type: 'EXPAND_RENDER_LIMIT' })
          }
        },
        { rootMargin: '300px' },
      )
      observer.observe(sentinel)
      return () => observer.disconnect()
    }

    const container = gridRef.current?.closest('main') || window
    function handleScroll() {
      if (!hasMore) return
      if (container instanceof HTMLElement) {
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 300) {
          dispatch({ type: 'EXPAND_RENDER_LIMIT' })
        }
      } else {
        const scrollY = window.scrollY || document.documentElement.scrollTop
        if (scrollY + window.innerHeight >= document.documentElement.scrollHeight - 300) {
          dispatch({ type: 'EXPAND_RENDER_LIMIT' })
        }
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [hasMore, renderLimit, items, dispatch])

  const handleCardClick = useCallback(
    (item: SmojiItem) => {
      dispatch({ type: 'OPEN_INSPECTOR', payload: item.src })
    },
    [dispatch],
  )

  const handleActionClick = useCallback(
    (e: React.MouseEvent, item: SmojiItem) => {
      e.stopPropagation()
      if (isCustom) {
        dispatch({ type: 'TOGGLE_CUSTOM_ITEM', payload: item })
      } else {
        dispatch({ type: 'TOGGLE_PACK_ITEM_EXCLUSION', payload: item.src })
      }
    },
    [isCustom, dispatch],
  )

  if (items.length === 0) {
    if (isCustom && isPickedView) {
      return (
        <EmptyState
          title="当前分组暂无表情"
          description="从「当前分类」中点击加号或拖拽表情到此分组。"
          actionLabel="去浏览表情"
          onAction={() => dispatch({ type: 'SET_GALLERY_VIEW', payload: 'source' })}
        />
      )
    }
    return (
      <EmptyState
        title="暂无表情"
        description="该分类下没有包含任何表情图片。"
      />
    )
  }

  return (
    <div className="flex-1 p-3 sm:p-5">
      <div
        ref={gridRef}
        id="grid"
        role="group"
        aria-label="表情图库"
        tabIndex={-1}
        className={`grid gap-2.5 sm:gap-3.5 ${
          isComfortable
            ? 'grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))]'
            : 'grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))]'
        }`}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
      >
        {visibleItems.map((item, index) => {
          const isPicked = activeGroupPickedSrcs.has(item.src)
          const isExcluded = !isCustom && state.packSelection.excludedItemSrcs.has(item.src)

          return (
            <EmojiCard
              key={item.src}
              item={item}
              index={index}
              isCustomMode={isCustom}
              isPicked={isPicked}
              isExcluded={isExcluded}
              isComfortable={isComfortable}
              onCardClick={handleCardClick}
              onActionClick={handleActionClick}
            />
          )
        })}
      </div>

      {hasMore && (
        <div ref={sentinelRef} className="mt-6 flex justify-center pb-8">
          <Button variant="ghost"
            type="button"
            className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
            onClick={() => dispatch({ type: 'EXPAND_RENDER_LIMIT' })}
          >
            加载更多 ({items.length - visibleItems.length} 张剩余)
          </Button>
        </div>
      )}
    </div>
  )
}
