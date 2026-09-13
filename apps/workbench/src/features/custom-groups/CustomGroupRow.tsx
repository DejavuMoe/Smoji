import { useState } from 'react'
import { MoreHorizontal, GripVertical, Check, Trash2, Edit2, Copy, ArrowUp, ArrowDown, Split, GitMerge } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu'
import { useWorkbench } from '../../app/WorkbenchContext'
import type { EditableCustomPack } from '../../domain/state'
import { CustomGroupItemTray } from './CustomGroupItemTray'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'

interface CustomGroupRowProps {
  group: EditableCustomPack
  index: number
  isActive: boolean
  totalGroups: number
}

export function CustomGroupRow({ group, index, isActive, totalGroups }: CustomGroupRowProps) {
  const { dispatch } = useWorkbench()
  const [isEditing, setIsEditing] = useState(false)
  const [editLabel, setEditLabel] = useState(group.label)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const isFull = group.items.length >= 600

  function handleSelect() {
    dispatch({ type: 'SET_ACTIVE_CUSTOM_GROUP', payload: index })
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (editLabel.trim()) {
      dispatch({
        type: 'RENAME_CUSTOM_GROUP',
        payload: { index, label: editLabel.trim() },
      })
    }
    setIsEditing(false)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)

    // Check if dragging another group (reorder)
    const sourceGroupIndex = e.dataTransfer.getData('text/smoji-group-index')
    if (sourceGroupIndex) {
      const fromIndex = parseInt(sourceGroupIndex, 10)
      if (!isNaN(fromIndex) && fromIndex !== index) {
        dispatch({
          type: 'REORDER_CUSTOM_GROUPS',
          payload: { fromIndex, toIndex: index },
        })
        return
      }
    }

    // Check if dragging an emoji item
    const itemSrc = e.dataTransfer.getData('text/smoji-src')
    if (itemSrc) {
      dispatch({
        type: 'MOVE_CUSTOM_ITEM_TO_GROUP',
        payload: { itemSrc, targetGroupIndex: index },
      })
    }
  }

  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData('text/smoji-group-index', String(index))
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      role="listitem"
      data-custom-index={String(index)}
      className={`custom-pack-item group relative rounded-lg border transition-colors ${
        isActive
          ? 'border-primary/50 bg-muted/40 font-medium'
          : 'border-transparent bg-surface/50 hover:border-border hover:bg-muted/20'
      } ${isDragOver ? 'border-primary ring-2 ring-primary/20' : ''}`}
      aria-current={isActive ? 'true' : undefined}
      draggable
      onDragStart={handleDragStart}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-1.5 p-2">
        <span
          className="cursor-grab text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
          title="拖拽调整分组顺序"
          aria-hidden="true"
        >
          <GripVertical className="h-4 w-4" />
        </span>

        {isEditing ? (
          <form className="custom-pack-edit-form flex flex-1 items-center gap-1" onSubmit={handleSaveEdit}>
            <input
              id={`edit-name-${index}`}
              type="text"
              className="h-6 flex-1 rounded border border-input bg-background px-1.5 text-xs text-foreground outline-none focus:border-primary"
              value={editLabel}
              autoFocus
              onChange={(e) => setEditLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsEditing(false)
              }}
            />
            <div className="custom-pack-edit-actions flex gap-1">
              <button
                type="submit"
                className="save rounded bg-primary px-1.5 py-0.5 text-[11px] text-primary-foreground hover:bg-primary/90"
              >
                保存
              </button>
              <button
                type="button"
                className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
                onClick={() => setIsEditing(false)}
              >
                取消
              </button>
            </div>
          </form>
        ) : (
          <>
            <button
              type="button"
              className="custom-pack-name flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onClick={handleSelect}
            >
              <span className="truncate text-foreground">{group.label}</span>
              {isActive && (
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary/20 text-[9px] text-primary">
                  ✓
                </span>
              )}
            </button>

            <span
              className={`custom-pack-count text-[11px] tabular-nums ${
                isFull ? 'is-full font-semibold text-warning' : 'text-muted-foreground'
              }`}
              aria-label={`已用 ${group.items.length} / 600 项`}
            >
              {group.items.length} / 600 张
            </span>

            {/* Dropdown Menu for Group Tools */}
            <div className="group-tools">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                    title="分组操作"
                    aria-label="分组操作"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36 text-xs">
                  <DropdownMenuItem
                    data-group-action="edit"
                    data-edit-index={String(index)}
                    onClick={() => {
                      setEditLabel(group.label)
                      setIsEditing(true)
                    }}
                  >
                    <Edit2 className="mr-2 h-3.5 w-3.5" />
                    <span>编辑名称</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    data-group-action="duplicate"
                    data-duplicate-index={String(index)}
                    onClick={() => dispatch({ type: 'DUPLICATE_CUSTOM_GROUP', payload: index })}
                  >
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    <span>复制分组</span>
                  </DropdownMenuItem>
                  {index > 0 && (
                    <DropdownMenuItem
                      data-group-action="move-up"
                      data-move-index={String(index)}
                      data-move-dir="-1"
                      onClick={() =>
                        dispatch({ type: 'MOVE_CUSTOM_GROUP', payload: { index, direction: -1 } })
                      }
                    >
                      <ArrowUp className="mr-2 h-3.5 w-3.5" />
                      <span>上移</span>
                    </DropdownMenuItem>
                  )}
                  {index < totalGroups - 1 && (
                    <DropdownMenuItem
                      data-group-action="move-down"
                      data-move-index={String(index)}
                      data-move-dir="1"
                      onClick={() =>
                        dispatch({ type: 'MOVE_CUSTOM_GROUP', payload: { index, direction: 1 } })
                      }
                    >
                      <ArrowDown className="mr-2 h-3.5 w-3.5" />
                      <span>下移</span>
                    </DropdownMenuItem>
                  )}
                  {index > 0 && (
                    <DropdownMenuItem
                      data-group-action="merge"
                      data-merge-index={String(index)}
                      onClick={() => dispatch({ type: 'MERGE_CUSTOM_GROUP', payload: index })}
                    >
                      <GitMerge className="mr-2 h-3.5 w-3.5" />
                      <span>向上合并</span>
                    </DropdownMenuItem>
                  )}
                  {group.items.length >= 2 && (
                    <DropdownMenuItem
                      data-group-action="split"
                      data-split-index={String(index)}
                      onClick={() => dispatch({ type: 'SPLIT_CUSTOM_GROUP', payload: index })}
                    >
                      <Split className="mr-2 h-3.5 w-3.5" />
                      <span>拆分分组</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    data-group-action="delete"
                    data-delete-index={String(index)}
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    <span>删除分组</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>

      {/* Thumbnails tray */}
      <CustomGroupItemTray groupIndex={index} items={group.items} />

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        title="删除分组确认"
        description={`确定要删除分组「${group.label}」吗？包含 ${group.items.length} 张表情。此操作可通过撤销 (⌘+Z) 恢复。`}
        onConfirm={() => {
          setDeleteDialogOpen(false)
          dispatch({ type: 'DELETE_CUSTOM_GROUP', payload: index })
        }}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  )
}
