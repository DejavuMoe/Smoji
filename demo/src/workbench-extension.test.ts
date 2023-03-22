import { describe, expect, it } from 'vitest'
import {
  WORKBENCH_EXTENSION_ID,
  buildWorkbenchExtensionPayload,
  mergeWorkbenchExtension,
  parseWorkbenchExtension,
} from './workbench-extension'

describe('workbench extension', () => {
  it('parses preferences and ignores legacy search scope', () => {
    expect(
      parseWorkbenchExtension({
        preferredDockFormat: 'artalk',
        notes: '  hello  ',
        junk: true,
      }),
    ).toEqual({
      preferredDockFormat: 'artalk',
      notes: 'hello',
    })
  })

  it('rejects invalid dock formats and ignores old scopes', () => {
    expect(parseWorkbenchExtension({ preferredDockFormat: 'markdown', searchScope: 'nope' })).toEqual({})
    expect(parseWorkbenchExtension(null)).toBeNull()
  })

  it('merges payloads shallowly with incoming wins', () => {
    expect(
      mergeWorkbenchExtension(
        { preferredDockFormat: 'smoji', notes: 'a' },
        { preferredDockFormat: 'owo' },
      ),
    ).toEqual({
      preferredDockFormat: 'owo',
      notes: 'a',
    })
  })

  it('builds a portable payload for export', () => {
    const payload = buildWorkbenchExtensionPayload({
      preferredDockFormat: 'twikoo',
      notes: 'bundle note',
    })
    expect(payload).toEqual({
      preferredDockFormat: 'twikoo',
      notes: 'bundle note',
    })
    expect(WORKBENCH_EXTENSION_ID).toBe('smoji.workbench')
  })
})
