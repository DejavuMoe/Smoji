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

  it('skips closed disclosures and hidden ancestors, and cancels deferred focus on release', () => {
    const outside = document.createElement('button')
    const dialog = document.createElement('div')
    dialog.innerHTML = '<button>first</button><details><summary>options</summary><button>hidden option</button></details><div style="display:none"><button>hidden ancestor</button></div>'
    document.body.append(outside, dialog)
    outside.focus()
    let deferred: FrameRequestCallback | undefined
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { deferred = cb; return 42 })
    const cancel = vi.spyOn(window, 'cancelAnimationFrame')
    const release = trapFocus(dialog)
    deferred?.(0)
    dialog.querySelector('summary')!.focus()
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(dialog.querySelector('button'))
    release()
    expect(cancel).toHaveBeenCalledWith(42)
    expect(document.activeElement).toBe(outside)
  })
})
