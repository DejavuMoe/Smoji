// Reproduce prototype checks with Linux Chromium; defaults to the frozen v0 baseline.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { chromium } from '@playwright/test'

const project = import.meta.dirname
const root = resolve(project, '../..')
const version = process.argv[2] ?? 'v0'
assert(['v0', 'v1'].includes(version))
const fullCatalog = version === 'v1'
const firstPackCount = fullCatalog ? 104 : 144
const evidence = resolve(project, 'evidence/' + version)
await mkdir(evidence, { recursive: true })
const collector = await readFile(resolve(root, '.agents/skills/prototype-first-ui/scripts/collect_dom_content.js'), 'utf8')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff' }
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  const file = resolve(project, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname))
  if (!file.startsWith(project + '/')) { res.writeHead(403); res.end(); return }
  try { res.setHeader('Content-Type', mime[extname(file)] ?? 'text/plain'); res.end(await readFile(file)) }
  catch { res.writeHead(404); res.end() }
})
if (fullCatalog) {
  const catalog = JSON.parse(await readFile(resolve(project, 'v1/smoji.json'), 'utf8'))
  const production = JSON.parse(await readFile(resolve(root, 'data/smoji.json'), 'utf8'))
  const normalize = packs => packs.map(pack => ({ ...pack, items: pack.items.map(item => ({
    ...item, src: new URL(item.src, 'https://s3-cdn.zsh.moe/smoji/').href,
  })) }))
  assert.deepEqual(catalog.packs.slice(1), normalize(production.packs))
  const live = await fetch('https://smoji.zsh.moe/smoji.json').then(r => { assert(r.ok); return r.json() })
  assert.deepEqual(catalog.packs.slice(1), normalize(live.packs))
  assert.equal(catalog.packs[0].label, '大肥鱼')
  assert.equal(catalog.packs.length, 36)
  assert.equal(catalog.packs.flatMap(p => p.items).length, 5934)
  let cursor = 0
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (cursor < 104) {
      const item = catalog.packs[0].items[cursor++]
      const response = await fetch(item.src, { method: 'HEAD', signal: AbortSignal.timeout(30000) })
      assert(response.ok, item.src)
      assert.match(response.headers.get('content-type'), /image\/webp/)
      assert(Number(response.headers.get('content-length')) > 0)
    }
  }))
  console.log('Full catalog matches production; 104 new CDN URLs return WebP successfully')
}
await new Promise(r => server.listen(0, '127.0.0.1', r))
const url = `http://127.0.0.1:${server.address().port}/${version}/`
const browser = await chromium.launch()
const checks = []
async function capture(page, name) {
  // Preserve baseline motion, but record the settled state rather than a blur-animation frame.
  await page.waitForTimeout(450)
  await page.evaluate(collector)
  const content = await page.evaluate(() => window.__prototypeFirstUICollectDOMContent())
  await writeFile(resolve(evidence, `${name}.json`), JSON.stringify(content, null, 2))
  await writeFile(resolve(evidence, `${name}.a11y.txt`), await page.locator('body').ariaSnapshot())
  await page.screenshot({ path: resolve(evidence, `${name}.png`) })
}
try {
  for (const width of [1440, 390, 320, 834]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 }, hasTouch: width < 901, colorScheme: 'light' })
    const page = await context.newPage()
    const errors = [], external = [], failed = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('requestfailed', req => failed.push(req.url()))
    page.on('request', req => { if (new URL(req.url()).origin !== new URL(url).origin) external.push(req.url()) })
    await page.addInitScript(() => { localStorage.setItem('smoji-workbench:custom-packs', 'production-sentinel'); localStorage.setItem('smoji-theme', 'dark') })
    await page.goto(url)
    await page.locator('.card__open').first().waitFor()
    if (fullCatalog) assert.equal(await page.locator('.gallery__header h2').innerText(), '大肥鱼')
    await page.evaluate(() => document.fonts.ready)
    await page.waitForFunction(() => [...document.querySelectorAll('#grid img')].every(img => img.complete && img.naturalWidth > 0))
    await page.waitForTimeout(400)
    assert(await page.locator('.gallery__header h2').innerText())
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light')
    await capture(page, `ready-${width}`)
    await page.locator('.card__open').first().focus()
    await page.keyboard.press('ArrowRight')
    assert.equal(await page.locator('.card__open').nth(1).evaluate(el => el === document.activeElement), true)
    await page.keyboard.press('Enter')
    await page.getByRole('dialog').waitFor()
    await page.locator('#pop-next-btn').click()
    await capture(page, `inspector-${width}`)
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await page.waitForFunction(() => document.activeElement?.matches('#grid .card__open'))
    await page.getByRole('button', { name: '选择本分类导出', exact: true }).click()
    await page.locator('#selection-dock-export').waitFor()
    const downloadPromise = page.waitForEvent('download')
    await page.locator('#selection-dock-export').click()
    const download = await downloadPromise
    const body = JSON.parse(await readFile(await download.path(), 'utf8'))
    assert.equal(body.packs[0].items.length, firstPackCount)
    assert.equal(JSON.stringify(body).includes('s3-cdn.zsh.moe'), fullCatalog, 'Export asset origin')
    await page.locator('#selection-dock-preview').click()
    await page.getByRole('dialog').waitFor()
    await capture(page, `export-${width}`)
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    if (width < 901) await page.locator('#menu-toggle').click()
    await page.locator('#tab-custom').click()
    await capture(page, `custom-empty-${width}`)
    await page.locator('#custom-name-input').fill('常用')
    await page.locator('#btn-create-custom-pack').click()
    if (width < 901) await page.locator('#mobile-sidebar').waitFor({ state: 'hidden' })
    await page.locator('#btn-batch-pack-action').click()
    assert.match(await page.locator('#gallery-export-count').innerText(), new RegExp(String(firstPackCount)))
    await page.keyboard.press('Control+z')
    assert.match(await page.locator('#gallery-export-count').innerText(), /0 张/)
    await page.keyboard.press('Control+Shift+z')
    assert.match(await page.locator('#gallery-export-count').innerText(), new RegExp(String(firstPackCount)))
    await capture(page, `custom-selected-${width}`)
    if (width < 901) await page.locator('#menu-toggle').click()
    await page.locator('.custom-pack-item .group-tools button[aria-haspopup="menu"]').first().click()
    await capture(page, `group-menu-${width}`)
    await page.locator('[role="menu"] [data-group-action="delete"]').click()
    await page.getByRole('alertdialog').waitFor()
    assert.equal(await page.getByRole('button', { name: '取消', exact: true }).evaluate(e => e === document.activeElement), true)
    await capture(page, `delete-confirm-${width}`)
    await page.getByRole('button', { name: '取消', exact: true }).click()
    if (width < 901) await page.locator('#sidebar-close').click()
    await page.locator('#btn-open-guide').click()
    await page.getByRole('dialog').waitFor()
    await capture(page, `help-${width}`)
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await page.locator('#density-toggle').click()
    await page.waitForTimeout(400)
    await capture(page, `comfortable-${width}`)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark')
    await capture(page, `dark-${width}`)
    assert.equal(await page.evaluate(() => localStorage.getItem('smoji-workbench:custom-packs')), 'production-sentinel')
    assert.equal(await page.evaluate(() => localStorage.getItem('smoji-theme')), 'dark')
    assert.deepEqual(errors, []); assert(external.every(url => fullCatalog && new URL(url).origin === 'https://s3-cdn.zsh.moe')); assert.deepEqual(failed, [])
    checks.push({ width, errors, externalRequestCount: external.length, externalOrigin: fullCatalog ? 'https://s3-cdn.zsh.moe' : null, failed, downloadItems: firstPackCount, productionStorageUntouched: true })
    await context.close()
    console.log(`Verified ${width}px: load, keyboard, inspector, export, groups, undo/redo, cancellation, help, theme`)
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  let release
  const blocked = new Promise(r => { release = r })
  await page.route('**/smoji.json', async route => { await blocked; await route.fulfill({ status: 503, body: 'Unavailable' }) })
  await page.goto(url)
  await page.getByRole('status').waitFor()
  await capture(page, 'loading')
  release()
  await page.getByRole('button', { name: '重试加载' }).waitFor()
  await capture(page, 'catalog-error')
  await page.unroute('**/smoji.json')
  await page.getByRole('button', { name: '重试加载' }).click()
  await page.locator('.card__open').first().waitFor()
  await page.addInitScript(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key.startsWith('smoji-prototype-')) throw new DOMException('QuotaExceededError', 'QuotaExceededError'); original.call(this, key, value) } })
  await page.reload()
  await page.getByRole('alert').filter({ hasText: '浏览器存储' }).waitFor()
  await capture(page, 'storage-error')
  await context.close()
  await writeFile(resolve(evidence, 'verification.json'), JSON.stringify({ browser: browser.version(), checks, ...(fullCatalog ? { catalog: { packs: 36, items: 5934, preservedProductionPacks: 35, preservedProductionItems: 5830, liveManifest: 'https://smoji.zsh.moe/smoji.json', liveCatalogEqual: true, newWebpHeadChecks: 104 } } : {}), exceptionStates: ['loading', 'catalog-error', 'retry-success', 'storage-error'], limitations: ['Chromium emulation only; not real Safari/device or full accessibility certification', fullCatalog ? 'CDN originals; CI thumbnails not included; historical migration not separately tested' : 'Historical migration intentionally absent; fixture export URLs are local', 'Clipboard actual OS write and drag/drop not separately verified in this run'] }, null, 2))
} finally { await browser.close(); await new Promise(r => server.close(r)) }
