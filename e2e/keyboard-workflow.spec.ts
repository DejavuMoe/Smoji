import { test, expect } from '@playwright/test'
import { boot, closeSheets, makeItems, mockCatalog, openKit, openPackList, setMode, tiles } from './support'

const keyboardItems = makeItems('keyboard', 15, '键盘表情')
const packs = [
  { id: 'keyboard', label: '键盘分类', items: keyboardItems },
  { id: 'short', label: '单行分类', items: makeItems('short', 3, '单行') },
]
const dialog = '.insp'

test.beforeEach(async ({ page }) => {
  await mockCatalog(page, packs)
  await page.addInitScript(items => {
    if (localStorage.getItem('smoji-workbench:custom-packs')) return
    localStorage.setItem('smoji-workbench:custom-packs', JSON.stringify([
      { id: 'a', label: '分组 A', itemSrcs: items.slice(0, 3).map(item => item.src) },
      { id: 'b', label: '分组 B', itemSrcs: [] },
    ]))
  }, keyboardItems)
  await boot(page)
})

test('skip link, roving grid, inspector and preview work from the keyboard alone', async ({ page }) => {
  await page.keyboard.press('Tab')
  await expect(page.locator('.skip-link')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#grid')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(tiles(page).first()).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(tiles(page).nth(1)).toBeFocused()

  await page.keyboard.press('Enter')
  await expect(page.locator(dialog)).toBeVisible()
  await expect(page.locator('#pop-group-btn')).toBeFocused()
  await page.keyboard.press('2')
  await expect(page.locator('.copy__row[data-active] [data-copy-format]')).toHaveAttribute('data-copy-format', 'url')
  await page.keyboard.press('Escape')
  await expect(page.locator(dialog)).toHaveCount(0)
  await expect(tiles(page).nth(1)).toBeFocused()

  await page.keyboard.press('ControlOrMeta+Shift+P')
  await expect(page.locator('#code-modal')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('#code-modal')).toHaveCount(0)
  await expect(tiles(page).nth(1)).toBeFocused()

  await page.keyboard.press('?')
  await expect(page.locator('#guide-modal')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('#guide-modal')).toHaveCount(0)
})

test('multi-row and single-row navigation keep one tab stop', async ({ page }) => {
  const cards = tiles(page)
  await cards.first().focus()
  const nextRow = await cards.evaluateAll(elements => {
    const top = elements[0]!.getBoundingClientRect().top
    return elements.findIndex(element => element.getBoundingClientRect().top > top + 1)
  })
  expect(nextRow).toBeGreaterThan(0)
  await page.keyboard.press('ArrowDown')
  await expect(cards.nth(nextRow)).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(cards.first()).toBeFocused()
  await page.keyboard.press('End')
  await expect(cards.last()).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(cards.last()).toBeFocused()
  await page.keyboard.press('Home')
  await expect(cards.first()).toBeFocused()
  await expect(page.locator('#grid [tabindex="0"]')).toHaveCount(1)

  await openPackList(page)
  await page.locator('#pack-nav .pack').nth(1).click()
  await closeSheets(page)
  await expect(cards).toHaveCount(3)
  await cards.first().focus()
  await page.keyboard.press('ArrowDown')
  await expect(cards.first()).toBeFocused()
  await page.keyboard.press('End')
  await expect(cards.last()).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(cards.last()).toBeFocused()
  await expect(page.locator('#grid [tabindex="0"]')).toHaveCount(1)
})

test('the pack list is one tab stop: ↑/↓ change pack, ←/→ reach the checkbox', async ({ page }) => {
  await openPackList(page)
  const current = page.locator('#pack-nav .pack[aria-current="true"]')
  await expect(page.locator('#pack-nav [tabindex="0"]')).toHaveCount(1)
  await expect(current).toHaveAttribute('tabindex', '0')
  await current.focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('.ghead__title')).toHaveText('单行分类')
  await expect(page.locator('#pack-nav .pack').nth(1)).toBeFocused()
  await page.keyboard.press('ArrowRight')
  const check = page.getByRole('checkbox', { name: '选择 单行分类', exact: true })
  await expect(check).toBeFocused()
  await page.keyboard.press('Space')
  await expect(check).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('ArrowUp')
  await expect(page.getByRole('checkbox', { name: '选择 键盘分类', exact: true })).toBeFocused()
  // Moving within the checkbox column never changes the viewed pack.
  await expect(page.locator('.ghead__title')).toHaveText('单行分类')
  await expect(page.locator('#pack-nav [tabindex="0"]')).toHaveCount(1)
})

