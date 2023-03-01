import { describe, expect, it } from 'vitest'
import { renderSmojiContent, smojiMarker } from '../src/marker'
import type { SmojiItem } from '../src'

describe('smoji marker', () => {
  it('uses absolute image URLs', () => {
    const item: SmojiItem = {
      id: 'wave',
      label: '挥手',
      src: 'https://static.example.test/cats/wave.webp',
    }
    expect(smojiMarker(item)).toBe('![smoji:挥手](https://static.example.test/cats/wave.webp)')
  })

  it('rejects relative or unsafe src values', () => {
    expect(() => smojiMarker({ id: 'x', label: '一', src: './x.webp' })).toThrow()
    expect(() => smojiMarker({ id: 'x', label: '一', src: 'https://a.test/x.webp?q=1' })).toThrow()
  })

  it('renders only same-origin markers as images and never uses innerHTML', () => {
    const target = document.createElement('p')
    const htmlProbe = '<img src=x onerror=alert(1)>'
    renderSmojiContent(
      target,
      `前 ${htmlProbe} ![smoji:挥手](https://static.example.test/wave.webp) 后 ![smoji:坏](https://tracker.example/x.webp)`,
      'https://static.example.test/smoji.json',
    )
    expect(target.querySelectorAll('img')).toHaveLength(1)
    expect(target.querySelector('img')?.getAttribute('src')).toBe('https://static.example.test/wave.webp')
    expect(target.querySelector('img')?.getAttribute('alt')).toBe('[表情：挥手]')
    expect(target.textContent).toContain(htmlProbe)
    expect(target.textContent).toContain('![smoji:坏](https://tracker.example/x.webp)')
    expect(target.querySelector('img[onerror]')).toBeNull()
    expect([...target.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.includes(htmlProbe))).toBe(true)
  })
})
