import { createServer } from 'node:http'
import { once } from 'node:events'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, readFile, writeFile, stat, utimes, rm } from 'node:fs/promises'
import { execFile, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, it } from 'vitest'

it('generates visible previews locally or from verified remote originals, and rejects corrupt downloads', async () => {
  const root = await mkdtemp(join(tmpdir(), 'smoji-previews-'))
  // Transparent first frame, then a red square on a transparent canvas.
  const gif = Buffer.from('R0lGODlhCAAIAPAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQBCgAAACwAAAAACAAIAAACB4SPqcvtXQAAIfkEAQoAAAAsAAAAAAgACACAAAAA/wAAAgyEj3nBge1We1NZVAAAOw==', 'base64')
  const src = 'sample/abcdefghijkl.gif'
  const run = () => promisify(execFile)(process.execPath, [resolve('scripts/generate-previews.mjs'), root])
  let corrupt = false
  let requests = 0
  const server = createServer((_req, res) => { requests++; res.end(corrupt ? 'invalid image' : gif) })
  try {
    await mkdir(join(root, 'data'))
    await mkdir(join(root, 'packs/sample'), { recursive: true })
    await writeFile(join(root, 'packs', src), gif)
    await writeFile(join(root, 'data/assets.json'), JSON.stringify({ [src]: {
      bytes: gif.length, sha256: createHash('sha256').update(gif).digest('hex'),
    } }))
    await run()
    const index = JSON.parse(await readFile(join(root, 'data/previews.json'), 'utf8'))
    expect(index[src]).toMatchObject({ animated: true, bytes: gif.length })
    const output = join(root, 'demo/public', index[src].src)
    const thumbnail = await readFile(output)
    expect(thumbnail.toString('ascii', 8, 12)).toBe('WEBP')
    expect(thumbnail.includes(Buffer.from('ANIM'))).toBe(false)
    expect(Number(execFileSync('magick', [output, '-alpha', 'extract', '-format', '%[fx:mean]', 'info:'], { encoding: 'utf8' })))
      .toBeGreaterThan(0.2)
    await utimes(output, 0, 0)
    await run()
    expect((await stat(output)).mtimeMs).toBeGreaterThan(0)
    expect(await readFile(join(root, 'packs', src))).toEqual(gif)
    await rm(join(root, 'packs'), { recursive: true })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address() as { port: number }
    await writeFile(join(root, 'data/hosting.json'), JSON.stringify({ assetBaseUrl: `http://127.0.0.1:${address.port}/` }))
    await run()
    expect(requests).toBe(1)
    expect(await readFile(output)).toEqual(thumbnail)
    await run()
    expect(requests).toBe(2)
    corrupt = true
    await expect(run()).rejects.toThrow(/Asset integrity mismatch/)
    expect(JSON.parse(await readFile(join(root, 'data/previews.json'), 'utf8'))).toEqual(index)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await rm(root, { recursive: true, force: true })
  }
})
