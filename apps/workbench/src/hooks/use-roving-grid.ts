import { useCallback, type KeyboardEvent } from 'react'

export function useRovingGrid(gridRef: React.RefObject<HTMLElement | null>) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      const grid = gridRef.current
      if (!grid) return

      const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-roving-item="true"]'))
      if (cards.length === 0) return

      const activeEl = document.activeElement as HTMLElement | null
      const currentIndex = cards.findIndex((card) => card === activeEl || card.contains(activeEl))
      if (currentIndex === -1) return

      let columns = 1
      if (cards.length >= 2) {
        const firstTop = cards[0]!.getBoundingClientRect().top
        for (let i = 1; i < cards.length; i++) {
          if (cards[i]!.getBoundingClientRect().top > firstTop) {
            columns = i
            break
          }
        }
      }

      let targetIndex: number | null = null

      switch (e.key) {
        case 'ArrowRight':
          targetIndex = Math.min(cards.length - 1, currentIndex + 1)
          break
        case 'ArrowLeft':
          targetIndex = Math.max(0, currentIndex - 1)
          break
        case 'ArrowDown':
          targetIndex = Math.min(cards.length - 1, currentIndex + columns)
          break
        case 'ArrowUp':
          targetIndex = Math.max(0, currentIndex - columns)
          break
        case 'Home':
          targetIndex = 0
          break
        case 'End':
          targetIndex = cards.length - 1
          break
        default:
          return
      }

      if (targetIndex !== null && targetIndex !== currentIndex) {
        e.preventDefault()
        const target = cards[targetIndex]
        target?.focus()
        target?.scrollIntoView({ block: 'nearest' })
      }
    },
    [gridRef],
  )

  return { handleKeyDown }
}
