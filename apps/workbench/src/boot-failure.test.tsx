import { expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { STORAGE_KEYS } from './storage'

vi.mock('./asset-paths', async (original) => ({
  ...await original<object>(),
  loadAssetAliases: async () => { throw new Error('Failed to fetch dynamically imported module') },
}))

it('keeps the workbench unmounted and saved groups untouched when the aliases chunk fails', async () => {
  document.body.innerHTML = '<div id="root"></div>'
  localStorage.clear()
  const saved = [{ id: 'important', label: '重要分组', itemSrcs: ['https://s3-cdn.zsh.moe/smoji/aodamiao/alijklielooj.webp'] }]
  localStorage.setItem(STORAGE_KEYS.customPacks, JSON.stringify(saved))
  localStorage.setItem(STORAGE_KEYS.selectedPackIds, '["aodamiao"]')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify({ version: 1, packs: [{ id: 'sample', label: '示例', items: [{ id: 'wave', label: '挥手', src: './sample/wave.webp' }] }] }),
  }))
  await import('./main')
  await waitFor(() => expect(document.querySelector('.boot-error')?.textContent).toContain('Failed to fetch'))
  expect(document.querySelector('.boot-error h1')?.textContent).toBe('无法加载表情清单')
  expect(document.querySelector('#grid')).toBeNull()
  expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.customPacks)!)).toEqual(saved)
  vi.unstubAllGlobals()
})
