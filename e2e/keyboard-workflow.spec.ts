import { test, expect } from '@playwright/test'

test.describe('Full Keyboard Navigation Workflow E2E', () => {
  test('navigates mode, category, grid, inspector, and preview purely via keyboard', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.card').first()).toBeVisible()

    // 1. Tab to Skip link
    await page.keyboard.press('Tab')
    const active1 = await page.evaluate(() => document.activeElement?.className || '')
    expect(active1).toContain('skip-link')

    // 2. Press Enter on skip link -> Focus jumps to grid
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')

    // 3. 2D Roving Grid Navigation (Arrow keys)
    await page.keyboard.press('ArrowRight')
    const active3 = await page.evaluate(() => document.activeElement?.getAttribute('data-roving-item'))
    expect(active3).toBe('true')

    await page.keyboard.press('ArrowDown')
    const active4 = await page.evaluate(() => document.activeElement?.getAttribute('data-roving-item'))
    expect(active4).toBe('true')

    // 4. Press Enter to open Inspector
    await page.keyboard.press('Enter')
    const dialog = page.locator('[data-slot="dialog-content"]')
    await expect(dialog).toBeVisible()

    // 5. Press '2' to switch copy format to URL
    await page.keyboard.press('2')
    const copyInput = page.locator('#copy-active-input')
    const val = await copyInput.inputValue()
    expect(val).toMatch(/^https?:\/\//)

    // 6. Press Esc to close Inspector
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()

    // 7. Open Code Preview Dialog via shortcut: ⌘/Ctrl+Shift+P
    await page.keyboard.press('ControlOrMeta+Shift+P')
    const codeModal = page.locator('#code-modal')
    await expect(codeModal).toBeVisible()

    // 8. Press Esc to close Code Preview Dialog
    await page.keyboard.press('Escape')
    await expect(codeModal).not.toBeVisible()
  })
})
