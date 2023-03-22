import { describe, expect, it } from 'vitest'
import {
  DOCK_EXPORT_FORMAT_IDS,
  EXPORT_FORMAT_REGISTRY,
  dockExportFormats,
  isDockExportFormat,
  stampDownloadFilename,
  toExportItemSrc,
} from './export'

describe('stampDownloadFilename', () => {
  it('inserts YYYYMMDD before the extension', () => {
    const stamped = stampDownloadFilename('smoji.json')
    expect(stamped).toMatch(/^smoji-\d{8}\.json$/)
  })

  it('handles markdown and OwO names', () => {
    expect(stampDownloadFilename('OwO.json')).toMatch(/^OwO-\d{8}\.json$/)
    expect(stampDownloadFilename('smoji-markers.md')).toMatch(/^smoji-markers-\d{8}\.md$/)
  })

  it('appends stamp when there is no extension', () => {
    expect(stampDownloadFilename('bundle')).toMatch(/^bundle-\d{8}$/)
  })
})

describe('export format registry', () => {
  it('exposes dock formats as a stable subset', () => {
    expect(dockExportFormats().map((f) => f.id)).toEqual([...DOCK_EXPORT_FORMAT_IDS])
    expect(isDockExportFormat('smoji')).toBe(true)
    expect(isDockExportFormat('markdown')).toBe(false)
  })

  it('splits toolbar and preview subsets from the registry', async () => {
    const { toolbarExportFormats, previewExportFormats } = await import('./export')
    expect(toolbarExportFormats().every((f) => f.toolbar)).toBe(true)
    expect(previewExportFormats().map((f) => f.id)).toContain('markdown')
    expect(toolbarExportFormats().map((f) => f.id)).not.toContain('markdown')
  })

  it('keeps every registry id unique', () => {
    const ids = EXPORT_FORMAT_REGISTRY.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('accepts runtime-registered export formats', async () => {
    const {
      registerExportFormat,
      dockExportFormats,
      generateFormattedExport,
      onExportRegistryChange,
    } = await import('./export')
    let notified = 0
    const stop = onExportRegistryChange(() => {
      notified += 1
    })
    registerExportFormat(
      { id: 'demo-plugin', label: 'Demo Plugin', dock: true, preview: true },
      () => ({ content: '{"ok":true}\n', filename: 'demo-plugin.json' }),
    )
    expect(dockExportFormats().map((f) => f.id)).toContain('demo-plugin')
    expect(generateFormattedExport('demo-plugin', [], 'https://example.com/smoji.json')).toEqual({
      content: '{"ok":true}\n',
      filename: 'demo-plugin.json',
    })
    expect(notified).toBeGreaterThanOrEqual(1)
    stop()
  })
})

it('exports CDN subdirectory and external image URLs without duplicating or replacing their base', () => {
  const base = 'https://s3-cdn.zsh.moe/smoji/smoji.json'
  const src = 'https://s3-cdn.zsh.moe/smoji/coolapk/pcblfgpbbobn.webp'
  expect(toExportItemSrc(src, base)).toBe(src)
  expect(toExportItemSrc('./coolapk/pcblfgpbbobn.webp', base)).toBe(src)
  expect(toExportItemSrc('https://images.example/stickers/wave.gif', base)).toBe('https://images.example/stickers/wave.gif')
})
