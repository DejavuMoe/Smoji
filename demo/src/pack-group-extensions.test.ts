import { describe, expect, it } from 'vitest'
import {
  applyPackGroupExtensions,
  listPackGroupExtensionIds,
  listUnknownPackGroupExtensionIds,
  mergePackGroupExtensions,
  registerPackGroupExtension,
} from './pack-group-extensions'

describe('pack group extensions', () => {
  it('merges with custom handler and validates on apply', () => {
    registerPackGroupExtension('demo-source', {
      merge: (current, incoming) => ({
        ...(typeof current === 'object' && current ? current : {}),
        ...(typeof incoming === 'object' && incoming ? incoming : {}),
      }),
      validate: (value) => {
        if (!value || typeof value !== 'object') return 'expected object'
      },
    })

    expect(listPackGroupExtensionIds()).toContain('demo-source')

    const merged = mergePackGroupExtensions(
      { 'demo-source': { schema: 1 } },
      { 'demo-source': { label: 'demo' } },
    )
    expect(merged['demo-source']).toEqual({ schema: 1, label: 'demo' })

    const errors = applyPackGroupExtensions(merged, { packCount: 1, itemCount: 2 })
    expect(errors).toEqual([])
  })

  it('lists unknown extension ids preserved without handlers', () => {
    const unknown = listUnknownPackGroupExtensionIds({
      'demo-source': { ok: true },
      'future.plugin': { v: 1 },
    })
    expect(unknown).toContain('future.plugin')
    expect(unknown).not.toContain('demo-source')
  })
})
