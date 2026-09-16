import { expect, it } from 'vitest'
import { canonicalAssetSrc, canonicalPackIds, loadAssetAliases, migratePackSelection, seedAssetPaths } from './asset-paths'
import aliases from '../../../data/published-aliases.json'
import manifest from '../../../data/smoji.json'
import onionRemoval from '../../../data/removals/onion-duplicates-20260916.json'

it('migrates published URLs and pack selections without rewriting other origins', async () => {
  await loadAssetAliases()
  const [from, to] = Object.entries(aliases)[0]!
  const manifest = 'https://example.test/assets/smoji.json'
  expect(canonicalAssetSrc(`https://example.test/assets/${from}`, manifest)).toBe(`https://example.test/assets/${to}`)
  expect(canonicalAssetSrc(`https://other.test/assets/${from}`, manifest)).toBe(`https://other.test/assets/${from}`)
  expect(canonicalAssetSrc(`https://example.test/${from}`, manifest)).toBe(`https://example.test/${from}`)
  expect(canonicalAssetSrc(`https://example.test/assets/${from}?x=1`, manifest)).toBe(`https://example.test/assets/${from}?x=1`)
  expect(canonicalPackIds('tiktok')).toEqual(['douyin-classic'])
  expect(canonicalPackIds('coolapk')).toEqual(['coolapk'])
  expect(canonicalPackIds('douyin-mid-autumn')).toEqual(['douyin-limited'])
  expect(canonicalPackIds('qq-animated')).toEqual(['qq-animated'])
})

it('keeps a selected old subcategory from expanding to the whole merged category', async () => {
  await loadAssetAliases()
  const base = 'https://example.test/assets/smoji.json'
  const packs = manifest.packs.map((pack) => ({ ...pack, items: pack.items.map((item) => ({
    ...item, src: new URL(item.src, base).href,
  })) }))
  const selected = new Set(['yuexinmiao-classic', 'eveonecat-animation'])
  const excluded = new Set<string>()
  migratePackSelection(selected, excluded, packs, base)
  expect([...selected].sort()).toEqual(['eveonecat-animated', 'yuexinmiao'])
  expect(packs.find((p) => p.id === 'yuexinmiao')!.items.filter((i) => !excluded.has(i.src))).toHaveLength(18)
  expect(packs.find((p) => p.id === 'eveonecat-animated')!.items.filter((i) => !excluded.has(i.src))).toHaveLength(133)
  const saved = [...excluded]
  migratePackSelection(selected, excluded, packs, base)
  expect([...excluded]).toEqual(saved)

  const all = new Set(['yuexinmiao', 'yuexinmiao-classic'])
  const none = new Set<string>()
  migratePackSelection(all, none, packs, base)
  expect([...all]).toEqual(['yuexinmiao'])
  expect(none.size).toBe(0)
  expect(canonicalPackIds('jh-love')).toEqual(['yuexinmiao'])
})

it('migrates saved site URLs to the CDN while preserving unrelated URLs', async () => {
  await loadAssetAliases()
  const base = 'https://s3-cdn.zsh.moe/smoji/smoji.json'
  const packs = manifest.packs.map((pack) => ({ ...pack, items: pack.items.map((item) => ({
    ...item, src: new URL(item.src, base).href,
  })) }))
  // The runtime seeds known paths from the loaded catalog instead of bundling a second manifest copy.
  seedAssetPaths(packs, base)
  const path = manifest.packs[0]!.items[0]!.src
  expect(canonicalAssetSrc(new URL(path, window.location.href).href, base)).toBe(new URL(path, base).href)
  const [from, to] = Object.entries(aliases)[0]!
  expect(canonicalAssetSrc(new URL(from, window.location.href).href, base)).toBe(new URL(to, base).href)
  expect(canonicalAssetSrc('https://other.test/unknown.webp', base)).toBe('https://other.test/unknown.webp')
})

it('keeps saved onion duplicates resolvable after catalog removal', async () => {
  await loadAssetAliases()
  const base = 'https://example.test/assets/smoji.json'
  const live = new Set(manifest.packs.flatMap(pack => pack.items.map(item => item.src.replace(/^\.\//, ''))))
  for (const { removed } of onionRemoval.entries) {
    const replacement = (aliases as Record<string, string>)[removed]
    expect(live.has(removed)).toBe(false)
    expect(replacement && live.has(replacement)).toBe(true)
    expect(canonicalAssetSrc(new URL(removed, base).href, base)).toBe(new URL(replacement!, base).href)
  }
})
