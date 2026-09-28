import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { SmojiPack } from '../../../../packages/smoji/src/types'
import { stampDownloadFilename } from '../export'
import { STORAGE_KEYS } from '../storage'
import { WorkbenchProvider } from './WorkbenchProvider'
import { App } from './App'

const samplePacks: SmojiPack[] = [
  { id: 'sample', label: '示例', items: [
    { id: 'wave', label: '挥手', src: 'https://cdn.example/sample/wave.png' },
    { id: 'smile', label: '微笑', src: 'https://cdn.example/sample/smile.png' },
  ] },
  { id: 'second', label: '另一分类', items: [{ id: 'hello', label: '你好', src: 'https://cdn.example/second/hello.png' }] },
  { id: 'third', label: '第三分类', items: [{ id: 'cat', label: '猫', src: 'https://cdn.example/third/cat.png' }] },
  { id: 'fourth', label: '第四分类', items: [{ id: 'dog', label: '狗', src: 'https://cdn.example/fourth/dog.png' }] },
]

const groups = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.customPacks)!) as Array<{ id: string; label: string; itemSrcs: string[] }>
const el = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!
const key = (init: KeyboardEventInit, target: EventTarget = document.body) => act(() => { target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init })) })
const renderApp = (packs = samplePacks) => render(<WorkbenchProvider initialPacks={packs} manifestUrl="https://cdn.example/smoji.json"><App /></WorkbenchProvider>)
const openMenu = (trigger: HTMLElement) => fireEvent.keyDown(trigger, { key: 'Enter' })

