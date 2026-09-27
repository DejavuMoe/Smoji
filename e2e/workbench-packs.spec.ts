import { test, expect } from '@playwright/test'
import { boot, closeSheets, makeItems, mockCatalog, openKit, openPackList, tileAction, tiles } from './support'

const packs = [
  { id: 'a', label: '分类 A', items: makeItems('a', 150, 'A') },
  { id: 'b', label: '分类 B', items: makeItems('b', 3, 'B') },
  { id: 'c', label: '分类 C', items: makeItems('c', 3, 'C') },
  { id: 'd', label: '分类 D', items: makeItems('d', 3, 'D') },
]

test.beforeEach(async ({ page }) => {
  await mockCatalog(page, packs)
  await boot(page)
})

test('全选 → 反选 and partial invert [A, C] → [B, D], then 清空', async ({ page }) => {
  await openPackList(page)
  const selectAll = page.locator('#btn-select-all-packs')
  const checks = page.locator('#pack-nav .pack-check')
  const states = () => checks.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-checked')))
  await expect(checks).toHaveCount(4)
  await expect(selectAll).toHaveText('全选')

  await selectAll.click()
  expect(await states()).toEqual(['true', 'true', 'true', 'true'])
  await expect(selectAll).toHaveText('反选')
  await selectAll.click()
  expect(await states()).toEqual(['false', 'false', 'false', 'false'])
  await expect(selectAll).toHaveText('全选')

  await checks.nth(0).click()
  await checks.nth(2).click()
  await expect(selectAll).toHaveText('反选')
  await selectAll.click()
  expect(await states()).toEqual(['false', 'true', 'false', 'true'])

  await page.locator('#btn-clear-packs').click()
  expect(await states()).toEqual(['false', 'false', 'false', 'false'])
  await expect(page.locator('#btn-clear-packs')).toBeDisabled()
})

test('excludes and restores items only inside a selected pack', async ({ page }) => {
  // Unselected packs offer no exclusion tool: there is nothing to exclude from yet.
  await expect(page.locator('#grid .tile').first().locator('.tile__tool--act')).toHaveCount(0)
  await page.getByRole('button', { name: '选择本分类导出' }).click()
  await expect(page.getByRole('button', { name: '已选择本分类导出' })).toHaveAttribute('aria-pressed', 'true')

  await tileAction(page, 0)
  await expect(page.locator('#grid .tile').first()).toHaveAttribute('data-excluded')
  await expect(page.locator('#gallery-export-count')).toContainText('已排除 1 张')
  await openKit(page)
  await expect(page.locator('#selection-dock-count')).toHaveText('1 个分类 · 149 张表情')
  await expect(page.locator('.sel__n')).toContainText('149/150')
  await closeSheets(page)

  await tileAction(page, 0)
  await expect(page.locator('#grid .tile').first()).not.toHaveAttribute('data-excluded')
  await page.locator('#btn-batch-pack-action').click()
  await expect(page.locator('#btn-batch-pack-action')).toHaveText('恢复本分类全部')
  await expect(page.locator('#grid .tile[data-excluded]')).toHaveCount(await page.locator('#grid .tile').count())
  await page.locator('#btn-batch-pack-action').click()
  await expect(page.locator('#grid .tile[data-excluded]')).toHaveCount(0)
})

test('switches packs and renders large packs progressively', async ({ page }) => {
  await expect(page.locator('.ghead__title')).toHaveText('分类 A')
  const initial = await page.locator('#grid .tile').count()
  expect(initial).toBeLessThan(150)
  await expect(async () => {
    await page.locator('.stage__scroll').evaluate(scroller => { scroller.scrollTop = scroller.scrollHeight })
    await expect(page.locator('#grid .tile')).toHaveCount(150, { timeout: 500 })
  }).toPass()
  await expect(page.locator('.gallery__more')).toHaveCount(0)

  await openPackList(page)
  await page.locator('#pack-nav .pack').nth(1).click()
  await expect(page.locator('#mobile-sidebar')).toHaveCount(0)
  await expect(page.locator('.ghead__title')).toHaveText('分类 B')
  await expect(tiles(page)).toHaveCount(3)
  expect(await page.locator('.stage__scroll').evaluate(scroller => scroller.scrollTop)).toBe(0)
})

test('the narrow pack strip switches packs without opening the drawer', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1440) >= 900, 'narrow layout only')
  const chip = page.locator('.strip__chip').nth(2)
  await chip.click()
  await expect(chip).toHaveAttribute('aria-current', 'true')
  await expect(page.locator('.ghead__title')).toHaveText('分类 C')
})
