import { test, expect } from '@playwright/test'
import { boot, closeSheets, createGroup, makeItems, mockCatalog, reload, setMode, tileAction, tiles } from './support'

const packs = [{ id: 'insp', label: '详情分类', items: makeItems('insp', 6, '详情') }]

test.beforeEach(async ({ page }) => {
  await mockCatalog(page, packs)
  await boot(page)
})

test('shows every copy format, switches backgrounds and pages with the side buttons', async ({ page }) => {
  await tiles(page).first().click()
  const dialog = page.locator('.insp')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.insp__sticker')).toHaveAttribute('data-image-status', 'ready')
  const codes = await dialog.locator('.copy__code').allTextContents()
  expect(codes).toHaveLength(4)
  expect(codes[0]).toMatch(/^!\[smoji:详情 0\]\(https:\/\/.+\)$/)
  expect(codes[1]).toMatch(/^https:\/\//)
  expect(codes[2]).toMatch(/^<img /)
  expect(codes[3]).toMatch(/^\[img\]/)
  await expect(dialog.getByRole('button', { name: /Hugo/ })).toHaveCount(0)
  await expect(dialog.locator('.insp__index')).toHaveText('1/6')

  for (const [name, bg] of [['浅底', 'light'], ['深底', 'dark'], ['透明', 'transparent']] as const) {
    await dialog.getByRole('radio', { name }).click()
    await expect(dialog.locator('[data-preview-stage]')).toHaveAttribute('data-bg', bg)
  }
  await page.locator('#pop-next-btn').click()
  await expect(page.locator('.insp__title')).toHaveText('详情 1')
  await page.locator('#pop-prev-btn').click()
  await page.locator('#pop-prev-btn').click()
  // Paging wraps around the current list.
  await expect(page.locator('.insp__title')).toHaveText('详情 5')
  await page.getByRole('button', { name: '关闭详情' }).click()
  await expect(dialog).toHaveCount(0)
})

test('copying confirms success, and a missing clipboard falls back to a selected field', async ({ page, context, browserName }) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await tiles(page).first().click()
  await page.getByRole('button', { name: '复制 URL' }).click()
  await expect(page.locator('.copy__row[data-copied]')).toContainText('已复制')
  await page.keyboard.press('Escape')

  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }))
  await tiles(page).first().click()
  await page.getByRole('button', { name: '复制 HTML' }).click()
  const input = page.locator('#copy-active-input')
  await expect(input).toBeFocused()
  expect(await input.evaluate((e: HTMLInputElement) => e.value.length > 0 && e.selectionStart === 0 && e.selectionEnd === e.value.length)).toBe(true)
  await expect(page.locator('#copy-feedback')).toContainText('手动复制')
  expect(await page.locator('.insp').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true)
})

test('removing the inspected item from the picked view moves to a neighbour', async ({ page }) => {
  await setMode(page, 'custom')
  await createGroup(page, '翻页')
  await closeSheets(page)
  await tileAction(page, 0)
  await tileAction(page, 1)
  await page.locator('#gallery-view-picked').getByRole('radio', { name: '已入组 (2)' }).click()
  await tiles(page).first().click()
  const title = page.locator('.insp__title')
  await expect(title).toHaveText('详情 0')
  await page.locator('#pop-group-btn').click()
  await expect(title).toHaveText('详情 1')
  await expect(page.locator('.insp__index')).toHaveText('1/1')
})

test('a failed original is reported distinctly and can be retried', async ({ page }) => {
  let fail = true
  await page.route('**/insp/3.png', route => fail ? route.abort() : route.fallback())
  // A fresh document: the grid must not have cached the original before it starts failing.
  await reload(page)
  await tiles(page).nth(3).click()
  const sticker = page.locator('.insp__sticker')
  await expect(sticker).toHaveAttribute('data-image-status', 'error')
  await expect(sticker).toContainText('加载失败')
  fail = false
  await page.getByRole('button', { name: '重试加载 详情 3' }).click()
  await expect(sticker).toHaveAttribute('data-image-status', 'ready')
})
