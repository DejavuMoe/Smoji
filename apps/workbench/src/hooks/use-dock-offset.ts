import { useEffect, type RefObject } from 'react'

export function useDockOffset(dockRef: RefObject<HTMLElement | null>, isVisible: boolean): void {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const style = document.documentElement.style

    if (!isVisible || !dockRef.current) {
      style.setProperty('--selection-dock-offset', '0px')
      return
    }

    const dock = dockRef.current

    function syncOffset() {
      if (!dock) return
      const rect = dock.getBoundingClientRect()
      if (rect.height === 0) {
        style.setProperty('--selection-dock-offset', '0px')
        return
      }
      const gap = Number.parseFloat(getComputedStyle(dock).getPropertyValue('--dock-gap')) || 12
      const offset = Math.ceil(rect.height + gap * 2)
      style.setProperty('--selection-dock-offset', `${offset}px`)
    }

    syncOffset()

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(syncOffset)
      observer.observe(dock)
    }

    window.addEventListener('resize', syncOffset, { passive: true })

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', syncOffset)
      style.setProperty('--selection-dock-offset', '0px')
    }
  }, [dockRef, isVisible])
}
