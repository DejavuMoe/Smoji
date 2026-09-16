import { test, expect, type Page } from '@playwright/test'

// A deterministic catalog: browser interaction checks must not depend on CDN uptime.
// Item URLs are absolute on the published asset origin, exactly like the built smoji.json.
const assetBase = 'https://s3-cdn.zsh.moe/smoji/'
const packs = [
  { id: 'first', label: '第一分类', items: Array.from({ length: 240 }, (_, i) => ({ id: `item-${i}`, label: `表情 ${i}`, src: `${assetBase}audit/${i}.png` })) },
  { id: 'second', label: '第二分类', items: [{ id: 'second-item', label: '第二表情', src: `${assetBase}audit/second.png` }] },
]

test.beforeEach(async ({ page }) => {
  await page.route('**/smoji.json', route => route.fulfill({ json: { version: 1, packs } }))
  await page.route('**/audit/*.png', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="teal"/></svg>' }))
  await page.goto('/')
  await expect(page.locator('.card').first()).toBeVisible()
})

async function openCustomMode(page: Page) {
  const menu = page.locator('#menu-toggle')
  if (await menu.isVisible()) await menu.click()
  await page.locator('#tab-custom').click()
  await expect(page.locator('#custom-builder')).toBeVisible()
}

async function createGroup(page: Page, name: string, id?: string) {
  const details = page.locator('#custom-create')
  if (!(await details.evaluate((el) => (el as HTMLDetailsElement).open))) {
    await page.locator('#custom-create summary').click()
  }
  await page.locator('#custom-name-input').fill(name)
  if (id !== undefined) await page.locator('#custom-id-input').fill(id)
  await page.locator('#btn-create-custom-pack').click()
}

async function closeDrawer(page: Page) {
  const close = page.locator('#sidebar-close')
  if (await close.isVisible()) await close.click()
}

async function openDrawer(page: Page) {
  const menu = page.locator('#menu-toggle')
  if (await menu.isVisible()) await menu.click()
}

async function readGroups(page: Page): Promise<Array<{ id: string; label: string; itemSrcs: string[] }>> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('smoji-workbench:custom-packs') ?? '[]'))
}

test('keeps the shell in the viewport and loads every gallery chunk', async ({ page }) => {
  await page.getByRole('button', { name: '选择本分类导出' }).click()
  await expect(page.locator('#selection-dock')).toBeVisible()
  for (let i = 0; i < 8; i++) {
    await page.locator('main').evaluate(main => { main.scrollTop = main.scrollHeight })
    await page.waitForTimeout(150)
  }
  await expect(page.locator('.card')).toHaveCount(240)
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const last = await page.locator('.card').last().boundingBox()
  const dock = await page.locator('#selection-dock').boundingBox()
  expect(last!.y + last!.height).toBeLessThan(dock!.y)
})

test('gallery controls stay inside a 320px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  for (const button of await page.locator('.gallery__header button').all()) {
    const box = await button.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(320)
  }
})

test('custom mode can browse another source and keyboard actions do not open the inspector', async ({ page }) => {
  await openCustomMode(page)
  await page.locator('#pack-nav button.pack').nth(1).click()
  await expect(page.locator('.gallery__header h2')).toHaveText('第二分类')
  await expect(page.locator('#mobile-sidebar')).not.toBeVisible()
  const action = page.locator('.card__action-btn').first()
  await action.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.card__badge')).toBeVisible()
  await expect(page.getByRole('button', { name: '关闭详情' })).not.toBeVisible()
  await action.focus()
  await page.keyboard.press('Space')
  await expect(page.locator('.card__badge')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '关闭详情' })).not.toBeVisible()
})

