import { describe, expect, it } from 'vitest'
import {
  buildCustomGroupBundle,
  parseCustomGroupBundle,
  serializeCustomPacks,
  loadCustomPacks,
  STORAGE_KEYS,
  type EditableCustomPack,
} from './storage'

describe('custom group portability', () => {
  const packs: EditableCustomPack[] = [
    {
      id: 'fav',
      label: '常用',
      items: [
        { id: 'a', label: '挥手', src: 'https://static.example.test/a.webp' },
        { id: 'b', label: '点赞', src: 'https://static.example.test/b.webp' },
      ],
    },
  ]

  it('serializes packs to src lists', () => {
    expect(serializeCustomPacks(packs)).toEqual([
      {
        id: 'fav',
        label: '常用',
        itemSrcs: ['https://static.example.test/a.webp', 'https://static.example.test/b.webp'],
      },
    ])
  })

  it('deduplicates merged old URLs while preserving custom-group item order', () => {
    localStorage.setItem(STORAGE_KEYS.customPacks, JSON.stringify([
      { id: 'fav', label: '常用', itemSrcs: ['old-one', 'old-two', 'other'] },
    ]))
    const restored = loadCustomPacks((src) => src === 'other' ? packs[0]!.items[1]! : packs[0]!.items[0]!)
    expect(restored.packs[0]!.items).toEqual(packs[0]!.items)
    localStorage.removeItem(STORAGE_KEYS.customPacks)
  })

  it('round-trips custom group bundle', () => {
    const bundle = buildCustomGroupBundle(packs)
    expect(bundle.kind).toBe('smoji-custom-groups')
    expect(bundle.version).toBe(1)
    const parsed = parseCustomGroupBundle(bundle)
    expect(parsed).toEqual(bundle.packs)
  })

  it('preserves extensions on export and parse', async () => {
    const { parseCustomGroupExtensions } = await import('./storage')
    const extensions = { plugin: 'demo-pack-source', schema: 2 }
    const bundle = buildCustomGroupBundle(packs, extensions)
    expect(bundle.extensions).toEqual(extensions)
    expect(parseCustomGroupExtensions(bundle)).toEqual(extensions)
  })

  it('accepts plain pack arrays', () => {
    const parsed = parseCustomGroupBundle(serializeCustomPacks(packs))
    expect(parsed[0]?.id).toBe('fav')
  })

  it('ignores forward-compatible extension fields', () => {
    const bundle = {
      ...buildCustomGroupBundle(packs),
      extensions: { plugin: 'demo-pack-source', schema: 2 },
      unknownFutureKey: true,
    }
    const parsed = parseCustomGroupBundle(bundle)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.id).toBe('fav')
  })
})
