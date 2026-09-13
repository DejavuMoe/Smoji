import { readFileSync } from 'node:fs'
import { it, expect, vi } from 'vitest'
import manifest from '../../../data/smoji.json'
import hosting from '../../../data/hosting.json'
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

it('preserves groups and consistent undo through real workbench handlers', async () => {
  document.documentElement.innerHTML = readFileSync('apps/workbench/index.html', 'utf8').replace(/<!doctype html>/i, '')
  vi.stubEnv('PROD', true)
  window.matchMedia = vi.fn((media) => ({ matches: media.includes('hover: hover'), media, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true } })) as any
  HTMLElement.prototype.scrollIntoView = () => {}
  const items = manifest.packs.flatMap(p => p.items.map(i => ({ ...i, src: new URL(i.src, hosting.assetBaseUrl).href })))
  localStorage.clear()
  localStorage.setItem(STORAGE_KEYS.mode, 'custom')
  localStorage.setItem(STORAGE_KEYS.customPacks, JSON.stringify([{ id: 'a', label: 'A', itemSrcs: items.slice(0, 600).map(i => i.src) }, { id: 'b', label: 'B', itemSrcs: [items[600]!.src] }]))
  localStorage.setItem(STORAGE_KEYS.activeCustomIndex, '1')
  const app = await import('./main')
  await vi.waitFor(() => expect(document.querySelectorAll('[data-merge-index]')).toHaveLength(2))
  expect(document.querySelector('.custom-pack-count.is-full')?.textContent).toContain('600 / 600 张')
  const groups = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.customPacks)!) as Array<{ id: string; label: string; itemSrcs: string[] }>
  const click = (selector: string) => { const button = document.querySelector<HTMLElement>(selector); expect(button, selector).not.toBeNull(); button!.click() }
  const undo = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
  click('[data-merge-index="1"]')
  expect(groups().map(p => p.itemSrcs.length)).toEqual([600, 1])
  app.handleCustomItemClick(items[601]!)
  click('[data-move-index="1"][data-move-dir="-1"]')
  expect(groups()[0]!.id).toBe('b')
  undo()
  expect(groups()[1]!.id).toBe('b')
  undo()
  expect(groups()[1]!.itemSrcs).toEqual([items[600]!.src])
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true }))
  expect(groups()[1]!.itemSrcs).toHaveLength(2)
  undo()
  click('#tab-packs')
  expect([...document.querySelectorAll<HTMLInputElement>('.pack-check')].every(c => !c.disabled)).toBe(true)
  click('#tab-custom')
  click('[data-edit-index="0"]')
  ;(document.querySelector('#edit-name-0') as HTMLInputElement).value = 'renamed'
  click('.custom-pack-edit-actions button.save')
  expect(groups()[0]!.label).toBe('renamed')
  undo()
  expect(groups()[0]!.label).toBe('A')
  // Remove an item, then drop it onto group zero while group one remains active.
  click('[data-custom-index="0"]')
  app.handleCustomItemClick(items[0]!)
  click('[data-custom-index="1"]')
  expect(localStorage.getItem(STORAGE_KEYS.activeCustomIndex)).toBe('1')
  const drop = new Event('drop', { bubbles: true, cancelable: true })
  Object.defineProperty(drop, 'dataTransfer', { value: { getData: (type: string) => type === 'text/smoji-src' ? items[0]!.src : '' } })
  document.querySelector('[data-custom-index="0"]')!.dispatchEvent(drop)
  expect(groups()[0]!.itemSrcs).toHaveLength(600)
  expect(groups()[1]!.itemSrcs).toHaveLength(1)
  // Splitting and then merging is reversible as one operation each.
  click('[data-split-index="0"]')
  expect(groups().map(p => p.itemSrcs.length)).toEqual([300, 300, 1])
  click('[data-merge-index="1"]')
  expect(groups().map(p => p.itemSrcs.length)).toEqual([600, 1])
  undo()
  expect(groups().map(p => p.itemSrcs.length)).toEqual([300, 300, 1])
  undo()
  expect(groups().map(p => p.itemSrcs.length)).toEqual([600, 1])
  const beforeImport = groups()
  const input = document.querySelector<HTMLInputElement>('#import-groups-file')!
  const file = new File([JSON.stringify([{ id: 'imported', label: '导入', itemSrcs: [items[601]!.src] }])], 'groups.json', { type: 'application/json' })
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await vi.waitFor(() => expect(document.querySelector<HTMLElement>('#confirm-modal')!.hidden).toBe(false))
  click('#confirm-ok')
  await vi.waitFor(() => expect(groups()).toHaveLength(3))
  undo()
  expect(groups()).toEqual(beforeImport)
  undo()
  expect(groups()[0]!.itemSrcs).toHaveLength(599)

})
