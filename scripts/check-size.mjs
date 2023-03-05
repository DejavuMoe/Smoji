import { gzipSync } from 'node:zlib'
import { readdir, readFile, stat } from 'node:fs/promises'

const budgets = [
  ['packages/smoji/dist/index.js', 3 * 1024, 2_000],
  ['packages/smoji/dist/style.css', 2_000, 1_000],
]

const reportOnly = [
  'packages/smoji/dist/manifest.js',
  'packages/smoji/dist/marker.js',
]

async function measure(file) {
  const content = await readFile(new URL(`../${file}`, import.meta.url))
  const raw = (await stat(new URL(`../${file}`, import.meta.url))).size
  const gzip = gzipSync(content).length
  return { raw, gzip }
}

let failed = false

console.log('Budgets (picker core + CSS):')
for (const [file, rawBudget, gzipBudget] of budgets) {
  const { raw, gzip } = await measure(file)
  console.log(`  ${file}: ${raw} B minified, ${gzip} B gzip (limits < ${rawBudget} / < ${gzipBudget})`)
  if (raw >= rawBudget || gzip >= gzipBudget) {
    console.error(`  Budget exceeded for ${file}`)
    failed = true
  }
}

console.log('Loader / marker (reported, not budgeted with picker):')
for (const file of reportOnly) {
  const { raw, gzip } = await measure(file)
  console.log(`  ${file}: ${raw} B minified, ${gzip} B gzip`)
}

console.log('Demo build summary:')
try {
  const distRoot = new URL('../demo/dist/', import.meta.url)
  let files = 0
  let bytes = 0
  let uniqueBytes = 0
  const inodes = new Set()
  const notable = []
  for (const name of await readdir(distRoot, { recursive: true })) {
    const full = new URL(name, distRoot)
    const info = await stat(full)
    if (!info.isFile()) continue
    files += 1
    bytes += info.size
    const inode = `${info.dev}:${info.ino}`
    if (!inodes.has(inode)) {
      inodes.add(inode)
      uniqueBytes += info.size
    }
    if (/\.(html|js|css|json)$/.test(name) || name === 'smoji.json') {
      notable.push(`  demo/dist/${name}: ${info.size} B`)
    }
  }
  for (const line of notable.sort()) console.log(line)
  console.log(`  (${files} files, ${bytes} logical bytes / ${uniqueBytes} hard-link-deduplicated bytes including images)`)
} catch {
  console.error('  demo/dist missing — run build:demo first')
  failed = true
}

if (failed) process.exitCode = 1
