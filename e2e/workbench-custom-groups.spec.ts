import catalog from '../data/smoji.json' with { type: 'json' }
import { test, expect } from '@playwright/test'

test.describe('Workbench Custom Groups Mode E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Current local catalog; UI contracts must not depend on the CDN's version or latency.
    await page.route('**/smoji.json', route => route.fulfill({ json: catalog }))
    await page.route(/\.(png|gif|webp)$/, route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="teal"/></svg>' }))
    await page.goto('/')
    await expect(page.locator('.card').first()).toBeVisible()

    // If mobile/tablet, open drawer
    const menuToggle = page.locator('#menu-toggle')
    if (await menuToggle.isVisible()) {
      await menuToggle.click()
    }

    // Switch to custom mode
    await page.locator('#tab-custom').click()
    await expect(page.locator('#custom-builder')).toBeVisible()
  })

  test('creates, renames, duplicates, splits, merges, and undoes custom groups', async ({ page }) => {
    // 1. Create a custom group
    const input = page.locator('#custom-name-input')
    await input.fill('我的收藏')
    await page.locator('#btn-create-custom-pack').click()
    await expect(page.locator('#mobile-sidebar')).not.toBeVisible()

    // Creating a group hands the user back to the gallery, so reopen the drawer on mobile.
    const menuToggleAfterCreate = page.locator('#menu-toggle')
    if (await menuToggleAfterCreate.isVisible()) {
      await menuToggleAfterCreate.click()
    }

    const groups = page.locator('.custom-pack-item')
    await expect(groups).toHaveCount(1)
    await expect(groups.first()).toContainText('我的收藏')

    // 2. Add item from gallery
    const drawerClose = page.locator('#sidebar-close')
    if (await drawerClose.isVisible()) {
      await drawerClose.click()
    }

    const firstCard = page.locator('.card').first()
    const addBtn = firstCard.locator('.card__action-btn')
    await addBtn.focus()
    await page.keyboard.press('Enter')

    // Card should now have badge (✓)
    await expect(firstCard.locator('.card__badge')).toBeVisible()

    // 3. Batch add from current pack
    const batchAddBtn = page.locator('#btn-batch-pack-action')
    await expect(batchAddBtn).toHaveText('本分类全部加入')
    await batchAddBtn.click()

    // 4. Test Undo (⌘/Ctrl+Z)
    await page.keyboard.press('ControlOrMeta+z')

    // 5. Test Redo (⌘/Ctrl+Shift+Z)
    await page.keyboard.press('ControlOrMeta+Shift+z')

    // Reopen sidebar if mobile
    const menuToggle = page.locator('#menu-toggle')
    if (await menuToggle.isVisible()) {
      await menuToggle.click()
    }

    // 6. Duplicate group
    const moreBtn = page.locator('.custom-pack-item .group-tools button[aria-haspopup="menu"]').first()
    await moreBtn.click()
    await page.locator('[role="menu"][data-state="open"] [data-group-action="duplicate"]').click()
    await expect(groups).toHaveCount(2)
    await expect(groups.nth(1)).toContainText('副本')

    // 7. Split group
    const secondMoreBtn = groups.nth(1).locator('.group-tools button[aria-haspopup="menu"]')
    await secondMoreBtn.click()
    await page.locator('[role="menu"][data-state="open"] [data-group-action="split"]').click()
    await expect(groups).toHaveCount(3)

    // 8. Merge group
    const thirdMoreBtn = groups.nth(2).locator('.group-tools button[aria-haspopup="menu"]')
    await thirdMoreBtn.click()
    await page.locator('[role="menu"][data-state="open"] [data-group-action="merge"]').click()
    await expect(groups).toHaveCount(2)
  })
})
