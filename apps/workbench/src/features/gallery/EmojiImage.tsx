import { useCallback, useEffect, useRef, useState } from 'react'
import { ImageOff, RotateCw } from 'lucide-react'
import { loadImage } from '../../images'

type ImageStatus = 'loading' | 'loaded' | 'error'

interface EmojiImageProps {
  src: string
  alt: string
  /** Sizing/layout classes for the wrapper; the wrapper owns the box. */
  className?: string
  imgClassName?: string
  /** Show an explicit retry control (only where it does not nest inside another button). */
  retryable?: boolean
}

/**
 * Decoded-reveal image with perceptible loading/error states. Uses the shared `loadImage` helper so
 * a slow request never paints over the next one, and failure is distinguishable from a transparent emoji.
 */
export function EmojiImage({ src, alt, className, imgClassName, retryable = false }: EmojiImageProps) {
  const ref = useRef<HTMLImageElement | null>(null)
  const attempt = useRef(0)
  const [status, setStatus] = useState<ImageStatus>('loading')

  const load = useCallback(() => {
    const image = ref.current
    if (!image) return
    const current = ++attempt.current
    setStatus('loading')
    loadImage(image, src, {
      load: () => {
        if (current === attempt.current) setStatus('loaded')
      },
      error: () => {
        if (current === attempt.current) setStatus('error')
      },
    })
  }, [src])

  useEffect(() => {
    load()
    return () => {
      attempt.current++
    }
  }, [load])

  return (
    <span className={`relative flex items-center justify-center ${className ?? ''}`} data-image-status={status}>
      <img
        ref={ref}
        alt={alt}
        className={`image-reveal ${imgClassName ?? ''} ${status === 'loaded' ? 'is-loaded' : ''}`}
      />

      {status === 'loading' && (
        <span
          className="pointer-events-none absolute inset-0 animate-pulse rounded bg-muted/60"
          data-image-placeholder="loading"
          aria-hidden="true"
        />
      )}

      {status === 'error' && (
        <span
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded bg-muted/70 text-[10px] text-muted-foreground"
          data-image-placeholder="error"
        >
          <ImageOff className="h-4 w-4" aria-hidden="true" />
          {retryable ? <span>加载失败</span> : <span className="sr-only">{alt} 加载失败</span>}
        </span>
      )}

      {status === 'error' && retryable && (
        <button
          type="button"
          className="absolute inset-0 flex items-center justify-center rounded "
          onClick={load}
          aria-label={`重试加载 ${alt}`}
        >
          <RotateCw className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
