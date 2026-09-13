import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import schema from '../data.schema.json'
import { assertManifestSize, parseSmojiManifest } from '../src/manifest'
import type { SmojiPack } from '../src/types'
import {
  buildArtalkExport,
  buildCustomExportManifest,
  buildExportManifest,
  buildOwOExport,
  buildTwikooExport,
  generateFormattedExport,
  serializeAndValidateManifest,
  toExportItemSrc,
} from '../../../apps/workbench/src/export'

describe('demo and schema contracts', () => {
  it('demo sources do not reference catalog.json or pack.json', async () => {
    const files = [
      'apps/workbench/src/main.ts',
      'apps/workbench/src/export.ts',
      'apps/workbench/index.html',
      'apps/workbench/src/site.css',
    ]
    for (const file of files) {
      const text = await readFile(resolve(file), 'utf8')
      expect(text).not.toMatch(/catalog\.json|pack\.json/)
      expect(text).not.toContain('<textarea')
      expect(text).not.toMatch(/createSmoji|textTarget/)
    }
  })

  it('JSON Schema encodes v1 exact keys and limits', () => {
    expect(schema.additionalProperties).toBe(false)
    expect(schema.properties.version).toEqual({ const: 1 })
    expect(schema.properties.packs.maxItems).toBe(64)
    expect(schema.$defs.pack.additionalProperties).toBe(false)
    expect(schema.$defs.item.additionalProperties).toBe(false)
    expect(schema.$defs.pack.properties.items.maxItems).toBe(600)
    expect(schema.$defs.pack.required).toEqual(['id', 'label', 'items'])
    expect(schema.$defs.item.required).toEqual(['id', 'label'])
    expect(schema.properties.base.type).toBe('string')
    expect(schema.allOf[0].then.properties.packs.items.properties.items.items.required).toEqual(['src'])
  })

  it('schema label and template patterns match runtime constraints', () => {
    const labelPattern = new RegExp(schema.$defs.label.pattern, 'u')
    for (const label of ['猫', '  ' + '😀'.repeat(40) + '  ', 'a b']) {
      expect(labelPattern.test(label)).toBe(true)
    }
    for (const label of ['', '   ', '😀'.repeat(41), '坏]', '坏\u0085', '坏\n']) {
      expect(labelPattern.test(label)).toBe(false)
    }
    const basePattern = new RegExp(schema.properties.base.pattern, 'u')
    expect(basePattern.test('./{pack}/{id}.webp')).toBe(true)
    expect(basePattern.test('./{pack}/{id}/{unknown}.webp')).toBe(false)
    expect(basePattern.test('./{id}.webp')).toBe(false)
  })

  it('schema sample matches the runtime validator', () => {
    const sample = {
      version: 1,
      packs: [{
        id: 'cats',
        label: '猫猫',
        items: [{ id: 'wave', label: '挥手', src: './cats/wave.webp' }],
      }],
    }
    const manifest = parseSmojiManifest(sample, 'https://static.example.test/smoji.json')
    expect(manifest.packs[0]!.items[0]!.src).toBe('https://static.example.test/cats/wave.webp')
  })

  const sampleSourcePacks: readonly SmojiPack[] = [
    {
      id: 'pack_a',
      label: '表情包A',
      items: [
        { id: 'a_01', label: 'A01', src: 'https://static.example.test/pack_a/a_01.png' },
        { id: 'a_02', label: 'A02', src: 'https://static.example.test/pack_a/a_02.png' },
      ],
    },
    {
      id: 'pack_b',
      label: '表情包B',
      items: [
        { id: 'b_01', label: 'B01', src: 'https://static.example.test/pack_b/b_01.png' },
      ],
    },
    {
      id: 'pack_c',
      label: '表情包C',
      items: [
        { id: 'c_01', label: 'C01', src: 'https://static.example.test/pack_c/c_01.png' },
        { id: 'c_02', label: 'C02', src: 'https://static.example.test/pack_c/c_02.png' },
      ],
    },
  ]
  const manifestUrl = 'https://static.example.test/smoji.json'

  it('exports only selected packs when two packs are selected', () => {
    const selected = new Set(['pack_c', 'pack_a'])
    const manifest = buildExportManifest(sampleSourcePacks, selected, manifestUrl)
    expect(manifest.packs.map((p) => p.id)).toEqual(['pack_a', 'pack_c'])
  })

  it('preserves source pack and item order rather than selection order', () => {
    const selected = new Set<string>()
    selected.add('pack_c')
    selected.add('pack_a')
    const manifest = buildExportManifest(sampleSourcePacks, selected, manifestUrl)
    expect(manifest.packs[0]!.id).toBe('pack_a')
    expect(manifest.packs[1]!.id).toBe('pack_c')
    expect(manifest.packs[0]!.items.map((i) => i.id)).toEqual(['a_01', 'a_02'])
    expect(manifest.packs[1]!.items.map((i) => i.id)).toEqual(['c_01', 'c_02'])
  })

  it('output contains no extra fields or UI states', () => {
    const selected = new Set(['pack_a', 'pack_b'])
    const manifest = buildExportManifest(sampleSourcePacks, selected, manifestUrl)

    const forbiddenKeys = [
      'selected',
      'checked',
      'count',
      'cover',
      'active',
      'preview',
      'type',
      'value',
    ]

    expect(Object.keys(manifest).sort()).toEqual(['packs', 'version'])
    for (const key of forbiddenKeys) {
      expect((manifest as unknown as Record<string, unknown>)[key]).toBeUndefined()
    }

    for (const pack of manifest.packs) {
      expect(Object.keys(pack).sort()).toEqual(['id', 'items', 'label'])
      for (const key of forbiddenKeys) {
        expect((pack as unknown as Record<string, unknown>)[key]).toBeUndefined()
      }
      for (const item of pack.items) {
        expect(Object.keys(item).sort()).toEqual(['id', 'label', 'src'])
        for (const key of forbiddenKeys) {
          expect((item as unknown as Record<string, unknown>)[key]).toBeUndefined()
        }
      }
    }
  })

  it('preserves absolute image origins and rejects unsafe URLs', () => {
    const selected = new Set(['pack_a'])
    const manifest = buildExportManifest(sampleSourcePacks, selected, manifestUrl)
    expect(manifest.packs[0]!.items[0]!.src).toBe('https://static.example.test/pack_a/a_01.png')

    // A different manifest location must not rewrite an absolute image URL.
    const localManifest = buildExportManifest(
      sampleSourcePacks,
      selected,
      'http://localhost:5173/smoji.json',
    )
    expect(localManifest.packs[0]!.items[0]!.src).toBe('https://static.example.test/pack_a/a_01.png')

    // The same applies to LAN preview hosts.
    const lanManifest = buildExportManifest(
      sampleSourcePacks,
      selected,
      'http://10.111.1.112:5173/smoji.json',
    )
    expect(lanManifest.packs[0]!.items[0]!.src).toBe('https://static.example.test/pack_a/a_01.png')

    for (const item of manifest.packs[0]!.items) {
      expect(item.src).not.toContain('blob:')
      expect(item.src).not.toContain('?')
      expect(item.src).not.toContain('#')
    }

    expect(() =>
      toExportItemSrc('blob:http://localhost/pack_a/01.png', manifestUrl),
    ).toThrow(/协议必须为 http 或 https/)

    expect(() =>
      toExportItemSrc('https://static.example.test/../secret.png', manifestUrl),
    ).toThrow(/相对路径非法/)

    expect(() =>
      toExportItemSrc('https://static.example.test/pack_a/01.png?v=1', manifestUrl),
    ).toThrow(/查询参数或片段/)

    expect(() =>
      toExportItemSrc('https://static.example.test/pack_a/01.png#anchor', manifestUrl),
    ).toThrow(/查询参数或片段/)
  })

  it('disallows export when zero packs are selected', () => {
    expect(() => buildExportManifest(sampleSourcePacks, new Set(), manifestUrl)).toThrow(
      /未选择任何表情包/,
    )
  })

  it('generated result passes parseSmojiManifest() validation', () => {
    const selected = new Set(['pack_a', 'pack_c'])
    const manifest = buildExportManifest(sampleSourcePacks, selected, manifestUrl)
    const parsed = parseSmojiManifest(manifest, manifestUrl)
    expect(parsed.version).toBe(1)
    expect(parsed.packs.length).toBe(2)
    expect(parsed.packs[0]!.items[0]!.src).toBe('https://static.example.test/pack_a/a_01.png')
  })

  it('generated json does not exceed 1 MiB and asserts size correctly', () => {
    const selected = new Set(['pack_a', 'pack_b', 'pack_c'])
    const manifest = buildExportManifest(sampleSourcePacks, selected, manifestUrl)
    const json = serializeAndValidateManifest(manifest, manifestUrl)
    const byteLength = new TextEncoder().encode(json).length
    expect(byteLength).toBeLessThanOrEqual(1024 * 1024)

    const hugeText = 'x'.repeat(1024 * 1024 + 1)
    expect(() => assertManifestSize(hugeText)).toThrow('manifest-too-large')
  })

  it('custom packs builder preserves exact picking order across source categories and generates multiple groups', () => {
    const customPacks = [
      {
        id: 'favorites',
        label: '常用精选',
        items: [
          { id: 'c_02', label: 'C02', src: 'https://static.example.test/pack_c/c_02.png' },
          { id: 'a_01', label: 'A01', src: 'https://static.example.test/pack_a/a_01.png' },
          { id: 'b_01', label: 'B01', src: 'https://static.example.test/pack_b/b_01.png' },
        ],
      },
      {
        id: 'pets',
        label: '萌宠组',
        items: [
          { id: 'a_02', label: 'A02', src: 'https://static.example.test/pack_a/a_02.png' },
          { id: 'c_01', label: 'C01', src: 'https://static.example.test/pack_c/c_01.png' },
        ],
      },
    ]

    const manifest = buildCustomExportManifest(customPacks, manifestUrl)

    expect(manifest.packs.length).toBe(2)
    expect(manifest.packs[0]!.id).toBe('favorites')
    expect(manifest.packs[0]!.label).toBe('常用精选')
    expect(manifest.packs[0]!.items.map((i) => i.id)).toEqual(['c_02', 'a_01', 'b_01'])

    expect(manifest.packs[1]!.id).toBe('pets')
    expect(manifest.packs[1]!.label).toBe('萌宠组')
    expect(manifest.packs[1]!.items.map((i) => i.id)).toEqual(['a_02', 'c_01'])

    const parsed = parseSmojiManifest(manifest, manifestUrl)
    expect(parsed.packs.length).toBe(2)
    expect(parsed.packs[0]!.items[0]!.src).toBe('https://static.example.test/pack_c/c_02.png')

    expect(() =>
      buildCustomExportManifest([{ id: 'empty', label: '空', items: [] }], manifestUrl),
    ).toThrow(/未在任何分组中添加表情/)

    expect(() =>
      buildCustomExportManifest(
        [
          { id: 'dup', label: '组1', items: [{ id: '1', label: '1', src: 'https://static.example.test/1.png' }] },
          { id: 'dup', label: '组2', items: [{ id: '2', label: '2', src: 'https://static.example.test/2.png' }] },
        ],
        manifestUrl,
      ),
    ).toThrow(/分组 ID 重复/)
  })

  it('supports exporting in Artalk, Twikoo, and OwO formats', () => {
    const customPacks = [
      {
        id: 'favorites',
        label: '常用精选',
        items: [
          { id: 'c_02', label: 'C02', src: 'https://static.example.test/pack_c/c_02.png' },
          { id: 'a_01', label: 'A01', src: 'https://static.example.test/pack_a/a_01.png' },
        ],
      },
    ]

    // 1. Artalk
    const artalk = buildArtalkExport(customPacks, manifestUrl)
    expect(Array.isArray(artalk)).toBe(true)
    expect(artalk[0]!.name).toBe('常用精选')
    expect(artalk[0]!.type).toBe('image')
    expect(artalk[0]!.items[0]!.key).toBe('C02')
    expect(artalk[0]!.items[0]!.val).toBe('https://static.example.test/pack_c/c_02.png')

    // 2. Twikoo
    const twikoo = buildTwikooExport(customPacks, manifestUrl)
    expect(twikoo['常用精选']!.type).toBe('image')
    expect(twikoo['常用精选']!.container[0]!.text).toBe('c_02')
    expect(twikoo['常用精选']!.container[0]!.icon).toBe(
      '<img src="https://static.example.test/pack_c/c_02.png">',
    )

    // 3. OwO
    const owo = buildOwOExport(customPacks, manifestUrl)
    expect(owo['常用精选']!.type).toBe('image')
    expect(owo['常用精选']!.name).toBe('favorites')
    expect(owo['常用精选']!.container[0]!.text).toBe('c_02')
    expect(owo['常用精选']!.container[0]!.icon).toBe(
      '<img src="https://static.example.test/pack_c/c_02.png">',
    )

    // 4. generateFormattedExport for all targets
    const exportSmoji = generateFormattedExport('smoji', customPacks, manifestUrl)
    expect(exportSmoji.filename).toBe('smoji.json')
    expect(JSON.parse(exportSmoji.content).version).toBe(1)

    const exportArtalk = generateFormattedExport('artalk', customPacks, manifestUrl)
    expect(exportArtalk.filename).toBe('artalk.json')
    expect(Array.isArray(JSON.parse(exportArtalk.content))).toBe(true)

    const exportTwikoo = generateFormattedExport('twikoo', customPacks, manifestUrl)
    expect(exportTwikoo.filename).toBe('twikoo.json')
    expect(JSON.parse(exportTwikoo.content)['常用精选']).toBeDefined()

    const exportOwO = generateFormattedExport('owo', customPacks, manifestUrl)
    expect(exportOwO.filename).toBe('OwO.json')
    expect(JSON.parse(exportOwO.content)['常用精选']).toBeDefined()
  })

  it('desktop and narrow screen UI controls contract is maintained', async () => {
    const html = await readFile(resolve('apps/workbench/index.html'), 'utf8')
    const css = await readFile(resolve('apps/workbench/src/site.css'), 'utf8')
    const main = await readFile(resolve('apps/workbench/src/main.ts'), 'utf8')

    expect(html).toContain('id="pack-nav"')
    expect(html).toContain('id="tab-packs"')
    expect(html).toContain('id="tab-custom"')
    expect(html).toContain('id="custom-builder"')
    expect(html).toContain('id="custom-pack-list"')
    expect(html).toContain('id="gallery-export-count"')
    expect(html).toContain('id="quick-export"')
    expect(html).toContain('id="selection-dock-format"')
    expect(html).toContain('id="selection-dock-export"')
    expect(main).toContain('for (const fmt of toolbarExportFormats())')
    expect(html).toContain('class="export-toolbar"')
    expect(html).not.toContain('class="sidebar__github"')
    expect(html).not.toContain('class="export-box"')

    expect(main).toContain('row.className = \'pack-row\'')
    expect(main).toContain('checkbox.type = \'checkbox\'')
    expect(main).toContain('checkbox.className = \'pack-check\'')
    expect(main).toContain('selectLabel.append(checkbox)')
    expect(main).toContain('row.append(selectLabel, button)')
    expect(main).not.toMatch(/button\.append\([^)]*checkbox/)
    expect(main).toContain('handleCustomItemClick')
    expect(main).toContain('handlePackItemToggle')
    expect(main).toContain('excludedItemSrcs')
    expect(main).toContain('card__badge')
    expect(main).toContain('card__check-hover')
    expect(main).toContain('card__action-btn')
    expect(main).toContain('popToggleGroupBtn')
    expect(main).toContain('triggerExport')

    expect(css).toContain('.pack-row')
    expect(css).toContain('.pack-check')
    expect(css).toContain('.mode-tabs')
    expect(css).toContain('.card__badge')
    expect(css).toContain('.card.is-excluded')
    expect(css).toContain('.card__action-btn')
    expect(css).toContain('.gallery__header')
    expect(css).toContain('.export-toolbar')
    expect(css).toContain('.pop__group-btn')
    expect(css).toContain('@media (max-width: 900px)')

    // Enhanced UI/UX feature contracts
    expect(html).not.toContain('type="search"')
    expect(html).toContain('id="gallery-view-picked"')
    expect(html).not.toContain('id="pop-media-toggle"')
    expect(html).toContain('id="theme-toggle"')
    expect(html).toContain('id="code-modal"')
    expect(html).toContain('id="guide-modal"')
    expect(html).toContain('id="toast-container"')
    expect(html).toContain('id="btn-select-all-packs"')
    expect(html).toContain('id="density-toggle"')

    expect(main).toContain('applyTheme')
    expect(main).toContain('showToast')
    expect(main).toContain('updateCodePreview')
    expect(main).toContain('navigatePop')

    expect(css).toContain('--bg')
    expect(css).toContain('--surface')
    expect(css).toContain('.toast-container')
    expect(css).toContain('.code-modal')
  })
})
