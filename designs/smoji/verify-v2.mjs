// v2 prototype checks with Linux Chromium: layout at four widths, core flows, exception states, DOM capture.
// `--production` runs the same checks against the built workbench (apps/workbench/dist) after implementation.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { chromium } from '@playwright/test'

const project = import.meta.dirname
const root = resolve(project, '../..')
const productionMode = process.argv.includes('--production')
const serveRoot = productionMode ? resolve(root, 'apps/workbench/dist') : resolve(project, 'v2')
const evidence = resolve(project, productionMode ? 'evidence/production' : 'evidence/v2')
const storagePrefix = productionMode ? 'smoji-workbench:' : 'smoji-prototype-v2:'
await mkdir(evidence, { recursive: true })
const collector = await readFile(resolve(root, '.agents/skills/prototype-first-ui/scripts/collect_dom_content.js'), 'utf8')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' }
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  const file = resolve(serveRoot, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname))
  if (!file.startsWith(serveRoot)) { res.writeHead(403); res.end(); return }
  try { res.setHeader('Content-Type', mime[extname(file)] ?? 'text/plain'); res.end(await readFile(file)) }
  catch { res.writeHead(404); res.end() }
})

const catalog = JSON.parse(await readFile(resolve(serveRoot, 'smoji.json'), 'utf8'))
const production = JSON.parse(await readFile(resolve(root, 'data/smoji.json'), 'utf8'))
assert.deepEqual(catalog.packs.map((pack) => [pack.id, pack.label, pack.items.length]), production.packs.map((pack) => [pack.id, pack.label, pack.items.length]))
assert(catalog.packs.every((pack) => pack.items.every((item) => item.src.startsWith('https://s3-cdn.zsh.moe/smoji/'))))
const firstPack = catalog.packs[0]
assert(firstPack.items.length >= 3, 'first pack can be paged in the inspector')

await new Promise((done) => server.listen(0, '127.0.0.1', done))
const url = `http://127.0.0.1:${server.address().port}/`
const origin = new URL(url).origin
const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {})
const checks = []

async function capture(page, name) {
  await page.waitForTimeout(450)
  await page.evaluate(collector)
  const content = await page.evaluate(() => window.__prototypeFirstUICollectDOMContent())
  await writeFile(resolve(evidence, `${name}.json`), JSON.stringify(content, null, 2))
  await writeFile(resolve(evidence, `${name}.a11y.txt`), await page.locator('body').ariaSnapshot())
  await page.screenshot({ path: resolve(evidence, `${name}.png`) })
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
const focused = (page, selector) => page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector)

