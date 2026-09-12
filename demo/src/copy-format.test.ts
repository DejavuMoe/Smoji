import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import { loadCopyFormat } from './storage'

it('copies Hugo shortcodes with quoted labels and preserves all five format shortcuts', async () => {
  document.documentElement.innerHTML = readFileSync('demo/index.html', 'utf8').replace(/<!doctype html>/i, '')
  localStorage.clear()
  vi.stubEnv('PROD', false)
  vi.stubGlobal('matchMedia', (media: string) => Object.assign(new EventTarget(), { matches: false, media }))
  HTMLElement.prototype.scrollIntoView = vi.fn()
  const label = '说"你好"\\再见'
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify({ version: 1, packs: [{ id: 'sample', label: '示例', items: [
      { id: 'hello', label, src: './sample/hello.png' },
    ] }] }),
  }))
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  await import('./main')
  await vi.waitFor(() => expect(document.querySelector('#grid [data-item-index]')).not.toBeNull())
  document.querySelector<HTMLElement>('#grid [data-item-index]')!.click()
  const click = (id: string) => document.getElementById(id)!.click()
  const value = () => document.querySelector<HTMLInputElement>('#copy-active-input')!.value
  click('copy-tab-url')
  const url = value()
  click('copy-tab-hugo')
  expect(value()).toBe(`{{< inTextImg url=${JSON.stringify(url)} alt="说\\"你好\\"\\\\再见" >}}`)
  expect(loadCopyFormat()).toBe('hugo')
  click('btn-copy-active')
  await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(value()))
  expect(document.getElementById('btn-copy-active')!.textContent).toBe('复制')
  for (const [index, format] of ['md', 'url', 'hugo', 'html', 'bbcode'].entries()) {
    const input = document.querySelector<HTMLInputElement>('#copy-active-input')!
    input.focus()
    expect(document.activeElement).toBe(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: String(index + 1), bubbles: true }))
    expect(document.querySelector('[data-copy-format][aria-selected="true"]')?.getAttribute('data-copy-format')).toBe(format)
  }
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
