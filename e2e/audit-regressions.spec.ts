import { test, expect } from '@playwright/test'
import catalog from '../data/smoji.json' with { type: 'json' }
import { boot, closeSheets, createGroup, makeItems, mockCatalog, mockImages, openKit, openPackList, readGroups, reload, setMode, tileAction, tiles } from './support'

const packs = [
  { id: 'first', label: '第一分类', items: makeItems('audit', 240, '表情') },
  { id: 'second', label: '第二分类', items: [{ id: 'second-item', label: '第二表情', src: 'https://s3-cdn.zsh.moe/smoji/audit/second.png' }] },
]

test.describe('with a deterministic catalog', () => {
  test.beforeEach(async ({ page }) => {
    await mockCatalog(page, packs)
    await boot(page)
  })

  test('keeps the shell in the viewport while every gallery chunk loads', async ({ page }) => {
    await page.getByRole('button', { name: '选择本分类导出' }).click()
    await expect(async () => {
      await page.locator('.stage__scroll').evaluate(scroller => { scroller.scrollTop = scroller.scrollHeight })
      await expect(page.locator('#grid .tile')).toHaveCount(240, { timeout: 500 })
    }).toPass()
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const last = page.locator('#grid .tile').last()
    await last.scrollIntoViewIfNeeded()
    await expect(last.locator('.sticker')).toHaveAttribute('data-image-status', 'ready')
    const bottom = (await last.boundingBox())!
    const scroller = (await page.locator('.stage__scroll').boundingBox())!
    expect(bottom.y + bottom.height).toBeLessThanOrEqual(scroller.y + scroller.height + 1)
  })

  test('custom mode can browse another source pack and tile actions never open the inspector', async ({ page, isMobile }) => {
    test.skip(isMobile, 'hover tools are a pointer affordance; touch acts through the inspector')
    await setMode(page, 'custom')
    await createGroup(page, '收集')
    await openPackList(page)
    await page.locator('#pack-nav .pack').nth(1).click()
    await expect(page.locator('.ghead__title')).toHaveText('第二分类')
    await expect(page.locator('#mobile-sidebar')).toHaveCount(0)
    await tileAction(page, 0)
    await expect(page.locator('#grid .tile').first()).toHaveAttribute('data-picked')
    await expect(page.locator('.insp')).toHaveCount(0)
    await tileAction(page, 0)
    await expect(page.locator('#grid .tile[data-picked]')).toHaveCount(0)
    await expect(page.locator('.insp')).toHaveCount(0)
  })

  test('dragging a gallery tile onto a group adds it', async ({ page, isMobile }) => {
    test.skip(isMobile || (page.viewportSize()?.width ?? 1440) < 900, 'drag targets are visible beside the gallery on desktop')
    await setMode(page, 'custom')
    await createGroup(page, '拖入')
    await page.locator('#grid .tile').nth(3).dragTo(page.locator('#custom-pack-list [data-custom-index="0"]'))
    await expect(page.locator('#custom-pack-list [data-custom-index="0"] [data-tray-item]')).toHaveCount(1)
    expect((await readGroups(page))[0]!.itemSrcs).toEqual(['https://s3-cdn.zsh.moe/smoji/audit/3.png'])
  })

  test('closing the inspector returns focus to the originating tile', async ({ page }) => {
    const open = tiles(page).nth(2)
    await open.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.insp')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.insp')).toHaveCount(0)
    await expect(open).toBeFocused()
  })

  test('the picked view can open every item of a group larger than the tray', async ({ page }) => {
    await setMode(page, 'custom')
    await createGroup(page, '大组')
    await closeSheets(page)
    await page.locator('#btn-batch-pack-action').click()
    await openKit(page)
    const more = page.locator('#custom-pack-list .tray__more')
    await expect(more).toBeVisible()
    await more.click()
    await expect(page.locator('#kit-sheet')).toHaveCount(0)
    await expect(page.locator('#gallery-view-picked [aria-checked="true"]')).toHaveText('已入组 (240)')
    await expect(page.locator('#grid')).toBeFocused()
  })
})

test('storage write failures are reported while in-memory work continues', async ({ page }) => {
  await mockCatalog(page, packs)
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key: string, value: string) {
      if (String(key).startsWith('smoji-workbench:')) throw new DOMException('quota exceeded', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await boot(page)
  await setMode(page, 'custom')
  await expect(page.getByRole('alert').filter({ hasText: '浏览器存储' })).toBeVisible()
  await createGroup(page, '内存分组')
  await expect(page.locator('#custom-pack-list [data-custom-index]')).toHaveCount(1)
})

test('a failed migration chunk never overwrites saved groups', async ({ page }) => {
  await mockCatalog(page, packs)
  const backup = JSON.stringify([{ id: 'saved', label: '旧收藏', itemSrcs: ['https://legacy.example/old.png'] }])
  await page.addInitScript(value => localStorage.setItem('smoji-workbench:custom-packs', value), backup)
  await page.route('**/published-aliases-*.js', route => route.abort())
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '无法加载表情清单' })).toBeVisible()
  await expect(page.locator('.boot-error')).toBeVisible()
  await expect(page.locator('#grid')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('smoji-workbench:custom-packs'))).toBe(backup)
})

// The real built catalog: mocking both origins with identical data would hide an accidental fallback.
test('boots the complete built catalog without requesting the CDN copy', async ({ page }) => {
  await mockImages(page)
  const fallbackRequests: string[] = []
  await page.route('**/smoji.json', route => {
    const url = new URL(route.request().url())
    if (url.origin === 'http://localhost:4173') return route.continue()
    fallbackRequests.push(url.href)
    return route.abort()
  })
  await boot(page)
  if ((page.viewportSize()?.width ?? 1440) < 900) await expect(page.locator('.strip__chip')).toHaveCount(catalog.packs.length)
  else await expect(page.locator('#pack-nav .pack')).toHaveCount(catalog.packs.length)
  await expect(page.locator('.ghead__title')).toHaveText(catalog.packs[0]!.label)
  expect(fallbackRequests).toEqual([])
})

test('falls back to the published copy when the same-origin catalog is unavailable', async ({ page }) => {
  await mockImages(page)
  await page.route('**/smoji.json', route => {
    const url = new URL(route.request().url())
    if (url.origin === 'http://localhost:4173') return route.abort()
    return route.fulfill({ json: { version: 1, packs } })
  })
  await boot(page)
  await expect(page.locator('#gallery-export-count')).toContainText('240')
  await reload(page)
})