test('cancelling import preserves existing notes and groups', async ({ page }) => {
  await openCustomMode(page)
  await page.getByRole('textbox', { name: '分组配置备注' }).fill('原备注')
  await page.locator('#import-groups-file').setInputFiles({
    name: 'groups.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ version: 1, kind: 'smoji-custom-groups', packs: [{ id: 'imported', label: '导入组', itemSrcs: [] }], extensions: { 'smoji.workbench': { notes: '新备注' } } })),
  })
  await page.getByRole('alertdialog').getByRole('button', { name: '取消' }).click()
  await expect(page.getByRole('textbox', { name: '分组配置备注' })).toHaveValue('原备注')
  await expect(page.locator('.custom-pack-item')).toHaveCount(0)
})

test('failed migration assets never overwrite saved groups', async ({ page }) => {
  const backup = JSON.stringify([{ id: 'saved', label: '旧收藏', itemSrcs: ['https://legacy.example/old.png'] }])
  await page.evaluate(value => localStorage.setItem('smoji-workbench:custom-packs', value), backup)
  await page.route('**/published-aliases-*.js', route => route.abort())
  await page.reload()
  await expect(page.getByRole('heading', { name: '无法加载表情清单' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('smoji-workbench:custom-packs'))).toBe(backup)
})

test('system theme follows live preference changes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

// A01 · validation and refresh round-trip
test('created groups survive refresh and invalid input is rejected with a reason', async ({ page }) => {
  await openCustomMode(page)

  // The UI clamps input to the core 40-character label limit instead of accepting an unstorable name.
  await page.locator('#custom-name-input').fill('a'.repeat(41))
  await expect(page.locator('#custom-name-input')).toHaveValue('a'.repeat(40))

  // A forbidden character is refused with a reason and the input is preserved.
  await page.locator('#custom-name-input').fill('坏]名称')
  await page.locator('#btn-create-custom-pack').click()
  await expect(page.locator('#custom-create-error')).toBeVisible()
  await expect(page.locator('.custom-pack-item')).toHaveCount(0)
  await expect(page.locator('#custom-name-input')).toHaveValue('坏]名称')

  // A name that reduces to an illegal auto ID must still produce a valid ID.
  await page.locator('#custom-name-input').fill('-')
  await page.locator('#btn-create-custom-pack').click()
  // Creating a group returns to the gallery; reopen the drawer to inspect it on mobile.
  await openDrawer(page)
  await expect(page.locator('.custom-pack-item')).toHaveCount(1)
  let groups = await readGroups(page)
  expect(groups[0]!.id).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/)

  // Rename to a legal name, add an item, then reload: the group and its item must persist.
  await closeDrawer(page)
  const firstCard = page.locator('.card').first()
  await firstCard.locator('.card__action-btn').click({ force: true })
  await expect(firstCard.locator('.card__badge')).toBeVisible()
  await page.reload()
  await expect(page.locator('.card').first()).toBeVisible()
  await openCustomMode(page)
  await expect(page.locator('.custom-pack-item')).toHaveCount(1)
  groups = await readGroups(page)
  expect(groups[0]!.itemSrcs).toHaveLength(1)
})

// A03/A04 · backups keep stable IDs, notes and unknown extensions
test('backup round-trip preserves IDs, notes and unknown extensions', async ({ page }) => {
  await openCustomMode(page)
  await page.locator('#import-groups-file').setInputFiles({
    name: 'groups.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      version: 1,
      kind: 'smoji-custom-groups',
      packs: [
        { id: 'Team_A.v1', label: '团队', itemSrcs: [`${assetBase}audit/0.png`, `${assetBase}audit/0.png`] },
      ],
      extensions: { 'vendor.new': { flag: true }, 'smoji.workbench': { notes: '新备注' } },
    })),
  })
  await page.getByRole('alertdialog').getByRole('button', { name: '确定' }).click()
  await expect(page.locator('.custom-pack-item')).toHaveCount(1)
  await expect(page.locator('.custom-pack-count').first()).toContainText('1 / 600')

  // A valid non-conflicting ID is kept verbatim, and duplicate sources are de-duplicated.
  const groups = await readGroups(page)
  expect(groups[0]!.id).toBe('Team_A.v1')
  expect(groups[0]!.itemSrcs).toHaveLength(1)

  const download = page.waitForEvent('download')
  await page.locator('#btn-export-groups').click()
  const file = await download
  const stream = await file.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  const bundle = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  expect(bundle.packs[0].id).toBe('Team_A.v1')
  expect(bundle.extensions['vendor.new']).toEqual({ flag: true })
  expect(bundle.extensions['smoji.workbench'].notes).toBe('新备注')
})

