import { describe, expect, it, vi } from 'vitest'
import { WorkbenchStore } from './state'

describe('WorkbenchStore', () => {
  it('initializes with defaults and allows partial overrides', () => {
    const store = new WorkbenchStore({ mode: 'custom', activePack: 2 })
    expect(store.get('mode')).toBe('custom')
    expect(store.get('activePack')).toBe(2)
    expect(store.get('previewScope')).toBe('active')
  })

  it('notifies subscribers on set and update', () => {
    const store = new WorkbenchStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    store.set('previewScope', 'all')
    expect(listener).toHaveBeenCalledWith('previewScope', 'all', expect.any(Object))

    store.update({ mode: 'custom', activePack: 1 })
    expect(listener).toHaveBeenCalledWith('mode', 'custom', expect.any(Object))
    expect(listener).toHaveBeenCalledWith('activePack', 1, expect.any(Object))

    unsubscribe()
    store.set('previewScope', 'selected')
    expect(listener).toHaveBeenCalledTimes(3)
  })
})
