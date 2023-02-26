import type { InsertTarget, SmojiItem, SmojiOptions, SmojiPack, SmojiPicker } from './types'

export function createSmoji(opts: SmojiOptions): SmojiPicker {
  const { trigger, target, packs, root = document.body, closeOnSelect = true, onSelect } = opts
  if (!(trigger instanceof HTMLElement && typeof target?.insert === 'function' && Array.isArray(packs) && packs.length)) {
    throw new TypeError('Invalid options')
  }

  const D = document, ac = new AbortController()
  const ce = (t: string, c?: string) => Object.assign(D.createElement(t), c ? { className: c } : 0)
  const sa = (e: Element, a: string, b: any, c?: string, d?: any) => { e.setAttribute(a, b); if (c) e.setAttribute(c, d) }
  const on = (t: any, ev: string, fn: any, p?: boolean) => t?.addEventListener(ev, fn, { signal: ac.signal, passive: p })

  const R = 'role', G = 'smoji-grid', AL = 'aria-label', TAB = 'tab'
  const pan = ce('div', 'smoji'), tabs = ce('div', 'smoji__tabs'), grid = ce('div', 'smoji__grid')
  pan.hidden = true
  sa(pan, R, 'dialog', AL, 'Smoji')
  sa(tabs, R, 'tablist', AL, '表情包分类')
  grid.id = G
  sa(grid, R, 'tabpanel')

  packs.forEach((p, i) => {
    const b = Object.assign(ce('button', 'smoji__tab'), { type: 'button', textContent: p.label, id: 'smoji-tab-' + i })
    b.dataset.packIndex = i as any
    sa(b, R, TAB, 'aria-controls', G)
    tabs.append(b)
  })
  pan.append(tabs, grid)
  root.append(pan)
  sa(trigger, 'aria-expanded', false)

  let active = 0, open = false, dead = false

  const paint = () => {
    grid.replaceChildren(...packs[active]!.items.map((it: SmojiItem, i: number) => {
      const b = Object.assign(ce('button', 'smoji__item'), { type: 'button', ariaLabel: it.label })
      b.dataset.itemIndex = i as any
      b.append(Object.assign(D.createElement('img'), {
        src: it.src, alt: '', loading: 'lazy', decoding: 'async', referrerPolicy: 'no-referrer'
      }))
      return b
    }))
    sa(grid, 'aria-labelledby', 'smoji-tab-' + active)
    for (let i = 0; i < tabs.children.length; i++) {
      const tab = tabs.children[i] as HTMLElement
      sa(tab, 'aria-selected', i === active)
      tab.tabIndex = i === active ? 0 : -1
    }
  }

  const pos = () => {
    if (!dead && open) {
      const r = trigger.getBoundingClientRect(), s = pan.getBoundingClientRect(), v = window.visualViewport
      const x = v?.offsetLeft || 0, y = v?.offsetTop || 0, w = v?.width || innerWidth, h = v?.height || innerHeight
      const b = r.bottom + 8, a = r.top - s.height - 8
      const l = Math.max(8, Math.min(Math.max(x + 8, r.left), x + w - s.width - 8))
      const t = Math.min(Math.max(y + 8, b + s.height <= y + h - 8 || a < y + 8 ? b : a), y + h - s.height - 8)
      pan.style.cssText = `left:${~~l}px;top:${~~Math.max(y + 8, t)}px`
    }
  }

  const setOpen = (v: boolean) => {
    if (dead || open === v) return
    open = v
    pan.hidden = !v
    sa(trigger, 'aria-expanded', v)
    if (v) pos()
  }

  ;['scroll', 'resize'].forEach(ev => {
    on(window, ev, pos, true)
    on(window.visualViewport, ev, pos)
  })
  on(trigger, 'click', () => setOpen(!open))

  on(grid, 'click', (e: Event) => {
    const btn = (e.target as Element).closest<HTMLElement>('[data-item-index]')
    if (!btn) return
    const p = packs[active]!, it = p.items[+btn.dataset.itemIndex!]
    if (!it) return
    target.insert(it, p)
    onSelect?.(it, p)
    if (closeOnSelect) setOpen(false)
  })

  on(tabs, 'click', (e: Event) => {
    const tab = (e.target as Element).closest<HTMLElement>('[data-pack-index]')
    if (tab) {
      const i = +tab.dataset.packIndex!
      if (packs[i] && i !== active) { active = i; paint() }
    }
  })

  on(tabs, 'keydown', (e: KeyboardEvent) => {
    const k = e.key, nav: Record<string, number> = {
      ArrowLeft: (active - 1 + packs.length) % packs.length,
      ArrowRight: (active + 1) % packs.length,
      Home: 0,
      End: packs.length - 1,
    }
    if (k in nav) {
      e.preventDefault()
      active = nav[k]!
      paint()
      ;(tabs.children[active] as HTMLElement)?.focus()
    }
  })

  on(D, 'pointerdown', (e: Event) => {
    const n = e.target as Node
    if (open && !pan.contains(n) && !trigger.contains(n)) setOpen(false)
  })

  on(D, 'keydown', (e: KeyboardEvent) => {
    if (open && e.key === 'Escape') { setOpen(false); trigger.focus() }
  })

  paint()

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!open),
    isOpen: () => open,
    destroy() {
      if (!dead) {
        setOpen(false)
        dead = true
        ac.abort()
        pan.remove()
        trigger.removeAttribute('aria-expanded')
      }
    },
  }
}
