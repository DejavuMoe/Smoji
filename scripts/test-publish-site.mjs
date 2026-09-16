import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readlink, rm, writeFile, cp, symlink, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const parent = await mkdtemp(join(tmpdir(), 'smoji-deploy-'))
const sha = 'a'.repeat(40)
const site = join(parent, 'smoji.zsh.moe')
const live = join(site, 'html')
const run = (id, source = 'apps/workbench/dist', root = site) => execFileSync('sh', ['scripts/publish-site.sh', source, id], {
  env: { ...process.env, SMOJI_DEPLOY_ROOT: root },
  stdio: 'pipe',
})
try {
  await mkdir(site)
  run(`${sha}-1-0`)
  const first = await readlink(live)
  assert.equal(first, `releases/${sha}-1-0`)
  assert.deepEqual((await readdir(site)).sort(), ['.deploy.lock', 'html', 'releases'])
  assert.deepEqual(await readdir(parent), ['smoji.zsh.moe'], 'Publication stays inside the site directory')
  await writeFile(join(live, 'assets/previous-hash.js'), 'export const previous = true')
  run(`${sha}-2-0`)
  assert.equal(await readFile(join(live, 'assets/previous-hash.js'), 'utf8'), 'export const previous = true', 'Old chunk URLs must survive activation')
  const second = await readlink(live)
  assert.notEqual(first, second)
  assert.equal(await readFile(join(live, 'index.html'), 'utf8'), await readFile('apps/workbench/dist/index.html', 'utf8'))
  assert((await readFile(join(site, first, 'index.html'))).length > 0, 'Keep previous release')
  run(`${sha}-1-1`)
  assert.equal(await readlink(live), second, 'A stale pipeline must not replace the current site')
  run(`${sha}-2-1`)
  const rerun = await readlink(live)
  assert.equal(rerun, `releases/${sha}-2-1`, 'A newer rerun can activate')
  assert.throws(() => run('../unsafe'))
  await mkdir(join(parent, 'empty'))
  assert.throws(() => run(`${sha}-3-0`, join(parent, 'empty')))
  assert.equal(await readlink(live), rerun, 'Invalid output must leave the live site unchanged')
  for (const name of [`.build-${sha}-5-0`, `${sha}-5-0`]) {
    const reserved = join(site, 'releases', name)
    await mkdir(reserved)
    await writeFile(join(reserved, 'owned-by-another-run'), 'keep')
    assert.throws(() => run(`${sha}-5-0`))
    assert.equal(await readFile(join(reserved, 'owned-by-another-run'), 'utf8'), 'keep')
    await rm(reserved, { recursive: true })
  }
  const damaged = join(parent, 'damaged')
  await cp('apps/workbench/dist', damaged, { recursive: true })
  const chunks = JSON.parse(await readFile(join(damaged, '.vite/manifest.json'), 'utf8'))
  const alias = Object.values(chunks).find((chunk) => chunk.file.includes('published-aliases'))
  assert(alias, 'Expected aliases dynamic chunk')
  await rm(join(damaged, alias.file))
  assert.throws(() => run(`${sha}-6-0`, damaged), 'Missing dynamic chunk must block publication')
  assert.equal(await readlink(live), rerun)
  const legacy = join(parent, 'legacy')
  await symlink(join(site, rerun), legacy)
  assert.throws(() => run(`${sha}-7-0`, undefined, legacy), 'Reject a legacy site symlink')
  assert.throws(() => run(`${sha}-7-0`, undefined, join(site, rerun)), 'Reject the resolved legacy Docker mount')
  assert.equal(await readlink(legacy), join(site, rerun))
  await assert.rejects(readFile(join(site, rerun, '.deploy.lock')), { code: 'ENOENT' })
  await rm(live)
  await mkdir(live)
  await writeFile(join(live, 'existing.txt'), 'keep')
  assert.throws(() => run(`${sha}-4-0`))
  assert.equal(await readFile(join(live, 'existing.txt'), 'utf8'), 'keep', 'Never replace an existing real directory')
  console.log('Publish checks passed: isolated layout, activate, upgrade, rerun, stale pipeline, legacy mounts and invalid output')
} finally {
  await rm(parent, { recursive: true, force: true })
}
