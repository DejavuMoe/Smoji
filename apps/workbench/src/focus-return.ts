import { useRef } from 'react'

/** Each overlay owns its trigger; nested overlays never consume their parent's target. */
export function useFocusReturn(fallbackSelector = '#grid, #gallery-empty-action', returnSelector?: string) {
  const trigger = useRef<HTMLElement | null>(null)
  const content = useRef<HTMLElement | null>(null)
  const originGroup = useRef<HTMLElement | null>(null)
  const originIndex = useRef(-1)

  return {
    onOpenAutoFocus(event: Event) {
      content.current = event.target as HTMLElement
      const candidate = returnSelector
        ? document.querySelector<HTMLElement>(returnSelector)
        : document.activeElement
      if (candidate instanceof HTMLElement && !content.current?.contains(candidate)) {
        trigger.current = candidate === document.body ? null : candidate
        originGroup.current = candidate.closest<HTMLElement>('[data-custom-index]')
        originIndex.current = Number(candidate.closest<HTMLElement>('[data-tray-item]')?.dataset.trayItem ?? -1)
      }
    },
    onCloseAutoFocus(event: Event) {
      event.preventDefault()
      requestAnimationFrame(() => {
        const active = document.activeElement
        // An explicit navigation (e.g. drawer -> gallery) has already placed focus.
        if (active instanceof HTMLElement && active !== document.body && active.isConnected &&
          !content.current?.contains(active) && active !== trigger.current) return
        const group = originGroup.current
        const neighbors = group?.querySelectorAll<HTMLElement>('[data-tray-item]')
        const adjacent = neighbors?.[Math.min(originIndex.current, neighbors.length - 1)]
        const target = [
          trigger.current,
          adjacent,
          group?.querySelector<HTMLElement>('.custom-pack-name'),
          ...fallbackSelector.split(',').map(selector => document.querySelector<HTMLElement>(selector.trim())),
        ].find(element => element?.isConnected && element.getClientRects().length &&
          !element.matches(':disabled') && !element.closest('[inert]'))
        target?.focus()
      })
    },
  }
}
