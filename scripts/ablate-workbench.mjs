// Production-build ablations; transforms never modify application source files.
// Run after pnpm install && pnpm generate:packs: node scripts/ablate-workbench.mjs
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { resolve, extname, relative } from 'node:path'
import { createServer } from 'node:http'
import { gzipSync } from 'node:zlib'
import { cpus, release } from 'node:os'
import { build } from 'vite'
import { chromium } from '@playwright/test'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.tmp/ablation')
const repetitions = Number(process.env.ABLATION_RUNS ?? 5)
assert(Number.isInteger(repetitions) && repetitions >= 1)
const variants = ['baseline', 'no-progressive', 'no-memo', 'no-containment', 'no-fonts',
  'no-reveal', 'no-legacy', 'no-tooltips', 'eager-dialogs', 'no-aliases']
const catalog = JSON.parse(await readFile(resolve(root, 'data/smoji.json'), 'utf8'))
const hosting = JSON.parse(await readFile(resolve(root, 'data/hosting.json'), 'utf8'))
const largest = catalog.packs.reduce((a, b) => a.items.length > b.items.length ? a : b)
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="35" fill="#f5c542"/><circle cx="28" cy="32" r="4"/><circle cx="52" cy="32" r="4"/><path d="M22 48Q40 68 58 48" fill="none" stroke="#333" stroke-width="4"/></svg>'
await mkdir(output, { recursive: true })

function replaceOnce(code, before, after) {
  assert.equal(code.split(before).length, 2, `Ablation source changed: ${before}`)
  return code.replace(before, after)
}

function plugin(variant) {
  let changed = variant === 'baseline'
  return {
    name: `ablation-${variant}`, enforce: 'pre',
    async load(id) {
      if (variant === 'no-aliases' && id.endsWith('/data/published-aliases.json')) {
        changed = true
        return '{}'
      }
      if (!id.endsWith('/styles/globals.css')) return
      const code = await readFile(id, 'utf8')
      if (variant === 'no-containment') {
        changed = true
        return replaceOnce(code, 'content-visibility: auto;', 'content-visibility: visible;')
      }
      if (variant === 'no-reveal') {
        changed = true
        return replaceOnce(code, 'animation: image-reveal 350ms ease-out both;', 'animation: none;')
      }
    },
    transformIndexHtml: {
      order: 'pre', handler(html) {
        if (variant !== 'no-legacy') return html
        assert(html.includes('<div id="workbench-static" hidden>'))
        changed = true
        return html.replace(/    <div id="workbench-static" hidden>[\s\S]*?(?=  <\/body>)/, '')
      },
    },
    transform(code, id) {
      code = code.replaceAll('\r\n', '\n')
      const file = id.replaceAll('\\', '/').split('?')[0]
      // Equal render-count instrumentation in every build, including baseline.
      if (file.endsWith('/features/gallery/EmojiCard.tsx')) {
        code = replaceOnce(code, '  const thumbUrl =', '  globalThis.__ablationCardRenders = (globalThis.__ablationCardRenders ?? 0) + 1\n  const thumbUrl =')
        if (variant === 'no-memo') {
          code = replaceOnce(code, 'memo(function EmojiCard(', '(function EmojiCard(')
          changed = true
        }
        if (variant === 'no-tooltips') {
          code = replaceOnce(code, '        tooltip={', '        title={')
          changed = true
        }
        return code
      }
      if (variant === 'no-progressive' && file.endsWith('/features/gallery/EmojiGrid.tsx')) {
        changed = true
        return replaceOnce(code, 'const renderLimit = state.gallery.renderLimit', 'const renderLimit = items.length')
      }
      if (variant === 'no-fonts' && file.endsWith('/src/main.tsx')) {
        changed = true
        return replaceOnce(code, "import './fonts.css'", '')
      }
      if (variant === 'eager-dialogs' && file.endsWith('/app/App.tsx')) {
        changed = true
        return replaceOnce(code,
          "const CodePreviewDialog = lazy(() =>\n  import('../features/export/CodePreviewDialog').then((m) => ({ default: m.CodePreviewDialog })),\n)\nconst HelpDialog = lazy(() =>\n  import('../features/help/HelpDialog').then((m) => ({ default: m.HelpDialog })),\n)",
          "import { CodePreviewDialog } from '../features/export/CodePreviewDialog'\nimport { HelpDialog } from '../features/help/HelpDialog'")
      }
    },
    closeBundle() { assert(changed, `Ablation did not apply: ${variant}`) },
  }
}

