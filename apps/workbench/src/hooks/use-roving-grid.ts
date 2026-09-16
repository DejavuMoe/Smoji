import { useCallback, useLayoutEffect, useRef, type FocusEvent, type KeyboardEvent } from 'react'

function applyRoving(cards: HTMLElement[], active: HTMLElement | null): void {
  for (const card of cards) card.tabIndex = card === active ? 0 : -1
}

export function useRovingGrid(gridRef: React.RefObject<HTMLElement | null>) {
  const lastActive = useRef<HTMLElement | null>(null)

  // Reconcile React's initial tabIndex after items are added, removed, or reordered.
  useLayoutEffect(() => {
    const cards = Array.from(gridRef.current?.querySelectorAll<HTMLElement>('[data-roving-item="true"]') ?? [])
    const active = cards.includes(lastActive.current!) ? lastActive.current : cards[0] ?? null
    applyRoving(cards, active)
    lastActive.current = active
  })

  const handleFocus = useCallback((e: FocusEvent<HTMLElement>) => {
    const grid = gridRef.current
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-roving-item="true"]')
    if (!grid || !target || !grid.contains(target)) return
    lastActive.current = target
    applyRoving(Array.from(grid.querySelectorAll<HTMLElement>('[data-roving-item="true"]')), target)
  }, [gridRef])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLElement>) => {
    if (e.defaultPrevented || e.nativeEvent.isComposing || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    const cards = Array.from(gridRef.current?.querySelectorAll<HTMLElement>('[data-roving-item="true"]') ?? [])
    const currentIndex = cards.findIndex(card => card === document.activeElement)
    if (currentIndex === -1) return
    let targetIndex = currentIndex
    switch (e.key) {
      case 'ArrowRight': targetIndex = Math.min(cards.length - 1, currentIndex + 1); break
      case 'ArrowLeft': targetIndex = Math.max(0, currentIndex - 1); break
      case 'Home': targetIndex = 0; break
      case 'End': targetIndex = cards.length - 1; break
      case 'ArrowDown':
      case 'ArrowUp': {
        const rects = cards.map(card => card.getBoundingClientRect())
        const current = rects[currentIndex]!
        const direction = e.key === 'ArrowDown' ? 1 : -1
        let nearestRow = Infinity
        let nearestColumn = Infinity
        for (let i = 0; i < rects.length; i++) {
          const rect = rects[i]!
          const rowDistance = (rect.top - current.top) * direction
          const columnDistance = Math.abs(rect.left - current.left)
          if (rowDistance > 1 && (rowDistance < nearestRow - 1 ||
            (Math.abs(rowDistance - nearestRow) <= 1 && columnDistance < nearestColumn))) {
            nearestRow = rowDistance
            nearestColumn = columnDistance
            targetIndex = i
          }
        }
        break
      }
      default: return
    }
    e.preventDefault()
    if (targetIndex === currentIndex) return
    const target = cards[targetIndex]!
    lastActive.current = target
    applyRoving(cards, target)
    target.focus()
    target.scrollIntoView({ block: 'nearest' })
  }, [gridRef])

  return { handleKeyDown, handleFocus }
}
