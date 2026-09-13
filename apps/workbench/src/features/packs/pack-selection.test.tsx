import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { SmojiPack } from '../../../../../packages/smoji/src/types'
import { WorkbenchProvider } from '../../app/WorkbenchProvider'
import { PackList } from './PackList'

const mockPacks: SmojiPack[] = [
  { id: 'pack-a', label: '分类A', items: [{ id: 'a1', label: 'A1', src: 'https://cdn.example/a1.webp' }] },
  { id: 'pack-b', label: '分类B', items: [{ id: 'b1', label: 'B1', src: 'https://cdn.example/b1.webp' }] },
  { id: 'pack-c', label: '分类C', items: [{ id: 'c1', label: 'C1', src: 'https://cdn.example/c1.webp' }] },
  { id: 'pack-d', label: '分类D', items: [{ id: 'd1', label: 'D1', src: 'https://cdn.example/d1.webp' }] },
]

function renderPackList() {
  return render(
    <WorkbenchProvider initialPacks={mockPacks}>
      <PackList />
    </WorkbenchProvider>,
  )
}

describe('PackList Component & "全选 / 反选" UI contract', () => {
  it('starts with "全选", clicking selects all packs and changes button to "反选"', () => {
    renderPackList()
    const selectAllBtn = screen.getByRole('button', { name: /全选表情包/i })
    expect(selectAllBtn.textContent).toBe('全选')

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(4)
    expect(checkboxes.every((cb) => !(cb as HTMLInputElement).checked)).toBe(true)

    // Click "全选"
    fireEvent.click(selectAllBtn)

    expect(selectAllBtn.textContent).toBe('反选')
    expect(checkboxes.every((cb) => (cb as HTMLInputElement).checked)).toBe(true)

    // Click "反选" when all are selected -> deselects all, button reverts to "全选"
    fireEvent.click(selectAllBtn)
    expect(selectAllBtn.textContent).toBe('全选')
    expect(checkboxes.every((cb) => !(cb as HTMLInputElement).checked)).toBe(true)
  })

  it('preserves partial invert semantics: [A, C] -> [B, D]', () => {
    renderPackList()
    const selectAllBtn = screen.getByRole('button', { name: /表情包/i })
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]

    // Select pack-a (index 0) and pack-c (index 2)
    fireEvent.click(checkboxes[0]!)
    fireEvent.click(checkboxes[2]!)
    expect(checkboxes[0]!.checked).toBe(true)
    expect(checkboxes[1]!.checked).toBe(false)
    expect(checkboxes[2]!.checked).toBe(true)
    expect(checkboxes[3]!.checked).toBe(false)
    expect(selectAllBtn.textContent).toBe('反选')

    // Click "反选"
    fireEvent.click(selectAllBtn)

    expect(checkboxes[0]!.checked).toBe(false)
    expect(checkboxes[1]!.checked).toBe(true)
    expect(checkboxes[2]!.checked).toBe(false)
    expect(checkboxes[3]!.checked).toBe(true)
    expect(selectAllBtn.textContent).toBe('反选')

    // Clear button clears all and disables clear button
    const clearBtn = screen.getByRole('button', { name: '清空' })
    expect((clearBtn as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(clearBtn)
    expect(checkboxes.every((cb) => !cb.checked)).toBe(true)
    expect(selectAllBtn.textContent).toBe('全选')
    expect((clearBtn as HTMLButtonElement).disabled).toBe(true)
  })
})
