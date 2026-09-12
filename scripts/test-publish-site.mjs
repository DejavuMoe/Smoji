import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readlink, rm, writeFile, cp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const parent = await mkdtemp(join(tmpdir(), 'smoji-deploy-'))
const sha = 'a'.repeat(40)
const live = join(parent, 'smoji.zsh.moe')
const run = (id, source = 'demo/dist') => execFileSync('sh', ['scripts/publish-site.sh', source, id], {
  env: { ...process.env, SMOJI_DEPLOY_PARENT: parent, SMOJI_DEPLOY_SITE: 'smoji.zsh.moe' },
  stdio: 'pipe',
})
try {
  run(`${sha}-1-0`)
  const first = await readlink(live)
  await writeFile(join(live, 'assets/previous-hash.js'), 'export const previous = true')
  run(`${sha}-2-0`)
  assert.equal(await readFile(join(live, 'assets/previous-hash.js'), 'utf8'), 'export const previous = true', 'Old chunk URLs must survive activation')
  const second = await readlink(live)
  assert.notEqual(first, second)
  assert.equal(await readFile(join(live, 'index.html'), 'utf8'), await readFile('demo/dist/index.html', 'utf8'))
  assert((await readFile(join(parent, first, 'index.html'))).length > 0, 'Keep previous release')
  run(`${sha}-1-1`)
  assert.equal(await readlink(live), second, 'A stale pipeline must not replace the current site')
  assert.throws(() => run('../unsafe'))
  await mkdir(join(parent, 'empty'))
  assert.throws(() => run(`${sha}-3-0`, join(parent, 'empty')))
  assert.equal(await readlink(live), second, 'Invalid output must leave the live site unchanged')
  for (const name of [`.build-${sha}-5-0`, `.site-${sha}-5-0`]) {
    const reserved = join(parent, '.smoji.zsh.moe-releases', name)
    await mkdir(reserved)
    await writeFile(join(reserved, 'owned-by-another-run'), 'keep')
    assert.throws(() => run(`${sha}-5-0`))
    assert.equal(await readFile(join(reserved, 'owned-by-another-run'), 'utf8'), 'keep')
    await rm(reserved, { recursive: true })
  }
  const damaged = join(parent, 'damaged')
  await cp('demo/dist', damaged, { recursive: true })
  const chunks = JSON.parse(await readFile(join(damaged, '.vite/manifest.json'), 'utf8'))
  const alias = Object.values(chunks).find((chunk) => chunk.file.includes('published-aliases'))
  assert(alias, 'Expected aliases dynamic chunk')
  await rm(join(damaged, alias.file))
  assert.throws(() => run(`${sha}-6-0`, damaged), 'Missing dynamic chunk must block publication')
  assert.equal(await readlink(live), second)
  await rm(live)
  await mkdir(live)
  await writeFile(join(live, 'existing.txt'), 'keep')
  assert.throws(() => run(`${sha}-4-0`))
  assert.equal(await readFile(join(live, 'existing.txt'), 'utf8'), 'keep', 'Never replace an existing real directory')
  console.log('Publish checks passed: activate, upgrade, stale pipeline, invalid input and existing directory')
} finally {
  await rm(parent, { recursive: true, force: true })
}
