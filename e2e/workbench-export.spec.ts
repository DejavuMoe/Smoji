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
    await dockFormatSelect.click()
    await page.getByRole('option', { name: 'Twikoo', exact: true }).click()

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

    // Only supported configuration formats remain in the exporter.
    await expect(page.locator('#code-tab-markdown')).toHaveCount(0)
    await page.locator('#code-tab-artalk').click()
    await expect(page.locator('#code-tab-artalk')).toHaveAttribute('aria-selected', 'true')
    const artalk = JSON.parse(await code.innerText())
    expect(artalk[0]).toMatchObject({ type: 'image', items: expect.any(Array) })
    expect(artalk[0].items.length).toBeGreaterThan(0)

    await page.keyboard.press('Escape')
    await expect(codeModal).not.toBeVisible()
  })
})
