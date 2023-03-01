import { readFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { parseSmojiManifest, assertManifestSize, SMOJI_MAX_ITEMS, SMOJI_MAX_ITEMS_PER_PACK } from '../src/manifest'
import catalog from '../../../data/packs.json'
import assets from '../../../data/assets.json'
import aliases from '../../../data/published-aliases.json'

it('keeps the scanned catalog, integrity metadata and live aliases aligned with disk', async () => {
  const text = await readFile('data/smoji.json', 'utf8')
  assertManifestSize(text)
  const manifest = parseSmojiManifest(JSON.parse(text), 'https://example.test/smoji.json')
  expect(manifest.packs.map((pack) => pack.id)).toEqual(catalog.map((pack) => pack.id))
  const diskPaths = await readdir('packs', { recursive: true }).catch((error) => {
    if (error.code === 'ENOENT') return []
    throw error
  })
  const manifestPaths = manifest.packs.flatMap((pack) => pack.items.map((item) => new URL(item.src).pathname.slice(1)))
  expect(Object.keys(assets).sort()).toEqual(manifestPaths.sort())
  const actualPaths = diskPaths.filter((path) => !path.startsWith('_') && /\.(png|gif|webp)$/.test(path))
  expect(actualPaths.every((path) => path in assets)).toBe(true)
  for (const [path, info] of Object.entries(assets)) {
    expect(path).toMatch(/^[a-z-]+\/[a-z]{12}\.(png|gif|webp)$/)
    if (!actualPaths.includes(path)) continue
    const bytes = await readFile(`packs/${path}`)
    expect(bytes.length).toBe(info.bytes)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(info.sha256)
  }
  for (const [from, to] of Object.entries(aliases)) {
    expect(manifestPaths, from).toContain(to)
    expect(actualPaths).not.toContain(from)
  }
  const sample = manifest.packs[0]!
  expect(() => parseSmojiManifest({ version: 1, packs: [{ ...sample, items: Array.from({ length: SMOJI_MAX_ITEMS_PER_PACK + 1 }, (_, i) => ({ ...sample.items[0], id: `item-${i}` })) }] }, 'https://example.test/smoji.json')).toThrow()
  expect(manifestPaths.length).toBeLessThanOrEqual(SMOJI_MAX_ITEMS)
})

it('accepts the expanded catalog capacity and rejects one extra item', () => {
  const item = { id: 'item', label: '表情', src: './sample.webp' }
  const packs = Array.from({ length: SMOJI_MAX_ITEMS / SMOJI_MAX_ITEMS_PER_PACK }, (_, pack) => ({
    id: `pack-${pack}`, label: '分类',
    items: Array.from({ length: SMOJI_MAX_ITEMS_PER_PACK }, (_, index) => ({ ...item, id: `item-${index}` })),
  }))
  expect(parseSmojiManifest({ version: 1, packs }, 'https://example.test/smoji.json').packs.flatMap((pack) => pack.items))
    .toHaveLength(SMOJI_MAX_ITEMS)
  expect(() => parseSmojiManifest({ version: 1, packs: [...packs, { id: 'extra', label: '分类', items: [item] }] },
    'https://example.test/smoji.json')).toThrow()
})
