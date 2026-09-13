import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { SmojiPack } from '../../../../../packages/smoji/src/types'
import { WorkbenchProvider } from '../../app/WorkbenchProvider'
import { CustomGroupList } from './CustomGroupList'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'

const mockPacks: SmojiPack[] = [
  {
    id: 'pack-a',
    label: '分类A',
    items: [
      { id: 'a1', label: 'A1', src: 'https://cdn.example/a1.webp' },
      { id: 'a2', label: 'A2', src: 'https://cdn.example/a2.webp' },
    ],
  },
]

describe('CustomGroupList Component & Dialog Safety', () => {
  it('creates custom group and displays count', async () => {
    render(
      <WorkbenchProvider initialPacks={mockPacks}>
        <CustomGroupList />
      </WorkbenchProvider>,
    )
    const nameInput = screen.getByPlaceholderText(/分组名称/i)
    fireEvent.change(nameInput, { target: { value: '我的常用' } })

    const addBtn = screen.getByRole('button', { name: '添加' })
    fireEvent.click(addBtn)

    await waitFor(() => {
      expect(screen.getByText('我的常用')).toBeDefined()
    })
    expect(screen.getByText(/0 \/ 600 张/)).toBeDefined()
  })

  it('destructive delete dialog places initial focus on Cancel button', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    render(
      <DeleteConfirmDialog
        open={true}
        title="删除分组确认"
        description="确定要删除吗？"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('删除分组确认')).toBeDefined()
    })

    const cancelBtn = screen.getByRole('button', { name: '取消' })
    const confirmBtn = screen.getByRole('button', { name: '确定' })

    // Cancel button must be focused
    await waitFor(() => {
      expect(document.activeElement).toBe(cancelBtn)
      expect(document.activeElement).not.toBe(confirmBtn)
    })

    fireEvent.click(cancelBtn)
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
