import { expect, type Page } from '@playwright/test'

// Deterministic catalogs: interaction checks must not depend on CDN uptime or latency.
// Item URLs are absolute on the published asset origin, exactly like the built smoji.json.
export const assetBase = 'https://s3-cdn.zsh.moe/smoji/'
export const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="teal"/></svg>'

export interface Item { id: string; label: string; src: string }
export interface Pack { id: string; label: string; items: Item[] }

export const makeItems = (dir: string, count: number, label = '表情'): Item[] =>
  Array.from({ length: count }, (_, i) => ({ id: `${dir}-${i}`, label: `${label} ${i}`, src: `${assetBase}${dir}/${i}.png` }))

export async function mockImages(page: Page) {
  await page.route(/\.(png|gif|webp)$/, route => route.fulfill({ contentType: 'image/svg+xml', body: svg }))
}

export async function mockCatalog(page: Page, packs: Pack[]) {
  await page.route('**/smoji.json', route => route.fulfill({ json: { version: 1, packs } }))
  await mockImages(page)
}

export const tiles = (page: Page) => page.locator('#grid .tile__open')

export async function boot(page: Page) {
  await page.goto('/')
  await expect(tiles(page).first()).toBeVisible()
}

export async function reload(page: Page) {
  await page.reload()
  await expect(tiles(page).first()).toBeVisible()
}

/** Below 900px the pack list lives in a drawer and the export kit in a bottom sheet. */
export const isNarrow = (page: Page) => (page.viewportSize()?.width ?? 1440) < 900

export async function openPackList(page: Page) {
  if (!isNarrow(page) || await page.locator('#mobile-sidebar').isVisible()) return
  await page.locator('#menu-toggle').click()
  await expect(page.locator('#mobile-sidebar')).toBeVisible()
}

export async function openKit(page: Page) {
  if (!isNarrow(page) || await page.locator('#kit-sheet').isVisible()) return
  await page.locator('#kit-open').click()
  await expect(page.locator('#kit-sheet')).toBeVisible()
}

/** Closes whichever narrow-layout sheet is open so the gallery is interactive again. */
export async function closeSheets(page: Page) {
  for (const id of ['#mobile-sidebar', '#kit-sheet']) {
    if (!await page.locator(id).isVisible()) continue
    // A tooltip reopened by focus return takes the first Escape.
    await expect(async () => {
      await page.keyboard.press('Escape')
      await expect(page.locator(id)).toHaveCount(0, { timeout: 600 })
    }).toPass()
  }
}

export async function setMode(page: Page, mode: 'packs' | 'custom') {
  await closeSheets(page)
  await page.locator(mode === 'custom' ? '#tab-custom' : '#tab-packs').click()
  await expect(page.locator('.app')).toHaveAttribute('data-mode', mode)
}

export async function createGroup(page: Page, name: string, id?: string) {
  await openKit(page)
  const count = await page.locator('#custom-pack-list [data-custom-index]').count()
  await page.locator('#custom-name-input').fill(name)
  if (id !== undefined) {
    if (!await page.locator('#custom-id-input').isVisible()) await page.getByRole('button', { name: '自定义 ID' }).click()
    await page.locator('#custom-id-input').fill(id)
  }
  await page.locator('#btn-create-custom-pack').click()
  await expect(page.locator('#custom-pack-list [data-custom-index]')).toHaveCount(count + 1)
}

/**
 * Runs a tile's primary action (exclude/restore or add/remove). Pointer devices use the hover
 * tool; touch devices have no hover tools and act through the inspector instead.
 */
export async function tileAction(page: Page, index = 0) {
  await closeSheets(page)
  const tile = page.locator('#grid .tile').nth(index)
  const tool = tile.locator('.tile__tool--act')
  if (await tool.count() && await tool.evaluate(e => getComputedStyle(e.parentElement!).display !== 'none')) {
    await tile.hover()
    await tool.click()
    return
  }
  await tile.locator('.tile__open').click()
  await page.locator('#pop-group-btn').click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

export async function readGroups(page: Page): Promise<Array<{ id: string; label: string; itemSrcs: string[] }>> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('smoji-workbench:custom-packs') ?? '[]'))
}

export async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
