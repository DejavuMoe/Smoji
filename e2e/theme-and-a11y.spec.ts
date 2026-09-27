import { test, expect } from '@playwright/test'
import { assetBase, boot, closeSheets, makeItems, mockCatalog, openKit, svg, tiles } from './support'

const packs = [{ id: 'a11y', label: '无障碍分类', items: makeItems('a11y', 12, '表情') }]

test.beforeEach(async ({ page }) => {
  await mockCatalog(page, packs)
})

test('theme toggle cycles system → light → dark, persists and follows live system changes', async ({ page }) => {
  await boot(page)
  const html = page.locator('html')
  const toggle = page.locator('#theme-toggle')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(html).toHaveAttribute('data-theme', 'light')

  await toggle.click()
  expect(await page.evaluate(() => localStorage.getItem('smoji-theme'))).toBe('light')
  await toggle.click()
  await expect(html).toHaveAttribute('data-theme', 'dark')
  expect(await page.evaluate(() => localStorage.getItem('smoji-theme'))).toBe('dark')
  // The inline bootstrap applies the stored theme before the app mounts.
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await toggle.click()
  expect(await page.evaluate(() => localStorage.getItem('smoji-theme'))).toBe('system')
  await expect(html).toHaveAttribute('data-theme', 'light')
})

test('landmarks, names and tooltips replace native titles in both themes', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('smoji-workbench:selected-pack-ids', '["a11y"]'))
  await boot(page)
  await expect(page.locator('a[href="#grid"]')).toHaveText('跳到表情图库')
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('group', { name: '表情图库', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('无障碍分类')

  // Icon and shortcut hints come from real tooltips on keyboard focus.
  await page.locator('#btn-open-guide').focus()
  await expect(page.getByRole('tooltip').filter({ hasText: '使用指南' })).toBeVisible()
  await openKit(page)
  await page.locator('#selection-dock-preview').focus()
  await expect(page.getByRole('tooltip').filter({ hasText: '预览导出数据' })).toBeVisible()
  await closeSheets(page)

  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await expect(page.locator('#root [title]')).toHaveCount(0)
    await page.locator('#btn-open-guide').click()
    await expect(page.getByRole('dialog', { name: '使用指南' })).toBeVisible()
    await expect(page.locator('body [title]')).toHaveCount(0)
    await page.locator('#guide-modal-close').click()
    await expect(page.locator('#guide-modal')).toHaveCount(0)
    await tiles(page).first().click()
    await expect(page.locator('.insp')).toBeVisible()
    await expect(page.locator('body [title]')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(page.locator('.insp')).toHaveCount(0)
  }
})

test('keyboard focus is a visible 2px ring, also in forced colours', async ({ page }) => {
  await boot(page)
  const first = tiles(page).first()
  await first.focus()
  await page.keyboard.press('ArrowRight')
  const second = tiles(page).nth(1)
  await expect(second).toBeFocused()
  await expect(second).toHaveCSS('outline-style', 'solid')
  expect(parseFloat(await second.evaluate(e => getComputedStyle(e).outlineWidth))).toBeGreaterThanOrEqual(2)
  await page.emulateMedia({ forcedColors: 'active' })
  await page.keyboard.press('ArrowLeft')
  await expect(first).toBeFocused()
  await expect(first).toHaveCSS('outline-style', 'solid')
})

test('images reveal from a blurred placeholder regardless of load speed, without moving the tile', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route(`${assetBase}a11y/0.png`, async route => {
    await gate
    await route.fulfill({ contentType: 'image/svg+xml', body: svg })
  })
  try {
    await page.goto('/')
    const tile = page.locator('#grid .tile').first()
    const sticker = tile.locator('.sticker')
    await expect(sticker).toHaveAttribute('data-image-status', 'loading')
    await expect(sticker.locator('.sticker__ph')).toBeVisible()
    const before = await tile.boundingBox()
    release()
    await expect(sticker).toHaveAttribute('data-image-status', 'ready')
    await expect(sticker.locator('.sticker__ph')).toHaveCount(0)
    const media = sticker.locator('.sticker__media')
    const midpoint = await media.evaluate(element => {
      const animation = element.getAnimations().find(a => (a as CSSAnimation).animationName === 'unblur')!
      animation.pause()
      animation.currentTime = 120
      return { filter: getComputedStyle(element).filter, opacity: Number(getComputedStyle(element).opacity) }
    })
    expect(parseFloat(midpoint.filter.replace('blur(', ''))).toBeGreaterThan(0)
    expect(midpoint.opacity).toBeLessThan(1)
    await media.evaluate(element => element.getAnimations().forEach(a => a.finish()))
    expect(await media.evaluate(element => getComputedStyle(element).filter)).toMatch(/^(none|blur\(0px\))$/)
    expect(await tile.boundingBox()).toEqual(before)

    // Already-cached images take the same reveal: speed never skips the animation.
    const fast = page.locator('#grid .tile').nth(1).locator('.sticker__media')
    await expect(fast).toBeVisible()
    expect(await fast.evaluate(e => getComputedStyle(e).animationName)).toBe('unblur')
  } finally { release() }

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  const media = page.locator('#grid .tile').first().locator('.sticker__media')
  await expect(media).toBeVisible()
  expect(await media.evaluate(e => getComputedStyle(e).animationName)).toBe('fade-only')
})

test('the grid shows stills and plays an animated original only on hover', async ({ page, isMobile }) => {
  test.skip(isMobile, 'hover playback is a pointer affordance')
  await boot(page)
  await expect(page.locator('#grid img[src$=".png"]')).toHaveCount(0)
  const tile = page.locator('#grid .tile').nth(2)
  await expect(tile.locator('.sticker')).toHaveAttribute('data-image-status', 'ready')
  await tile.hover()
  await expect(tile.locator('.sticker__live')).toHaveAttribute('src', `${assetBase}a11y/2.png`)
  await page.mouse.move(0, 0)
  await expect(tile.locator('.sticker__live')).toHaveCount(0)
})
