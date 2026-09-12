import type { LoadSmojiOptions, SmojiManifest } from './types'
import {
  assertManifestSize,
  parseSmojiManifest,
  SMOJI_MANIFEST_MAX_BYTES,
  SmojiManifestError,
} from './validate'

export {
  assertManifestSize,
  parseSmojiManifest,
  SMOJI_ID_PATTERN,
  SMOJI_MANIFEST_MAX_BYTES,
  SMOJI_MAX_ITEMS,
  SMOJI_MAX_ITEMS_PER_PACK,
  SMOJI_MAX_PACKS,
  SmojiManifestError,
} from './validate'

const DEFAULT_TIMEOUT_MS = 8_000

function isJsonContentType(value: string | null): boolean {
  if (!value) return false
  const media = value.split(';', 1)[0]!.trim().toLowerCase()
  return media === 'application/json' || media.endsWith('+json')
}

export async function loadSmojiManifest(
  manifestUrl: string,
  options: LoadSmojiOptions = {},
): Promise<SmojiManifest> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const onAbort = (): void => controller.abort()
  if (options.signal?.aborted) controller.abort()
  else options.signal?.addEventListener('abort', onAbort, { once: true })

  try {
    const response = await fetch(manifestUrl, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    })

    if (!response.ok) throw new SmojiManifestError('manifest-request-failed')
    if (!isJsonContentType(response.headers.get('content-type'))) {
      throw new SmojiManifestError('invalid-manifest')
    }

    const declaredLength = Number(response.headers.get('content-length') || 0)
    if (declaredLength > SMOJI_MANIFEST_MAX_BYTES) {
      throw new SmojiManifestError('manifest-too-large')
    }

    let text = ''
    if (response.body) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let bytes = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          bytes += value.byteLength
          if (bytes > SMOJI_MANIFEST_MAX_BYTES) {
            controller.abort()
            throw new SmojiManifestError('manifest-too-large')
          }
          text += decoder.decode(value, { stream: true })
        }
        text += decoder.decode()
      } finally {
        reader.releaseLock()
      }
    } else {
      text = await response.text()
    }
    assertManifestSize(text)

    let value: unknown
    try {
      value = JSON.parse(text) as unknown
    } catch {
      throw new SmojiManifestError('invalid-manifest')
    }

    return parseSmojiManifest(value, manifestUrl)
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', onAbort)
  }
}