try {
  for (const width of [1440, 834, 390, 320]) {
    const mobile = width < 900
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 }, hasTouch: mobile, colorScheme: 'light' })
    const page = await context.newPage()
    const errors = [], failed = [], foreign = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
    page.on('requestfailed', (request) => failed.push(request.url()))
    page.on('request', (request) => {
      const requestOrigin = new URL(request.url()).origin
      if (requestOrigin !== origin && requestOrigin !== 'https://s3-cdn.zsh.moe') foreign.push(request.url())
    })
    // The prototype must leave production storage alone; production itself starts from a clean profile.
    if (!productionMode) await page.addInitScript(() => { localStorage.setItem('smoji-workbench:custom-packs', 'production-sentinel'); localStorage.setItem('smoji-theme', 'dark') })
    await page.goto(url)
    await page.locator('#grid .tile__open').first().waitFor()
    assert.equal(await page.locator('.ghead__title').innerText(), firstPack.label)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForFunction(() => document.querySelectorAll('#grid .sticker[data-image-status="ready"]').length >= 12, null, { timeout: 30000 })
    // The grid paints stills only: no animated original is decoded until a tile is hovered or focused.
    assert.equal(await page.locator('#grid img[src^="https://s3-cdn.zsh.moe/"]').count(), 0, 'grid holds no animated originals')
    const rendered = await page.locator('#grid .tile').count()
    const ready = await page.locator('#grid .sticker[data-image-status="ready"]').count()
    assert(ready < rendered || rendered <= 24, 'stills load near the viewport only')
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light', productionMode ? 'system light theme' : 'prototype theme is isolated from production storage')
    assert(await noOverflow(page), `no horizontal overflow at ${width}`)
    const repo = page.locator('#repo-link:visible')
    assert.equal(await repo.count(), 1, 'one visible repository link')
    assert.equal(await repo.getAttribute('href'), 'https://github.com/DejavuMoe/Smoji')
    assert.equal(await repo.getAttribute('target'), '_blank')
    // Every icon draws a screen-pixel line regardless of its rendered size.
    assert(await page.evaluate(() => [...document.querySelectorAll('svg.lucide')].every((svg) =>
      ['1.5px', '2px'].includes(getComputedStyle(svg).strokeWidth)
      && [...svg.children].every((node) => getComputedStyle(node).vectorEffect === 'non-scaling-stroke'))), 'uniform icon stroke')
    await capture(page, `ready-${width}`)
    if (!mobile) {
      await repo.hover()
      await page.locator('.tip').filter({ hasText: 'GitHub 源代码' }).waitFor()
      const foot = await page.locator('.rail__foot').boundingBox()
      await page.screenshot({ path: resolve(evidence, `repo-link-${width}.png`), clip: { x: foot.x - 8, y: foot.y - 48, width: foot.width + 16, height: foot.height + 56 } })
      await page.mouse.move(0, 0)
    }

    if (!mobile) {
      await page.locator('#grid .tile').nth(2).hover()
      await page.locator('#grid .tile').nth(2).locator('.sticker[data-playing]').waitFor({ timeout: 20000 })
      assert.equal(await page.locator('#grid .sticker__live').count(), 1, 'only the hovered sticker plays')
      await page.mouse.move(0, 0)
      await page.locator('#grid .sticker__live').waitFor({ state: 'detached' })
    }

    // Grid keyboard → inspector → paging → close returns focus to the card.
    await page.locator('#grid .tile__open').first().focus()
    await page.keyboard.press('ArrowRight')
    assert(await page.locator('#grid .tile__open').nth(1).evaluate((el) => el === document.activeElement))
    await page.keyboard.press('Enter')
    await page.getByRole('dialog').waitFor()
    assert(await focused(page, '#pop-group-btn'), 'inspector focuses the primary action')
    await page.locator('#pop-next-btn').click()
    assert.equal(await page.locator('.insp__title').innerText(), firstPack.items[2].label)
    await page.keyboard.press('2')
    assert.equal(await page.locator('.copy__row[data-active] [data-copy-format]').getAttribute('data-copy-format'), 'url')
    await capture(page, `inspector-${width}`)
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await page.waitForFunction(() => document.activeElement?.matches('#grid .tile__open'))

    // Whole-pack export with one exclusion, then a real download.
    await page.getByRole('button', { name: '选择本分类导出', exact: true }).click()
    if (!mobile) {
      await page.locator('#grid .tile').nth(3).hover()
      await page.locator('#grid .tile').nth(3).locator('.tile__tool--act').click()
      assert.match(await page.locator('#gallery-export-count').innerText(), /已排除 1 张/)
    }
    const expected = mobile ? firstPack.items.length : firstPack.items.length - 1
    if (mobile) {
      await page.locator('#kit-open').click()
      await page.locator('#kit-sheet').waitFor()
    }
    assert.match(await page.locator('#selection-dock-count').innerText(), new RegExp(`${expected} 张表情`))
    const downloadPromise = page.waitForEvent('download')
    await page.locator('#selection-dock-export').click()
    const download = await downloadPromise
    assert.match(download.suggestedFilename(), /^smoji-\d{8}\.json$/)
    const body = JSON.parse(await readFile(await download.path(), 'utf8'))
    assert.equal(body.packs[0].items.length, expected)
    assert(JSON.stringify(body).includes('s3-cdn.zsh.moe'))
    await page.locator('#selection-dock-preview').click()
    await page.locator('#code-modal').waitFor()
    await page.locator('#code-tab-twikoo').click()
    assert.match(await page.locator('#code-modal-meta').innerText(), /twikoo-\d{8}\.json/)
    await capture(page, `export-${width}`)
    await page.keyboard.press('Escape')
    await page.locator('#code-modal').waitFor({ state: 'hidden' })
    if (mobile) await page.keyboard.press('Escape')

    // Custom groups: create, add a whole pack, undo/redo, menu, cancelled delete.
    if (mobile) { await page.locator('#tab-custom').click(); await page.locator('#kit-open').click(); await page.locator('#kit-sheet').waitFor() }
    else await page.locator('#tab-custom').click()
    await capture(page, `custom-empty-${width}`)
    await page.locator('#custom-name-input').fill('常用')
    await page.locator('#btn-create-custom-pack').click()
    await page.locator('[data-custom-index="0"]').waitFor()
    if (mobile) { await page.keyboard.press('Escape'); await page.locator('#kit-sheet').waitFor({ state: 'hidden' }) }
    await page.locator('#btn-batch-pack-action').click()
    assert.match(await page.locator('#gallery-export-count').innerText(), new RegExp(`当前分组 ${firstPack.items.length} 张`))
    await page.keyboard.press('Control+z')
    assert.match(await page.locator('#gallery-export-count').innerText(), /当前分组 0 张/)
    await page.keyboard.press('Control+Shift+z')
    assert.match(await page.locator('#gallery-export-count').innerText(), new RegExp(`当前分组 ${firstPack.items.length} 张`))
    if (mobile) { await page.locator('#kit-open').click(); await page.locator('#kit-sheet').waitFor() }
    await capture(page, `custom-selected-${width}`)
    await page.locator('[data-custom-index="0"] .group__menu').click()
    await page.getByRole('menu').waitFor()
    await capture(page, `group-menu-${width}`)
    await page.locator('[role="menu"] [data-group-action="delete"]').click()
    await page.getByRole('alertdialog').waitFor()
    assert(await page.getByRole('button', { name: '取消', exact: true }).evaluate((el) => el === document.activeElement), 'cancel is focused first')
    await capture(page, `delete-confirm-${width}`)
    await page.getByRole('button', { name: '取消', exact: true }).click()
    await page.getByRole('alertdialog').waitFor({ state: 'hidden' })
    assert.equal(await page.locator('[data-custom-index]').count(), 1)
    if (mobile) { await page.keyboard.press('Escape'); await page.locator('#kit-sheet').waitFor({ state: 'hidden' }) }

    await page.locator('#btn-open-guide').click()
    await page.locator('#guide-modal').waitFor()
    await capture(page, `help-${width}`)
    await page.keyboard.press('Escape')
    await page.locator('#guide-modal').waitFor({ state: 'hidden' })
    await page.locator('#density-toggle [role="radio"]').nth(1).click()
    assert.equal(await page.locator('#grid').getAttribute('data-density'), 'comfortable')
    await capture(page, `comfortable-${width}`)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark')
    assert(await noOverflow(page))
    await capture(page, `dark-${width}`)

    if (!productionMode) {
      assert.equal(await page.evaluate(() => localStorage.getItem('smoji-workbench:custom-packs')), 'production-sentinel')
      assert.equal(await page.evaluate(() => localStorage.getItem('smoji-theme')), 'dark')
    }
    assert.deepEqual(errors, [])
    assert.deepEqual(failed, [])
    assert.deepEqual(foreign, [])
    checks.push({ width, errors, failed, foreignRequests: foreign.length, downloadItems: expected, stillsOnlyGrid: true, hoverPlaysOne: !mobile, productionStorageUntouched: !productionMode })
    await context.close()
    console.log(`Verified ${width}px: load, stills, hover playback, keyboard, inspector, export, groups, undo/redo, cancellation, help, density, theme`)
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  let release
  const blocked = new Promise((done) => { release = done })
  await page.route('**/smoji.json', async (route) => { await blocked; await route.fulfill({ status: 503, body: 'Unavailable' }) })
  await page.goto(url)
  await page.getByRole('status').waitFor()
  await capture(page, 'loading')
  release()
  await page.getByRole('button', { name: '重试加载' }).waitFor()
  await capture(page, 'catalog-error')
  await page.unroute('**/smoji.json')
  await page.getByRole('button', { name: '重试加载' }).click()
  await page.locator('#grid .tile__open').first().waitFor()
  await page.addInitScript((prefix) => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith(prefix)) throw new DOMException('QuotaExceededError', 'QuotaExceededError')
      original.call(this, key, value)
    }
  }, storagePrefix)
  await page.reload()
  await page.locator('#grid .tile__open').first().waitFor()
  await page.getByRole('button', { name: '选择本分类导出', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: '浏览器存储' }).waitFor()
  await capture(page, 'storage-error')
  await context.close()

  await writeFile(resolve(evidence, 'verification.json'), JSON.stringify({
    target: productionMode ? 'apps/workbench/dist' : 'designs/smoji/v2', browser: browser.version(), checks,
    catalog: { packs: catalog.packs.length, items: catalog.packs.reduce((n, p) => n + p.items.length, 0), matchesProductionManifest: true, imageOrigin: 'https://s3-cdn.zsh.moe' },
    exceptionStates: ['loading', 'catalog-error', 'retry-success', 'storage-error'],
    limitations: [
      'Chromium emulation only; not real Safari/device or assistive-technology certification',
      'CI thumbnails not included; stills are frozen first frames of CDN originals (production uses CI previews)',
      'OS clipboard write and drag/drop not verified in this run',
    ],
  }, null, 2))
} finally {
  await browser.close()
  await new Promise((done) => server.close(done))
}
