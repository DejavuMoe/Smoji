// Build a frozen, isolated prototype from the existing product, never edit product files.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { createHash } from 'node:crypto'
import { build } from 'vite'

const project = import.meta.dirname
const root = resolve(project, '../..')
const output = resolve(project, 'v0')
const json = async path => JSON.parse(await readFile(path, 'utf8'))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
async function walk(dir) {
  return (await Promise.all((await readdir(dir, { withFileTypes: true })).map(e =>
    e.isDirectory() ? walk(resolve(dir, e.name)) : [resolve(dir, e.name)]))).flat()
}
const inputs = [...await walk(resolve(root, 'apps/workbench/src')), ...await walk(resolve(root, 'packages/smoji/src')),
  ...['apps/workbench/index.html', 'apps/workbench/vite.config.ts', 'package.json', 'pnpm-lock.yaml', 'data/smoji.json'].map(p => resolve(root, p))]
const fingerprint = Object.fromEntries(await Promise.all(inputs.sort().map(async path =>
  [relative(root, path).replaceAll('\\', '/'), hash((await readFile(path, 'utf8')).replaceAll('\r\n', '\n'))])))
const saved = await json(resolve(project, 'source-fingerprint.json')).catch(e => { if (e.code !== 'ENOENT') throw e })
if (saved) assert.deepEqual(fingerprint, saved, 'The v0 source changed. Create a new prototype version instead of silently rebuilding v0.')
const catalog = await json(resolve(root, 'data/smoji.json'))
const hosting = await json(resolve(root, 'data/hosting.json'))
const fixtures = { version: 1, packs: catalog.packs.map((pack, index) => ({
  ...pack, items: pack.items.slice(0, index === 0 ? 144 : 6).map(item => ({
    ...item, src: './images/' + item.src.replace(/^\.\//, ''),
  })),
})) }
const images = fixtures.packs.flatMap(p => p.items)
const cachedImages = new Map(await Promise.all(images.map(async item => [item.src,
  await readFile(resolve(output, item.src)).catch(e => { if (e.code !== 'ENOENT') throw e; return null }),
])))
const replacements = new Set()
await build({ configFile: resolve(root, 'apps/workbench/vite.config.ts'), base: './', logLevel: 'error',
  build: { outDir: output, emptyOutDir: true, sourcemap: false },
  plugins: [{ name: 'isolated-v0', enforce: 'pre',
    load(id) {
      if (id.endsWith('/data/previews.json') || id.endsWith('/data/published-aliases.json')) return '{}'
    },
    transformIndexHtml: { order: 'pre', handler(html) {
      return html.replace(/    <div id="workbench-static" hidden>[\s\S]*?(?=  <\/body>)/, '')
        .replaceAll('smoji-theme', 'smoji-prototype-v0:theme').replace('href="/favicon.svg', 'href="./favicon.svg')
    } },
    transform(code, id) {
      if (!id.startsWith(resolve(root, 'apps/workbench/src').replaceAll('\\', '/'))) return
      let result = code.replaceAll('smoji-workbench:', 'smoji-prototype-v0:').replaceAll('smoji-theme', 'smoji-prototype-v0:theme')
      if (id.endsWith('/main.tsx')) {
        const needle = 'const manifestUrl = import.meta.env.PROD ? publishedManifestUrl : catalogUrl'
        assert(result.includes(needle))
        result = result.replace(needle, 'const manifestUrl = catalogUrl')
        replacements.add('local-catalog')
      }
      if (id.endsWith('/features/shell/Header.tsx')) {
        assert(result.includes('src="/favicon.svg?v=2"'))
        result = result.replace('src="/favicon.svg?v=2"', 'src={`${import.meta.env.BASE_URL}favicon.svg?v=2`}')
        result = result.replace('href="/"', 'href={import.meta.env.BASE_URL}')
        replacements.add('relative-brand')
      }
      if (id.endsWith('/src/export.ts')) {
        assert(result.includes("? new URL('smoji.json', hosting.assetBaseUrl).href : url.href"))
        result = result.replace(/function exportManifestUrl\(manifestUrl: string\): string \{[\s\S]*?\r?\n\}/,
          'function exportManifestUrl(manifestUrl: string): string { return manifestUrl }')
        replacements.add('local-export')
      }
      return result
    },
  }],
})
assert.deepEqual([...replacements].sort(), ['local-catalog', 'local-export', 'relative-brand'])
await writeFile(resolve(output, 'smoji.json'), JSON.stringify(fixtures))
const assets = await json(resolve(root, 'data/assets.json'))
let cursor = 0
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < images.length) {
    const item = images[cursor++]
    const path = item.src.slice('./images/'.length)
    let bytes = cachedImages.get(item.src)
    if (!bytes) {
      const response = await fetch(new URL(path, hosting.assetBaseUrl), { signal: AbortSignal.timeout(30000) })
      assert(response.ok, `Missing fixture: ${path}`)
      bytes = Buffer.from(await response.arrayBuffer())
    }
    assert.equal(hash(bytes), assets[path].sha256, `Fixture integrity: ${path}`)
    await mkdir(resolve(output, 'images', path, '..'), { recursive: true })
    await writeFile(resolve(output, 'images', path), bytes)
  }
}))
await writeFile(resolve(project, 'source-fingerprint.json'), JSON.stringify(fingerprint, null, 2) + '\n')
await writeFile(resolve(project, 'fixture-provenance.json'), JSON.stringify({
  sourceCommit: 'e10929d8a9bdf0a8e1b7ac87b5a33bc58cf6653b',
  source: hosting.assetBaseUrl, packs: fixtures.packs.length, items: images.length,
  assets: images.map(item => { const path = item.src.slice('./images/'.length); return { path: 'v0/' + item.src.slice(2), source: new URL(path, hosting.assetBaseUrl).href, sha256: assets[path].sha256 } }),
}, null, 2) + '\n')
console.log(`v0 ready: ${fixtures.packs.length} packs / ${images.length} local images; isolated storage; ${output}`)