// A05 · tray drag between groups moves instead of copying
test('dragging a tray item across groups moves it and keeps the total stable', async ({ page }) => {
  await openCustomMode(page)
  await createGroup(page, '来源')
  await closeDrawer(page)
  await page.locator('.card').nth(0).locator('.card__action-btn').click({ force: true })
  await page.locator('.card').nth(1).locator('.card__action-btn').click({ force: true })

  await openCustomMode(page)
  await createGroup(page, '目标')
  await openCustomMode(page)

  const rows = page.locator('.custom-pack-item')
  await expect(rows.nth(0).locator('[data-tray-item]')).toHaveCount(2)
  await rows.nth(0).locator('[data-tray-item]').first().dragTo(rows.nth(1))

  await expect(rows.nth(0).locator('[data-tray-item]')).toHaveCount(1)
  await expect(rows.nth(1).locator('[data-tray-item]')).toHaveCount(1)
  const groups = await readGroups(page)
  expect(groups.reduce((count, group) => count + group.itemSrcs.length, 0)).toBe(2)
})

// A06 · custom batch add is independent from hidden pack exclusions
test('custom batch add includes items excluded in packs mode', async ({ page }) => {
  await page.locator('.card__action-btn').first().click({ force: true })
  await expect(page.locator('.card').first()).toHaveClass(/is-excluded/)

  await openCustomMode(page)
  await createGroup(page, '全部')
  await closeDrawer(page)
  await page.locator('#btn-batch-pack-action').click()
  await openDrawer(page)
  await expect(page.locator('.custom-pack-count').first()).toContainText('240 / 600')
})

// A07 · preview scopes agree with the visible exclusion state
test('preview excludes excluded items in the current scope', async ({ page }) => {
  await page.locator('.card__action-btn').first().click({ force: true })
  await page.getByRole('button', { name: '选择本分类导出' }).click()
  await page.locator('#selection-dock-preview').click()
  const code = page.locator('#code-preview-content')
  await expect(code).toBeVisible()

  const selectedCount = await page.evaluate(() => JSON.parse(document.querySelector('#code-preview-content')!.textContent!).packs[0].items.length)
  await page.locator('[data-scope="current"]').click()
  const currentCount = await page.evaluate(() => JSON.parse(document.querySelector('#code-preview-content')!.textContent!).packs[0].items.length)
  expect(selectedCount).toBe(239)
  expect(currentCount).toBe(239)
})

// A08 · dock and preview share one registry and one global format/scope state
test('Waline is selectable in the preview and format/scope survive closing', async ({ page }) => {
  await page.getByRole('button', { name: '选择本分类导出' }).click()
  await page.locator('#selection-dock-format').click()
  await page.getByRole('option', { name: 'Waline', exact: true }).click()
  await page.locator('#selection-dock-preview').click()
  await expect(page.locator('#code-tab-waline')).toHaveAttribute('aria-selected', 'true')

  await page.locator('[data-scope="all"]').click()
  await page.locator('#code-modal-close').click()
  await page.locator('#selection-dock-preview').click()
  await expect(page.locator('#code-tab-waline')).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('[data-scope="all"]')).toHaveAttribute('aria-checked', 'true')
})

