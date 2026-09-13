import { test, expect } from '@playwright/test'

test.describe('Emoji Detail Inspector E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.card').first()).toBeVisible()
  })

  test('opens inspector, cycles formats 1-5, toggles backgrounds, navigates prev/next', async ({ page }) => {
    const firstCard = page.locator('.card').first()
    await firstCard.click()

    // Dialog opens
    const dialog = page.locator('[data-slot="dialog-content"]')
    await expect(dialog).toBeVisible()

    const copyInput = page.locator('#copy-active-input')
    await expect(copyInput).toBeVisible()

    // 1. Check default format (Markdown)
    const mdValue = await copyInput.inputValue()
    expect(mdValue).toMatch(/^!\[.*\]\(.*\)$/)

    // 2. Press '2' -> URL format
    await page.keyboard.press('2')
    const urlValue = await copyInput.inputValue()
    expect(urlValue).toMatch(/^https?:\/\//)

    // 3. Press '3' -> Hugo format
    await page.keyboard.press('3')
    const hugoValue = await copyInput.inputValue()
    expect(hugoValue).toMatch(/\{\{<\s*(?:smoji|inTextImg)/)

    // 4. Press '4' -> HTML format
    await page.keyboard.press('4')
    const htmlValue = await copyInput.inputValue()
    expect(htmlValue).toMatch(/^<img /)

    // 5. Press '5' -> BBCode format
    await page.keyboard.press('5')
    const bbValue = await copyInput.inputValue()
    expect(bbValue).toMatch(/^\[img\]/)

    // 6. Test background toggles: 浅底, 深底, 透明
    const bgLight = page.getByRole('button', { name: '浅底' })
    await bgLight.click()
    const bgDark = page.getByRole('button', { name: '深底' })
    await bgDark.click()
    const bgTrans = page.getByRole('button', { name: '透明' })
    await bgTrans.click()

    // 7. Test prev / next keyboard navigation
    const initialTitle = await page.locator('[data-slot="dialog-title"]').textContent()
    await page.keyboard.press('ArrowRight')
    const nextTitle = await page.locator('[data-slot="dialog-title"]').textContent()
    expect(nextTitle).not.toBe(initialTitle)

    await page.keyboard.press('ArrowLeft')
    const prevTitle = await page.locator('[data-slot="dialog-title"]').textContent()
    expect(prevTitle).toBe(initialTitle)

    // 8. Test copy button
    const copyBtn = page.locator('#btn-copy-active')
    await copyBtn.click()
    await expect(page.locator('#copy-feedback')).toBeVisible()

    // 9. Close dialog via Esc
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })
})
