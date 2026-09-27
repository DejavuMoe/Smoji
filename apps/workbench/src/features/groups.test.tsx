import { afterEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SmojiPack } from '../../../../packages/smoji/src/types'
import { WorkbenchProvider } from '../app/WorkbenchProvider'
import { STORAGE_KEYS } from '../storage'
import { Confirm } from '../ui/overlays'
import { Toasts } from './Toasts'
import { showToast } from './feedback/toast'
import { CustomGroups, Tray } from './Groups'

const items = Array.from({ length: 3 }, (_, i) => ({ id: `k${i}`, label: `表情${i}`, src: `https://cdn.example/k/${i}.png` }))
const packs: SmojiPack[] = [{ id: 'k', label: '分类', items }]

afterEach(() => localStorage.clear())

it('keeps item drags separate from group drags and delegates cross-group drops to the group', () => {
  const parentDrag = vi.fn()
  const parentDrop = vi.fn()
  const { container } = render(
    <WorkbenchProvider>
      <div onDragStart={parentDrag} onDrop={parentDrop}>
        <Tray groupIndex={0} items={[{ id: 'item', label: '表情', src: 'https://example.test/item.png' }]} />
      </div>
    </WorkbenchProvider>,
  )
  const data: Record<string, string> = {}
  const dataTransfer = { setData: (type: string, value: string) => { data[type] = value }, getData: (type: string) => data[type] ?? '' }
  const item = container.querySelector('[data-tray-item]')!
  fireEvent.dragStart(item, { dataTransfer })
  expect(parentDrag).not.toHaveBeenCalled()
  expect(data['text/smoji-tray-group']).toBe('0')
  fireEvent.drop(item, { dataTransfer })
  expect(parentDrop).not.toHaveBeenCalled()
  data['text/smoji-tray-group'] = '1'
  fireEvent.drop(item, { dataTransfer })
  expect(parentDrop).toHaveBeenCalledOnce()
})

it('deleting tray items keeps focus on a neighbour and then on the group', async () => {
  localStorage.setItem(STORAGE_KEYS.customPacks, JSON.stringify([{ id: 'a', label: '分组 A', itemSrcs: items.map((item) => item.src) }]))
  const { container } = render(<WorkbenchProvider initialPacks={packs}><CustomGroups /></WorkbenchProvider>)
  const first = () => container.querySelector<HTMLElement>('[data-tray-item="0"]')
  first()!.focus()
  fireEvent.keyDown(first()!, { key: 'Delete' })
  await waitFor(() => expect(document.activeElement).toBe(first()))
  fireEvent.keyDown(first()!, { key: 'Delete' })
  fireEvent.keyDown(first()!, { key: 'Delete' })
  await waitFor(() => expect(document.activeElement).toBe(container.querySelector('.custom-pack-name')))
  expect(screen.getByText('拖入表情，或在图库中点 +')).toBeDefined()
})

it('reorders tray items with Alt+arrows and validates group names and ids', async () => {
  localStorage.setItem(STORAGE_KEYS.customPacks, JSON.stringify([{ id: 'a', label: '分组 A', itemSrcs: items.map((item) => item.src) }]))
  const { container } = render(<WorkbenchProvider initialPacks={packs}><CustomGroups /></WorkbenchProvider>)
  const tray = () => [...container.querySelectorAll<HTMLElement>('[data-tray-item]')].map((node) => node.dataset.traySrc)
  const first = container.querySelector<HTMLElement>('[data-tray-item="0"]')!
  first.focus()
  fireEvent.keyDown(first, { key: 'ArrowRight', altKey: true })
  expect(tray()).toEqual([items[1]!.src, items[0]!.src, items[2]!.src])
  await waitFor(() => expect(document.activeElement?.getAttribute('data-tray-src')).toBe(items[0]!.src))

  fireEvent.change(screen.getByLabelText('分组名称'), { target: { value: 'bad]' } })
  fireEvent.click(screen.getByRole('button', { name: '添加' }))
  expect(screen.getByRole('alert').textContent).toContain('不能包含 ]')
  fireEvent.change(screen.getByLabelText('分组名称'), { target: { value: '第二组' } })
  fireEvent.click(screen.getByRole('button', { name: '自定义 ID' }))
  fireEvent.change(screen.getByLabelText('分组 ID（可选）'), { target: { value: 'a' } })
  fireEvent.click(screen.getByRole('button', { name: '添加' }))
  expect(screen.getByRole('alert').textContent).toBe('分组 ID「a」已存在')
  fireEvent.change(screen.getByLabelText('分组 ID（可选）'), { target: { value: 'second' } })
  fireEvent.click(screen.getByRole('button', { name: '添加' }))
  await waitFor(() => expect(container.querySelectorAll('[data-custom-index]')).toHaveLength(2))
})

it('focuses 取消 first in destructive confirmations', async () => {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(<Confirm open title="删除分组确认" description="确定要删除吗？" confirmLabel="删除" onConfirm={onConfirm} onCancel={onCancel} />)
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: '取消' })))
  fireEvent.click(screen.getByRole('button', { name: '取消' }))
  expect(onCancel).toHaveBeenCalled()
  expect(onConfirm).not.toHaveBeenCalled()
})

it('shows plain notifications with a named dismiss control', async () => {
  const { container } = render(<Toasts />)
  showToast('操作完成', 'info')
  await waitFor(() => expect(container.querySelector('.toast__text')?.textContent).toBe('操作完成'))
  expect(container.querySelector('.toast > svg')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '关闭通知' }))
  await waitFor(() => expect(container.querySelector('.toast')).toBeNull())
})
