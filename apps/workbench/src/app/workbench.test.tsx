import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { SmojiPack } from '../../../../packages/smoji/src/types'
import { WorkbenchProvider } from './WorkbenchProvider'
import { App } from './App'

const samplePacks: SmojiPack[] = [
  {
    id: 'sample',
    label: '示例',
    items: [
      { id: 'wave', label: '挥手', src: 'https://cdn.example/sample/wave.png' },
      { id: 'smile', label: '微笑', src: 'https://cdn.example/sample/smile.png' },
    ],
  },
  {
    id: 'second',
    label: '另一分类',
    items: [
      { id: 'hello', label: '你好', src: 'https://cdn.example/second/hello.png' },
    ],
  },
  {
    id: 'third',
    label: '第三分类',
    items: [
      { id: 'cat', label: '猫', src: 'https://cdn.example/third/cat.png' },
    ],
  },
  {
    id: 'fourth',
    label: '第四分类',
    items: [
      { id: 'dog', label: '狗', src: 'https://cdn.example/fourth/dog.png' },
    ],
  },
]

describe('React Workbench Integration Suite', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('scrollTo', vi.fn())
  })

  it('verifies the full workbench interaction contract in React', async () => {
    render(
      <WorkbenchProvider initialPacks={samplePacks}>
        <App />
      </WorkbenchProvider>,
    )

    // 1. Guide Modal
    const guideBtn = screen.getByRole('button', { name: /帮助/i })
    fireEvent.click(guideBtn)
    await waitFor(() => {
      expect(document.querySelector('[data-guide-limit="packs-n"]')?.textContent).toBe('64')
    })
    const closeGuide = screen.getByRole('button', { name: '关闭使用指南' })
    fireEvent.click(closeGuide)

    // 2. Pack Selection Semantics ("全选 / 反选" & partial invert)
    const selectAllBtn = screen.getByRole('button', { name: /全选表情包/i })
    expect(selectAllBtn.textContent).toBe('全选')

    // Click "全选" -> all 4 selected
    fireEvent.click(selectAllBtn)
    expect(selectAllBtn.textContent).toBe('反选')
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes.every((cb) => cb.checked)).toBe(true)

    // Click "反选" when all selected -> 0 selected
    fireEvent.click(selectAllBtn)
    expect(selectAllBtn.textContent).toBe('全选')
    expect(checkboxes.every((cb) => !cb.checked)).toBe(true)

    // Partial Invert: check pack 0 and pack 2
    fireEvent.click(checkboxes[0]!)
    fireEvent.click(checkboxes[2]!)
    expect(checkboxes[0]!.checked).toBe(true)
    expect(checkboxes[1]!.checked).toBe(false)
    expect(checkboxes[2]!.checked).toBe(true)
    expect(checkboxes[3]!.checked).toBe(false)
    expect(selectAllBtn.textContent).toBe('反选')

    // Click "反选" -> 0 and 2 become false, 1 and 3 become true
    fireEvent.click(selectAllBtn)
    expect(checkboxes[0]!.checked).toBe(false)
    expect(checkboxes[1]!.checked).toBe(true)
    expect(checkboxes[2]!.checked).toBe(false)
    expect(checkboxes[3]!.checked).toBe(true)
    expect(selectAllBtn.textContent).toBe('反选')

    // 3. Selection Dock & Export
    const dock = screen.getByRole('region', { name: '导出状态' })
    expect(dock).toBeDefined()
    expect(screen.getByText(/2 个分类/)).toBeDefined()

    // Format select in dock
    const formatSelect = screen.getByRole('combobox', { name: '导出格式' }) as HTMLSelectElement
    fireEvent.change(formatSelect, { target: { value: 'twikoo' } })
    expect(formatSelect.value).toBe('twikoo')

    // Open code preview
    const previewBtn = document.getElementById('selection-dock-preview')!
    fireEvent.click(previewBtn)
    await waitFor(() => {
      expect(screen.getByText('数据预览与导出')).toBeDefined()
    })

    // Code modal tabs
    const twikooTab = screen.getByRole('button', { name: 'Twikoo' })
    expect(twikooTab.getAttribute('aria-selected')).toBe('true')
    const closeCode = screen.getByRole('button', { name: '关闭预览' })
    fireEvent.click(closeCode)

    // 4. Custom Mode
    const customTab = screen.getByRole('button', { name: '自选分组' })
    fireEvent.click(customTab)

    // Create group
    const nameInput = screen.getByPlaceholderText(/分组名称/i)
    fireEvent.change(nameInput, { target: { value: '我的收藏' } })
    const addGroupBtn = screen.getByRole('button', { name: '添加' })
    fireEvent.click(addGroupBtn)

    await waitFor(() => {
      expect(screen.getByText('我的收藏')).toBeDefined()
    })

    // Gallery header indicates current target
    expect(screen.getByText(/添加到「我的收藏」/)).toBeDefined()

    // Add item to group via hover check button
    const checkBtns = screen.getAllByRole('button', { name: /^加入 / })
    fireEvent.click(checkBtns[0]!)

    await waitFor(() => {
      expect(screen.getByText(/1 \/ 600 张/)).toBeDefined()
      expect(document.querySelector('.card__badge')?.textContent).toBe('✓')
    })

    // 5. Inspector & Clipboard fallback
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    const card = document.querySelector('.card')!
    expect(card.classList.contains('aspect-square')).toBe(true)
    fireEvent.click(card)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '复制' })).toBeDefined()
    })

    const copyBtn = screen.getByRole('button', { name: '复制' })
    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(screen.getByText(/手动复制/i)).toBeDefined()
    })

    const closeInspector = screen.getByRole('button', { name: '关闭详情' })
    fireEvent.click(closeInspector)
  })
})
