import { describe, expect, it, vi } from 'vitest'
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
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-09-13T00:30:00+08:00'))
      expect(stampDownloadFilename('smoji.json')).toBe('smoji-20260912.json')
    } finally {
      vi.useRealTimers()
    }
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

it('exports local preview images using CDN templates and keeps custom group paths', async () => {
  const { buildCustomExportManifest, serializeAndValidateManifest } = await import('./export')
  const { parseSmojiManifest } = await import('../../packages/smoji/src/manifest')
  const local = 'http://localhost:5173/smoji.json'
  const groups = [
    { id: 'cats', label: '猫', items: [{ id: 'wave', label: '挥手', src: 'http://localhost:5173/cats/wave.webp' }] },
    { id: 'custom', label: '自选', items: [{ id: 'wave', label: '挥手', src: 'http://localhost:5173/cats/wave.webp' }] },
  ]
  const text = serializeAndValidateManifest(buildCustomExportManifest(groups, local), local)
  const raw = JSON.parse(text)
  expect(raw.base).toBe('https://s3-cdn.zsh.moe/smoji/{pack}/{id}.webp')
  expect(raw.packs[0].items[0]).toEqual({ id: 'wave', label: '挥手' })
  expect(text).not.toContain('localhost')
  const parsed = parseSmojiManifest(raw, 'https://s3-cdn.zsh.moe/smoji/smoji.json')
  expect(parsed.packs[1]!.items[0]!.src).toBe('https://s3-cdn.zsh.moe/smoji/cats/wave.webp')
})

it('exports Waline objects with round-trippable keys for mixed formats and custom groups', async () => {
  const { buildWalineExport, generateFormattedExport } = await import('./export')
  const base = 'http://localhost:5173/smoji.json'
  const packs = [{ id: 'favorites', label: '精选', items: [
    { id: 'wave', label: '挥手', src: './cats/wave.webp' },
    { id: 'wave', label: '挥手动图', src: './dogs/wave.gif' },
    { id: 'png', label: '图片', src: './dogs/png.png' },
  ] }]
  const { content, filename } = generateFormattedExport('waline', packs, base)
  const groups = JSON.parse(content)
  expect(filename).toBe('waline.json')
  expect(groups).toHaveLength(1)
  expect(groups[0].name).toBe('精选')
  expect(groups[0].prefix).toBe('')
  expect(groups[0].type).toBe('')
  // Reconstruct URLs and :key: matching exactly as Waline does.
  const urls = groups.flatMap((g: { folder: string; items: string[] }) => g.items.map(key => {
    expect(`:${key}:`.match(/^:(.+?):$/u)?.[1]).toBe(key)
    return `${g.folder}/${key}`
  }))
  expect(urls).toEqual(['cats/wave.webp', 'dogs/wave.gif', 'dogs/png.png'].map(path => `https://s3-cdn.zsh.moe/smoji/${path}`))
  expect(groups[0].icon).toBe(groups[0].items[0])
  expect(() => buildWalineExport([], base)).toThrow('未选择')
  expect(() => buildWalineExport([{ ...packs[0]!, items: [{ id: 'bad', label: '坏', src: 'javascript:alert(1)' }] }], base)).toThrow()
  const external = [{ id: 'x', label: '跨源', items: [
    { id: 'a', label: 'A', src: 'https://a.example/x.webp' },
    { id: 'b', label: 'B', src: 'https://b.example/y.gif' },
  ] }]
  expect(buildWalineExport(external, base).map(g => g.folder)).toEqual(['https://a.example', 'https://b.example'])
  expect(() => buildWalineExport([{ ...external[0]!, items: [...external[0]!.items, { id: 'c', label: 'C', src: 'https://b.example/x.webp' }] }], base)).toThrow('键冲突')
})
