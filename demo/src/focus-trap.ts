export interface TrapFocusOptions {
  initialFocus?: HTMLElement | (() => HTMLElement | null) | null
}

/** Lightweight focus trap for modal dialogs. */
export function trapFocus(container: HTMLElement, options?: TrapFocusOptions): () => void {
  const focusableSelector =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

  const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null

  const visibleFocusables = (): HTMLElement[] =>
    [...container.querySelectorAll<HTMLElement>(focusableSelector)].filter((el) => {
      if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') return false
      if (el.closest('[hidden]')) return false
      if (el.closest('[aria-hidden="true"]')) return false
      const style = window.getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') return false
      return el.isConnected
    })

  const focusFirst = (): void => {
    let target: HTMLElement | null = null
    if (options?.initialFocus) {
      target = typeof options.initialFocus === 'function' ? options.initialFocus() : options.initialFocus
      if (target && (!target.isConnected || target.closest('[hidden]') || target.getAttribute('aria-hidden') === 'true')) {
        target = null
      }
    }
    if (!target) {
      const nodes = visibleFocusables()
      target = nodes[0] ?? container
    }
    target?.focus()
  }

  // Defer so the dialog is visible before focusing
  requestAnimationFrame(focusFirst)

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') return
    const nodes = visibleFocusables()
    if (!nodes.length) {
      event.preventDefault()
      container.focus()
      return
    }
    const first = nodes[0]!
    const last = nodes[nodes.length - 1]!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  container.addEventListener('keydown', onKeyDown)
  if (!container.hasAttribute('tabindex')) container.tabIndex = -1

  return () => {
    container.removeEventListener('keydown', onKeyDown)
    previouslyFocused?.focus()
  }
}
