import { mkdtemp, mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, it } from 'vitest'

it('rescans conversions, moves and deletions while preserving stable IDs and labels', async () => {
  const root = await mkdtemp(join(tmpdir(), 'smoji-generator-'))
  const run = () => execFileSync(process.execPath, ['--experimental-strip-types', resolve('scripts/generate-packs.mjs'), root], { stdio: 'pipe' })
  const read = async (path: string) => JSON.parse(await readFile(join(root, path), 'utf8'))
  try {
    await mkdir(join(root, 'data'))
    await mkdir(join(root, 'packs/new-pack'), { recursive: true })
    await mkdir(join(root, 'packs/old-pack'))
    await writeFile(join(root, 'data/packs.json'), JSON.stringify([{ id: 'old-pack', label: '旧分类', items: [
      { file: 'abcdefghijkl.png', label: '挥手' }, { file: 'bbbbbbbbbbbb.png', label: '已删除' },
    ] }]))
    await writeFile(join(root, 'data/published-aliases.json'), JSON.stringify({ 'old/wave.png': 'old-pack/abcdefghijkl.png', 'old/deleted.png': 'old-pack/bbbbbbbbbbbb.png' }))
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
    await writeFile(join(root, 'packs/new-pack/abcdefghijkl.gif'), gif)
    await writeFile(join(root, 'packs/new-pack/picforge-manifest.json'), '{"app":"PicForge"}')
    run()
    expect(await read('data/previews.json')).toEqual({})
    await writeFile(join(root, 'data/previews.json'), '{"keep":true}')
    run()
    expect(await read('data/previews.json')).toEqual({ keep: true })
    expect((await read('data/smoji.json')).packs[0].items).toEqual([{ id: 'abcdefghijkl', label: '挥手', src: './new-pack/abcdefghijkl.gif' }])
    expect(await read('data/published-aliases.json')).toEqual({ 'old/wave.png': 'new-pack/abcdefghijkl.gif', 'old-pack/abcdefghijkl.png': 'new-pack/abcdefghijkl.gif' })
    expect(await read('packs/new-pack/picforge-manifest.json')).toEqual({ app: 'PicForge' })
    expect((await read('data/assets.json'))['new-pack/abcdefghijkl.gif'].bytes).toBe(gif.length)
    await rename(join(root, 'packs/new-pack'), join(root, 'packs/moved'))
    await mkdir(join(root, 'packs/new-pack'))
    run()
    expect((await read('data/published-aliases.json'))['old/wave.png']).toBe('moved/abcdefghijkl.gif')
    await writeFile(join(root, 'packs/moved/zzzzzzzzzzzz.gif'), gif)
    await writeFile(join(root, 'data/packs.json'), JSON.stringify([{ id: 'moved', label: '已整理', items: [
      { file: 'zzzzzzzzzzzz.gif', label: '第二张', series: '系列一' },
      { file: 'abcdefghijkl.gif', label: '挥手', series: '系列二' },
    ] }]))
    run()
    expect((await read('data/smoji.json')).packs[0].items.map((i: { id: string }) => i.id)).toEqual(['zzzzzzzzzzzz', 'abcdefghijkl'])
    expect((await read('data/packs.json'))[0].items[0].series).toBe('系列一')
    expect((await read('data/smoji.json')).packs[0].items[0]).not.toHaveProperty('series')
    const before = await readFile(join(root, 'data/smoji.json'), 'utf8')
    run()
    expect(await readFile(join(root, 'data/smoji.json'), 'utf8')).toBe(before)
    await rm(join(root, 'packs'), { recursive: true })
    run()
    expect(await readFile(join(root, 'data/smoji.json'), 'utf8')).toBe(before)
    await mkdir(join(root, 'packs/another'), { recursive: true })
    await writeFile(join(root, 'packs/another/bbbbbbbbbbbb.gif'), gif)
    run()
    expect((await read('data/packs.json')).map((pack: { id: string }) => pack.id)).toEqual(['another', 'moved'])
    await rm(join(root, 'packs/another'), { recursive: true })
    await mkdir(join(root, 'packs/another'))
    run()
    expect(await readFile(join(root, 'data/smoji.json'), 'utf8')).toBe(before)
    await mkdir(join(root, 'packs/moved'), { recursive: true })
    await writeFile(join(root, 'packs/moved/abcdefghijkl.gif'), gif)
    // A stable ID cannot ambiguously refer to two formats in the same pack.
    await writeFile(join(root, 'packs/moved/abcdefghijkl.png'), gif)
    expect(run).toThrow()
    expect(await readFile(join(root, 'data/smoji.json'), 'utf8')).toBe(before)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('adds numbered WebP files while retaining published packs and rejects invalid names atomically', async () => {
  const root = await mkdtemp(join(tmpdir(), 'smoji-generator-numbered-'))
  const run = () => execFileSync(process.execPath, ['--experimental-strip-types', resolve('scripts/generate-packs.mjs'), root], { stdio: 'pipe' })
  const read = async (path: string) => JSON.parse(await readFile(join(root, path), 'utf8'))
  try {
    await mkdir(join(root, 'data'))
    await mkdir(join(root, 'packs/deepseek-wale-girl'), { recursive: true })
    const old = { id: 'old-pack', label: '旧分类', items: [{ file: 'abcdefghijkl.webp', label: '保留', series: '旧系列' }] }
    const oldAsset = { 'old-pack/abcdefghijkl.webp': { sha256: 'a'.repeat(64), bytes: 42, preview: false } }
    await writeFile(join(root, 'data/packs.json'), JSON.stringify([old, {
      id: 'deepseek-wale-girl', label: '大肥鱼', items: [{ file: '001_hehe.webp', label: '嘿嘿', series: '大肥鱼' }],
    }]))
    await writeFile(join(root, 'data/assets.json'), JSON.stringify(oldAsset))
    await writeFile(join(root, 'data/published-aliases.json'), '{}')
    await writeFile(join(root, 'packs/deepseek-wale-girl/001_hehe.webp'), Buffer.from('RIFF....WEBP'))
    run()
    expect((await read('data/packs.json')).map((pack: { id: string }) => pack.id)).toEqual(['deepseek-wale-girl', 'old-pack'])
    expect((await read('data/packs.json'))[0].items[0]).toEqual({ file: '001_hehe.webp', label: '嘿嘿', series: '大肥鱼' })
    expect((await read('data/assets.json'))['old-pack/abcdefghijkl.webp']).toEqual(oldAsset['old-pack/abcdefghijkl.webp'])
    expect((await read('data/smoji.json')).packs[0].items[0]).toEqual({ id: '001_hehe', label: '嘿嘿', src: './deepseek-wale-girl/001_hehe.webp' })
    const before = await readFile(join(root, 'data/smoji.json'), 'utf8')
    await writeFile(join(root, 'packs/deepseek-wale-girl/bad_name.webp'), Buffer.from('RIFF....WEBP'))
    expect(run).toThrow()
    expect(await readFile(join(root, 'data/smoji.json'), 'utf8')).toBe(before)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
