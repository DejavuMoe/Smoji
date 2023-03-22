import { readFile } from 'node:fs/promises'
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
})

it('keeps the mobile drawer out of focus order, restores desktop access, and shows plain notifications', async () => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  const html = await readFile('demo/index.html', 'utf8')
  document.body.innerHTML = html.split('<body>')[1]!.split('</body>')[0]!
  const mobile = Object.assign(new EventTarget(), { matches: true })
  vi.stubGlobal('matchMedia', (query: string) => query === '(max-width: 720px)'
    ? mobile : Object.assign(new EventTarget(), { matches: false }))
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify({ version: 1, packs: [{ id: 'sample', label: '示例', items: [
      { id: 'wave', label: '挥手', src: './sample/wave.webp' },
    ] }] }),
  }))
  const { showToast } = await import('./main')
  const sidebar = document.querySelector<HTMLElement>('#sidebar')!
  const toggle = document.querySelector<HTMLButtonElement>('#menu-toggle')!
  await vi.waitFor(() => expect(document.querySelector('#pack-nav button')).not.toBeNull())
  expect(sidebar.hasAttribute('inert')).toBe(true)
  toggle.click()
  expect(sidebar.hasAttribute('inert')).toBe(false)
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  mobile.matches = false
  mobile.dispatchEvent(new Event('change'))
  expect(document.body.classList.contains('menu-open')).toBe(false)
  expect(sidebar.hasAttribute('inert')).toBe(false)
  expect(document.querySelector<HTMLElement>('#backdrop')!.hidden).toBe(true)
  document.querySelector<HTMLButtonElement>('#pack-nav button')!.focus()
  mobile.matches = true
  mobile.dispatchEvent(new Event('change'))
  expect(sidebar.hasAttribute('inert')).toBe(true)
  expect(document.activeElement).toBe(toggle)
  document.querySelector<HTMLElement>('.card')!.click()
  document.querySelector<HTMLButtonElement>('#pop-close-btn')!.click()
  document.querySelector<HTMLButtonElement>('#btn-clear-recent')!.click()
  expect(document.querySelector<HTMLElement>('#confirm-modal')!.hidden).toBe(false)
  expect(document.activeElement).toBe(document.querySelector('#confirm-cancel'))
  document.querySelector<HTMLButtonElement>('#confirm-cancel')!.click()
  expect(document.querySelector<HTMLElement>('#confirm-modal')!.hidden).toBe(true)
  expect(document.querySelector('#recent-strip-list')!.children).toHaveLength(1)
  showToast('已清空最近使用', 'info')
  expect(document.querySelector('.toast__text')!.textContent).toBe('已清空最近使用')
  expect(document.querySelector('.toast__icon')).toBeNull()
  expect(document.querySelector('.toast__dismiss')!.getAttribute('aria-label')).toBe('关闭通知')
})
