import { describe, expect, it } from 'vitest'
import {
  EXPORT_FORMAT_REGISTRY,
  dockExportFormats,
  isDockExportFormat,
  previewExportFormats,
  toolbarExportFormats,
} from './export'
import { buildCustomGroupBundle, parseCustomGroupExtensions } from './storage'
import {
  WORKBENCH_EXTENSION_ID,
  buildWorkbenchExtensionPayload,
  mergeWorkbenchExtension,
} from './workbench-extension'
import {
  applyPackGroupExtensions,
  mergePackGroupExtensions,
  registerPackGroupExtension,
} from './pack-group-extensions'

describe('workbench extensibility pipeline', () => {
  it('keeps export chrome subsets aligned with the registry', () => {
    const dock = new Set(dockExportFormats().map((f) => f.id))
    const toolbar = new Set(toolbarExportFormats().map((f) => f.id))
    const preview = new Set(previewExportFormats().map((f) => f.id))

    for (const fmt of EXPORT_FORMAT_REGISTRY) {
      expect(dock.has(fmt.id)).toBe(Boolean(fmt.dock))
      expect(toolbar.has(fmt.id)).toBe(Boolean(fmt.toolbar))
      expect(preview.has(fmt.id)).toBe(Boolean(fmt.preview))
    }

    expect(isDockExportFormat('smoji')).toBe(true)
    expect(isDockExportFormat('markdown')).toBe(false)
  })

  it('round-trips smoji.workbench prefs through custom-group bundles', () => {
    registerPackGroupExtension(WORKBENCH_EXTENSION_ID, {
      merge: mergeWorkbenchExtension,
    })

    const payload = buildWorkbenchExtensionPayload({
      preferredDockFormat: 'owo',
      notes: 'integration',
    })
    const bundle = buildCustomGroupBundle(
      [{ id: 'g1', label: '常用', items: [] }],
      { [WORKBENCH_EXTENSION_ID]: payload },
    )

    const parsed = parseCustomGroupExtensions(bundle)
    expect(parsed?.[WORKBENCH_EXTENSION_ID]).toEqual(payload)

    const merged = mergePackGroupExtensions(
      { [WORKBENCH_EXTENSION_ID]: { preferredDockFormat: 'smoji' } },
      parsed!,
    )
    expect(merged[WORKBENCH_EXTENSION_ID]).toMatchObject({
      preferredDockFormat: 'owo',
      notes: 'integration',
    })

    const applied: string[] = []
    registerPackGroupExtension(WORKBENCH_EXTENSION_ID, {
      merge: mergeWorkbenchExtension,
      apply: (value) => {
        const fmt =
          value && typeof value === 'object' && 'preferredDockFormat' in value
            ? String((value as { preferredDockFormat?: string }).preferredDockFormat)
            : ''
        applied.push(fmt)
      },
    })
    expect(applyPackGroupExtensions(merged, { packCount: 1, itemCount: 0 })).toEqual([])
    expect(applied).toEqual(['owo'])
  })
})
