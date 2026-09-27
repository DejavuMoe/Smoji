import { test, expect, type Locator, type Page } from '@playwright/test'
import { boot, makeItems, mockCatalog, noHorizontalOverflow, openKit, tiles } from './support'

const packs = [
  { id: 'wide', label: '一个名字相当长的表情分类用于检查截断', items: makeItems('wide', 40, '很长很长的表情名称') },
  { id: 'next', label: '第二分类', items: makeItems('next', 4, '第二') },
]

test.beforeEach(async ({ page }) => {
  await mockCatalog(page, packs)
})

const viewports = [
  { width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 1024, height: 768 }, { width: 900, height: 700 },
  { width: 899, height: 700 }, { width: 834, height: 1194 }, { width: 768, height: 1024 },
  { width: 430, height: 932 }, { width: 390, height: 844 }, { width: 360, height: 800 }, { width: 320, height: 568 },
  { width: 844, height: 390 },
]

/** Every button label in a row must fit without clipping or wrapping out of its box. */
async function expectControlsFit(scope: Locator) {
  const problems = await scope.locator('.seg, .ghead__actions, .xbar__actions, .pv__actions').evaluateAll(rows => rows.flatMap(row => {
    const issues: string[] = []
    if (row.scrollWidth - row.clientWidth > 1) issues.push(`${row.className} overflows`)
    for (const button of row.querySelectorAll('button')) {
      if (button.scrollWidth - button.clientWidth > 1) issues.push(`${button.textContent} is clipped`)
    }
    return issues
  }))
  expect(problems).toEqual([])
}

async function expectInsideViewport(page: Page, locator: Locator) {
  const width = page.viewportSize()!.width
  for (const element of await locator.all()) {
    if (!await element.isVisible()) continue
    const box = (await element.boundingBox())!
    const label = await element.evaluate(e => e.outerHTML.slice(0, 160))
    expect(box.x, label).toBeGreaterThanOrEqual(-0.5)
    expect(box.x + box.width, label).toBeLessThanOrEqual(width + 0.5)
  }
}

for (const viewport of viewports) {
  const name = `${viewport.width}x${viewport.height}`
  test(`layout holds at ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await boot(page)
    const narrow = viewport.width < 900
    await expect(page.locator('#sidebar')).toHaveCount(narrow ? 0 : 1)
    await expect(page.locator('.kit-col')).toHaveCount(narrow ? 0 : 1)
    await expect(page.locator('#menu-toggle')).toBeVisible({ visible: narrow })
    await expect(page.locator('.mbar')).toBeVisible({ visible: narrow })
    await expect(page.locator('#pack-nav')).toHaveCount(narrow ? 0 : 1)
    await noHorizontalOverflow(page)
    // The page itself never scrolls: only the gallery and side columns do.
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true)
    await expectInsideViewport(page, page.locator('.ghead button, .mbar button, .mtop__row button, #menu-toggle'))
    await expectControlsFit(page.locator('.stage'))

    await page.getByRole('button', { name: '选择本分类导出' }).click()
    await openKit(page)
    await expectControlsFit(page.locator('.kit'))
    await expectInsideViewport(page, page.locator('.kit button'))
    await noHorizontalOverflow(page)
    await page.keyboard.press('Escape')

    await tiles(page).first().click()
    // Measure the settled layout, not the sheet's slide-in.
    await page.locator('.insp, .insp__sticker').evaluateAll(elements => Promise.all(elements.flatMap(e => e.getAnimations().map(a => a.finished))))
    const stage = (await page.locator('[data-preview-stage]').boundingBox())!
    const sticker = (await page.locator('.insp__sticker').boundingBox())!
    expect(Math.min(stage.width, stage.height)).toBeGreaterThan(200)
    expect(sticker.x).toBeGreaterThanOrEqual(stage.x)
    expect(sticker.y).toBeGreaterThanOrEqual(stage.y)
    expect(sticker.x + sticker.width).toBeLessThanOrEqual(stage.x + stage.width + 0.5)
    expect(sticker.y + sticker.height).toBeLessThanOrEqual(stage.y + stage.height + 0.5)
    const dialog = page.locator('.insp')
    expect(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true)
    await expectInsideViewport(page, dialog)
    await expectControlsFit(dialog)
    await page.keyboard.press('Escape')

    await page.keyboard.press('ControlOrMeta+Shift+P')
    const preview = page.locator('#code-modal')
    await expect(preview).toBeVisible()
    await expectInsideViewport(page, preview)
    await expectControlsFit(preview)
    await page.keyboard.press('Escape')
    await noHorizontalOverflow(page)
  })
}

test('crossing the breakpoint keeps a single pack list and closes narrow sheets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await boot(page)
  await page.locator('#menu-toggle').click()
  await expect(page.locator('#mobile-sidebar')).toBeVisible()
  await page.setViewportSize({ width: 1024, height: 800 })
  await expect(page.locator('#mobile-sidebar')).toHaveCount(0)
  await expect(page.locator('#pack-nav')).toHaveCount(1)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('#pack-nav')).toHaveCount(0)
  await expect(page.locator('#kit-open')).toBeVisible()
})

test('touch devices get no hover tools and act through the inspector', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch projects only')
  await boot(page)
  await expect(page.locator('#grid .tile__tools').first()).toBeHidden()
  await tiles(page).first().tap()
  await expect(page.locator('#pop-group-btn')).toHaveText(/整包导出/)
  await page.locator('#pop-group-btn').tap()
  await expect(page.locator('#pop-group-btn')).toHaveText('从导出中排除')
  await page.keyboard.press('Escape')

  // Tray thumbnails keep one always-visible menu; removal lives inside it.
  await page.evaluate(src => {
    localStorage.setItem('smoji-workbench:mode', 'custom')
    localStorage.setItem('smoji-workbench:custom-packs', JSON.stringify([{ id: 'touch', label: '触控', itemSrcs: [src] }]))
  }, packs[0]!.items[0]!.src)
  await page.reload()
  await openKit(page)
  const cell = page.locator('#custom-pack-list .tray__cell').first()
  await expect(cell.getByRole('button', { name: `排序或移动 ${packs[0]!.items[0]!.label}` })).toBeVisible()
  await expect(cell.getByRole('button', { name: `移出 ${packs[0]!.items[0]!.label}` })).toBeHidden()
  await cell.getByRole('button', { name: `排序或移动 ${packs[0]!.items[0]!.label}` }).tap()
  await page.getByRole('menuitem', { name: '从分组移出' }).tap()
  await expect(page.locator('#custom-pack-list .group__hint')).toBeVisible()
})
