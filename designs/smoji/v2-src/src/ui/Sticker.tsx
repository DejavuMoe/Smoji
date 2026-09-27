import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ImageOff, RotateCw } from 'lucide-react'
import { decodeImage, loadStill, peekStill, previewUrl, whenNearViewport, type Still } from '../lib/stills'

type Status = 'loading' | 'ready' | 'error'

interface StickerProps {
  src: string
  alt: string
  className?: string
  /** `still` shows a static frame (grids, lists); `live` shows the animated original (inspector). */
  mode?: 'still' | 'live'
  /** Still mode only: overlay the animated original while true (hover / keyboard focus). */
  play?: boolean
  eager?: boolean
  /** Only where the sticker is not already inside another button. */
  retryable?: boolean
}

function paint(canvas: HTMLCanvasElement, bitmap: ImageBitmap) {
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
}

/**
 * Loads only near the viewport, always reveals through the same blur-to-sharp animation,
 * and keeps failure distinguishable from a transparent emoji.
 */
export function Sticker({ src, alt, className = '', mode = 'still', play = false, eager = false, retryable = false }: StickerProps) {
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const placeholderRef = useRef<HTMLCanvasElement | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [still, setStill] = useState<Still | null>(null)
  const [liveReady, setLiveReady] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const live = mode === 'live'

  // A blurred still is the inspector's placeholder whenever one is already known.
  const [placeholder, setPlaceholder] = useState<Still | null>(null)

  useEffect(() => {
    setStatus('loading')
    setStill(null)
    setPlaceholder(null)
    let cancelled = false
    const start = () => {
      if (live) {
        const preview = previewUrl(src)
        if (preview) setPlaceholder({ url: preview })
        else peekStill(src)?.then((value) => { if (!cancelled) setPlaceholder(value) }, () => {})
        decodeImage(src).then(() => { if (!cancelled) setStatus('ready') }, () => { if (!cancelled) setStatus('error') })
        return
      }
      loadStill(src).then((value) => { if (!cancelled) { setStill(value); setStatus('ready') } },
        () => { if (!cancelled) setStatus('error') })
    }
    const root = rootRef.current
    if (eager || !root) { start(); return () => { cancelled = true } }
    const stop = whenNearViewport(root, start)
    return () => { cancelled = true; stop() }
  }, [src, live, eager, attempt])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !still?.bitmap) return
    try { paint(canvas, still.bitmap) } catch { setAttempt((value) => value + 1) }
  }, [still])

  useLayoutEffect(() => {
    const canvas = placeholderRef.current
    if (!canvas || !placeholder?.bitmap) return
    try { paint(canvas, placeholder.bitmap) } catch { /* evicted: the plain blur placeholder is enough */ }
  }, [placeholder, status])

  const playing = !live && play && status === 'ready'
  useEffect(() => { if (!playing) setLiveReady(false) }, [playing])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  return (
    <span ref={rootRef} className={`sticker ${className}`} data-image-status={status} data-playing={(playing && liveReady) || undefined}>
      {status !== 'ready' && (
        placeholder?.url
          ? <img className="sticker__ph sticker__ph--image" src={placeholder.url} alt="" aria-hidden="true" />
          : placeholder?.bitmap
            ? <canvas ref={placeholderRef} className="sticker__ph sticker__ph--image" aria-hidden="true" />
            : <span className="sticker__ph" aria-hidden="true" />
      )}
      {status === 'ready' && (live
        ? <img className="sticker__media" src={src} alt={alt} draggable={false} referrerPolicy="no-referrer" />
        : still?.url
          ? <img className="sticker__media" src={still.url} alt={alt} draggable={false} />
          : <canvas ref={canvasRef} className="sticker__media" role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} />)}
      {playing && (
        <img className="sticker__live" src={src} alt="" aria-hidden="true" draggable={false} referrerPolicy="no-referrer"
          onLoad={() => setLiveReady(true)} />
      )}
      {status === 'error' && (
        <span className="sticker__error">
          <ImageOff aria-hidden="true" />
          {retryable ? <span>加载失败</span> : <span className="sr-only">{alt} 加载失败</span>}
        </span>
      )}
      {status === 'error' && retryable && (
        <button type="button" className="sticker__retry" onClick={retry} aria-label={`重试加载 ${alt}`}>
          <RotateCw aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
