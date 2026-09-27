import { imagePreview } from '@wb/images'

/*
 * Grid-sized stills. Published builds ship CI previews (the clearest frame of every animated
 * sticker); without one, the original is decoded once, its first frame is kept as a small bitmap
 * and the animated image is released, so a pack full of animations never plays in the grid.
 */
const STILL_SIZE = 192
const CONCURRENCY = 6
const CACHE_LIMIT = 360

type Task = () => void
const waiting: Task[] = []
let active = 0

function schedule<T>(job: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      active++
      job().then(resolve, reject).finally(() => {
        active--
        waiting.shift()?.()
      })
    }
    if (active < CONCURRENCY) run()
    else waiting.push(run)
  })
}

export function decodeImage(src: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.decoding = 'async'
  image.referrerPolicy = 'no-referrer'
  image.src = src
  return image.decode().then(() => image)
}

export interface Still {
  /** A ready bitmap to paint, or a small static URL that needs no freezing. */
  readonly bitmap?: ImageBitmap
  readonly url?: string
}

const cache = new Map<string, Promise<Still>>()

/** A still that is already cached (e.g. from the grid), without starting a new load. */
export function peekStill(src: string): Promise<Still> | undefined {
  return cache.get(src)
}

export function previewUrl(src: string): string | undefined {
  return imagePreview(src)?.src
}

export function loadStill(src: string): Promise<Still> {
  const hit = cache.get(src)
  if (hit) {
    cache.delete(src)
    cache.set(src, hit)
    return hit
  }
  const preview = previewUrl(src)
  const task = schedule(async (): Promise<Still> => {
    if (preview) {
      await decodeImage(preview)
      return { url: preview }
    }
    const image = await decodeImage(src)
    const scale = Math.min(1, STILL_SIZE / Math.max(image.naturalWidth, image.naturalHeight))
    const bitmap = await createImageBitmap(image, {
      resizeWidth: Math.max(1, Math.round(image.naturalWidth * scale)),
      resizeHeight: Math.max(1, Math.round(image.naturalHeight * scale)),
      resizeQuality: 'high',
    })
    image.src = ''
    return { bitmap }
  })
  task.catch(() => cache.delete(src))
  cache.set(src, task)
  while (cache.size > CACHE_LIMIT) {
    const [oldest, entry] = cache.entries().next().value as [string, Promise<Still>]
    cache.delete(oldest)
    void entry.then((still) => still.bitmap?.close(), () => {})
  }
  return task
}

/** One shared observer: stickers start loading only when they come near the viewport. */
const watchers = new Map<Element, () => void>()
let observer: IntersectionObserver | null = null

export function whenNearViewport(element: Element, callback: () => void): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    callback()
    return () => {}
  }
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      const run = watchers.get(entry.target)
      watchers.delete(entry.target)
      observer?.unobserve(entry.target)
      run?.()
    }
  }, { rootMargin: '240px' })
  watchers.set(element, callback)
  observer.observe(element)
  return () => {
    watchers.delete(element)
    observer?.unobserve(element)
  }
}
