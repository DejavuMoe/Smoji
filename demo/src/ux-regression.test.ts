import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { stampDownloadFilename } from './export'

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

it('keeps export scope/format, progressive group creation, overlays and clipboard fallback coherent', async () => {
  document.documentElement.innerHTML = readFileSync('demo/index.html', 'utf8').replace(/<!doctype html>/i, '')
  localStorage.clear()
  vi.stubEnv('PROD', false)
  vi.stubGlobal('matchMedia', (media: string) => Object.assign(new EventTarget(), { matches: media === '(max-width: 900px)', media }))
  vi.stubGlobal('scrollTo', vi.fn())
  HTMLElement.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify({ version: 1, packs: [{ id: 'sample', label: '示例', items: [
      { id: 'wave', label: '挥手', src: './sample/wave.png' },
      { id: 'smile', label: '微笑', src: './sample/smile.png' },
    ] }, { id: 'second', label: '另一分类', items: [
      { id: 'hello', label: '你好', src: './second/hello.png' },
    ] }] }),
  }))
  const el = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!
  const click = (selector: string) => el(selector).click()
  await import('./main')
  await vi.waitFor(() => expect(el('.card')).not.toBeNull())
  click('#btn-open-guide')
  expect(el('[data-guide-limit="packs-n"]').textContent).toBe('64')
  const guideNames = [...document.querySelectorAll('#guide-export-tbody code')].map(node => node.textContent)
  click('#guide-modal-close')
  expect(el('#gallery-empty-cta').hidden).toBe(true)
  expect(el('#selection-dock').hidden).toBe(true)
  expect(el('#btn-select-all-packs').textContent).toBe('全选')
  click('#btn-select-all-packs')
  expect(document.querySelectorAll('.pack-check:checked')).toHaveLength(2)
  expect(el('#btn-select-all-packs').textContent).toBe('反选')
  expect(el('#btn-invert-packs')).toBeNull()
  click('#btn-select-all-packs')
  expect(document.querySelectorAll('.pack-check:checked')).toHaveLength(0)
  click('#menu-toggle')
  click('.pack-check')
  click('#sidebar-close')
  const format = el<HTMLSelectElement>('#selection-dock-format')
  format.value = 'twikoo'
  format.dispatchEvent(new Event('change'))
  el('#selection-dock-preview').focus()
  click('#selection-dock-preview')
  expect(el('#code-tab-twikoo').getAttribute('aria-selected')).toBe('true')
  expect(el('[data-scope="selected"]').getAttribute('aria-checked')).toBe('true')
  expect(JSON.parse(el('#code-preview-content').textContent!).示例.container).toHaveLength(2)
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:export')
    static revokeObjectURL = vi.fn()
  })
  const downloadNames: string[] = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { downloadNames.push(this.download) })
  for (const [format, filename] of [['smoji', 'smoji.json'], ['twikoo', 'twikoo.json'], ['markdown', 'smoji-markers.md']]) {
    click(`#code-tab-${format}`)
    const expected = stampDownloadFilename(filename!)
    expect(guideNames).toContain(expected)
    expect(el('#code-modal-meta').textContent).toContain(expected)
    click('#btn-download-current-code')
    expect(downloadNames[downloadNames.length - 1]).toBe(expected)
  }
  click('#code-tab-twikoo')
  click('#code-modal-close')
  expect(document.activeElement).toBe(el('#selection-dock-preview'))
  expect(document.body.classList.contains('overlay-open')).toBe(false)
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true, bubbles: true }))
  expect(el('#code-tab-twikoo').getAttribute('aria-selected')).toBe('true')
  expect(el('[data-scope="selected"]').getAttribute('aria-checked')).toBe('true')
  click('#code-modal-close')
  click('#menu-toggle')
  el('#pack-nav button').focus()
  el('#pack-nav button').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
  expect(document.body.classList.contains('menu-open')).toBe(true)
  expect(el('button.pack[aria-current="true"]').dataset.packIndex).toBe('1')
  el('button.pack[aria-current="true"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
  click('#tab-custom')
  el<HTMLInputElement>('#custom-name-input').value = '我的收藏'
  el<HTMLFormElement>('#custom-add-form').dispatchEvent(new Event('submit', { cancelable: true }))
  expect(el<HTMLDetailsElement>('#custom-create').open).toBe(false)
  expect(document.body.classList.contains('menu-open')).toBe(false)
  expect(el('#gallery-export-count').textContent).toContain('添加到「我的收藏」')
  expect(el('#gallery-empty-cta').hidden).toBe(true)
  const notes = el<HTMLInputElement>('#bundle-notes-input')
  notes.value = '临时备注'
  notes.dispatchEvent(new Event('change'))
  notes.value = ''
  notes.dispatchEvent(new Event('change'))
  expect(JSON.parse(localStorage.getItem('smoji-workbench:custom-group-extensions')!)['smoji.workbench'].notes).toBeUndefined()
  click('[data-check-item-index="0"]')
  expect(el('.custom-pack-count').textContent).toContain('1 / 600 张')
  expect(el('.custom-pack-count').getAttribute('aria-label')).toContain('已用 1 / 600 项')
  expect(el('[data-badge-item-index="0"]').textContent).toBe('✓')
  expect(el('#selection-dock-count').textContent).toContain('1 张表情')
  expect(el('#toast-container').children).toHaveLength(0)
  click('#menu-toggle')
  click('.group-tools > summary')
  click('[data-delete-index="0"]')
  expect(el('#sidebar').hasAttribute('inert')).toBe(true)
  expect(document.activeElement).toBe(el('#confirm-cancel'))
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  expect(el('#confirm-modal').hidden).toBe(true)
  expect(document.body.classList.contains('menu-open')).toBe(true)
  expect(el('#sidebar').hasAttribute('inert')).toBe(false)
  click('#sidebar-close')
  click('.card')
  expect(el('#btn-copy-active').textContent).toBe('复制')
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
  click('#btn-copy-active')
  await vi.waitFor(() => expect(document.activeElement).toBe(el('#copy-active-input')))
  const input = el<HTMLInputElement>('#copy-active-input')
  expect(input.selectionStart).toBe(0)
  expect(input.selectionEnd).toBe(input.value.length)
  expect(el('#copy-feedback').textContent).toContain('手动复制')
  click('#pop-close-btn')
  expect(document.body.classList.contains('overlay-open')).toBe(false)

  // A tray drop replaces its source node. The next drag must start with clean state.
  click('[data-check-item-index="1"]')
  click('#menu-toggle')
  el<HTMLDetailsElement>('#custom-create').open = true
  el<HTMLInputElement>('#custom-name-input').value = '第二组'
  el<HTMLFormElement>('#custom-add-form').dispatchEvent(new Event('submit', { cancelable: true }))
  click('[data-check-item-index="0"]')
  click('#menu-toggle')
  click('[data-custom-index="0"] .custom-pack-name')
  const groups = () => JSON.parse(localStorage.getItem('smoji-workbench:custom-packs')!) as Array<{ label: string; itemSrcs: string[] }>
  const drag = (source: string, target: string) => {
    const data = new Map<string, string>()
    const dataTransfer = { setData: (key: string, value: string) => data.set(key, value), getData: (key: string) => data.get(key) ?? '', setDragImage: vi.fn() }
    for (const [selector, type] of [[source, 'dragstart'], [target, 'drop']]) {
      const event = new Event(type!, { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
      el(selector!).dispatchEvent(event)
    }
  }
  const firstSrc = groups()[0]!.itemSrcs[0]
  drag('[data-tray-item="0"]', '[data-tray-item="1"]')
  expect(groups()[0]!.itemSrcs[1]).toBe(firstSrc)
  drag('[data-custom-index="0"]', '[data-custom-index="1"]')
  expect(groups().map((group) => group.label)).toEqual(['第二组', '我的收藏'])
  click('[data-delete-index="0"]')
  click('#confirm-ok')
  await vi.waitFor(() => expect(groups()).toHaveLength(1))
  expect(el('#gallery-export-count').textContent).toContain('我的收藏')
  expect(localStorage.getItem('smoji-workbench:active-custom-index')).toBe('0')
  click('#sidebar-close')
})
