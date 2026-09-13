import { test, expect } from '@playwright/test'

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
