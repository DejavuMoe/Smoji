export interface TrapFocusOptions {
  initialFocus?: HTMLElement | (() => HTMLElement | null) | null
}

/** Lightweight focus trap for modal dialogs. */
export function trapFocus(container: HTMLElement, options?: TrapFocusOptions): () => void {
  const focusableSelector =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

  const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null

  const visible = (el: HTMLElement): boolean => {
    if (!el.isConnected || el.closest('[hidden], [inert], [aria-hidden="true"]')) return false
    for (let parent: HTMLElement | null = el; parent; parent = parent.parentElement) {
      const style = window.getComputedStyle(parent)
      if (style.display === 'none' || style.visibility === 'hidden') return false
      if (parent instanceof HTMLDetailsElement && !parent.open &&
          !parent.querySelector(':scope > summary')?.contains(el)) return false
    }
    return true
  }
  const visibleFocusables = (): HTMLElement[] =>
    [...container.querySelectorAll<HTMLElement>(focusableSelector)]
      .filter((el) => el.tabIndex >= 0 && !el.hasAttribute('disabled') && visible(el))

  const focusFirst = (): void => {
    let target: HTMLElement | null = null
    if (options?.initialFocus) {
      target = typeof options.initialFocus === 'function' ? options.initialFocus() : options.initialFocus
      if (target && !visible(target)) {
        target = null
      }
    }
    if (!target) {
      const nodes = visibleFocusables()
      target = nodes[0] ?? container
    }
    target?.focus({ preventScroll: true })
  }

  // Defer so the dialog is visible before focusing
  const frame = requestAnimationFrame(() => {
    // A user may already have reached a control before the next frame.
    if (!container.contains(document.activeElement)) focusFirst()
  })

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') return
    if (container.closest('[inert]')) return
    const nodes = visibleFocusables()
    if (!nodes.length) {
      event.preventDefault()
      container.focus()
      return
    }
    const first = nodes[0]!
    const last = nodes[nodes.length - 1]!
    const active = document.activeElement
    if (event.shiftKey && (active === first || !nodes.includes(active as HTMLElement))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (active === last || !nodes.includes(active as HTMLElement))) {
      event.preventDefault()
      first.focus()
    }
  }

  container.addEventListener('keydown', onKeyDown)
  if (!container.hasAttribute('tabindex')) container.tabIndex = -1

  return () => {
    cancelAnimationFrame(frame)
    container.removeEventListener('keydown', onKeyDown)
    if (previouslyFocused && visible(previouslyFocused)) previouslyFocused.focus({ preventScroll: true })
  }
}
