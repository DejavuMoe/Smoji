import hosting from '../../../data/hosting.json'
import previews from '../../../data/previews.json'

type Preview = { src: string; bytes: number; animated: boolean }
const index: Record<string, Preview> = previews

export function imagePreview(src: string): Preview | undefined {
  try {
    const base = new URL(import.meta.env.BASE_URL, window.location.href)
    const url = new URL(src, base)
    const assetBase = new URL(hosting.assetBaseUrl)
    const sourceBase = url.origin === assetBase.origin ? assetBase : base
    if (url.origin !== sourceBase.origin || !url.pathname.startsWith(sourceBase.pathname) || url.search || url.hash || url.username || url.password) return
    const path = decodeURIComponent(url.pathname.slice(sourceBase.pathname.length))
    const preview = Object.prototype.hasOwnProperty.call(index, path) ? index[path] : undefined
    return preview && { ...preview, src: new URL(preview.src, base).href }
  } catch {
    return undefined
  }
}

export function thumbnailSrc(src: string): string {
  return imagePreview(src)?.src ?? src
}

/** Reveal decoded pixels, and ignore a previous request after navigating or closing a preview. */
export function loadImage(
  image: HTMLImageElement,
  src: string,
  callbacks: { load?: () => void; error?: () => void } = {},
): void {
  image.classList.add('image-reveal')
  image.classList.remove('is-loaded', 'is-broken')
  image.decoding = 'async'
  image.referrerPolicy = 'no-referrer'
  const current = () => image.onload === ready && image.getAttribute('src') === src
  const failed = () => {
    if (!current()) return
    image.classList.add('is-broken')
    callbacks.error?.()
  }
  const ready = async () => {
    try {
      await image.decode()
      if (!current()) return
      image.classList.add('is-loaded')
      callbacks.load?.()
    } catch {
      failed()
    }
  }
  image.onload = ready
  image.onerror = failed
  image.src = src
  if (image.complete && image.naturalWidth > 0) void ready()
}
