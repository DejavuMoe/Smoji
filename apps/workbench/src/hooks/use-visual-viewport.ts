import { useEffect } from 'react'

export function useVisualViewport(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return

    function syncKeyboardInset(): void {
      const vv = window.visualViewport
      const height = vv?.height ?? window.innerHeight
      const top = vv?.offsetTop ?? 0
      const inset = Math.max(0, window.innerHeight - height - top)
      const style = document.documentElement.style
      style.setProperty('--viewport-height', `${height}px`)
      style.setProperty('--viewport-top', `${top}px`)
      style.setProperty('--keyboard-inset', `${inset}px`)
    }

    syncKeyboardInset()
    window.addEventListener('resize', syncKeyboardInset, { passive: true })
    window.visualViewport?.addEventListener('resize', syncKeyboardInset, { passive: true })
    window.visualViewport?.addEventListener('scroll', syncKeyboardInset, { passive: true })

    return () => {
      window.removeEventListener('resize', syncKeyboardInset)
      window.visualViewport?.removeEventListener('resize', syncKeyboardInset)
      window.visualViewport?.removeEventListener('scroll', syncKeyboardInset)
    }
  }, [])
}
