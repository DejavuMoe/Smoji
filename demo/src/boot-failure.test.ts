import { readFileSync } from 'node:fs'
import { it, expect, vi } from 'vitest'
import { STORAGE_KEYS } from './storage'
vi.mock('./asset-paths', async (original) => ({ ...await original<object>(), loadAssetAliases: async () => { throw new Error('Failed to fetch dynamically imported module') } }))
it('preserves saved groups when the aliases chunk fails to load', async () => {
  document.documentElement.innerHTML = readFileSync('demo/index.html', 'utf8').replace(/<!doctype html>/i, '')
  vi.stubEnv('PROD', true)
  window.matchMedia = vi.fn((media) => ({ matches: false, media, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true } })) as any
  HTMLElement.prototype.scrollIntoView = () => {}
  localStorage.clear()
  const saved = [{ id: 'important', label: '重要分组', itemSrcs: ['https://s3-cdn.zsh.moe/smoji/aodamiao/alijklielooj.webp'] }]
  localStorage.setItem(STORAGE_KEYS.customPacks, JSON.stringify(saved))
  localStorage.setItem(STORAGE_KEYS.selectedPackIds, '["aodamiao"]')
  await import('./main')
  await vi.waitFor(() => expect(document.querySelector('#gallery-title')!.textContent).toContain('Failed to fetch'))
  expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.customPacks)!)).toEqual(saved)
})