test('inspector: number keys pick formats, modifiers are ignored, arrows page and Esc returns focus', async ({ page }) => {
  const card = tiles(page).nth(2)
  await card.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#pop-close-btn')).toBeVisible()
  // The preview shortcut cannot stack a second dialog on the inspector.
  await page.keyboard.press('ControlOrMeta+Shift+P')
  await expect(page.locator('#code-modal')).toHaveCount(0)
  for (const [key, format] of [['1', 'md'], ['2', 'url'], ['3', 'html'], ['4', 'bbcode']] as const) {
    await page.keyboard.press(key)
    await expect(page.locator('.copy__row[data-active] [data-copy-format]')).toHaveAttribute('data-copy-format', format)
  }
  // Modifiers and the former fifth key change nothing.
  await page.keyboard.press('Control+2')
  await page.keyboard.press('Alt+2')
  await page.keyboard.press('5')
  await expect(page.locator('.copy__row[data-active] [data-copy-format]')).toHaveAttribute('data-copy-format', 'bbcode')

  const title = page.locator('.insp__title')
  await expect(title).toHaveText('键盘表情 2')
  await page.keyboard.press('ArrowRight')
  await expect(title).toHaveText('键盘表情 3')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect(title).toHaveText('键盘表情 1')
  // Arrow keys inside the background radio group move the selection, never the image.
  await page.locator('.insp__bg [aria-checked="true"]').focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.insp__stage')).toHaveAttribute('data-bg', 'light')
  await expect(title).toHaveText('键盘表情 1')
  await page.keyboard.press('Escape')
  await expect(card).toBeFocused()
})

test('Space runs the inspector action in packs mode without closing it', async ({ page }) => {
  const card = tiles(page).first()
  await card.focus()
  await page.keyboard.press('Space')
  const action = page.locator('#pop-group-btn')
  await expect(action).toBeFocused()
  await expect(action).toHaveText('选择「键盘分类」整包导出')
  await page.keyboard.press('Space')
  await expect(action).toHaveText('从导出中排除')
  await page.keyboard.press('Space')
  await expect(action).toHaveText('恢复到导出')
  await page.keyboard.press('Space')
  await expect(action).toHaveText('从导出中排除')
  await expect(action).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(card).toBeFocused()
  await openKit(page)
  await expect(page.locator('#selection-dock-count')).toHaveText('1 个分类 · 15 张表情')
})

test('Space adds and removes in custom mode; emptying the picked view hands focus to its action', async ({ page }) => {
  await setMode(page, 'custom')
  const card = tiles(page).nth(4)
  await card.focus()
  await page.keyboard.press('Enter')
  const action = page.locator('#pop-group-btn')
  await expect(action).toBeFocused()
  await page.keyboard.press('Space')
  await expect(action).toHaveText('从「分组 A」移出')
  await page.keyboard.press('Space')
  await expect(action).toHaveText('加入「分组 A」')
  await page.keyboard.press('Escape')
  await expect(card).toBeFocused()

  await page.locator('#gallery-view-picked').getByRole('radio', { name: '已入组 (3)' }).click()
  await tiles(page).first().click()
  for (const remaining of [2, 1, 0]) {
    await page.keyboard.press('Space')
    await expect(page.locator('#gallery-view-picked [role="radio"]').last()).toHaveText(`已入组 (${remaining})`)
  }
  await expect(page.locator('.insp')).toHaveCount(0)
  await expect(page.locator('#gallery-empty-action')).toBeFocused()
})