// A09 · errors are not downloadable configurations
test('empty scope shows an error state and disables copy/download', async ({ page }) => {
  await page.keyboard.press('ControlOrMeta+Shift+P')
  await expect(page.locator('#code-modal')).toBeVisible()
  await expect(page.locator('#code-preview-error')).toBeVisible()
  await expect(page.locator('#btn-download-current-code')).toBeDisabled()
  await expect(page.locator('#code-preview-copy')).toBeDisabled()
  await expect(page.locator('#code-preview-content')).toHaveCount(0)
})

// A10 · closing the inspector returns focus to the card that opened it
test('closing the inspector returns focus to the originating card', async ({ page }) => {
  const open = page.locator('.card__open').nth(2)
  await open.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-slot="dialog-content"]')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-slot="dialog-content"]')).not.toBeVisible()
  await expect(open).toBeFocused()
})

// A12 · removing the inspected item keeps prev/next usable
test('removing the inspected item moves the inspector to a neighbor', async ({ page }) => {
  await openCustomMode(page)
  await createGroup(page, '翻页')
  await closeDrawer(page)
  await page.locator('.card').nth(0).locator('.card__action-btn').click({ force: true })
  await page.locator('.card').nth(1).locator('.card__action-btn').click({ force: true })
  await page.locator('#gallery-view-picked button').nth(1).click()

  await page.locator('.card__open').first().click()
  const title = page.locator('[data-slot="dialog-title"]')
  const firstTitle = await title.textContent()
  await page.locator('#pop-group-btn').click()
  await expect(title).not.toHaveText(firstTitle ?? '')
  await page.keyboard.press('ArrowRight')
  await expect(title).not.toHaveText('')
})

// A13 · drawer hand-off and breakpoint collapse
test('view-all closes the drawer and cross-breakpoint resize keeps a single workspace', async ({ page }) => {
  await openCustomMode(page)
  await createGroup(page, '抽屉')
  await closeDrawer(page)
  await page.locator('#btn-batch-pack-action').click()
  await openDrawer(page)
  await expect(page.locator('.custom-pack-count').first()).toContainText('240 / 600')

  // Phones truncate the tray to 8 thumbnails and label the entry “查看全部”.
  const isPhone = (page.viewportSize()?.width ?? 1440) <= 600
  if (isPhone) {
    const viewAll = page.getByRole('button', { name: /查看全部/ })
    await expect(viewAll).toBeVisible()
    await viewAll.click()
    await expect(page.locator('#mobile-sidebar')).not.toBeVisible()
  }

  await page.setViewportSize({ width: 1024, height: 800 })
  await expect(page.locator('#pack-nav')).toHaveCount(1)
  await expect(page.locator('#mobile-sidebar')).toHaveCount(0)
})

// A02 · storage failures are surfaced, and the in-memory state plus backup stay available
test('reports storage write failures without pretending the data was saved', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key: string, value: string) {
      if (String(key).startsWith('smoji-workbench:')) {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      }
      return original.call(this, key, value)
    }
  })
  await page.reload()
  await expect(page.locator('.card').first()).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: '浏览器存储' })).toBeVisible()
  await openCustomMode(page)
  await createGroup(page, '内存分组')
  await openDrawer(page)
  await expect(page.locator('.custom-pack-item')).toHaveCount(1)
})

// A18 · the same-origin catalog is used and the published CDN copy is a fallback
test('boots from the same-origin catalog and falls back to the published copy', async ({ page }) => {
  await page.route('**/smoji.json', route => {
    const url = new URL(route.request().url())
    // Only the app's own origin is missing; the published CDN copy must still boot the workbench.
    if (url.origin === new URL(page.url()).origin) return route.abort()
    return route.fulfill({ json: { version: 1, packs } })
  })
  await page.reload()
  await expect(page.locator('.card').first()).toBeVisible()
  // Progressive rendering only mounts a chunk at a time; the catalog itself is fully loaded.
  await expect(page.locator('#gallery-export-count')).toContainText('240')
})
