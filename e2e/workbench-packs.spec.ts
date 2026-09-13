import { test, expect } from '@playwright/test'

test.describe('Workbench Packs Mode E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for the app to mount and cards to load
    await expect(page.locator('.card').first()).toBeVisible()
  })

  test('preserves dynamic 全选 → 反选 and partial invert [A, C] -> [B, D] contract', async ({ page, isMobile }) => {
    // If mobile/tablet, open drawer
    const menuToggle = page.locator('#menu-toggle')
    if (await menuToggle.isVisible()) {
      await menuToggle.click()
    }

    const selectAllBtn = page.locator('#btn-select-all-packs')
    await expect(selectAllBtn).toBeVisible()
    await expect(selectAllBtn).toHaveText('全选')

    // Initial state: 0 packs selected
    const packChecks = page.locator('.pack-check')
    const totalPacks = await packChecks.count()
    expect(totalPacks).toBeGreaterThanOrEqual(4)

    // 1. Click 全选 -> All selected -> Button becomes 反选
    await selectAllBtn.click()
    for (let i = 0; i < totalPacks; i++) {
      await expect(packChecks.nth(i)).toBeChecked()
    }
    await expect(selectAllBtn).toHaveText('反选')

    // 2. Click 反选 when all selected -> All deselected -> Button becomes 全选
    await selectAllBtn.click()
    for (let i = 0; i < totalPacks; i++) {
      await expect(packChecks.nth(i)).not.toBeChecked()
    }
    await expect(selectAllBtn).toHaveText('全选')

    // 3. Select subset [0, 2] (corresponds to [A, C])
    await packChecks.nth(0).click()
    await packChecks.nth(2).click()
    await expect(packChecks.nth(0)).toBeChecked()
    await expect(packChecks.nth(1)).not.toBeChecked()
    await expect(packChecks.nth(2)).toBeChecked()
    await expect(packChecks.nth(3)).not.toBeChecked()
    await expect(selectAllBtn).toHaveText('反选')

    // 4. Click 反选 -> Set complement -> [1, 3] selected ([B, D]), [0, 2] unselected
    await selectAllBtn.click()
    await expect(packChecks.nth(0)).not.toBeChecked()
    await expect(packChecks.nth(1)).toBeChecked()
    await expect(packChecks.nth(2)).not.toBeChecked()
    await expect(packChecks.nth(3)).toBeChecked()
    await expect(selectAllBtn).toHaveText('反选')

    // 5. Test "清空" button -> All deselected, button returns to "全选"
    const clearBtn = page.locator('#btn-clear-packs')
    await clearBtn.click()
    for (let i = 0; i < totalPacks; i++) {
      await expect(packChecks.nth(i)).not.toBeChecked()
    }
    await expect(selectAllBtn).toHaveText('全选')
  })

  test('handles item exclusion and restoration in current pack', async ({ page }) => {
    const firstCard = page.locator('.card').first()
    await expect(firstCard).toBeVisible()
    await expect(firstCard).not.toHaveClass(/is-excluded/)

    // Exclude item via action button
    await firstCard.hover()
    const actionBtn = firstCard.locator('.card__action-btn')
    await actionBtn.click({ force: true })
    await expect(firstCard).toHaveClass(/is-excluded/)

    // Restore item
    await firstCard.hover()
    await actionBtn.click({ force: true })
    await expect(firstCard).not.toHaveClass(/is-excluded/)

    // Exclude whole pack
    const batchBtn = page.locator('#btn-batch-pack-action')
    await expect(batchBtn).toHaveText('排除本分类全部')
    await batchBtn.click()
    await expect(firstCard).toHaveClass(/is-excluded/)
    await expect(batchBtn).toHaveText('恢复本分类全部')

    // Restore whole pack
    await batchBtn.click()
    await expect(firstCard).not.toHaveClass(/is-excluded/)
    await expect(batchBtn).toHaveText('排除本分类全部')
  })

  test('switches active pack and renders cards progressively', async ({ page, isMobile }) => {
    const menuToggle = page.locator('#menu-toggle')
    if (await menuToggle.isVisible()) {
      await menuToggle.click()
    }

    const packRows = page.locator('.pack-row')
    await expect(packRows.first()).toBeVisible()

    // Click second pack
    const secondPackRow = packRows.nth(1)
    const secondLabel = await secondPackRow.locator('.truncate').textContent()
    await secondPackRow.locator('button').click()

    // Close drawer if on mobile
    const drawerClose = page.locator('#sidebar-close')
    if (await drawerClose.isVisible()) {
      await drawerClose.click()
    }

    // Gallery header should update
    const headerTitle = page.locator('.gallery__header h2')
    await expect(headerTitle).toHaveText(secondLabel?.trim() || '')
  })
})
