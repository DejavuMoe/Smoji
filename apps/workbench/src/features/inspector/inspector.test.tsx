import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { SmojiItem, SmojiPack } from '../../../../../packages/smoji/src/types'
import { WorkbenchProvider } from '../../app/WorkbenchProvider'
import { CopyTabs } from './CopyTabs'
import { PreviewBackgroundToggle } from './PreviewBackgroundToggle'
import { DetailInspectorDialog } from './DetailInspectorDialog'
import { useWorkbench } from '../../app/WorkbenchContext'

vi.mock('../../images', () => ({
  thumbnailSrc: () => '/static-thumbnail.webp',
  loadImage: (image: HTMLImageElement, src: string, callbacks: { load?: () => void } = {}) => {
    image.src = src
    callbacks.load?.()
  },
}))

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

  it('previews the original image and preserves text-field arrow navigation', () => {
    function Inspector() {
      const { dispatch } = useWorkbench()
      return <><button onClick={() => dispatch({ type: 'OPEN_INSPECTOR', payload: mockItem.src })}>打开</button><DetailInspectorDialog /></>
    }
    const next = { id: 'next', label: '下一张', src: 'https://cdn.example/next.gif' }
    render(<WorkbenchProvider initialPacks={[{ ...mockPacks[0]!, items: [mockItem, next] }]}><Inspector /></WorkbenchProvider>)
    fireEvent.click(screen.getByRole('button', { name: '打开' }))
    expect(screen.getByRole('img').getAttribute('src')).toBe(mockItem.src)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'ArrowRight' })
    expect(screen.getByRole('img').getAttribute('src')).toBe(mockItem.src)
    fireEvent.keyDown(screen.getByRole('button', { name: '关闭详情' }), { key: 'ArrowRight' })
    expect(screen.getByRole('img').getAttribute('src')).toBe(next.src)
  })

  it('formats Hugo shortcodes with properly escaped quotes and labels', () => {
    render(
      <WorkbenchProvider initialPacks={mockPacks}>
        <CopyTabs item={mockItem} />
      </WorkbenchProvider>,
    )

    const hugoTab = screen.getByRole('tab', { name: 'Hugo' })
    fireEvent.mouseDown(hugoTab)

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

    const lightBtn = screen.getByRole('radio', { name: '浅底' })
    const darkBtn = screen.getByRole('radio', { name: '深底' })
    const transBtn = screen.getByRole('radio', { name: '透明' })

    fireEvent.click(lightBtn)
    expect(lightBtn.getAttribute('aria-checked')).toBe('true')

    fireEvent.click(darkBtn)
    expect(darkBtn.getAttribute('aria-checked')).toBe('true')

    fireEvent.click(transBtn)
    expect(transBtn.getAttribute('aria-checked')).toBe('true')
  })
})
