// Full production catalog plus the requested pack, with isolated prototype storage.
import assert from 'node:assert/strict'
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { createHash } from 'node:crypto'
import { build } from 'vite'
import { assertManifestSize, parseSmojiManifest } from '../../packages/smoji/src/validate.ts'

const project = import.meta.dirname
const root = resolve(project, '../..')
const output = resolve(project, 'v1')
const json = async path => JSON.parse(await readFile(path, 'utf8'))
async function walk(dir) {
  return (await Promise.all((await readdir(dir, { withFileTypes: true })).map(e =>
    e.isDirectory() ? walk(resolve(dir, e.name)) : [resolve(dir, e.name)]))).flat()
}
const inputs = [...await walk(resolve(root, 'apps/workbench/src')), ...await walk(resolve(root, 'packages/smoji/src')),
  ...['apps/workbench/index.html', 'apps/workbench/vite.config.ts', 'package.json', 'pnpm-lock.yaml',
    'data/smoji.json', 'data/hosting.json', 'data/published-aliases.json', 'designs/smoji/deepseek-wale-girl.json'].map(p => resolve(root, p))]
const fingerprint = Object.fromEntries(await Promise.all(inputs.sort().map(async path =>
  [relative(root, path).replaceAll('\\', '/'), createHash('sha256').update((await readFile(path, 'utf8')).replaceAll('\r\n', '\n')).digest('hex')])))
const saved = await json(resolve(project, 'source-fingerprint-v1.json')).catch(e => { if (e.code !== 'ENOENT') throw e })
if (saved) assert.deepEqual(fingerprint, saved, 'Source changed; create a new prototype version.')
const catalog = await json(resolve(root, 'data/smoji.json'))
const hosting = await json(resolve(root, 'data/hosting.json'))
const added = await json(resolve(project, 'deepseek-wale-girl.json'))
assert.equal(added.items.length, 104)
assert(!catalog.packs.some(p => p.id === added.id))
const manifest = { version: 1, packs: [added, ...catalog.packs].map(pack => ({
  ...pack, items: pack.items.map(item => ({ ...item, src: new URL(item.src, hosting.assetBaseUrl).href })),
})) }
const text = JSON.stringify(manifest)
assertManifestSize(text)
parseSmojiManifest(manifest, new URL('smoji.json', hosting.assetBaseUrl).href)
const transformed = new Set()
await build({ configFile: resolve(root, 'apps/workbench/vite.config.ts'), base: './', logLevel: 'error',
  build: { outDir: output, emptyOutDir: true, sourcemap: false },
  plugins: [{ name: 'isolated-v1', enforce: 'pre',
    // CI-only thumbnails are absent locally; use the same CDN originals as the inspector.
    resolveId(id) { if (id.endsWith('/data/previews.json')) return '\0prototype-previews' },
    load(id) { if (id === '\0prototype-previews') return 'export default {}' },
    transformIndexHtml: { order: 'pre', handler(html) {
      return html.replace(/    <div id="workbench-static" hidden>[\s\S]*?(?=  <\/body>)/, '')
        .replaceAll('smoji-theme', 'smoji-prototype-v1:theme').replace('href="/favicon.svg', 'href="./favicon.svg')
    } },
    transform(code, id) {
      if (!id.startsWith(resolve(root, 'apps/workbench/src').replaceAll('\\', '/'))) return
      let result = code.replaceAll('smoji-workbench:', 'smoji-prototype-v1:').replaceAll('smoji-theme', 'smoji-prototype-v1:theme')
      if (id.endsWith('/features/shell/Header.tsx')) {
        assert(result.includes('src="/favicon.svg?v=2"'))
        result = result.replace('src="/favicon.svg?v=2"', 'src={`${import.meta.env.BASE_URL}favicon.svg?v=2`}')
          .replace('href="/"', 'href={import.meta.env.BASE_URL}')
        transformed.add('relative-brand')
      }
      return result
    },
  }],
})
assert.deepEqual([...transformed], ['relative-brand'])
await writeFile(resolve(output, 'smoji.json'), text)
await writeFile(resolve(project, 'source-fingerprint-v1.json'), JSON.stringify(fingerprint, null, 2) + '\n')
console.log(`v1: ${manifest.packs.length} packs / ${manifest.packs.reduce((n, p) => n + p.items.length, 0)} items / ${Buffer.byteLength(text)} bytes`)
