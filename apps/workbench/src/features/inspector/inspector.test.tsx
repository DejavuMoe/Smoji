import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { SmojiItem, SmojiPack } from '../../../../../packages/smoji/src/types'
import { WorkbenchProvider } from '../../app/WorkbenchProvider'
import { CopyTabs } from './CopyTabs'
import { PreviewBackgroundToggle } from './PreviewBackgroundToggle'

const mockItem: SmojiItem = {
  id: 'hello',
  label: '说"你好"\\再见',
  src: 'https://cdn.example/hello.png',
}

const mockPacks: SmojiPack[] = [
  { id: 'sample', label: '示例', items: [mockItem] },
]

describe('Inspector Components & Clipboard Fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('formats Hugo shortcodes with properly escaped quotes and labels', () => {
    render(
      <WorkbenchProvider initialPacks={mockPacks}>
        <CopyTabs item={mockItem} />
      </WorkbenchProvider>,
    )

    const hugoTab = screen.getByRole('button', { name: 'Hugo' })
    fireEvent.click(hugoTab)

    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe(
      '{{< inTextImg url="https://cdn.example/hello.png" alt="说\\"你好\\"\\\\再见" >}}',
    )
  })

  it('provides clipboard fallback when navigator.clipboard is unavailable', async () => {
    // Mock navigator.clipboard as undefined
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })

    render(
      <WorkbenchProvider initialPacks={mockPacks}>
        <CopyTabs item={mockItem} />
      </WorkbenchProvider>,
    )

    const copyBtn = screen.getByRole('button', { name: '复制' })
    fireEvent.click(copyBtn)

    await waitFor(() => {
      const feedback = screen.getByText(/手动复制/i)
      expect(feedback).toBeDefined()
    })

    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(input.value.length)
  })

  it('toggles preview backgrounds between transparent, light, and dark', () => {
    render(
      <WorkbenchProvider initialPacks={mockPacks}>
        <PreviewBackgroundToggle />
      </WorkbenchProvider>,
    )

    const lightBtn = screen.getByRole('button', { name: '浅底' })
    const darkBtn = screen.getByRole('button', { name: '深底' })
    const transBtn = screen.getByRole('button', { name: '透明' })

    fireEvent.click(lightBtn)
    expect(lightBtn.className).toContain('bg-surface')

    fireEvent.click(darkBtn)
    expect(darkBtn.className).toContain('bg-surface')

    fireEvent.click(transBtn)
    expect(transBtn.className).toContain('bg-surface')
  })
})