const builds = {}
const servers = []
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webp': 'image/webp' }
async function filesIn(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  return (await Promise.all(entries.map(e => e.isDirectory() ? filesIn(resolve(dir, e.name)) : [resolve(dir, e.name)]))).flat()
}

let browser
const raw = process.env.ABLATION_RESUME
  ? JSON.parse(await readFile(resolve(output, 'raw.json'), 'utf8')).raw : []
try {
  for (const variant of variants) {
    const dir = resolve(output, variant)
    if (!process.env.ABLATION_REUSE_BUILDS) await build({
      configFile: resolve(root, 'apps/workbench/vite.config.ts'), logLevel: 'error',
      plugins: [plugin(variant)], build: { outDir: dir },
    })
    const files = await filesIn(dir)
    const sizes = []
    const assets = new Map()
    for (const file of files) {
      const body = await readFile(file)
      const path = '/' + relative(dir, file).replaceAll('\\', '/')
      const zipped = /\.(html|js|css|json)$/.test(path)
      const payload = zipped ? gzipSync(body) : body
      assets.set(path, { payload, zipped, type: mime[extname(file)] ?? 'application/octet-stream' })
      sizes.push({ path, bytes: body.length, gzipBytes: gzipSync(body).length })
    }
    const server = createServer((req, res) => {
      const path = new URL(req.url, 'http://localhost').pathname
      const asset = assets.get(path === '/' ? '/index.html' : path)
      if (!asset) { res.writeHead(404); res.end(); return }
      res.writeHead(200, { 'Content-Type': asset.type, 'Cache-Control': 'no-store',
        ...(asset.zipped ? { 'Content-Encoding': 'gzip' } : {}) })
      res.end(asset.payload)
    })
    await new Promise(r => server.listen(0, '127.0.0.1', r))
    servers.push(server)
    builds[variant] = { url: `http://127.0.0.1:${server.address().port}`, sizes }
    console.log(`Built ${variant}`)
  }
  browser = await chromium.launch()
  const viewports = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }]

  async function openPage(variant, viewport, realImages = false, dark = false, design = '') {
    const context = await browser.newContext({ viewport, colorScheme: dark ? 'dark' : 'light', hasTouch: viewport.width < 600, isMobile: viewport.width < 600 })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.route(`${hosting.assetBaseUrl}**`, async route => {
      const url = route.request().url()
      if (url.endsWith('.json')) { await route.abort(); return }
      const sourcePath = decodeURIComponent(new URL(url).pathname.slice(new URL(hosting.assetBaseUrl).pathname.length))
      const body = realImages ? imageCache.get(sourcePath) : null
      await route.fulfill({ contentType: body ? mime[extname(sourcePath)] : 'image/svg+xml', body: body ?? svg })
    })
    await page.addInitScript(({ design }) => {
      localStorage.setItem('smoji-workbench:density', design === 'comfortable' ? 'comfortable' : 'compact')
      window.__ablation = { ready: 0, longTasks: [], lcp: 0 }
      new PerformanceObserver(list => window.__ablation.longTasks.push(...list.getEntries().map(e => e.duration))).observe({ type: 'longtask', buffered: true })
      new PerformanceObserver(list => { window.__ablation.lcp = list.getEntries().at(-1).startTime }).observe({ type: 'largest-contentful-paint', buffered: true })
      const observer = new MutationObserver(() => {
        if (!document.querySelector('#grid .card__open')) return
        observer.disconnect()
        requestAnimationFrame(() => requestAnimationFrame(() => { window.__ablation.ready = performance.now() }))
      })
      observer.observe(document, { subtree: true, childList: true })
    }, { design })
    const cdp = await context.newCDPSession(page)
    await cdp.send('Performance.enable')
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: realImages ? 1 : 4 })
    await cdp.send('Network.enable')
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
    // Local JS/CSS/fonts/catalog: fixed network envelope. Fulfilled image fixtures are not bandwidth measurements.
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 1250000, uploadThroughput: 1250000 })
    await page.goto(builds[variant].url)
    await page.waitForFunction(() => window.__ablation.ready > 0)
    await page.waitForTimeout(500)
    return { page, context, cdp, errors }
  }

  const imageCache = new Map()
  // One unrecorded warm-up per variant and viewport; measured order rotates each round.
  for (const viewport of viewports) {
    if (raw.filter(r => r.viewport === viewport.name).length === repetitions * variants.length) continue
    for (let round = -1; round < repetitions; round++) {
      const offset = (round + 1) % variants.length
      const ordered = [...variants.slice(offset), ...variants.slice(0, offset)]
      for (const variant of ordered) {
        if (round >= 0 && raw.some(r => r.viewport === viewport.name && r.variant === variant && r.round === round)) continue
        const { page, context, cdp, errors } = await openPage(variant, viewport)
        try {
          const startup = await page.evaluate(() => ({
            ...window.__ablation,
            fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0,
            cards: document.querySelectorAll('#grid .card').length,
            domNodes: document.querySelectorAll('*').length,
            fonts: performance.getEntriesByType('resource').filter(e => /\.woff2?$/.test(e.name)).map(e => ({ name: e.name.split('/').at(-1), bytes: e.encodedBodySize })),
          }))
          const before = await page.evaluate(() => window.__ablationCardRenders)
          const inspectorMs = await page.evaluate(async () => {
            const start = performance.now()
            document.querySelector('.card__open').click()
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
            return performance.now() - start
          })
          assert(await page.getByRole('dialog').isVisible())
          const inspectorRenders = await page.evaluate(() => window.__ablationCardRenders) - before
          await page.keyboard.press('Escape')
          await page.getByRole('dialog').waitFor({ state: 'hidden' })
          if (viewport.width < 901) await page.locator('#menu-toggle').click()
          await page.locator(`#pack-nav button.pack[data-pack-index="${catalog.packs.indexOf(largest)}"]`).click()
          await page.waitForFunction(label => document.querySelector('.gallery__header h2')?.textContent === label, largest.label)
          await page.waitForTimeout(400)
          const largestInitialCards = await page.locator('#grid .card').count()
          // Equal DOM/content for scroll comparisons. Progressive startup savings are measured above.
          while (await page.locator('#grid .card').count() < largest.items.length) {
            const count = await page.locator('#grid .card').count()
            await page.getByRole('button', { name: /加载更多/ }).evaluate(e => e.click())
            await page.waitForFunction(n => document.querySelectorAll('#grid .card').length > n, count)
          }
          await page.locator('main').evaluate(e => { e.scrollTop = 0 })
          await page.waitForTimeout(400)
          const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]))
          const pre = await metrics()
          const frames = await page.evaluate(async () => {
            const main = document.querySelector('main')
            const frames = []
            let previous = performance.now()
            const distance = main.scrollHeight - main.clientHeight
            for (let i = 0; i < 40; i++) {
              main.scrollTop = (i < 20 ? i / 19 : (39 - i) / 19) * distance
              await new Promise(requestAnimationFrame)
              const now = performance.now()
              frames.push(now - previous)
              previous = now
            }
            return frames
          })
          const post = await metrics()
          const result = { variant, viewport: viewport.name, round, startup, inspectorMs, inspectorRenders,
            largestInitialCards, scrollFrames: frames, scrollTaskMs: (post.TaskDuration - pre.TaskDuration) * 1000,
            scrollLayoutMs: (post.LayoutDuration - pre.LayoutDuration) * 1000,
            finalCards: await page.locator('#grid .card').count(), errors }
          assert.equal(errors.length, 0, errors.join('\n'))
          if (round >= 0) raw.push(result)
          await writeFile(resolve(output, 'raw.json'), JSON.stringify({ builds, raw }, null, 2))
        } finally { await context.close() }
      }
      console.log(`${viewport.name}: ${round < 0 ? 'warm-up' : `round ${round + 1}/${repetitions}`} complete`)
    }
  }

  // Actual CDN pixels are used only for visual review, never for the timed fixture runs.
  const firstItems = catalog.packs[0].items.slice(0, 144)
  let cursor = 0
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < firstItems.length) {
      const item = firstItems[cursor++]
      const sourcePath = item.src.replace(/^\.\//, '')
      const url = new URL(sourcePath, hosting.assetBaseUrl)
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
      assert(response.ok, `Visual asset ${url}: ${response.status}`)
      imageCache.set(sourcePath, Buffer.from(await response.arrayBuffer()))
    }
  }))
  const visuals = []
  for (const viewport of viewports) {
    for (const design of ['baseline', 'no-fonts', 'no-reveal', 'flat-cards', 'always-actions', 'comfortable']) {
      const variant = variants.includes(design) ? design : 'baseline'
      const { page, context } = await openPage(variant, viewport, true, false, design)
      try {
        if (design === 'flat-cards') await page.addStyleTag({ content: '.card:not(.is-excluded) { border-color: transparent !important; background: transparent !important; box-shadow: none !important; }' })
        if (design === 'always-actions') await page.addStyleTag({ content: '.card__action-btn { opacity: 1 !important; pointer-events: auto !important; }' })
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(600)
        const geometry = await page.evaluate(() => {
          const main = document.querySelector('main').getBoundingClientRect()
          const header = document.querySelector('.gallery__header').getBoundingClientRect()
          const cards = [...document.querySelectorAll('#grid .card')]
          const visible = cards.filter(e => { const r = e.getBoundingClientRect(); return r.top >= header.bottom && r.bottom <= main.bottom })
          const action = document.querySelector('.card__action-btn')
          const rect = action.getBoundingClientRect()
          return { overflow: document.documentElement.scrollWidth > innerWidth, fullyVisibleCards: visible.length,
            cardWidth: cards[0].getBoundingClientRect().width, actionWidth: rect.width, actionHeight: rect.height,
            actionOpacity: getComputedStyle(action).opacity, loaded: document.querySelectorAll('#grid [data-image-status="loaded"]').length }
        })
        assert(!geometry.overflow)
        const screenshot = `${viewport.name}-${design}.png`
        await page.screenshot({ path: resolve(output, screenshot) })
        visuals.push({ viewport: viewport.name, design, ...geometry, screenshot })
      } finally { await context.close() }
    }
    const { page, context } = await openPage('baseline', viewport, true, true)
    await page.waitForTimeout(600)
    await page.screenshot({ path: resolve(output, `${viewport.name}-dark.png`) })
    await context.close()
  }

  const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
  const p95 = values => [...values].sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1]
  const summary = viewports.flatMap(viewport => variants.map(variant => {
    const runs = raw.filter(r => r.viewport === viewport.name && r.variant === variant)
    return { viewport: viewport.name, variant, runs: runs.length,
      readyMs: median(runs.map(r => r.startup.ready)), readyMinMs: Math.min(...runs.map(r => r.startup.ready)), readyMaxMs: Math.max(...runs.map(r => r.startup.ready)),
      fcpMs: median(runs.map(r => r.startup.fcp)), startupBlockingMs: median(runs.map(r => r.startup.longTasks.reduce((sum, t) => sum + Math.max(0, t - 50), 0))),
      cards: median(runs.map(r => r.startup.cards)), domNodes: median(runs.map(r => r.startup.domNodes)),
      fontBytes: median(runs.map(r => r.startup.fonts.reduce((sum, f) => sum + f.bytes, 0))),
      inspectorMs: median(runs.map(r => r.inspectorMs)), inspectorRenders: median(runs.map(r => r.inspectorRenders)),
      largestInitialCards: median(runs.map(r => r.largestInitialCards)), scrollTaskMs: median(runs.map(r => r.scrollTaskMs)),
      scrollFrameP95Ms: median(runs.map(r => p95(r.scrollFrames))), finalCards: median(runs.map(r => r.finalCards)),
    }
  }))
  const result = { environment: { node: process.version, browser: browser.version(), cpu: cpus()[0].model, os: release(), repetitions,
    cpuThrottle: 4, latencyMs: 40, bytesPerSecond: 1250000, imageFixture: svg,
    catalogPacks: catalog.packs.length, catalogItems: catalog.packs.reduce((n, p) => n + p.items.length, 0),
    entryPack: { id: catalog.packs[0].id, items: catalog.packs[0].items.length }, largestPack: { id: largest.id, items: largest.items.length },
    previewEntries: Object.keys(JSON.parse(await readFile(resolve(root, 'data/previews.json'), 'utf8'))).length },
    summary, visuals, builds, raw }
  await writeFile(resolve(output, 'results.json'), JSON.stringify(result, null, 2))
  console.table(summary)
  console.log(`Results: ${output}/results.json`)
} finally {
  await browser?.close()
  await Promise.all(servers.map(s => new Promise(r => s.close(r))))
}
