import { test, expect } from '@playwright/test'

test.describe('Gallery quick action visibility', () => {
  test.beforeEach(async ({ page }) => {
    const items = Array.from({ length: 3 }, (_, i) => ({
      id: `touch-${i}`, label: `表情 ${i}`, src: `https://s3-cdn.zsh.moe/smoji/touch/${i}.png`,
    }))
    await page.route('**/smoji.json', route => route.fulfill({ json: {
      version: 1, packs: [{ id: 'touch', label: '触屏分类', items }],
    } }))
    await page.route('**/touch/*.png', route => route.fulfill({
      contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="teal"/></svg>',
    }))
    await page.addInitScript(() => localStorage.setItem('smoji-workbench:custom-packs', JSON.stringify([
      { id: 'touch-group', label: '触屏收藏', itemSrcs: [] },
    ])))
    await page.goto('/')
    await expect(page.locator('.card__open').first()).toBeVisible()
  })

  test('only the hovered or focused card reveals an action at every width', async ({ page }) => {
    const actions = page.locator('.card__action-btn')
    const canHover = await page.evaluate(() => matchMedia('(hover: hover)').matches)
    for (const width of [1440, 834, 574, 390, 320]) {
      await page.setViewportSize({ width, height: 828 })
      await page.locator('.card__open').first().evaluate(e => (e as HTMLElement).blur())
      await page.mouse.move(0, 0)
      for (const action of await actions.all()) {
        await expect(action).toHaveCSS('opacity', '0')
        await expect(action).toHaveCSS('pointer-events', 'none')
      }
      if (canHover) {
        await page.locator('.card').first().hover()
        await expect(actions.first()).toHaveCSS('opacity', '1')
        await expect(actions.first()).toHaveCSS('pointer-events', 'auto')
        await expect(actions.nth(1)).toHaveCSS('opacity', '0')
        await page.mouse.move(0, 0)
      }
      await page.keyboard.press('Tab')
      await page.locator('.card__open').first().focus()
      await expect(actions.first()).toHaveCSS('opacity', '1')
      await expect(actions.first()).toHaveCSS('pointer-events', 'auto')
      await expect(actions.nth(1)).toHaveCSS('opacity', '0')
    }
  })

  test('touching a hidden corner opens preview and preserves pack and custom actions', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch, 'Touch interaction coverage')
    await page.setViewportSize({ width: 574, height: 828 })
    await page.getByRole('button', { name: '选择本分类导出' }).tap()
    const card = page.locator('.card').first()
    const corner = await card.locator('.card__action-btn').boundingBox()
    await page.touchscreen.tap(corner!.x + corner!.width / 2, corner!.y + corner!.height / 2)
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(card).not.toHaveClass(/is-excluded/)
    const action = page.locator('#pop-group-btn')
    await expect(action).toHaveText('从导出中排除')
    await action.tap()
    await expect(card).toHaveClass(/is-excluded/)
    await expect(action).toHaveText('恢复到导出')
    await action.tap()
    await expect(card).not.toHaveClass(/is-excluded/)
    await page.locator('#pop-close-btn').tap()
    await expect(page.locator('.card__action-btn').nth(1)).toHaveCSS('opacity', '0')

    await page.locator('#menu-toggle').tap()
    await page.locator('#tab-custom').tap()
    await page.locator('#sidebar-close').tap()
    await expect(card.locator('.card__action-btn')).toHaveCSS('opacity', '0')
    await card.locator('.card__open').tap()
    await expect(action).toHaveText('加入「触屏收藏」')
    await action.tap()
    await expect(card.locator('.card__badge')).toBeVisible()
    await expect(action).toHaveText('从「触屏收藏」移出')
    await action.tap()
    await expect(card.locator('.card__badge')).toHaveCount(0)
    await page.locator('#pop-close-btn').tap()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
})

test.describe('Responsive Viewport Matrix E2E', () => {
  const desktopViewports = [
    { width: 1440, height: 900, name: '1440x900' },
    { width: 1280, height: 800, name: '1280x800' },
    { width: 1100, height: 800, name: '1100x800' },
  ]

  const compactDesktopViewports = [
    { width: 1024, height: 768, name: '1024x768 (Compact Desktop)' },
    { width: 950, height: 700, name: '950x700 (Compact Desktop)' },
  ]

  const tabletViewports = [
    { width: 1194, height: 834, name: '1194x834 Landscape Tablet' },
    { width: 834, height: 1194, name: '834x1194 Portrait Tablet' },
    { width: 768, height: 1024, name: '768x1024 Portrait Tablet' },
  ]

  const phoneViewports = [
    { width: 430, height: 932, name: '430x932 (iPhone Pro Max)' },
    { width: 393, height: 852, name: '393x852 (Pixel 7)' },
    { width: 390, height: 844, name: '390x844 (iPhone 14)' },
    { width: 360, height: 800, name: '360x800 (Android Standard)' },
    { width: 320, height: 568, name: '320x568 (Small Phone)' },
  ]

  const landscapeViewports = [
    { width: 844, height: 390, name: '844x390 (Mobile Landscape)' },
    { width: 800, height: 360, name: '800x360 (Mobile Landscape)' },
  ]

  for (const vp of desktopViewports) {
    test(`verifies standard desktop layout at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/')
      await expect(page.locator('#sidebar')).toBeVisible()
      await expect(page.locator('#menu-toggle')).not.toBeVisible()
      await expect(page.locator('.brand__description')).toBeVisible()
    })
  }

  for (const vp of compactDesktopViewports) {
    test(`verifies compact desktop layout at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/')
      await expect(page.locator('#sidebar')).toBeVisible()
      await expect(page.locator('#menu-toggle')).not.toBeVisible()
    })
  }

  for (const vp of tabletViewports) {
    test(`verifies tablet layout at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/')
      if (vp.width >= 901) {
        await expect(page.locator('#sidebar')).toBeVisible()
      } else {
        await expect(page.locator('#sidebar')).not.toBeVisible()
        await expect(page.locator('#menu-toggle')).toBeVisible()
        // Open drawer
        await page.locator('#menu-toggle').click()
        await expect(page.locator('[aria-label="分类导航"]')).toBeVisible()
      }
    })
  }

  for (const vp of phoneViewports) {
    test(`verifies mobile phone layout and touch drawer at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/')
      await expect(page.locator('#sidebar')).not.toBeVisible()
      const toggle = page.locator('#menu-toggle')
      await expect(toggle).toBeVisible()

      // Open drawer sheet
      await toggle.click()
      const sheet = page.locator('[aria-label="分类导航"]')
      await expect(sheet).toBeVisible()

      // Close drawer sheet
      await page.locator('#sidebar-close').click()
      await expect(sheet).not.toBeVisible()
    })
  }

  for (const vp of landscapeViewports) {
    test(`verifies landscape mobile layout at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/')
      await expect(page.locator('#menu-toggle')).toBeVisible()
    })
  }
})
