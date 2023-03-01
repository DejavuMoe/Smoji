import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadSmojiManifest, parseSmojiManifest, SmojiManifestError } from '../src/manifest'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...init.headers },
    ...init,
  })
}

describe('smoji manifest loader', () => {
  it.each(['timeout', 'caller'])('aborts a pending response body on %s', async (reason) => {
    vi.useFakeTimers()
    let bodyStarted = false
    vi.stubGlobal('fetch', vi.fn(async (_url, init: RequestInit) => ({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: () => new Promise<string>((_resolve, reject) => {
        bodyStarted = true
        init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      }),
    })))
    const controller = new AbortController()
    const pending = loadSmojiManifest('https://static.example.test/smoji.json', { signal: controller.signal })
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(0)
    expect(bodyStarted).toBe(true)
    if (reason === 'caller') controller.abort()
    else await vi.advanceTimersByTimeAsync(8000)
    await rejected
    expect(vi.getTimerCount()).toBe(0)
  })

  it('normalizes same-origin relative item URLs', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      version: 1,
      packs: [{ id: 'demo', label: '示例', items: [{ id: 'wave', label: '挥手', src: './packs/wave.webp' }] }],
    }))
    vi.stubGlobal('fetch', fetchMock)
    const manifest = await loadSmojiManifest('https://static.example.test/smoji.json')
    expect(manifest.packs[0]!.items[0]!.src).toBe('https://static.example.test/packs/wave.webp')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://static.example.test/smoji.json',
      expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer' }),
    )
  })

  it('rejects cross-origin images', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      version: 1,
      packs: [{ id: 'demo', label: '示例', items: [{ id: 'bad', label: '坏', src: 'https://tracker.example/bad.webp' }] }],
    })))
    await expect(loadSmojiManifest('https://static.example.test/smoji.json'))
      .rejects.toThrow(SmojiManifestError)
  })

  it('rejects credentials, query, and fragment in image URLs', async () => {
    for (const src of [
      'https://user:pass@static.example.test/x.webp',
      './x.webp?x=1',
      './x.webp#frag',
    ]) {
      expect(() => parseSmojiManifest({
        version: 1,
        packs: [{ id: 'demo', label: '示例', items: [{ id: 'x', label: '图', src }] }],
      }, 'https://static.example.test/smoji.json')).toThrow(SmojiManifestError)
    }
  })

  it('rejects unknown fields', () => {
    expect(() => parseSmojiManifest({
      version: 1,
      packs: [{ id: 'demo', label: '示例', style: 'display:none', items: [{ id: 'wave', label: '挥手', src: './wave.webp' }] }],
    }, 'https://static.example.test/smoji.json')).toThrow(SmojiManifestError)

    expect(() => parseSmojiManifest({
      version: 1,
      extra: true,
      packs: [{ id: 'demo', label: '示例', items: [{ id: 'wave', label: '挥手', src: './wave.webp' }] }],
    }, 'https://static.example.test/smoji.json')).toThrow(SmojiManifestError)
  })

  it('rejects duplicate IDs, count limits, and document size', async () => {
    expect(() => parseSmojiManifest({
      version: 1,
      packs: [
        { id: 'a', label: 'A', items: [{ id: 'x', label: '一', src: './a.webp' }] },
        { id: 'a', label: 'B', items: [{ id: 'y', label: '二', src: './b.webp' }] },
      ],
    }, 'https://static.example.test/smoji.json')).toThrow(SmojiManifestError)

    expect(() => parseSmojiManifest({
      version: 1,
      packs: [{
        id: 'a',
        label: 'A',
        items: [
          { id: 'x', label: '一', src: './a.webp' },
          { id: 'x', label: '二', src: './b.webp' },
        ],
      }],
    }, 'https://static.example.test/smoji.json')).toThrow(SmojiManifestError)

    const tooManyPacks = {
      version: 1 as const,
      packs: Array.from({ length: 65 }, (_, i) => ({
        id: `p${i}`,
        label: `P${i}`,
        items: [{ id: 'x', label: '一', src: './x.webp' }],
      })),
    }
    expect(() => parseSmojiManifest(tooManyPacks, 'https://static.example.test/smoji.json'))
      .toThrow(SmojiManifestError)

    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('{"version":1,"packs":[]}', {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'content-length': String(1024 * 1024 + 1),
      },
    })))
    await expect(loadSmojiManifest('https://static.example.test/smoji.json'))
      .rejects.toThrow('manifest-too-large')
  })

  it('enforces Unicode label code point limits and forbidden characters', () => {
    const over = '啊'.repeat(41)
    expect(() => parseSmojiManifest({
      version: 1,
      packs: [{ id: 'a', label: over, items: [{ id: 'x', label: '一', src: './x.webp' }] }],
    }, 'https://static.example.test/smoji.json')).toThrow(SmojiManifestError)

    expect(() => parseSmojiManifest({
      version: 1,
      packs: [{ id: 'a', label: '好]', items: [{ id: 'x', label: '一', src: './x.webp' }] }],
    }, 'https://static.example.test/smoji.json')).toThrow(SmojiManifestError)

    expect(() => parseSmojiManifest({
      version: 1,
      packs: [{ id: 'a', label: '好\n', items: [{ id: 'x', label: '一', src: './x.webp' }] }],
    }, 'https://static.example.test/smoji.json')).toThrow(SmojiManifestError)

    expect(() => parseSmojiManifest({
      version: 1,
      packs: [{ id: 'a', label: '好\u0001', items: [{ id: 'x', label: '一', src: './x.webp' }] }],
    }, 'https://static.example.test/smoji.json')).toThrow(SmojiManifestError)
  })

  it('rejects non-JSON content types', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('{"version":1,"packs":[]}', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    })))
    await expect(loadSmojiManifest('https://static.example.test/smoji.json'))
      .rejects.toThrow(SmojiManifestError)
  })
})

describe('generated data/smoji.json', () => {
  it('passes the runtime validator after generation', async () => {
    const text = await readFile(resolve('data/smoji.json'), 'utf8')
    const manifest = parseSmojiManifest(JSON.parse(text), 'https://static.example.test/smoji.json')
    expect(manifest.version).toBe(1)
    expect(manifest.packs.length).toBeGreaterThan(0)
    expect(manifest.packs.every((pack) => pack.items.length > 0)).toBe(true)
    expect(text).not.toMatch(/schemaVersion|"type"\s*:\s*"image"|"keywords"|"catalog"/)
  })
})
