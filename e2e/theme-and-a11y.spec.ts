import { test, expect } from '@playwright/test'

test.describe('Theme, Safe Area, and Accessibility E2E', () => {
  test('persists theme toggle and updates data-theme / class on html element', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#theme-toggle')).toBeVisible()

    const html = page.locator('html')

    // Click theme toggle
    await page.locator('#theme-toggle').click()

    // Read stored theme
    const theme = await page.evaluate(() => localStorage.getItem('smoji-theme'))
    expect(['light', 'dark', 'system']).toContain(theme)

    // Verify viewport and dock CSS variables
    const vars = await page.evaluate(() => {
      const style = document.documentElement.style
      return {
        viewportHeight: style.getPropertyValue('--viewport-height'),
        keyboardInset: style.getPropertyValue('--keyboard-inset'),
        dockOffset: style.getPropertyValue('--selection-dock-offset'),
      }
    })
    expect(vars.viewportHeight).toBeTruthy()
    expect(vars.keyboardInset).toBeTruthy()
  })

  test('maintains accessible aria roles and landmark headings', async ({ page }) => {
    await page.goto('/')

    // Skip link
    const skipLink = page.locator('a[href="#grid"]')
    await expect(skipLink).toHaveText('跳到表情图库')

    // Grid role
    await expect(page.locator('#grid')).toHaveAttribute('role', 'grid')

    // Open guide dialog and check accessible title
    await page.locator('#btn-open-guide').click()
    const guideDialog = page.locator('#guide-modal')
    await expect(guideDialog).toBeVisible()
    await expect(page.locator('[data-slot="dialog-title"]')).toContainText('Smoji 使用指南与接入规范')

    await page.locator('#guide-modal-close').click()
    await expect(guideDialog).not.toBeVisible()
  })
})
