import { beforeEach, expect, it, vi } from 'vitest'
import manifest from '../../../../data/smoji.json'
import { loadAssetAliases } from '../asset-paths'
import { loadRawCustomPacksBackup, STORAGE_KEYS } from '../storage'
import { initialWorkbenchState } from '../domain/state'
import { loadInitialState, persistWorkbenchState } from './storage'

beforeEach(() => localStorage.clear())

it('migrates legacy selected folders and saved site URLs before persisting React state', async () => {
  await loadAssetAliases()
  const base = 'https://s3-cdn.zsh.moe/smoji/smoji.json'
  const packs = manifest.packs.map(pack => ({ ...pack, items: pack.items.map(item => ({ ...item, src: new URL(item.src, base).href })) }))
  const oldSrc = new URL(manifest.packs[0]!.items[0]!.src, window.location.href).href
  localStorage.setItem(STORAGE_KEYS.selectedPackIds, JSON.stringify(['yuexinmiao-classic']))
  localStorage.setItem(STORAGE_KEYS.excludedSrcs, JSON.stringify([oldSrc]))
  localStorage.setItem(STORAGE_KEYS.customPacks, JSON.stringify([{ id: 'saved', label: '收藏', itemSrcs: [oldSrc] }]))
  const state = loadInitialState(packs, base)
  expect([...state.packSelection.selectedPackIds]).toEqual(['yuexinmiao'])
  expect(state.packSelection.excludedItemSrcs.has(packs[0]!.items[0]!.src)).toBe(true)
  expect(state.customGroups.groups[0]!.items).toEqual([packs[0]!.items[0]!])
  persistWorkbenchState(state)
  // No delayed write that can disappear on reload or leak into the next provider.
  expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.customPacks)!)[0].itemSrcs).toEqual([packs[0]!.items[0]!.src])
})

it('reports persistence failures instead of swallowing them', () => {
  const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
  const result = persistWorkbenchState(initialWorkbenchState)
  set.mockRestore()
  expect(result.ok).toBe(false)
  expect(result.failures.length).toBeGreaterThan(0)
})

it('keeps an immutable raw backup before unresolved historical items are dropped', async () => {
  await loadAssetAliases()
  const base = 'https://s3-cdn.zsh.moe/smoji/smoji.json'
  const packs = manifest.packs.map(pack => ({ ...pack, items: pack.items.map(item => ({ ...item, src: new URL(item.src, base).href })) }))
  const known = packs[0]!.items[0]!.src
  const unknown = 'https://legacy.example/gone.webp'
  localStorage.setItem(STORAGE_KEYS.customPacks, JSON.stringify([{ id: 'saved', label: '旧收藏', itemSrcs: [known, unknown] }]))

  const state = loadInitialState(packs, base)
  expect(state.customGroups.groups[0]!.items).toEqual([packs[0]!.items[0]!])
  expect(state.customGroups.notice?.tone).toBe('error')

  const backup = loadRawCustomPacksBackup()
  expect(backup?.unresolvedItems).toBe(1)
  expect(JSON.parse(backup!.raw)[0].itemSrcs).toContain(unknown)

  // Persisting the filtered working copy must never rewrite the immutable backup.
  persistWorkbenchState(state)
  expect(loadRawCustomPacksBackup()?.raw).toBe(backup!.raw)
  expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.customPacks)!)[0].itemSrcs).toEqual([known])
})
