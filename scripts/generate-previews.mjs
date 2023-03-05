import { access, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const run = promisify(execFile)
const root = resolve(process.argv[2] ?? fileURLToPath(new URL('../', import.meta.url)))
const assets = JSON.parse(await readFile(resolve(root, 'data/assets.json'), 'utf8'))
const previous = JSON.parse(await readFile(resolve(root, 'data/previews.json'), 'utf8').catch((error) => {
  if (error.code === 'ENOENT') return '{}'
  throw error
}))
const entries = Object.entries(assets)
const results = new Array(entries.length)
const temporary = await mkdtemp(join(tmpdir(), 'smoji-preview-sources-'))
await mkdir(resolve(root, 'demo/public/_previews'), { recursive: true })
let generated = 0
let cursor = 0
let assetBaseUrl

async function preview(path, asset) {
  if (!/^[a-z-]+\/[a-z]{12}\.(png|gif|webp)$/.test(path) || !/^[a-f0-9]{64}$/.test(asset.sha256)) {
    throw new Error(`Invalid asset metadata: ${path}`)
  }
  if (asset.preview === false) return
  const src = `_previews/${asset.sha256}-160-v3.webp`
  const output = resolve(root, 'demo/public', src)
  if (previous[path]?.src === src) {
    try { await access(output); return [path, previous[path]] } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  let input = resolve(root, 'packs', path)
  let bytes = await readFile(input).catch((error) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  if (!bytes) {
    assetBaseUrl ??= JSON.parse(await readFile(resolve(root, 'data/hosting.json'), 'utf8')).assetBaseUrl
    const url = new URL(path, assetBaseUrl)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        bytes = Buffer.from(await response.arrayBuffer())
        break
      } catch (error) {
        if (attempt === 2) throw new Error(`Cannot download ${url}: ${error.message}`, { cause: error })
      }
    }
    input = resolve(temporary, path)
    await mkdir(resolve(temporary, path.split('/')[0]), { recursive: true })
    await writeFile(input, bytes)
  }
  if (bytes.length !== asset.bytes || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) {
    throw new Error(`Asset integrity mismatch: ${path}`)
  }
  const animated = path.endsWith('.gif')
    ? Number((await run('magick', ['identify', '-format', '%n ', input])).stdout.split(' ')[0]) > 1
    : bytes.toString('ascii', 12, 16) === 'VP8X' && Boolean(bytes[20] & 2)
  if (!animated && asset.bytes <= 32768) return
  const temp = `${output}.${process.pid}-${path.replace('/', '-')}.tmp.webp`
  try {
    const render = ['-thumbnail', '160x160>', '-strip', '-quality', '76']
    const contrast = ['-background', 'white', '-alpha', 'remove', '-colorspace', 'Gray', '-format', '%[fx:standard_deviation]\n', 'info:']
    let frames = [`${input}[0]`]
    if (animated) {
      const { stdout } = await run('magick', [input, '-coalesce', '-thumbnail', '160x160>', ...contrast])
      const scores = stdout.trim().split('\n').map(Number)
      frames = [input, '-coalesce', '-clone', String(scores.indexOf(Math.max(...scores))), '-delete', '0--2']
    }
    await run('magick', [...frames, ...render, temp])
    await rename(temp, output)
    generated++
  } catch (error) {
    await rm(temp, { force: true })
    throw new Error(`Cannot generate preview for ${path}. Install ImageMagick with WebP support.`, { cause: error })
  }
  return [path, { src, bytes: asset.bytes, animated }]
}

try {
  // Two workers bound simultaneous image decoding and download memory use.
  const workers = await Promise.allSettled(Array.from({ length: 2 }, async () => {
    while (cursor < entries.length) {
      const index = cursor++
      results[index] = await preview(...entries[index])
      if ((index + 1) % 250 === 0) console.log(`Previews: ${index + 1}/${entries.length}`)
    }
  }))
  const failure = workers.find((worker) => worker.status === 'rejected')
  if (failure) throw failure.reason
  const previews = Object.fromEntries(results.filter(Boolean))
  await writeFile(resolve(root, 'data/previews.json'), `${JSON.stringify(previews)}\n`)
  console.log(`Previews: ${Object.keys(previews).length} indexed, ${generated} generated`)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