describe('workbench integration', () => {
  beforeEach(() => {
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('keeps pack selection, export scope/format, filenames and focus return coherent', async () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: '帮助' }))
    await waitFor(() => expect(el('[data-guide-limit="packs-n"]').textContent).toBe('64'))
    const guideNames = [...document.querySelectorAll('#guide-export-tbody code')].map((node) => node.textContent)
    fireEvent.click(screen.getByRole('button', { name: '关闭使用指南' }))

    const selectAll = el('#btn-select-all-packs')
    const checks = () => screen.getAllByRole('checkbox')
    expect(selectAll.textContent).toBe('全选')
    fireEvent.click(selectAll)
    expect(checks().every((check) => check.getAttribute('aria-checked') === 'true')).toBe(true)
    expect(selectAll.textContent).toBe('反选')
    fireEvent.click(selectAll)
    expect(checks().every((check) => check.getAttribute('aria-checked') === 'false')).toBe(true)
    fireEvent.click(checks()[0]!)
    fireEvent.click(checks()[2]!)
    fireEvent.click(selectAll)
    expect(checks().map((check) => check.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'true'])
    expect(selectAll.textContent).toBe('反选')
    fireEvent.click(el('#btn-clear-packs'))
    expect(checks().every((check) => check.getAttribute('aria-checked') === 'false')).toBe(true)
    expect(el<HTMLButtonElement>('#btn-clear-packs').disabled).toBe(true)
    expect(el<HTMLButtonElement>('#selection-dock-export').disabled).toBe(true)

    fireEvent.click(checks()[0]!)
    expect(el('#selection-dock-count').textContent).toBe('1 个分类 · 2 张表情')
    fireEvent.click(screen.getByRole('radio', { name: 'Twikoo' }))
    const preview = el('#selection-dock-preview')
    preview.focus()
    fireEvent.click(preview)
    await waitFor(() => expect(el('#code-modal')).not.toBeNull())
    expect(el('#code-tab-twikoo').getAttribute('aria-checked')).toBe('true')
    expect(el('#code-scope-selected').getAttribute('aria-checked')).toBe('true')
    expect(JSON.parse(el('#code-preview-content').textContent!).示例.container).toHaveLength(2)

    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:export')
      static revokeObjectURL = vi.fn()
    })
    const downloads: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { downloads.push(this.download) })
    for (const [format, filename] of [['smoji', 'smoji.json'], ['twikoo', 'twikoo.json'], ['artalk', 'artalk.json']] as const) {
      fireEvent.click(el(`#code-tab-${format}`))
      const expected = stampDownloadFilename(filename)
      expect(guideNames).toContain(expected)
      expect(el('#code-modal-meta').textContent).toContain(expected)
      fireEvent.click(el('#btn-download-current-code'))
      expect(downloads[downloads.length - 1]).toBe(expected)
    }
    fireEvent.click(el('#code-tab-twikoo'))
    // Focus return needs layout; it is asserted in the browser suite.
    fireEvent.click(screen.getByRole('button', { name: '关闭预览' }))
    await waitFor(() => expect(document.querySelector('#code-modal')).toBeNull())

    key({ key: 'P', ctrlKey: true, shiftKey: true })
    await waitFor(() => expect(el('#code-tab-twikoo').getAttribute('aria-checked')).toBe('true'))
    fireEvent.click(screen.getByRole('button', { name: '关闭预览' }))

    // The dock export matches the preview's stamped filename and honours the shortcut.
    fireEvent.click(el('#selection-dock-export'))
    expect(downloads[downloads.length - 1]).toBe(stampDownloadFilename('twikoo.json'))
    key({ key: 'e', ctrlKey: true })
    expect(downloads).toHaveLength(5)
  })

  it('pages packs from one tab stop, excludes items only in selected packs and restores them', () => {
    renderApp()
    const firstPack = el('#pack-nav .pack[aria-current="true"]')
    expect(firstPack.tabIndex).toBe(0)
    expect(document.querySelectorAll('#pack-nav [tabindex="0"]')).toHaveLength(1)
    firstPack.focus()
    fireEvent.keyDown(firstPack, { key: 'ArrowDown' })
    expect(el('.ghead__title').textContent).toBe('另一分类')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
    expect(document.activeElement?.getAttribute('aria-label')).toBe('选择 另一分类')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
    expect(document.activeElement?.getAttribute('aria-label')).toBe('选择 示例')
    expect(el('.ghead__title').textContent).toBe('另一分类')
    fireEvent.click(el('#pack-nav .pack[data-pack-index="0"]'))

    expect(screen.queryByRole('button', { name: '排除 挥手' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '选择本分类导出' }))
    fireEvent.click(screen.getByRole('button', { name: '排除 挥手' }))
    expect(el('.tile[data-card-index="0"]').hasAttribute('data-excluded')).toBe(true)
    expect(el('#gallery-export-count').textContent).toContain('已排除 1 张')
    expect(el('#selection-dock-count').textContent).toBe('1 个分类 · 1 张表情')
    fireEvent.click(el('#btn-batch-pack-action'))
    expect(el('#btn-batch-pack-action').textContent).toBe('恢复本分类全部')
    fireEvent.click(el('#btn-batch-pack-action'))
    expect(el('#selection-dock-count').textContent).toBe('1 个分类 · 2 张表情')
  })

  it('creates, fills, reorders and deletes custom groups with undoable history', async () => {
    renderApp()
    fireEvent.click(screen.getByRole('radio', { name: '自选分组' }))
    fireEvent.change(el('#custom-name-input'), { target: { value: '我的收藏' } })
    fireEvent.click(screen.getByRole('button', { name: '添加' }))
    await waitFor(() => expect(el('#gallery-export-count').textContent).toContain('添加到「我的收藏」'))

    const notes = el<HTMLInputElement>('#bundle-notes-input')
    fireEvent.change(notes, { target: { value: '临时备注' } })
    fireEvent.change(notes, { target: { value: '' } })
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.customGroupExtensions)!)['smoji.workbench']?.notes).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: '加入 挥手' }))
    fireEvent.click(screen.getByRole('button', { name: '加入 微笑' }))
    const count = el('[data-custom-index="0"] .group__count')
    expect(count.getAttribute('aria-label')).toBe('已用 2 / 600 项')
    expect(el('.tile[data-card-index="0"]').hasAttribute('data-picked')).toBe(true)
    expect(el('#selection-dock-count').textContent).toBe('1 个自选组 · 2 张表情')

    fireEvent.change(el('#custom-name-input'), { target: { value: '第二组' } })
    fireEvent.click(screen.getByRole('button', { name: '添加' }))
    await waitFor(() => expect(groups()).toHaveLength(2))

    // Tray reorder, group reorder by drag, then delete through the confirmation.
    const drag = (source: Element, target: Element) => {
      const data = new Map<string, string>()
      const dataTransfer = { setData: (type: string, value: string) => data.set(type, value), getData: (type: string) => data.get(type) ?? '', setDragImage: vi.fn(), effectAllowed: '', dropEffect: '' }
      fireEvent.dragStart(source, { dataTransfer })
      fireEvent.drop(target, { dataTransfer })
    }
    const first = groups()[0]!.itemSrcs[0]
    drag(el('[data-custom-index="0"] [data-tray-item="0"]'), el('[data-custom-index="0"] [data-tray-item="1"]'))
    expect(groups()[0]!.itemSrcs[1]).toBe(first)
    drag(el('[data-custom-index="0"]'), el('[data-custom-index="1"]'))
    expect(groups().map((group) => group.label)).toEqual(['第二组', '我的收藏'])
    key({ key: 'z', ctrlKey: true })
    expect(groups().map((group) => group.label)).toEqual(['我的收藏', '第二组'])
    key({ key: 'z', ctrlKey: true, shiftKey: true })
    expect(groups().map((group) => group.label)).toEqual(['第二组', '我的收藏'])

    openMenu(within(el('[data-custom-index="0"]')).getByRole('button', { name: '分组操作' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '删除分组' }))
    await waitFor(() => expect(document.activeElement).toBe(el('#confirm-cancel')))
    fireEvent.click(el('#confirm-ok'))
    await waitFor(() => expect(groups()).toHaveLength(1))
    expect(el('#gallery-export-count').textContent).toContain('我的收藏')
    expect(localStorage.getItem(STORAGE_KEYS.activeCustomIndex)).toBe('0')
  })

  it('reports full groups, blocks oversized merges and keeps split/merge/import reversible', async () => {
    const items = Array.from({ length: 602 }, (_, i) => ({ id: `i${i}`, label: `表情${i}`, src: `https://cdn.example/big/${i}.png` }))
    localStorage.setItem(STORAGE_KEYS.mode, 'custom')
    localStorage.setItem(STORAGE_KEYS.customPacks, JSON.stringify([
      { id: 'a', label: 'A', itemSrcs: items.slice(0, 600).map((item) => item.src) },
      { id: 'b', label: 'B', itemSrcs: [items[600]!.src] },
    ]))
    localStorage.setItem(STORAGE_KEYS.activeCustomIndex, '1')
    renderApp([{ id: 'big', label: '大包', items }])
    expect(el('[data-custom-index="0"] .group__count').hasAttribute('data-full')).toBe(true)

    openMenu(within(el('[data-custom-index="1"]')).getByRole('button', { name: '分组操作' }))
    expect((await screen.findByRole('menuitem', { name: '合并超出 600 张限制' })).getAttribute('aria-disabled')).toBe('true')
    key({ key: 'Escape' }, document.activeElement!)
    openMenu(within(el('[data-custom-index="0"]')).getByRole('button', { name: '分组操作' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '拆分分组' }))
    expect(groups().map((group) => group.itemSrcs.length)).toEqual([300, 300, 1])
    openMenu(within(el('[data-custom-index="1"]')).getByRole('button', { name: '分组操作' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '向上合并' }))
    expect(groups().map((group) => group.itemSrcs.length)).toEqual([600, 1])
    key({ key: 'z', ctrlKey: true })
    expect(groups().map((group) => group.itemSrcs.length)).toEqual([300, 300, 1])
    key({ key: 'z', ctrlKey: true })
    expect(groups().map((group) => group.itemSrcs.length)).toEqual([600, 1])

    const before = groups()
    const input = el<HTMLInputElement>('#import-groups-file')
    const payload = JSON.stringify([{ id: 'imported', label: '导入', itemSrcs: [items[601]!.src] }])
    const file = new File([payload], 'groups.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => payload })
    Object.defineProperty(input, 'files', { configurable: true, value: [file] })
    fireEvent.change(input)
    await waitFor(() => expect(screen.getByText('导入分组确认')).toBeDefined())
    fireEvent.click(el('#confirm-ok'))
    await waitFor(() => expect(groups()).toHaveLength(3))
    key({ key: 'z', ctrlKey: true })
    expect(groups()).toEqual(before)
  })

  it('opens the inspector with all formats, keyboard format keys and a manual-copy fallback', async () => {
    const label = '说"你好"\\再见'
    renderApp([{ id: 'sample', label: '示例', items: [
      { id: 'hello', label, src: 'https://cdn.example/hello.png' },
      { id: 'next', label: '下一张', src: 'https://cdn.example/next.gif' },
    ] }])
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    const card = el('#grid .tile__open')
    card.focus()
    fireEvent.click(card)
    await waitFor(() => expect(document.activeElement).toBe(el('#pop-group-btn')))
    const codes = [...document.querySelectorAll('.copy__code')].map((node) => node.textContent)
    expect(codes[2]).toBe('<img src="https://cdn.example/hello.png" alt="说&quot;你好&quot;\\再见">')
    expect(codes).toHaveLength(4)
    expect(codes.join('\n')).not.toContain('inTextImg')

    const dialog = screen.getByRole('dialog')
    for (const [index, format] of ['md', 'url', 'html', 'bbcode'].entries()) {
      fireEvent.keyDown(dialog, { key: String(index + 1) })
      expect(el('.copy__row[data-active] [data-copy-format]').dataset.copyFormat).toBe(format)
    }
    fireEvent.keyDown(dialog, { key: '2', ctrlKey: true })
    fireEvent.keyDown(dialog, { key: '5' })
    expect(el('.copy__row[data-active] [data-copy-format]').dataset.copyFormat).toBe('bbcode')
    expect(localStorage.getItem(STORAGE_KEYS.copyFormat)).toBe('bbcode')

    fireEvent.click(screen.getByRole('button', { name: '复制 HTML' }))
    await waitFor(() => expect(document.activeElement).toBe(el('#copy-active-input')))
    const input = el<HTMLInputElement>('#copy-active-input')
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(input.value.length)
    expect(el('#copy-feedback').textContent).toContain('手动复制')
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    expect(el('.insp__title').textContent).toBe(label)
    fireEvent.keyDown(el('#pop-close-btn'), { key: 'ArrowRight' })
    expect(el('.insp__title').textContent).toBe('下一张')

    fireEvent.click(screen.getByRole('button', { name: '关闭详情' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('keeps the grid free of animated originals', () => {
    renderApp()
    expect(document.querySelectorAll('#grid .tile')).toHaveLength(2)
    expect(document.querySelectorAll('#grid img')).toHaveLength(0)
    expect(document.querySelectorAll('#grid [data-roving-item][tabindex="0"]')).toHaveLength(1)
  })
})
