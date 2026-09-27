/** Send a copy of a sticker to where it landed, so adding to a group or the export list is visible. */
export function flyTo(source: Element | null | undefined, targetSelector: string): void {
  if (!source || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const target = Array.from(document.querySelectorAll<HTMLElement>(targetSelector))
    .find((element) => element.getClientRects().length > 0)
  const media = source.matches('img, canvas') ? source as HTMLElement : source.querySelector<HTMLElement>('.sticker__media')
  if (!target || !media) return
  if (media instanceof HTMLImageElement && (!media.complete || !media.naturalWidth)) return

  const from = media.getBoundingClientRect()
  const to = target.getBoundingClientRect()
  if (!from.width || !to.width) return
  const size = Math.min(from.width, 72)
  let ghost: HTMLElement
  if (media instanceof HTMLCanvasElement) {
    // Stills are canvases: copy the painted frame rather than the element.
    const copy = document.createElement('canvas')
    copy.width = media.width
    copy.height = media.height
    copy.getContext('2d')?.drawImage(media, 0, 0)
    ghost = copy
  } else {
    ghost = media.cloneNode() as HTMLImageElement
    ;(ghost as HTMLImageElement).alt = ''
  }
  ghost.removeAttribute('id')
  ghost.removeAttribute('aria-label')
  ghost.setAttribute('aria-hidden', 'true')
  ghost.className = 'fly-ghost'
  Object.assign(ghost.style, {
    left: `${from.left + (from.width - size) / 2}px`,
    top: `${from.top + (from.height - size) / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
  })
  document.body.append(ghost)

  const dx = to.left + Math.min(to.width, 56) / 2 - (from.left + from.width / 2)
  const dy = to.top + Math.min(to.height, 56) / 2 - (from.top + from.height / 2)
  const lift = Math.min(120, Math.abs(dx) * 0.25 + 40)
  const flight = ghost.animate([
    { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) scale(0.8) rotate(-8deg)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.32) rotate(4deg)`, opacity: 0.2 },
  ], { duration: 520, easing: 'cubic-bezier(.3,.7,.25,1)' })
  flight.onfinish = flight.oncancel = () => {
    ghost.remove()
    target.animate([
      { transform: 'scale(1)' }, { transform: 'scale(1.035)' }, { transform: 'scale(1)' },
    ], { duration: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' })
  }
}
