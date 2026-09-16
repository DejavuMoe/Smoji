import { test, expect } from '@playwright/test'

test.describe('Destructive Action Confirmation E2E', () => {
  test('focuses Cancel by default and prevents accidental Enter deletion', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.card').first()).toBeVisible()

    // Open drawer if mobile
    const menuToggle = page.locator('#menu-toggle')
    if (await menuToggle.isVisible()) {
      await menuToggle.click()
    }

    // Switch to custom mode
    await page.locator('#tab-custom').click()

    // Create a group to test deletion
    await page.locator('#custom-name-input').fill('待删除分组')
    await page.locator('#btn-create-custom-pack').click()

    // Creating a group hands the user back to the gallery, so reopen the drawer on mobile.
    if (await menuToggle.isVisible()) {
      await menuToggle.click()
    }

    const groups = page.locator('.custom-pack-item')
    await expect(groups).toHaveCount(1)

    // Open dropdown menu and trigger delete
    const moreBtn = groups.first().locator('.group-tools button[aria-haspopup="menu"]')
    await moreBtn.click()
    await page.locator('[role="menu"][data-state="open"] [data-group-action="delete"]').click()

    // Modal opens
    const modal = page.locator('#confirm-modal')
    await expect(modal).toBeVisible()

    // CRITICAL SAFETY CHECK: Initial focus MUST be on Cancel (#confirm-cancel), NOT Delete (#confirm-ok)
    const cancelBtn = page.locator('#confirm-cancel')
    await expect(cancelBtn).toBeFocused()

    // Pressing Enter must activate the currently focused button (Cancel) and dismiss dialog WITHOUT deleting
    await page.keyboard.press('Enter')
    await expect(modal).not.toBeVisible()
    await expect(groups).toHaveCount(1)

    // Trigger delete again
    await moreBtn.click()
    await page.locator('[role="menu"][data-state="open"] [data-group-action="delete"]').click()
    await expect(modal).toBeVisible()
    await expect(cancelBtn).toBeFocused()

    // Explicitly click OK (#confirm-ok) to confirm deletion
    await page.locator('#confirm-ok').click()
    await expect(modal).not.toBeVisible()
    await expect(groups).toHaveCount(0)
  })
})
