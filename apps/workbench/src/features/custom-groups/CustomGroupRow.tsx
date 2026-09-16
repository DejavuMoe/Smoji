import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { useLayoutEffect, useRef, useState } from 'react'
import { MoreHorizontal, GripVertical, Trash2, Edit2, Copy, ArrowUp, ArrowDown, Split, GitMerge } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu'
import { isValidSmojiLabel, SMOJI_ID_PATTERN } from '../../../../../packages/smoji/src/validate'
import { useWorkbench } from '../../app/WorkbenchContext'
import type { EditableCustomPack } from '../../domain/state'
import { SMOJI_MAX_PACKS } from '../../domain/limits'
import { CustomGroupItemTray } from './CustomGroupItemTray'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'

const LABEL_ERROR = '名称需为 1–40 个字符，且不能包含 ] 或控制字符'
const ID_ERROR = 'ID 需以字母或数字开头，仅含字母、数字、点、下划线和连字符'

interface CustomGroupRowProps {
  group: EditableCustomPack
  index: number
  isActive: boolean
  totalGroups: number
}

export function CustomGroupRow({ group, index, isActive, totalGroups }: CustomGroupRowProps) {
  const { dispatch, state } = useWorkbench()
  const previousGroup = state.customGroups.groups[index - 1]
  const mergeTooLarge = previousGroup && new Set([...previousGroup.items, ...group.items].map((item) => item.src)).size > 600
  const [isEditing, setIsEditing] = useState(false)
  const [editLabel, setEditLabel] = useState(group.label)
  const [editId, setEditId] = useState(group.id)
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const rowRef = useRef<HTMLDivElement | null>(null)
  const wasEditing = useRef(false)
  useLayoutEffect(() => {
    if (wasEditing.current && !isEditing) rowRef.current?.querySelector<HTMLElement>('.group-tools button')?.focus()
    wasEditing.current = isEditing
  }, [isEditing])

  const isFull = group.items.length >= 600
  const atGroupCapacity = totalGroups >= SMOJI_MAX_PACKS

  function handleSelect() {
    dispatch({ type: 'SET_ACTIVE_CUSTOM_GROUP', payload: index })
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedLabel = editLabel.trim()
    const trimmedId = editId.trim()
    if (!isValidSmojiLabel(trimmedLabel)) {
      setEditError(LABEL_ERROR)
      return
    }
    if (trimmedId && !SMOJI_ID_PATTERN.test(trimmedId)) {
      setEditError(ID_ERROR)
      return
    }
    if (
      trimmedId &&
      trimmedId !== group.id &&
      state.customGroups.groups.some((entry, i) => i !== index && entry.id === trimmedId)
    ) {
      setEditError(`分组 ID「${trimmedId}」已存在`)
      return
    }

    if (trimmedId && trimmedId !== group.id) {
      dispatch({ type: 'SET_CUSTOM_GROUP_ID', payload: { index, id: trimmedId } })
    }
    if (trimmedLabel !== group.label) {
      dispatch({ type: 'RENAME_CUSTOM_GROUP', payload: { index, label: trimmedLabel } })
    }
    setEditError(null)
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

    // Check if dragging an emoji item. Tray drops carry their source group, so this is a move,
    // not the gallery's copy-into-group action.
    const itemSrc = e.dataTransfer.getData('text/smoji-src')
    if (itemSrc) {
      const trayGroup = e.dataTransfer.getData('text/smoji-tray-group')
      const trayIndex = e.dataTransfer.getData('text/smoji-tray-index')
      const fromTray = trayGroup !== '' && !isNaN(parseInt(trayGroup, 10))
      dispatch({
        type: 'MOVE_CUSTOM_ITEM_TO_GROUP',
        payload: {
          itemSrc,
          targetGroupIndex: index,
          ...(fromTray
            ? { sourceGroupIndex: parseInt(trayGroup, 10), sourceItemIndex: parseInt(trayIndex, 10) }
            : {}),
        },
      })
    }
  }

  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData('text/smoji-group-index', String(index))
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      ref={rowRef}
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
          className="shrink-0 cursor-grab text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
          aria-hidden="true"
        >
          <GripVertical className="h-4 w-4" />
        </span>

        {isEditing ? (
          <form className="custom-pack-edit-form flex flex-1 min-w-0 flex-col gap-1" onSubmit={handleSaveEdit}>
            <div className="flex flex-1 min-w-0 items-center gap-1">
              <label htmlFor={`edit-name-${index}`} className="sr-only">分组名称</label>
              <Input
                id={`edit-name-${index}`}
                type="text"
                className="h-6 min-w-0 flex-1 rounded border border-input bg-background px-1.5 text-xs text-foreground "
                aria-invalid={Boolean(editError)}
                aria-describedby={editError ? `edit-error-${index}` : undefined}
                value={editLabel}
                maxLength={40}
                autoFocus
                onChange={(e) => {
                  setEditLabel(e.target.value)
                  if (editError) setEditError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && !e.nativeEvent.isComposing) { e.preventDefault(); e.stopPropagation(); setIsEditing(false) }
                }}
              />
              <div className="custom-pack-edit-actions flex shrink-0 gap-1">
                <Button variant="ghost"
                  type="submit"
                  className="save rounded bg-primary px-1.5 py-0.5 text-[11px] text-primary-foreground hover:bg-primary/90"
                >
                  保存
                </Button>
                <Button variant="ghost"
                  type="button"
                  className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
                  onClick={() => setIsEditing(false)}
                >
                  取消
                </Button>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-1">
              <label htmlFor={`edit-id-${index}`} className="sr-only">分组 ID</label>
              <Input
                id={`edit-id-${index}`}
                type="text"
                className="h-6 min-w-0 flex-1 rounded border border-input bg-background px-1.5 font-mono text-[11px] text-foreground "
                aria-invalid={Boolean(editError)}
                value={editId}
                maxLength={64}
                aria-describedby={editError ? `edit-error-${index}` : undefined}
                onChange={(e) => {
                  setEditId(e.target.value)
                  if (editError) setEditError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && !e.nativeEvent.isComposing) { e.preventDefault(); e.stopPropagation(); setIsEditing(false) }
                }}
              />
            </div>
            {editError && (
              <p id={`edit-error-${index}`} role="alert" className="text-[11px] text-destructive">
                {editError}
              </p>
            )}
          </form>
        ) : (
          <>
            <Button variant="ghost"
              type="button"
              className="custom-pack-name flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs "
              onClick={handleSelect}
            >
              <span className="truncate text-foreground">{group.label}</span>
              {isActive && (
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary/20 text-[9px] text-primary">
                  ✓
                </span>
              )}
            </Button>

            <span
              className={`custom-pack-count shrink-0 text-[11px] tabular-nums ${
                isFull ? 'is-full font-semibold text-warning' : 'text-muted-foreground'
              }`}
              aria-label={`已用 ${group.items.length} / 600 项`}
            >
              {group.items.length} / 600 张
            </span>

            {/* Dropdown Menu for Group Tools */}
            <div className="group-tools shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost"
                    type="button"
                    className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground "
                    tooltip="分组操作"
                    aria-label="分组操作"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 text-xs">
                  <DropdownMenuItem
                    data-group-action="edit"
                    data-edit-index={String(index)}
                    onClick={() => {
                      setEditLabel(group.label)
                      setEditId(group.id)
                      setEditError(null)
                      setIsEditing(true)
                    }}
                  >
                    <Edit2 className="mr-2 h-3.5 w-3.5" />
                    <span>编辑名称 / ID</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    data-group-action="duplicate"
                    data-duplicate-index={String(index)}
                    disabled={atGroupCapacity}
                    onClick={() => dispatch({ type: 'DUPLICATE_CUSTOM_GROUP', payload: index })}
                  >
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    <span>{atGroupCapacity ? `复制（已达 ${SMOJI_MAX_PACKS} 组上限）` : '复制分组'}</span>
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
                      disabled={mergeTooLarge}
                      data-merge-index={String(index)}
                      onClick={() => dispatch({ type: 'MERGE_CUSTOM_GROUP', payload: index })}
                    >
                      <GitMerge className="mr-2 h-3.5 w-3.5" />
                      <span>{mergeTooLarge ? '合并超出 600 张限制' : '向上合并'}</span>
                    </DropdownMenuItem>
                  )}
                  {group.items.length >= 2 && (
                    <DropdownMenuItem
                      data-group-action="split"
                      data-split-index={String(index)}
                      disabled={atGroupCapacity}
                      onClick={() => dispatch({ type: 'SPLIT_CUSTOM_GROUP', payload: index })}
                    >
                      <Split className="mr-2 h-3.5 w-3.5" />
                      <span>{atGroupCapacity ? `拆分（已达 ${SMOJI_MAX_PACKS} 组上限）` : '拆分分组'}</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    data-group-action="delete"
                    data-delete-index={String(index)}
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    onClick={() => {
                      setDeleteDialogOpen(true)
                    }}
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
        returnSelector={`[data-custom-index="${index}"] .group-tools button`}
        fallbackSelector={`[data-custom-index="${Math.min(index, totalGroups - 2)}"] .custom-pack-name, #custom-create summary`}
        title="删除分组确认"
        description={`确定要删除分组「${group.label}」吗？包含 ${group.items.length} 张表情。此操作可通过撤销 (⌘/Ctrl+Z) 恢复。`}
        onConfirm={() => {
          setDeleteDialogOpen(false)
          dispatch({ type: 'DELETE_CUSTOM_GROUP', payload: index })
        }}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  )
}
