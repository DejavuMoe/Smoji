import { readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { assertManifestSize, parseSmojiManifest } from '../packages/smoji/src/validate.ts'

// Optional workspace argument lets integration checks exercise the real generator on temporary files.
const workspace = resolve(process.argv[2] ?? fileURLToPath(new URL('../', import.meta.url)))
const packsRoot = resolve(workspace, 'packs')
const dataRoot = resolve(workspace, 'data')
const readJson = async (name) => JSON.parse(await readFile(resolve(dataRoot, name), 'utf8'))
const previous = await readJson('packs.json')
const previousAliases = await readJson('published-aliases.json')
const labels = new Map()
const previousItems = new Map()
const previousSeries = new Map()
for (const pack of previous) {
  for (const item of pack.items) {
    const id = basename(item.file, extname(item.file))
    if (!labels.has(id)) labels.set(id, item.label)
    previousItems.set(`${pack.id}/${id}`, item.label)
    if (typeof item.series === 'string') previousSeries.set(`${pack.id}/${id}`, item.series)
  }
}
const directories = await readdir(packsRoot, { withFileTypes: true }).catch((error) => {
  if (error.code === 'ENOENT') return []
  throw error
})
const localIds = new Set(directories.filter((entry) => entry.isDirectory()).map((entry) => entry.name))
// Missing folders are published packs; an empty local folder explicitly removes a pack.
const packs = previous.filter((pack) => !localIds.has(pack.id))
const previousAssets = await readJson('assets.json').catch((error) => {
  if (error.code === 'ENOENT') return {}
  throw error
})
const assets = Object.fromEntries(Object.entries(previousAssets).filter(([path]) => !localIds.has(path.split('/')[0])))
const pathsById = new Map()
for (const directory of directories.sort((a, b) => a.name.localeCompare(b.name))) {
  if (!directory.isDirectory()) {
    if (directory.isFile() && ['favicon.svg', 'smoji.json'].includes(directory.name)) continue
    throw new Error(`Unexpected packs entry: ${directory.name}`)
  }
  const id = directory.name
  if (!/^[a-z]+(?:-[a-z]+)*$/.test(id)) throw new Error(`Invalid pack directory: ${id}`)
  const old = previous.find((pack) => pack.id === id)
  const items = []
  const ids = new Set()
  for (const entry of (await readdir(resolve(packsRoot, id), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = `${id}/${entry.name}`
    if (!entry.isFile()) throw new Error(`Expected a flat image directory: ${path}`)
    if (entry.name === 'picforge-manifest.json') continue
    if (!/^[a-z]{12}\.(png|gif|webp)$/.test(entry.name)) throw new Error(`Invalid stable asset name: ${path}`)
    const itemId = basename(entry.name, extname(entry.name))
    if (ids.has(itemId)) throw new Error(`Multiple formats for the same stable ID: ${path}`)
    ids.add(itemId)
    const bytes = await readFile(resolve(packsRoot, path))
    const extension = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png'
      : bytes.subarray(0, 3).toString() === 'GIF' ? 'gif'
      : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' ? 'webp' : null
    if (!extension || !entry.name.endsWith(`.${extension}`)) throw new Error(`Image format mismatch: ${path}`)
    assets[path] = { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
      preview: bytes.length > 32768 || extension === 'gif' ||
        (bytes.toString('ascii', 12, 16) === 'VP8X' && Boolean(bytes[20] & 2)) }
    const candidates = pathsById.get(itemId) ?? []
    candidates.push(path)
    pathsById.set(itemId, candidates)
    const series = previousSeries.get(`${id}/${itemId}`)
    items.push({ file: entry.name, label: previousItems.get(`${id}/${itemId}`) ?? labels.get(itemId) ?? itemId,
      ...(series ? { series } : {}) })
  }
  // Keep curated series together; newly discovered files append in stable filename order.
  const itemOrder = new Map((old?.items ?? []).map((item, index) => [basename(item.file, extname(item.file)), index]))
  items.sort((a, b) => (itemOrder.get(basename(a.file, extname(a.file))) ?? Infinity) -
    (itemOrder.get(basename(b.file, extname(b.file))) ?? Infinity) || a.file.localeCompare(b.file))
  // Empty folders contain no exportable pack; do not resurrect deleted metadata entries.
  if (items.length) packs.push({ id, label: old?.label ?? id, items })
}
function currentPath(path) {
  if (Object.hasOwn(assets, path)) return path
  const candidates = pathsById.get(basename(path, extname(path))) ?? []
  const samePack = candidates.find((candidate) => candidate.split('/')[0] === path.split('/')[0])
  return samePack ?? (candidates.length === 1 ? candidates[0] : undefined)
}
const aliases = {}
for (const [from, target] of [
  ...Object.entries(previousAliases),
  ...previous.flatMap((pack) => pack.items.map((item) => [`${pack.id}/${item.file}`, `${pack.id}/${item.file}`])),
]) {
  const to = currentPath(target)
  if (to && !Object.hasOwn(assets, from)) aliases[from] = to
}
// Bilibili is the workbench entry pack; keep the remaining catalog in stable ID order.
packs.sort((a, b) => Number(b.id === 'bilibili') - Number(a.id === 'bilibili') || a.id.localeCompare(b.id))
const manifest = { version: 1, packs: packs.map((pack) => ({
  id: pack.id, label: pack.label,
  items: pack.items.map((item) => ({ id: basename(item.file, extname(item.file)), label: item.label, src: `./${pack.id}/${item.file}` })),
})) }
parseSmojiManifest(manifest, 'https://smoji.local/smoji.json')
const text = `${JSON.stringify(manifest, null, 2)}\n`
assertManifestSize(text)
// All files and the resulting manifest are validated before updating generated metadata.
for (const [name, data] of [['packs.json', packs], ['assets.json', assets], ['published-aliases.json', aliases]]) {
  await writeFile(resolve(dataRoot, name), `${JSON.stringify(data, null, 2)}\n`)
}
await writeFile(resolve(dataRoot, 'smoji.json'), text)
console.log(`Generated ${packs.length} packs / ${Object.keys(assets).length} items / ${Buffer.byteLength(text)} bytes; ${Object.keys(aliases).length} live aliases`)
