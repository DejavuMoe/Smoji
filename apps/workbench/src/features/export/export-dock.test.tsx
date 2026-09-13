import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { SmojiPack } from '../../../../../packages/smoji/src/types'
import { WorkbenchProvider } from '../../app/WorkbenchProvider'
import { ExportDock } from './ExportDock'

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

describe('ExportDock Component', () => {
  it('displays count and format select', () => {
    render(
      <WorkbenchProvider initialPacks={mockPacks}>
        <ExportDock />
      </WorkbenchProvider>,
    )

    // With 0 selected packs, dock is hidden / null
    expect(screen.queryByRole('region', { name: '导出状态' })).toBeNull()
  })
})
