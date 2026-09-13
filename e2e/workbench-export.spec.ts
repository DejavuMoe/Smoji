import { test, expect } from '@playwright/test'

test.describe('Export Workflow and Code Preview E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.card').first()).toBeVisible()
  })

  test('syncs dock format with preview dialog, opens on ⌘/Ctrl+Shift+P', async ({ page }) => {
    // Dock should be hidden initially when 0 packs are selected
    const dock = page.locator('#selection-dock')
    await expect(dock).not.toBeVisible()

    // Open menu if mobile
    const menuToggle = page.locator('#menu-toggle')
    if (await menuToggle.isVisible()) {
      await menuToggle.click()
    }

    // Select first pack
    await page.locator('.pack-check').first().click()

    // Close menu if mobile
    const drawerClose = page.locator('#sidebar-close')
    if (await drawerClose.isVisible()) {
      await drawerClose.click()
    }

    // Dock is now visible
    await expect(dock).toBeVisible()
    await expect(page.locator('#selection-dock-count')).toContainText('1 个分类')

    // Change format to twikoo in dock
    const dockFormatSelect = page.locator('#selection-dock-format')
    await dockFormatSelect.selectOption('twikoo')

    // Click preview button on dock
    await page.locator('#selection-dock-preview').click()

    // Code modal opens
    const codeModal = page.locator('#code-modal')
    await expect(codeModal).toBeVisible()

    // Active tab in code modal should be Twikoo
    const twikooTab = page.locator('#code-tab-twikoo')
    await expect(twikooTab).toHaveAttribute('aria-selected', 'true')

    // Check code content
    const code = page.locator('#code-preview-content')
    await expect(code).toBeVisible()
    const content = await code.textContent()
    expect(content).toContain('"type": "image"')

    // Close code modal
    await page.locator('#code-modal-close').click()
    await expect(codeModal).not.toBeVisible()

    // Test shortcut: ⌘/Ctrl+Shift+P
    await page.keyboard.press('ControlOrMeta+Shift+P')
    await expect(codeModal).toBeVisible()

    // Switch format tab to Markdown
    await page.locator('#code-tab-markdown').click()
    const mdContent = await code.textContent()
    expect(mdContent).toContain('###')

    await page.keyboard.press('Escape')
    await expect(codeModal).not.toBeVisible()
  })
})
