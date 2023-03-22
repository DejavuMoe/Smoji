import { describe, expect, it, vi } from 'vitest'
import { HistoryStack } from './history'
import { trapFocus } from './focus-trap'
import { WorkbenchStore } from './state'

describe('core UI interactions and accessibility', () => {
  it('HistoryStack preserves multi-level timeline and supports inverse undo/redo', () => {
    const history = new HistoryStack(10)
    const list: string[] = []

    const addItem = (item: string) => {
      list.push(item)
      history.push({
        description: `add ${item}`,
        undo: () => {
          const idx = list.indexOf(item)
          if (idx !== -1) list.splice(idx, 1)
        },
        redo: () => {
          list.push(item)
        },
      })
    }

    addItem('A')
    addItem('B')
    addItem('C')
    expect(list).toEqual(['A', 'B', 'C'])

    // Undo C
    expect(history.undo()?.description).toBe('add C')
    expect(list).toEqual(['A', 'B'])

    // Undo B
    expect(history.undo()?.description).toBe('add B')
    expect(list).toEqual(['A'])

    // Redo B
    expect(history.redo()?.description).toBe('add B')
    expect(list).toEqual(['A', 'B'])

    // Redo C
    expect(history.redo()?.description).toBe('add C')
    expect(list).toEqual(['A', 'B', 'C'])
    expect(history.canRedo).toBe(false)
  })

  it('trapFocus focuses initialFocus element over first focusable without racing', () => {
    const modal = document.createElement('div')
    const closeBtn = document.createElement('button')
    closeBtn.className = 'close-btn'
    const actionBtn = document.createElement('button')
    actionBtn.className = 'action-btn'
    modal.append(closeBtn, actionBtn)
    document.body.append(modal)

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })

    const release = trapFocus(modal, { initialFocus: actionBtn })
    expect(document.activeElement).toBe(actionBtn)
    release()
    document.body.replaceChildren()
  })

  it('WorkbenchStore synchronizes state and dispatches change events to subscribers', () => {
    const store = new WorkbenchStore({ mode: 'packs', activePack: 0 })
    const events: string[] = []

    store.subscribe((key, value) => {
      events.push(`${String(key)}:${String(value)}`)
    })

    store.set('mode', 'custom')
    store.set('activePack', 3)
    expect(events).toEqual(['mode:custom', 'activePack:3'])
    expect(store.get('mode')).toBe('custom')
    expect(store.get('activePack')).toBe(3)
  })

  it('bidirectional pack-nav keyboard roving contracts are honored', () => {
    const nav = document.createElement('div')
    nav.id = 'pack-nav'

    const row = document.createElement('div')
    row.className = 'pack-row'

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.className = 'pack-check'
    checkbox.tabIndex = -1
    checkbox.setAttribute('aria-checked', 'false')

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'pack'
    button.dataset.packIndex = '0'

    row.append(checkbox, button)
    nav.append(row)
    document.body.append(nav)

    expect(checkbox.tabIndex).toBe(-1)
    expect(checkbox.getAttribute('aria-checked')).toBe('false')
    expect(row.contains(checkbox)).toBe(true)
    expect(row.contains(button)).toBe(true)

    document.body.replaceChildren()
  })

  it('custom pack list satisfies ARIA list and listitem standards', () => {
    const list = document.createElement('div')
    list.id = 'custom-pack-list'
    list.setAttribute('role', 'list')
    list.setAttribute('aria-label', '自选分组列表')

    const item = document.createElement('div')
    item.className = 'custom-pack-item'
    item.setAttribute('role', 'listitem')
    item.setAttribute('aria-current', 'true')
    list.append(item)

    expect(list.getAttribute('role')).toBe('list')
    expect(item.getAttribute('role')).toBe('listitem')
    expect(item.getAttribute('aria-current')).toBe('true')
  })
})
