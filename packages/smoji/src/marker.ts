import type { SmojiItem } from './types'
import { isValidSmojiLabel, resolveSmojiImageUrl, SmojiManifestError } from './validate'

const MARKER_PATTERN = /!\[smoji:([^\]\r\n]+)\]\((https?:\/\/[^()\s]+)\)/g

function assertMarkerItem(item: SmojiItem): void {
  if (
    typeof item.id !== 'string'
    || typeof item.label !== 'string'
    || typeof item.src !== 'string'
    || !isValidSmojiLabel(item.label)
  ) {
    throw new SmojiManifestError('invalid-item')
  }
  // Re-validate absolute same-origin-safe image URL shape against itself.
  resolveSmojiImageUrl(item.src, item.src)
}

/** Build Ecoku-compatible marker text from a loader-normalized item. */
export function smojiMarker(item: SmojiItem): string {
  assertMarkerItem(item)
  return `![smoji:${item.label}](${item.src})`
}

/**
 * Safely render textarea/comment content: plain text always becomes text nodes;
 * only same-origin Smoji markers become `<img>` elements. Never uses innerHTML.
 */
export function renderSmojiContent(
  target: HTMLElement,
  content: string,
  manifestUrl: string,
): void {
  target.replaceChildren()
  let origin: string
  try {
    origin = new URL(manifestUrl).origin
  } catch {
    target.append(document.createTextNode(content))
    return
  }

  let cursor = 0
  for (const match of content.matchAll(MARKER_PATTERN)) {
    if (match.index === undefined) continue
    target.append(document.createTextNode(content.slice(cursor, match.index)))
    try {
      const source = new URL(match[2]!)
      if (source.origin !== origin) throw new Error('cross-origin')
      if (source.username || source.password || source.search || source.hash) {
        throw new Error('unsafe-url')
      }
      const image = document.createElement('img')
      image.className = 'smoji-inline'
      image.src = source.href
      image.alt = `[表情：${match[1]}]`
      image.loading = 'lazy'
      image.decoding = 'async'
      image.referrerPolicy = 'no-referrer'
      target.append(image)
    } catch {
      target.append(document.createTextNode(match[0]))
    }
    cursor = match.index + match[0].length
  }
  target.append(document.createTextNode(content.slice(cursor)))
}
