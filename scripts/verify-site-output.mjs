import assert from 'node:assert/strict'
import { lstat, readdir, readFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { parseSmojiManifest, assertManifestSize } from '../packages/smoji/src/validate.ts'

const root = resolve(process.argv[2] || 'demo/dist')
const json = async (path) => JSON.parse(await readFile(path, 'utf8'))
const publicRoot = resolve('demo/public')
const hosting = await json('data/hosting.json')
assert((await lstat(root)).isDirectory(), 'Site output must be a real directory')

async function requireFile(path) {
  const info = await lstat(path)
  assert(info.isFile() && info.size > 0, `Missing, empty or non-regular file: ${path}`)
}

async function files(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) result.push(...await files(path))
    else { await requireFile(path); result.push(path) }
  }
  return result
}

const allowed = new Set(['.vite', 'index.html', 'favicon.svg', 'smoji.json', 'assets', '_previews', 'LICENSE', 'OFL-ibm-plex-sans.txt', 'OFL-ibm-plex-mono.txt'])
for (const entry of await readdir(root)) assert(allowed.has(entry), `Unexpected published path: ${entry}`)
await files(root)
await requireFile(resolve(root, 'index.html'))
assert.deepEqual(await readFile(resolve(root, 'LICENSE')), await readFile('LICENSE'))
for (const font of ['sans', 'mono']) {
  assert.deepEqual(await readFile(resolve(root, `OFL-ibm-plex-${font}.txt`)), await readFile(`node_modules/@fontsource/ibm-plex-${font}/LICENSE`))
}
const html = await readFile(resolve(root, 'index.html'), 'utf8')
const assets = [...html.matchAll(/\b(?:src|href)="(\/assets\/[^"?#]+)"/g)].map((match) => match[1].slice(1))
assert(assets.some((path) => path.endsWith('.js')) && assets.some((path) => path.endsWith('.css')), 'Missing built JS/CSS')
for (const path of assets) await requireFile(resolve(root, path))

const chunks = await json(resolve(root, '.vite/manifest.json'))
assert(Object.values(chunks).some((chunk) => chunk.isEntry), 'Missing Vite entry')
for (const chunk of Object.values(chunks)) {
  for (const path of [chunk.file, ...(chunk.css ?? []), ...(chunk.assets ?? [])]) {
    assert(typeof path === 'string' && !path.startsWith('/') && !path.split('/').includes('..'), 'Invalid asset path')
    await requireFile(resolve(root, path))
  }
  for (const dependency of [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])]) {
    assert(Object.hasOwn(chunks, dependency), `Missing chunk dependency: ${dependency}`)
  }
}

const manifestText = await readFile(resolve(root, 'smoji.json'), 'utf8')
assertManifestSize(manifestText)
const manifest = JSON.parse(manifestText)
const manifestUrl = new URL('smoji.json', hosting.assetBaseUrl).href
assert(manifest.packs.every((pack) => pack.items.every((item) => item.src.startsWith(hosting.assetBaseUrl))), 'Published images must use absolute CDN URLs')
assert.deepEqual(parseSmojiManifest(manifest, manifestUrl), parseSmojiManifest(await json('data/smoji.json'), manifestUrl), 'Published manifest differs from the saved catalog')
for (const path of await files(publicRoot)) {
  const output = resolve(root, relative(publicRoot, path))
  await requireFile(output)
  assert.deepEqual(await readFile(output), await readFile(path), `Static asset mismatch: ${output}`)
}
for (const { src } of Object.values(await json('data/previews.json'))) await requireFile(resolve(root, src))
console.log(`Site output verified: ${root}; manifest, JS/CSS, generated previews`)
