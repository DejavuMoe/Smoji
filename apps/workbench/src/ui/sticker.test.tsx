import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'

const previews: Record<string, string> = { 'https://cdn.example/animated.webp': '/_previews/animated-160-v3.webp' }
vi.mock('../images', () => ({ imagePreview: (src: string) => (previews[src] ? { src: previews[src], bytes: 1, animated: true } : undefined) }))

// Images "load" when the test says so, so both fast and slow paths can be observed.
const pending: Array<() => void> = []
class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  decoding = ''
  referrerPolicy = ''
  naturalWidth = 320
  naturalHeight = 320
  set src(value: string) { if (value) pending.push(() => this.onload?.()) }
}

beforeEach(() => {
  pending.length = 0
  vi.stubGlobal('Image', FakeImage)
})
afterEach(() => vi.unstubAllGlobals())

const flush = () => act(async () => {
  for (let round = 0; round < 5; round++) {
    while (pending.length) pending.shift()!()
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
})

it('shows a blurred placeholder, then reveals the static preview and plays the original only on demand', async () => {
  const { Sticker } = await import('./Sticker')
  const { container, rerender } = render(<Sticker src="https://cdn.example/animated.webp" alt="动图" />)
  const root = container.querySelector('.sticker')!
  expect(root.getAttribute('data-image-status')).toBe('loading')
  expect(container.querySelector('.sticker__ph')).not.toBeNull()
  expect(container.querySelector('img')).toBeNull()

  await flush()
  expect(root.getAttribute('data-image-status')).toBe('ready')
  expect(container.querySelector('.sticker__ph')).toBeNull()
  const media = container.querySelector<HTMLImageElement>('img.sticker__media')!
  expect(media.getAttribute('src')).toBe('/_previews/animated-160-v3.webp')
  expect(container.querySelector('.sticker__live')).toBeNull()

  rerender(<Sticker src="https://cdn.example/animated.webp" alt="动图" play />)
  const live = container.querySelector<HTMLImageElement>('.sticker__live')!
  expect(live.getAttribute('src')).toBe('https://cdn.example/animated.webp')
  expect(live.getAttribute('aria-hidden')).toBe('true')
  rerender(<Sticker src="https://cdn.example/animated.webp" alt="动图" play={false} />)
  expect(container.querySelector('.sticker__live')).toBeNull()
})

it('uses the blurred still as the inspector placeholder before the animated original is ready', async () => {
  const { Sticker } = await import('./Sticker')
  const { container } = render(<Sticker src="https://cdn.example/animated.webp" alt="动图" mode="live" eager />)
  expect(container.querySelector<HTMLImageElement>('img.sticker__ph--image')!.getAttribute('src')).toBe('/_previews/animated-160-v3.webp')
  await flush()
  expect(container.querySelector('.sticker__ph')).toBeNull()
  expect(container.querySelector<HTMLImageElement>('img.sticker__media')!.getAttribute('src')).toBe('https://cdn.example/animated.webp')
})

it('reports a failed image distinctly and can retry it', async () => {
  class FailingImage extends FakeImage {
    override set src(value: string) { if (value) pending.push(() => this.onerror?.()) }
  }
  vi.stubGlobal('Image', FailingImage)
  const { Sticker } = await import('./Sticker')
  const { container, getByRole } = render(<Sticker src="https://cdn.example/broken.webp" alt="坏图" mode="live" retryable eager />)
  await flush()
  expect(container.querySelector('.sticker')!.getAttribute('data-image-status')).toBe('error')
  expect(container.textContent).toContain('加载失败')
  vi.stubGlobal('Image', FakeImage)
  act(() => getByRole('button', { name: '重试加载 坏图' }).click())
  await flush()
  expect(container.querySelector('.sticker')!.getAttribute('data-image-status')).toBe('ready')
})
