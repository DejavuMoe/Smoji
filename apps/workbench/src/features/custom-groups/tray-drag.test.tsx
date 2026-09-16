import { expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { WorkbenchProvider } from '../../app/WorkbenchProvider'
import { CustomGroupItemTray } from './CustomGroupItemTray'

it('keeps item drags separate from group drags and delegates cross-group drops to the group', () => {
  const parentDrag = vi.fn()
  const parentDrop = vi.fn()
  const { container } = render(
    <WorkbenchProvider>
      <div onDragStart={parentDrag} onDrop={parentDrop}>
        <CustomGroupItemTray groupIndex={0} items={[{ id: 'item', label: '表情', src: 'https://example.test/item.png' }]} />
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
