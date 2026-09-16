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

const keyboardItems = Array.from({ length: 15 }, (_, i) => ({
  id: `key-${i}`, label: `键盘表情 ${i}`, src: `https://s3-cdn.zsh.moe/smoji/keyboard/${i}.png`,
}))

test.beforeEach(async ({ page }) => {
    await page.route('**/smoji.json', route => route.fulfill({ json: { version: 1, packs: [
      { id: 'keyboard', label: '键盘分类', items: keyboardItems },
      { id: 'short', label: '单行分类', items: keyboardItems.slice(0, 3).map((item, i) => ({ ...item, id: `short-${i}`, src: item.src.replace('/keyboard/', '/short/') })) },
    ] } }))
    await page.route(/\/(keyboard|short)\/\d+\.png$/, route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="teal"/></svg>' }))
    await page.addInitScript(items => {
      if (localStorage.getItem('smoji-workbench:custom-packs')) return
      localStorage.setItem('smoji-workbench:custom-packs', JSON.stringify([
        { id: 'a', label: '分组 A', itemSrcs: items.slice(0, 3).map(item => item.src) },
        { id: 'b', label: '分组 B', itemSrcs: [] },
      ]))
    }, keyboardItems)
    await page.goto('/')
    await expect(page.locator('.card__open').first()).toBeVisible()
  })

test.describe('Keyboard audit regressions', () => {
  test('format arrows never change the image and selected styling survives blur', async ({ page }) => {
    await page.locator('.card__open').first().click()
    await page.locator('#copy-tab-md').focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('#copy-tab-url')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('dialog').getByRole('heading')).toHaveText('键盘表情 0')
    await page.locator('#pop-close-btn').focus()
    const backgrounds = await page.locator('[data-copy-format]').evaluateAll(tabs => tabs.map(tab => getComputedStyle(tab).backgroundColor))
    expect(backgrounds[1]).not.toBe(backgrounds[0])
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('dialog').getByRole('heading')).toHaveText('键盘表情 1')
  })

  test('single-row up/down stays put and the grid has one tab stop', async ({ page }) => {
    const menu = page.locator('#menu-toggle')
    if (await menu.isVisible()) await menu.click()
    await page.getByRole('button', { name: '单行分类' }).click()
    const cards = page.locator('.card__open')
    await cards.first().focus()
    await page.keyboard.press('ArrowDown')
    await expect(cards.first()).toBeFocused()
    await page.keyboard.press('End')
    await expect(cards.last()).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(cards.last()).toBeFocused()
    await expect(page.locator('.card__open[tabindex="0"]')).toHaveCount(1)
  })

  test('deleting tray items keeps focus on a neighbor then the group', async ({ page }) => {
    const menu = page.locator('#menu-toggle')
    if (await menu.isVisible()) await menu.click()
    await page.locator('#tab-custom').click()
    const row = page.locator('.custom-pack-item').first()
    await row.locator('[data-tray-item]').first().focus()
    await page.keyboard.press('Delete')
    await expect(row.locator('[data-tray-item]').first()).toBeFocused()
    await page.keyboard.press('Delete')
    await page.keyboard.press('Delete')
    await expect(row.locator('.custom-pack-name')).toBeFocused()
  })

  test('preview shortcut cannot stack on the inspector and numbers ignore modifiers', async ({ page }) => {
    const card = page.locator('.card__open').nth(2)
    await card.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#pop-close-btn')).toBeVisible()
    await page.keyboard.press('ControlOrMeta+Shift+P')
    await expect(page.locator('#code-modal')).toHaveCount(0)
    await page.keyboard.press('5')
    await page.keyboard.press('Control+2')
    await expect(page.locator('#copy-tab-bbcode')).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Escape')
    await expect(card).toBeFocused()
  })

  test('both custom selectors commit or cancel without changing the inspected image', async ({ page }) => {
    await page.getByRole('button', { name: '选择本分类导出', exact: true }).click()
    const format = page.getByRole('combobox', { name: '导出格式' })
    await format.focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('End')
    await page.keyboard.press('Escape')
    await expect(format).toBeFocused()
    await expect(format).toHaveText('Smoji')
    await page.keyboard.press('Space')
    await page.getByRole('option', { name: 'Twikoo', exact: true }).click()
    await expect(format).toHaveText('Twikoo')

    const menu = page.locator('#menu-toggle')
    if (await menu.isVisible()) await menu.click()
    await page.locator('#tab-custom').click()
    const close = page.locator('#sidebar-close')
    if (await close.isVisible()) await close.click()
    await page.locator('.card__open').first().click()
    const target = page.getByRole('combobox', { name: '目标自选分组' })
    await target.focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('option', { name: '分组 A（3 张）', exact: true })).toBeFocused()
    await page.keyboard.press('End')
    await expect(page.getByRole('option', { name: '分组 B（0 张）', exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(target).toContainText('分组 B')
    await expect(page.getByRole('dialog').getByRole('heading')).toHaveText('键盘表情 0')
    await expect(page.locator('#pop-group-btn')).toHaveText('加入「分组 B」')
    await expect(target).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('option', { name: '分组 B（0 张）', exact: true })).toBeFocused()
    await page.keyboard.press('Home')
    await expect(page.getByRole('option', { name: '分组 A（3 张）', exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(target).toBeFocused()
    await expect(target).toContainText('分组 B')
    await expect(page.locator('#pop-close-btn')).toBeVisible()
  })

  test('local shortcuts respect editable fields, readonly copy, IME and modal scope', async ({ page }) => {
    const downloads: string[] = []
    page.on('download', download => downloads.push(download.suggestedFilename()))
    await page.getByRole('button', { name: '选择本分类导出', exact: true }).click()
    await page.locator('#btn-open-code').focus()
    const download = page.waitForEvent('download')
    await page.keyboard.press('ControlOrMeta+e')
    expect((await download).suggestedFilename()).toMatch(/^smoji-\d{8}\.json$/)
    await page.locator('.card__open').first().click()
    await page.keyboard.press('ControlOrMeta+e')
    const input = page.locator('#copy-active-input')
    await input.focus()
    for (const [key, format] of [['1', 'md'], ['2', 'url'], ['3', 'hugo'], ['4', 'html'], ['5', 'bbcode']]) {
      await page.keyboard.press(key!)
      await expect(page.locator(`#copy-tab-${format}`)).toHaveAttribute('aria-selected', 'true')
    }
    await input.dispatchEvent('keydown', { key: '2', isComposing: true, bubbles: true })
    await page.keyboard.press('Alt+2')
    await expect(page.locator('#copy-tab-bbcode')).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Escape')
    const menu = page.locator('#menu-toggle')
    if (await menu.isVisible()) await menu.click()
    await page.locator('#tab-custom').click()
    const notes = page.getByRole('textbox', { name: '分组配置备注' })
    await notes.fill('正在编辑')
    await page.keyboard.press('ControlOrMeta+Shift+P')
    await page.keyboard.press('ControlOrMeta+e')
    await expect(notes).toBeFocused()
    await expect(page.locator('#code-modal')).toHaveCount(0)
    expect(downloads).toHaveLength(1)
  })

  test('drawer child overlays return focus to their own triggers', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const menu = page.locator('#menu-toggle')
    await menu.click()
    await page.locator('#tab-custom').click()
    const row = page.locator('.custom-pack-item').first()
    const tray = row.locator('[data-tray-item]').nth(1)
    await tray.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#pop-close-btn')).toBeVisible()
    // Removing the opening thumbnail must return to its neighbor inside the drawer.
    await page.keyboard.press('Space')
    await expect(row.locator('[data-tray-item]')).toHaveCount(2)
    await page.keyboard.press('Escape')
    await expect(tray).toBeFocused()
    await expect(page.locator('#mobile-sidebar')).toBeVisible()
    const tools = row.getByRole('button', { name: '分组操作', exact: true })
    await tools.click()
    await page.getByRole('menuitem', { name: '删除分组', exact: true }).click()
    await expect(page.locator('#confirm-cancel')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(tools).toBeFocused()
    await expect(page.locator('#mobile-sidebar')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu).toBeFocused()
  })

  test('tray menu moves, rejected moves and editing keep a usable focus target', async ({ page }) => {
    const menu = page.locator('#menu-toggle')
    if (await menu.isVisible()) await menu.click()
    await page.locator('#tab-custom').click()
    const row = page.locator('.custom-pack-item').first()
    await row.getByRole('button', { name: '排序或移动 键盘表情 0', exact: true }).click()
    await page.getByRole('menuitem', { name: '移至「分组 B」' }).click()
    await expect(row.locator('[data-tray-item]')).toHaveCount(2)
    await expect(row.locator('[data-tray-item]').first()).toBeFocused()
    const tools = row.getByRole('button', { name: '分组操作', exact: true })
    await tools.click()
    await page.getByRole('menuitem', { name: '编辑名称 / ID' }).click()
    await expect(row.getByRole('textbox', { name: '分组名称', exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(tools).toBeFocused()
    // A duplicate in B must reject a subsequent move without losing source or keyboard focus.
    await page.evaluate(() => {
      const groups = JSON.parse(localStorage.getItem('smoji-workbench:custom-packs')!)
      groups[1].itemSrcs.push(groups[0].itemSrcs[0])
      localStorage.setItem('smoji-workbench:custom-packs', JSON.stringify(groups))
    })
    await page.reload()
    await expect(page.locator('.card__open').first()).toBeVisible()
    if (await menu.isVisible()) await menu.click()
    await row.getByRole('button', { name: '排序或移动 键盘表情 1', exact: true }).click()
    await page.getByRole('menuitem', { name: '移至「分组 B」' }).click()
    await expect(row.locator('[data-tray-item]')).toHaveCount(2)
    await expect(row.locator('[data-tray-item]').first()).toBeFocused()
  })

  test('focus, persistent selection and tooltips use the author theme in both modes', async ({ page }) => {
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      const menu = page.locator('#menu-toggle')
      if (await menu.isVisible() && !await page.locator('#mobile-sidebar').isVisible()) await menu.click()
      await page.locator('#tab-custom').click()
      const summary = page.locator('#custom-create summary')
      await summary.focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      await expect(summary).toBeFocused()
      await expect(summary).toHaveCSS('outline-style', 'solid')
      await expect(summary).toHaveCSS('outline-width', '2px')
      const close = page.locator('#sidebar-close')
      if (await close.isVisible()) await close.click()
      await page.locator('#btn-open-code').focus()
      await expect(page.getByRole('tooltip')).toContainText('预览导出数据')
      await expect(page.locator('#root [title]')).toHaveCount(0)
      await page.locator('.card__open').first().click()
      await page.locator('#copy-tab-url').click()
      await page.locator('#pop-close-btn').focus()
      const selected = await page.locator('#copy-tab-url').evaluate(e => getComputedStyle(e).backgroundColor)
      const other = await page.locator('#copy-tab-md').evaluate(e => getComputedStyle(e).backgroundColor)
      expect(selected).not.toBe(other)
      await page.keyboard.press('Escape')
    }
  })


  test('multi-row navigation, rerenders and viewport constraints preserve one visible focus', async ({ page }) => {
    const cards = page.locator('.card__open')
    await cards.first().focus()
    const nextRow = await cards.evaluateAll(elements => {
      const top = elements[0]!.getBoundingClientRect().top
      return elements.findIndex(element => element.getBoundingClientRect().top > top + 1)
    })
    expect(nextRow).toBeGreaterThan(0)
    await page.keyboard.press('ArrowDown')
    await expect(cards.nth(nextRow)).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(cards.first()).toBeFocused()
    await page.keyboard.press('End')
    await expect(cards.last()).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(cards.last()).toBeFocused()
    await page.locator('#density-toggle').click()
    await expect(page.locator('.card__open[tabindex="0"]')).toHaveCount(1)
    for (const width of [320, 390, 834, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      const menu = page.locator('#menu-toggle')
      if (await menu.isVisible()) await menu.click()
      await page.locator('#tab-packs').click()
      await page.getByRole('checkbox', { name: '选择 键盘分类', exact: true }).setChecked(true)
      const close = page.locator('#sidebar-close')
      if (await close.isVisible()) await close.click()
      const select = page.getByRole('combobox', { name: '导出格式' })
      await select.click()
      const options = page.getByRole('listbox')
      await expect(options).toBeVisible()
      const box = await options.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
      expect(box!.y + box!.height).toBeLessThanOrEqual(900)
      await page.keyboard.press('Escape')
      await expect(select).toBeFocused()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' })
    await page.locator('.card__open').first().focus()
    await page.keyboard.press('ArrowRight')
    await expect(cards.nth(1)).toBeFocused()
    await expect(cards.nth(1)).toHaveCSS('outline-style', 'solid')
  })

  test('long group selectors stay inside a narrow dialog and support scrolling', async ({ page }) => {
    await page.evaluate(items => {
      localStorage.setItem('smoji-workbench:mode', 'custom')
      localStorage.setItem('smoji-workbench:custom-packs', JSON.stringify(Array.from({ length: 64 }, (_, i) => ({
        id: `long-${i}`, label: `分组${i}` + 'W'.repeat(32), itemSrcs: i === 0 ? [items[0]!.src] : [],
      }))))
    }, keyboardItems)
    await page.setViewportSize({ width: 320, height: 640 })
    await page.reload()
    await page.locator('.card__open').first().click()
    const select = page.getByRole('combobox', { name: '目标自选分组' })
    await select.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('option').first()).toBeFocused()
    await page.keyboard.press('End')
    await expect(page.getByRole('option').last()).toBeFocused()
    const box = await page.getByRole('listbox').boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(320)
    expect(box!.y + box!.height).toBeLessThanOrEqual(640)
    await page.keyboard.press('Enter')
    await expect(select).toContainText('分组63')
    await expect(select).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.locator('.card__open').first()).toBeFocused()
  })


  test('Space selects in a newly opened inspector instead of closing it', async ({ page }) => {
    const card = page.locator('.card__open').first()
    await card.focus()
    await page.keyboard.press('Space')
    await expect(page.locator('#pop-group-btn')).toBeVisible()
    await page.keyboard.press('Space')
    await expect(page.locator('#pop-group-btn')).toBeVisible()
    await expect(page.locator('#selection-dock-count')).toContainText('15 张表情')
    await expect(page.locator('#pop-group-btn')).toBeFocused()
    await page.keyboard.press('Space')
    await expect(page.locator('#pop-group-btn')).toHaveText('恢复到导出')
    await expect(page.locator('#selection-dock-count')).toContainText('14 张表情')
    await page.keyboard.press('Space')
    await expect(page.locator('#pop-group-btn')).toHaveText('从导出中排除')
    await expect(page.locator('#selection-dock-count')).toContainText('15 张表情')
    await page.keyboard.press('Escape')
    await expect(card).toBeFocused()
  })


  test('Space adds and removes in custom mode without closing the source preview', async ({ page }) => {
    const menu = page.locator('#menu-toggle')
    if (await menu.isVisible()) await menu.click()
    await page.locator('#tab-custom').click()
    const close = page.locator('#sidebar-close')
    if (await close.isVisible()) await close.click()
    const card = page.locator('.card__open').nth(4)
    await card.focus()
    await page.keyboard.press('Enter')
    const action = page.locator('#pop-group-btn')
    await expect(action).toBeFocused()
    await page.keyboard.press('Space')
    await expect(action).toHaveText('从「分组 A」移出')
    await expect(page.locator('#selection-dock-count')).toContainText('4 张表情')
    await page.keyboard.press('Space')
    await expect(action).toHaveText('加入「分组 A」')
    await expect(page.locator('#selection-dock-count')).toContainText('3 张表情')
    await page.keyboard.press('Escape')
    await expect(card).toBeFocused()
    await page.locator('#gallery-view-picked').getByRole('radio', { name: '已入组 (3)' }).click()
    await page.locator('.card__open').first().click()
    for (const remaining of [2, 1, 0]) {
      await page.keyboard.press('Space')
      await expect(page.locator('#gallery-view-picked button').last()).toHaveText(`已入组 (${remaining})`)
    }
    await expect(page.locator('#pop-group-btn')).toHaveCount(0)
    await expect(page.locator('#gallery-empty-action')).toBeFocused()
  })

  test('sidebar content and gallery chips never overflow or wrap their labels', async ({ page }) => {
    for (const width of [1282, 901, 390, 320]) {
      await page.setViewportSize({ width, height: 828 })
      const menu = page.locator('#menu-toggle')
      if (await menu.isVisible()) await menu.click()
      await page.locator('#tab-custom').click()
      const metrics = await page.locator('.sidebar-scroll').evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth }))
      expect(metrics.scroll).toBeLessThanOrEqual(metrics.client)
      for (const button of await page.locator('#custom-builder .grid button').all()) {
        const fits = await button.evaluate(e => e.scrollWidth <= e.clientWidth + 1)
        expect(fits).toBe(true)
      }
      const close = page.locator('#sidebar-close')
      if (await close.isVisible()) await close.click()
      await expect(page.locator('#gallery-view-picked button').last()).toHaveCSS('white-space', 'nowrap')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
  })

  test('decoded images reveal from blur without moving the card', async ({ page }) => {
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    await page.route('**/keyboard/0.png', async route => {
      await gate
      await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="teal"/></svg>' })
    })
    try {
      await page.reload()
      const card = page.locator('.card').first()
      await expect(card.locator('[data-image-status]')).toHaveAttribute('data-image-status', 'loading')
      const before = await card.boundingBox()
      release()
      await expect(card.locator('[data-image-status]')).toHaveAttribute('data-image-status', 'loaded')
      const image = card.locator('img')
      const midpoint = await image.evaluate(element => {
        const animation = element.getAnimations().find(a => (a as CSSAnimation).animationName === 'image-reveal')!
        animation.pause()
        animation.currentTime = 70
        return { filter: getComputedStyle(element).filter, opacity: getComputedStyle(element).opacity }
      })
      expect(parseFloat(midpoint.filter.replace('blur(', ''))).toBeGreaterThan(0)
      expect(Number(midpoint.opacity)).toBeLessThan(1)
      await image.evaluate(element => element.getAnimations().forEach(a => a.finish()))
      await expect(image).toHaveCSS('filter', 'blur(0px)')
      expect(await card.boundingBox()).toEqual(before)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      const duration = await image.evaluate(element => parseFloat(getComputedStyle(element).animationDuration))
      expect(duration).toBeLessThan(0.001)
    } finally { release() }
  })


  test('polish: compact tabs, readable segmented labels and a square preview at every viewport', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    for (const [width, height] of [[1282, 828], [834, 1194], [390, 844], [320, 568], [844, 390]]) {
      await page.setViewportSize({ width: width!, height: height! })
      await page.locator('.card__open').first().click()
      const dialog = page.getByRole('dialog')
      const stage = await page.locator('[data-preview-stage]').boundingBox()
      expect(Math.abs(stage!.width - stage!.height)).toBeLessThan(1)
      await expect(dialog.getByRole('tab', { name: 'Markdown', exact: true })).toBeVisible()
      const formatRow = await dialog.getByRole('tablist').boundingBox()
      const copyRow = await page.locator('#copy-active-input').locator('..').boundingBox()
      expect(Math.abs(formatRow!.x - copyRow!.x)).toBeLessThan(1)
      expect(Math.abs(formatRow!.width - copyRow!.width)).toBeLessThan(1)
      const assertControlsFit = async () => {
        const measurements = await dialog.locator('[role="tablist"], [data-slot="toggle-group"]').evaluateAll(rows => rows.map(row => ({
          text: row.textContent,
          horizontalOverflow: row.scrollWidth - row.clientWidth,
          verticalOverflow: row.scrollHeight - row.clientHeight,
          cramped: [...row.querySelectorAll('button')].filter(button => {
            const range = document.createRange()
            range.selectNodeContents(button)
            const style = getComputedStyle(button)
            return range.getBoundingClientRect().width > button.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) + 1
          }).map(button => button.textContent),
        })))
        for (const row of measurements) {
          expect(row.horizontalOverflow, row.text ?? '').toBeLessThanOrEqual(1)
          expect(row.verticalOverflow, row.text ?? '').toBeLessThanOrEqual(1)
          expect(row.cramped, row.text ?? '').toEqual([])
        }
      }
      await assertControlsFit()
      await page.keyboard.press('Escape')
      await page.locator('#btn-open-code').click()
      await expect(page.locator('#code-modal')).toBeVisible()
      await expect(dialog.getByRole('tab')).toHaveCount(5)
      await expect(page.locator('#code-tab-markdown')).toHaveCount(0)
      await assertControlsFit()
      await page.locator('[data-scope="all"]').click()
      await assertControlsFit()
      await page.locator('#code-modal-close').click()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
  })

  test('polish: copy failures remain readable without widening either dialog', async ({ page }) => {
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }))
    await page.setViewportSize({ width: 320, height: 568 })
    await page.locator('.card__open').first().click()
    await page.locator('#btn-copy-active').click()
    await expect(page.locator('#copy-feedback')).toContainText('手动复制')
    expect(await page.getByRole('dialog').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true)
    await page.keyboard.press('Escape')
    await page.locator('#btn-open-code').click()
    await page.locator('[data-scope="all"]').click()
    await page.locator('#code-preview-copy').click()
    await expect(page.locator('#code-preview-copy')).toHaveText('手动复制')
    await expect(page.getByRole('status')).toContainText('已选中内容')
    expect(await page.getByRole('dialog').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true)
  })

  test('polish: removed Markdown export restores Smoji and changing scope resets the code scroll', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('smoji-workbench:export-format', 'markdown'))
    await page.reload()
    await expect(page.locator('.card__open').first()).toBeVisible()
    await page.locator('#btn-open-code').click()
    await expect(page.locator('#code-tab-smoji')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('#code-tab-markdown')).toHaveCount(0)
    await page.locator('[data-scope="all"]').click()
    await page.locator('#code-preview-content').locator('..').evaluate(e => { e.scrollTop = e.scrollHeight })
    await page.locator('[data-scope="current"]').click()
    expect(await page.locator('#code-preview-content').locator('..').evaluate(e => e.scrollTop)).toBe(0)
  })

})
