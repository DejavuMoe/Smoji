import { it, expect, vi } from 'vitest'
import { buildTwikooExport, buildOwOExport } from './export'
import { loadSelectedPackIds, loadExcludedSrcs, loadCustomPacks, parseCustomGroupBundle, STORAGE_KEYS, loadMode, saveCustomPacks } from './storage'

it('handles corrupt storage, unavailable storage and unsafe group imports/exports', () => {
  for (const [key, load] of [[STORAGE_KEYS.selectedPackIds, loadSelectedPackIds], [STORAGE_KEYS.excludedSrcs, loadExcludedSrcs], [STORAGE_KEYS.customPacks, () => loadCustomPacks(() => null)]] as const) {
    localStorage.setItem(key, '{}')
    expect(() => load()).not.toThrow()
  }
  localStorage.clear()
  const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  expect(loadMode()).toBe('packs')
  get.mockRestore()
  const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
  expect(saveCustomPacks([], -1)).toBe(false)
  set.mockRestore()
  for (const entry of [null, { id: 'a', label: 'A', itemSrcs: [null] }, { id: 'a', label: 'bad]', itemSrcs: [] }, { id: 'a'.repeat(65), label: 'A', itemSrcs: [] }]) {
    expect(() => parseCustomGroupBundle([entry])).toThrow()
  }
  const item = { id: 'x', label: 'X', src: 'https://example.test/x.png' }
  for (const build of [buildTwikooExport, buildOwOExport]) {
    const groups = [{ id: 'one', label: 'same', items: [item] }, { id: 'two', label: 'same', items: [item] }]
    expect(() => build(groups, 'https://example.test/smoji.json')).toThrow('分组名称重复')
    expect(Object.keys(build([{ ...groups[0]!, label: '__proto__' }], 'https://example.test/smoji.json'))).toEqual(['__proto__'])
  }
})

