import { afterEach, describe, expect, it, vi } from 'vitest'
import { trapFocus } from './focus-trap'

describe('trapFocus', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('cycles Tab within the container and restores focus on release', () => {
    const outside = document.createElement('button')
    outside.textContent = 'outside'
    document.body.append(outside)
    outside.focus()

    const dialog = document.createElement('div')
    const first = document.createElement('button')
    first.textContent = 'first'
    const second = document.createElement('button')
    second.textContent = 'second'
    dialog.append(first, second)
    document.body.append(dialog)

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })

    const release = trapFocus(dialog)
    expect(document.activeElement).toBe(first)

    second.focus()
    dialog.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(first)

    first.focus()
    dialog.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(document.activeElement).toBe(second)

    release()
    expect(document.activeElement).toBe(outside)
  })

  it('skips focusables under aria-hidden or display:none', () => {
    const dialog = document.createElement('div')
    const first = document.createElement('button')
    first.textContent = 'first'
    const hiddenWrap = document.createElement('div')
    hiddenWrap.setAttribute('aria-hidden', 'true')
    hiddenWrap.style.display = 'none'
    const ghost = document.createElement('input')
    ghost.id = 'ghost'
    hiddenWrap.append(ghost)
    const second = document.createElement('button')
    second.textContent = 'second'
    dialog.append(first, hiddenWrap, second)
    document.body.append(dialog)

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })

    trapFocus(dialog)
    expect(document.activeElement).toBe(first)

    // Wrap forward from last visible → first (must not land on ghost)
    second.focus()
    dialog.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(first)

    // Wrap backward from first → last visible
    first.focus()
    dialog.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(document.activeElement).toBe(second)
  })

  it('respects initialFocus option when provided', () => {
    const dialog = document.createElement('div')
    const first = document.createElement('button')
    first.textContent = 'first'
    const second = document.createElement('button')
    second.textContent = 'second'
    dialog.append(first, second)
    document.body.append(dialog)

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })

    trapFocus(dialog, { initialFocus: second })
    expect(document.activeElement).toBe(second)
  })
})