test('tray keys reorder and delete while keeping focus on a neighbour, then on the group', async ({ page }) => {
  await setMode(page, 'custom')
  await openKit(page)
  const group = page.locator('#custom-pack-list [data-custom-index="0"]')
  const tray = group.locator('[data-tray-item]')
  await tray.first().focus()
  await page.keyboard.press('Alt+ArrowRight')
  await expect(tray.nth(1)).toBeFocused()
  await expect(tray.nth(1)).toHaveAttribute('data-tray-src', keyboardItems[0]!.src)
  await page.keyboard.press('Delete')
  await expect(tray.nth(1)).toBeFocused()
  await page.keyboard.press('Delete')
  await expect(tray.first()).toBeFocused()
  await page.keyboard.press('Delete')
  await expect(group.locator('.custom-pack-name')).toBeFocused()
  await expect(group.locator('.group__hint')).toBeVisible()
  await closeSheets(page)
  await page.keyboard.press('ControlOrMeta+z')
  await openKit(page)
  await expect(tray).toHaveCount(1)
})

test('tray menu moves, rejected moves and editing keep a usable focus target', async ({ page }) => {
  await setMode(page, 'custom')
  await openKit(page)
  const group = page.locator('#custom-pack-list [data-custom-index="0"]')
  // Tray tools appear on hover or focus, like every other secondary control.
  const openTrayMenu = async (label: string) => {
    const button = group.getByRole('button', { name: `排序或移动 ${label}`, exact: true })
    await button.locator('xpath=ancestor::div[contains(@class, "tray__cell")]').hover()
    await button.click()
  }
  await openTrayMenu('键盘表情 0')
  await page.getByRole('menuitem', { name: '移至「分组 B」' }).click()
  await expect(group.locator('[data-tray-item]')).toHaveCount(2)
  await expect(group.locator('[data-tray-item]').first()).toBeFocused()

  const tools = group.getByRole('button', { name: '分组操作', exact: true })
  await tools.click()
  await page.getByRole('menuitem', { name: '编辑名称 / ID' }).click()
  await expect(page.locator('#edit-name-0')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(tools).toBeFocused()

  // B already holds 键盘表情 0; moving a duplicate must be refused without losing focus.
  await page.evaluate(() => {
    const groups = JSON.parse(localStorage.getItem('smoji-workbench:custom-packs')!)
    groups[1].itemSrcs.push(groups[0].itemSrcs[0])
    localStorage.setItem('smoji-workbench:custom-packs', JSON.stringify(groups))
  })
  await page.reload()
  await expect(tiles(page).first()).toBeVisible()
  await openKit(page)
  await openTrayMenu('键盘表情 1')
  await page.getByRole('menuitem', { name: '移至「分组 B」' }).click()
  await expect(group.locator('[data-tray-item]')).toHaveCount(2)
  await expect(group.locator('[data-tray-item]').first()).toBeFocused()
})

test('destructive confirmation focuses 取消 and Escape returns to the menu trigger', async ({ page }) => {
  await setMode(page, 'custom')
  await openKit(page)
  const tools = page.locator('#custom-pack-list [data-custom-index="0"]').getByRole('button', { name: '分组操作', exact: true })
  await tools.click()
  await page.getByRole('menuitem', { name: '删除分组' }).click()
  await expect(page.locator('#confirm-cancel')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(tools).toBeFocused()
  await expect(page.locator('#custom-pack-list [data-custom-index]')).toHaveCount(2)
})

test('narrow sheets return focus to their own triggers', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const menu = page.locator('#menu-toggle')
  await menu.click()
  await expect(page.locator('#mobile-sidebar')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toBeFocused()

  await setMode(page, 'custom')
  const kit = page.locator('#kit-open')
  await kit.click()
  const tray = page.locator('#custom-pack-list [data-custom-index="0"] [data-tray-item]').nth(1)
  await tray.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#pop-close-btn')).toBeVisible()
  // Removing the opening thumbnail returns focus to its neighbour inside the sheet.
  await page.keyboard.press('Space')
  await page.keyboard.press('Escape')
  await expect(page.locator('#custom-pack-list [data-custom-index="0"] [data-tray-item]')).toHaveCount(2)
  await expect(page.locator('#custom-pack-list [data-custom-index="0"] [data-tray-item]').nth(1)).toBeFocused()
  await expect(page.locator('#kit-sheet')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(kit).toBeFocused()
})
