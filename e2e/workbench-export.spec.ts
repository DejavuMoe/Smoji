import { test, expect, type Page } from '@playwright/test'
import { boot, closeSheets, makeItems, mockCatalog, openKit, reload, tileAction } from './support'

const packs = [
  { id: 'first', label: '第一分类', items: makeItems('first', 240, '表情') },
  { id: 'second', label: '第二分类', items: makeItems('second', 2, '第二') },
]

test.beforeEach(async ({ page }) => {
  await mockCatalog(page, packs)
  await boot(page)
})

const codeJson = (page: Page) => page.evaluate(() => JSON.parse(document.querySelector('#code-preview-content')!.textContent!))

async function selectCurrentPack(page: Page) {
  await closeSheets(page)
  await page.getByRole('button', { name: '选择本分类导出' }).click()
}

test('dock format, preview tabs and ⌘/Ctrl+Shift+P share one format and scope', async ({ page }) => {
  await selectCurrentPack(page)
  await openKit(page)
  await page.locator('#selection-dock-format').getByRole('radio', { name: 'Waline', exact: true }).click()
  await page.locator('#selection-dock-preview').click()
  await expect(page.locator('#code-modal')).toBeVisible()
  await expect(page.locator('#code-tab-waline')).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('#code-modal-meta')).toContainText(/waline-\d{8}\.json/)

  await page.locator('#code-scope-all').click()
  await page.locator('#code-tab-twikoo').click()
  await page.locator('#code-modal-close').click()
  await expect(page.locator('#code-modal')).toHaveCount(0)
  await expect(page.locator('#selection-dock-format').getByRole('radio', { name: 'Twikoo', exact: true })).toHaveAttribute('aria-checked', 'true')

  await closeSheets(page)
  await page.keyboard.press('ControlOrMeta+Shift+P')
  await expect(page.locator('#code-tab-twikoo')).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('#code-scope-all')).toHaveAttribute('aria-checked', 'true')
  // The same shortcut closes the preview it opened.
  await page.keyboard.press('ControlOrMeta+Shift+P')
  await expect(page.locator('#code-modal')).toHaveCount(0)
})

test('downloads use stamped filenames from the dock, the preview and ⌘/Ctrl+E', async ({ page }) => {
  const names: string[] = []
  page.on('download', download => names.push(download.suggestedFilename()))
  await selectCurrentPack(page)
  await openKit(page)
  let download = page.waitForEvent('download')
  await page.locator('#selection-dock-export').click()
  expect((await download).suggestedFilename()).toMatch(/^smoji-\d{8}\.json$/)

  await page.locator('#selection-dock-preview').click()
  await page.locator('#code-tab-artalk').click()
  download = page.waitForEvent('download')
  await page.locator('#btn-download-current-code').click()
  expect((await download).suggestedFilename()).toMatch(/^artalk-\d{8}\.json$/)
  await page.keyboard.press('Escape')
  await expect(page.locator('#code-modal')).toHaveCount(0)

  await closeSheets(page)
  download = page.waitForEvent('download')
  await page.keyboard.press('ControlOrMeta+e')
  expect((await download).suggestedFilename()).toMatch(/^artalk-\d{8}\.json$/)
  expect(names).toHaveLength(3)
})

test('⌘/Ctrl+E and ⌘/Ctrl+Shift+P stay out of editable fields', async ({ page }) => {
  let downloads = 0
  page.on('download', () => downloads++)
  await page.evaluate(() => {
    localStorage.setItem('smoji-workbench:mode', 'custom')
    localStorage.setItem('smoji-workbench:custom-packs', JSON.stringify([{ id: 'a', label: '分组 A', itemSrcs: ['https://s3-cdn.zsh.moe/smoji/first/0.png'] }]))
  })
  await reload(page)
  await openKit(page)
  const notes = page.getByRole('textbox', { name: '分组配置备注' })
  await notes.fill('正在编辑')
  await page.keyboard.press('ControlOrMeta+Shift+P')
  await page.keyboard.press('ControlOrMeta+e')
  await expect(notes).toBeFocused()
  await expect(page.locator('#code-modal')).toHaveCount(0)
  await page.waitForTimeout(300)
  expect(downloads).toBe(0)
})

test('an empty scope is an error state with copy and download disabled', async ({ page }) => {
  await page.keyboard.press('ControlOrMeta+Shift+P')
  await expect(page.locator('#code-modal')).toBeVisible()
  await expect(page.locator('#code-preview-error')).toBeVisible()
  await expect(page.locator('#btn-download-current-code')).toBeDisabled()
  await expect(page.locator('#code-preview-copy')).toBeDisabled()
  await expect(page.locator('#code-preview-content')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await openKit(page)
  await expect(page.locator('#selection-dock-export')).toBeDisabled()
})

test('preview scopes honour exclusions and changing scope resets the code scroll', async ({ page }) => {
  await selectCurrentPack(page)
  await tileAction(page, 0)
  await openKit(page)
  await page.locator('#selection-dock-preview').click()
  await expect(page.locator('#code-preview-content')).toBeVisible()
  expect((await codeJson(page)).packs[0].items).toHaveLength(239)
  await page.locator('#code-scope-current').click()
  expect((await codeJson(page)).packs[0].items).toHaveLength(239)

  await page.locator('#code-scope-all').click()
  expect((await codeJson(page)).packs.map((pack: { items: unknown[] }) => pack.items.length)).toEqual([240, 2])
  const scroller = page.locator('.pv__code')
  await scroller.evaluate(e => { e.scrollTop = e.scrollHeight })
  expect(await scroller.evaluate(e => e.scrollTop)).toBeGreaterThan(0)
  await page.locator('#code-scope-current').click()
  expect(await page.locator('.pv__code').evaluate(e => e.scrollTop)).toBe(0)
})

test('a stored Markdown export format falls back to Smoji', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('smoji-workbench:export-format', 'markdown'))
  await reload(page)
  await page.keyboard.press('ControlOrMeta+Shift+P')
  await expect(page.locator('#code-tab-smoji')).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('#code-tab-markdown')).toHaveCount(0)
  await expect(page.locator('#code-modal').getByRole('radiogroup', { name: '导出格式' }).getByRole('radio')).toHaveCount(5)
})

test('copy failures select the code for manual copying without widening the dialog', async ({ page }) => {
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }))
  await selectCurrentPack(page)
  await page.keyboard.press('ControlOrMeta+Shift+P')
  await page.locator('#code-preview-copy').click()
  await expect(page.locator('#code-preview-copy')).toHaveText('手动复制')
  await expect(page.locator('#code-modal').getByRole('status')).toContainText('已选中内容')
  expect(await page.evaluate(() => getSelection()?.toString().length ?? 0)).toBeGreaterThan(100)
  expect(await page.locator('#code-modal').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true)
})
