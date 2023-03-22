import { expect, it, vi } from 'vitest'
import previews from '../../data/previews.json'
import { imagePreview, loadImage, thumbnailSrc } from './images'

it('uses a local static thumbnail without changing foreign or unknown URLs', () => {
  const [path, preview] = Object.entries(previews)[0]!
  const original = new URL(path, window.location.href).href
  expect(thumbnailSrc(original)).toBe(new URL(preview.src, window.location.href).href)
  expect(imagePreview(original)?.bytes).toBe(preview.bytes)
  for (const src of [`https://other.test/${path}`, `${original}?v=1`, 'https://example.test/%', '/__proto__']) {
    expect(thumbnailSrc(src)).toBe(src)
  }
})

it('reveals decoded images and ignores a decode that finishes after the preview closes', async () => {
  const image = document.createElement('img')
  let decoded!: () => void
  image.decode = () => new Promise<void>((resolve) => { decoded = resolve })
  const load = vi.fn()
  loadImage(image, '/first.webp', { load })
  image.dispatchEvent(new Event('load'))
  expect(image.classList.contains('is-loaded')).toBe(false)
  image.removeAttribute('src')
  decoded()
  await Promise.resolve()
  expect(load).not.toHaveBeenCalled()
  expect(image.classList.contains('is-loaded')).toBe(false)

  image.decode = () => Promise.resolve()
  loadImage(image, '/second.webp', { load })
  image.dispatchEvent(new Event('load'))
  await Promise.resolve()
  expect(load).toHaveBeenCalledOnce()
  expect(image.classList.contains('is-loaded')).toBe(true)
})

it('exposes image errors without automatically downloading the original', () => {
  const image = document.createElement('img')
  const error = vi.fn()
  loadImage(image, '/missing-thumbnail.webp', { error })
  image.dispatchEvent(new Event('error'))
  expect(error).toHaveBeenCalledOnce()
  expect(image.classList.contains('is-broken')).toBe(true)
  expect(image.getAttribute('src')).toBe('/missing-thumbnail.webp')
})

it('ignores a failed old decode when retrying the same URL', async () => {
  const image = document.createElement('img')
  let rejectOld!: () => void
  image.decode = () => new Promise<void>((_resolve, reject) => { rejectOld = () => reject(new Error('old request')) })
  const error = vi.fn()
  loadImage(image, '/retry.webp', { error })
  image.dispatchEvent(new Event('load'))
  image.decode = () => Promise.resolve()
  loadImage(image, '/retry.webp', { error })
  image.dispatchEvent(new Event('load'))
  await Promise.resolve()
  rejectOld()
  await Promise.resolve()
  expect(image.classList.contains('is-loaded')).toBe(true)
  expect(image.classList.contains('is-broken')).toBe(false)
  expect(error).not.toHaveBeenCalled()
})

it('uses local previews for CDN originals', () => {
  const [path, preview] = Object.entries(previews)[0]!
  expect(thumbnailSrc(`https://s3-cdn.zsh.moe/smoji/${path}`)).toBe(new URL(preview.src, window.location.href).href)
})
