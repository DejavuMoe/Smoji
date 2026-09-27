import { useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type KeyboardEvent } from 'react'
import { DropdownMenu } from 'radix-ui'
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, Copy, Download, Ellipsis, GitMerge,
  GripVertical, MoveRight, Pencil, Plus, Redo2, ShieldAlert, Split, Trash2, Undo2, Upload, X,
} from 'lucide-react'
import type { SmojiItem } from 'smoji'
import { useWorkbench } from '../app/WorkbenchContext'
import type { CustomGroupExtensions, EditableCustomPack } from '../domain/state'
import { SMOJI_MAX_ITEMS, SMOJI_MAX_ITEMS_PER_PACK, SMOJI_MAX_PACKS } from '../domain/limits'
import {
  assertCustomGroupBundleSize, buildCustomGroupBundle, loadRawCustomPacksBackup,
  parseCustomGroupBundle, parseCustomGroupExtensions, resolvePersistedItems,
} from '../storage'
import { extensionsWithNotes } from '../persistence/storage'
import { canonicalAssetSrc } from '../asset-paths'
import { isValidSmojiLabel, SMOJI_ID_PATTERN } from '../../../../packages/smoji/src/validate'
import { showToast } from './feedback/toast'
import { useMediaQuery } from '../hooks/use-media-query'
import { IconButton } from '../ui/primitives'
import { Confirm } from '../ui/overlays'
import { Sticker } from '../ui/Sticker'
import { dateStamp, downloadText } from '../lib/actions'

const LABEL_ERROR = '名称需为 1–40 个字符，且不能包含 ] 或控制字符'
const ID_ERROR = 'ID 需以字母或数字开头，仅含字母、数字、点、下划线和连字符'

export function CustomGroups({ onViewGroup }: { onViewGroup?: () => void }) {
  const { state, dispatch, itemLookup, manifestUrl, canUndo, canRedo } = useWorkbench()
  const groups = state.customGroups.groups
  const activeIndex = state.customGroups.activeGroupIndex
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [pendingImport, setPendingImport] = useState<{ groups: EditableCustomPack[]; notes?: string; extensions?: CustomGroupExtensions } | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const rawBackup = useMemo(() => loadRawCustomPacksBackup(), [])
  const total = groups.reduce((count, group) => count + group.items.length, 0)

  function exportBundle() {
    if (!groups.length) return
    downloadText(`smoji-groups-${dateStamp()}.json`, JSON.stringify(buildCustomGroupBundle(groups as never, extensionsWithNotes(state)), null, 2))
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      assertCustomGroupBundleSize(text)
      const json = JSON.parse(text)
      const persisted = parseCustomGroupBundle(json)
      const extensions = parseCustomGroupExtensions(json)
      const imported = extensions?.['smoji.workbench'] as { notes?: unknown } | undefined
      if (imported?.notes !== undefined && typeof imported.notes !== 'string') throw new Error('分组备注必须为文本')
      let unresolved = 0
      const parsed = persisted.map((pack) => {
        const resolved = resolvePersistedItems(pack.itemSrcs, (src) => itemLookup.get(canonicalAssetSrc(src, manifestUrl)) ?? null)
        unresolved += resolved.unresolved
        return { id: pack.id, label: pack.label, items: resolved.items }
      })
      if (unresolved > 0) throw new Error(`有 ${unresolved} 张表情不在当前清单中，已取消导入以避免丢失，请检查备份版本。`)
      const existing = new Set(groups.flatMap((group) => group.items.map((item) => item.src)))
      const added = parsed.reduce((count, group) => count + group.items.filter((item) => !existing.has(item.src)).length, 0)
      if (groups.length + parsed.length > SMOJI_MAX_PACKS || total + added > SMOJI_MAX_ITEMS) {
        throw new Error('导入后将超过 64 个分组或 6000 张表情限制，请先精简分组。')
      }
      setPendingImport({ groups: parsed, notes: typeof imported?.notes === 'string' ? imported.notes : undefined, extensions })
    } catch (error) {
      showToast(error instanceof Error && error.message ? error.message : '导入文件格式错误', 'error')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div id="custom-builder" className="groups">
      <div className="groups__bar">
        <h3 className="eyebrow">自选分组 <span className="eyebrow__n">{groups.length} / {SMOJI_MAX_PACKS}</span></h3>
        <div className="groups__tools">
          <IconButton label="撤销" tip="撤销 (⌘/Ctrl+Z)" disabled={!canUndo} onClick={() => dispatch({ type: 'UNDO' })}><Undo2 aria-hidden="true" /></IconButton>
          <IconButton label="重做" tip="重做 (⌘/Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => dispatch({ type: 'REDO' })}><Redo2 aria-hidden="true" /></IconButton>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="icon-btn" aria-label="导入与管理"><Ellipsis aria-hidden="true" /></button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="menu" align="end" sideOffset={6}>
                <DropdownMenu.Item className="menu__item" onSelect={() => fileRef.current?.click()}><Upload aria-hidden="true" />导入分组</DropdownMenu.Item>
                <DropdownMenu.Item id="btn-export-groups" className="menu__item" disabled={!groups.length} onSelect={exportBundle}><Download aria-hidden="true" />备份分组</DropdownMenu.Item>
                {rawBackup && (
                  <DropdownMenu.Item id="btn-download-raw-backup" className="menu__item"
                    onSelect={() => downloadText(`smoji-groups-raw-${rawBackup.savedAt.slice(0, 10).replace(/-/g, '')}.json`, rawBackup.raw)}>
                    <ShieldAlert aria-hidden="true" />下载原始备份
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Separator className="menu__sep" />
                <DropdownMenu.Item id="btn-clear-all-groups" className="menu__item menu__item--danger" disabled={!groups.length} onSelect={() => setClearOpen(true)}>
                  <Trash2 aria-hidden="true" />清空全部
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
        <input ref={fileRef} id="import-groups-file" type="file" accept=".json,application/json" hidden onChange={importFile} />
      </div>

      <CreateForm />

      {rawBackup && (
        <p className="note note--warn">
          <ShieldAlert aria-hidden="true" />
          历史数据原始备份（{rawBackup.savedAt.slice(0, 10)}，{rawBackup.unresolvedItems} 张未解析）。
        </p>
      )}

      <div id="custom-pack-list" role="list" aria-label="自选分组列表" className="groups__list" data-fly-target="groups">
        {groups.map((group, index) => (
          <GroupCard key={group.id} group={group} index={index} active={index === activeIndex} total={groups.length} onViewGroup={onViewGroup} />
        ))}
        {groups.length === 0 && (
          <div className="kit-empty">
            <p className="kit-empty__title">尚未创建分组</p>
            <p className="kit-empty__text">新建分组后，在图库中点 + 或把表情拖到分组里。</p>
          </div>
        )}
      </div>

      {groups.length > 0 && (
        <label className="notes">
          <span className="sr-only">分组配置备注</span>
          <input id="bundle-notes-input" className="field field--sm" type="text" placeholder="分组配置备注 (可选)" maxLength={240}
            value={state.customGroups.notes ?? ''} onChange={(event) => dispatch({ type: 'SET_CUSTOM_NOTES', payload: event.target.value })} />
        </label>
      )}

      <Confirm open={pendingImport !== null} title="导入分组确认" tone="default" confirmLabel="导入"
        description={`确定要导入 ${pendingImport?.groups.length ?? 0} 个分组吗？将追加至当前自选列表中。此操作可通过撤销 (⌘/Ctrl+Z) 恢复。`}
        onCancel={() => setPendingImport(null)}
        onConfirm={() => {
          if (pendingImport) dispatch({
            type: 'IMPORT_CUSTOM_GROUPS',
            payload: {
              groups: pendingImport.groups,
              ...(pendingImport.notes !== undefined ? { notes: pendingImport.notes } : {}),
              ...(pendingImport.extensions !== undefined ? { extensions: pendingImport.extensions } : {}),
            },
          })
          setPendingImport(null)
        }} />
      <Confirm open={clearOpen} title="清空自选分组确认" confirmLabel="清空"
        description={`确定要清空全部 ${groups.length} 个自选分组吗？此操作可通过撤销 (⌘/Ctrl+Z) 恢复。`}
        onCancel={() => setClearOpen(false)}
        onConfirm={() => { setClearOpen(false); dispatch({ type: 'CLEAR_ALL_CUSTOM_GROUPS' }) }} />
    </div>
  )
}

function CreateForm() {
  const { state, dispatch } = useWorkbench()
  const [name, setName] = useState('')
  const [id, setId] = useState('')
  const [showId, setShowId] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const groups = state.customGroups.groups
  const atCapacity = groups.length >= SMOJI_MAX_PACKS

  function submit(event: FormEvent) {
    event.preventDefault()
    const label = name.trim()
    const trimmedId = id.trim()
    if (!isValidSmojiLabel(label)) return setError(LABEL_ERROR)
    if (atCapacity) return setError(`分组数量已达上限 ${SMOJI_MAX_PACKS} 个`)
    if (trimmedId && !SMOJI_ID_PATTERN.test(trimmedId)) return setError(ID_ERROR)
    if (trimmedId && groups.some((group) => group.id === trimmedId)) return setError(`分组 ID「${trimmedId}」已存在`)
    dispatch({ type: 'CREATE_CUSTOM_GROUP', payload: { label, ...(trimmedId ? { id: trimmedId } : {}) } })
    setError(null)
    setName('')
    setId('')
    setShowId(false)
  }

  return (
    <form id="custom-add-form" className="create" onSubmit={submit} noValidate>
      <div className="create__row">
        <label htmlFor="custom-name-input" className="sr-only">分组名称</label>
        <input id="custom-name-input" className="field" type="text" placeholder={atCapacity ? `已达 ${SMOJI_MAX_PACKS} 组上限` : '新建分组，如：常用'}
          maxLength={40} value={name} disabled={atCapacity}
          aria-invalid={Boolean(error)} aria-describedby={error ? 'custom-create-error' : undefined}
          onChange={(event) => { setName(event.target.value); if (error) setError(null) }} />
        <button id="btn-create-custom-pack" type="submit" className="btn btn--ink" disabled={atCapacity}>
          <Plus aria-hidden="true" strokeWidth={2.4} />添加
        </button>
      </div>
      <button type="button" className="create__toggle" aria-expanded={showId} aria-controls="custom-id-row" onClick={() => setShowId((value) => !value)}>
        自定义 ID<ChevronDown aria-hidden="true" />
      </button>
      {showId && (
        <div id="custom-id-row" className="create__row">
          <label htmlFor="custom-id-input" className="sr-only">分组 ID（可选）</label>
          <input id="custom-id-input" className="field field--mono" type="text" placeholder="分组 ID（可选，默认按名称生成）" maxLength={64}
            value={id} aria-invalid={Boolean(error)} aria-describedby={error ? 'custom-create-error' : undefined}
            onChange={(event) => { setId(event.target.value); if (error) setError(null) }} />
        </div>
      )}
      {error && <p id="custom-create-error" role="alert" className="field-error">{error}</p>}
    </form>
  )
}

interface GroupCardProps {
  group: EditableCustomPack
  index: number
  active: boolean
  total: number
  onViewGroup?: () => void
}

function GroupCard({ group, index, active, total, onViewGroup }: GroupCardProps) {
  const { state, dispatch } = useWorkbench()
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(group.label)
  const [id, setId] = useState(group.id)
  const [error, setError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const wasEditing = useRef(false)
  const previous = state.customGroups.groups[index - 1]
  const mergeTooLarge = previous && new Set([...previous.items, ...group.items].map((item) => item.src)).size > SMOJI_MAX_ITEMS_PER_PACK
  const atCapacity = total >= SMOJI_MAX_PACKS
  const full = group.items.length >= SMOJI_MAX_ITEMS_PER_PACK

  useLayoutEffect(() => {
    if (wasEditing.current && !editing) cardRef.current?.querySelector<HTMLElement>('.group__menu')?.focus()
    wasEditing.current = editing
  }, [editing])

  function save(event: FormEvent) {
    event.preventDefault()
    const nextLabel = label.trim()
    const nextId = id.trim()
    if (!isValidSmojiLabel(nextLabel)) return setError(LABEL_ERROR)
    if (nextId && !SMOJI_ID_PATTERN.test(nextId)) return setError(ID_ERROR)
    if (nextId && nextId !== group.id && state.customGroups.groups.some((entry, i) => i !== index && entry.id === nextId)) {
      return setError(`分组 ID「${nextId}」已存在`)
    }
    if (nextId && nextId !== group.id) dispatch({ type: 'SET_CUSTOM_GROUP_ID', payload: { index, id: nextId } })
    if (nextLabel !== group.label) dispatch({ type: 'RENAME_CUSTOM_GROUP', payload: { index, label: nextLabel } })
    setError(null)
    setEditing(false)
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOver(false)
    const fromGroup = event.dataTransfer.getData('text/smoji-group-index')
    if (fromGroup) {
      const fromIndex = Number.parseInt(fromGroup, 10)
      if (!Number.isNaN(fromIndex) && fromIndex !== index) dispatch({ type: 'REORDER_CUSTOM_GROUPS', payload: { fromIndex, toIndex: index } })
      return
    }
    const itemSrc = event.dataTransfer.getData('text/smoji-src')
    if (!itemSrc) return
    const trayGroup = Number.parseInt(event.dataTransfer.getData('text/smoji-tray-group'), 10)
    const trayIndex = Number.parseInt(event.dataTransfer.getData('text/smoji-tray-index'), 10)
    dispatch({
      type: 'MOVE_CUSTOM_ITEM_TO_GROUP',
      payload: { itemSrc, targetGroupIndex: index, ...(!Number.isNaN(trayGroup) ? { sourceGroupIndex: trayGroup, sourceItemIndex: trayIndex } : {}) },
    })
  }

  const escape = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); setEditing(false) }
  }

  return (
    <div ref={cardRef} role="listitem" className="group" data-custom-index={index} data-fly-target={`group-${index}`}
      data-active={active || undefined} data-drop={dragOver || undefined} aria-current={active ? 'true' : undefined}
      draggable={!editing}
      onDragStart={(event) => {
        if ((event.target as HTMLElement).closest('[data-tray-item]')) return
        event.dataTransfer.setData('text/smoji-group-index', String(index))
        event.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(event) => { event.preventDefault(); if (!dragOver) setDragOver(true) }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(false) }}
      onDrop={onDrop}>
      {editing ? (
        <form className="group__edit" data-own-escape onSubmit={save}>
          <label htmlFor={`edit-name-${index}`} className="sr-only">分组名称</label>
          <input id={`edit-name-${index}`} className="field field--sm" value={label} maxLength={40} autoFocus
            aria-invalid={Boolean(error)} aria-describedby={error ? `edit-error-${index}` : undefined}
            onChange={(event) => { setLabel(event.target.value); if (error) setError(null) }} onKeyDown={escape} />
          <label htmlFor={`edit-id-${index}`} className="sr-only">分组 ID</label>
          <input id={`edit-id-${index}`} className="field field--sm field--mono" value={id} maxLength={64}
            aria-invalid={Boolean(error)} aria-describedby={error ? `edit-error-${index}` : undefined}
            onChange={(event) => { setId(event.target.value); if (error) setError(null) }} onKeyDown={escape} />
          {error && <p id={`edit-error-${index}`} role="alert" className="field-error">{error}</p>}
          <div className="group__edit-actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}>取消</button>
            <button type="submit" className="btn btn--ink btn--sm">保存</button>
          </div>
        </form>
      ) : (
        <div className="group__head">
          <span className="group__grip" aria-hidden="true"><GripVertical /></span>
          <button type="button" className="group__name custom-pack-name" onClick={() => dispatch({ type: 'SET_ACTIVE_CUSTOM_GROUP', payload: index })}>
            <span className="group__dot" aria-hidden="true" />
            <span className="group__label">{group.label}</span>
          </button>
          <span className="group__count" data-full={full || undefined} aria-label={`已用 ${group.items.length} / ${SMOJI_MAX_ITEMS_PER_PACK} 项`}>
            {group.items.length}<span>/{SMOJI_MAX_ITEMS_PER_PACK}</span>
          </span>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="icon-btn icon-btn--sm group__menu" aria-label="分组操作"><Ellipsis aria-hidden="true" /></button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="menu" align="end" sideOffset={6}>
                <DropdownMenu.Item className="menu__item" data-group-action="edit"
                  onSelect={() => { setLabel(group.label); setId(group.id); setError(null); setEditing(true) }}>
                  <Pencil aria-hidden="true" />编辑名称 / ID
                </DropdownMenu.Item>
                <DropdownMenu.Item className="menu__item" data-group-action="duplicate" disabled={atCapacity}
                  onSelect={() => dispatch({ type: 'DUPLICATE_CUSTOM_GROUP', payload: index })}>
                  <Copy aria-hidden="true" />{atCapacity ? `复制（已达 ${SMOJI_MAX_PACKS} 组上限）` : '复制分组'}
                </DropdownMenu.Item>
                {index > 0 && (
                  <DropdownMenu.Item className="menu__item" data-group-action="move-up"
                    onSelect={() => dispatch({ type: 'MOVE_CUSTOM_GROUP', payload: { index, direction: -1 } })}>
                    <ArrowUp aria-hidden="true" />上移
                  </DropdownMenu.Item>
                )}
                {index < total - 1 && (
                  <DropdownMenu.Item className="menu__item" data-group-action="move-down"
                    onSelect={() => dispatch({ type: 'MOVE_CUSTOM_GROUP', payload: { index, direction: 1 } })}>
                    <ArrowDown aria-hidden="true" />下移
                  </DropdownMenu.Item>
                )}
                {index > 0 && (
                  <DropdownMenu.Item className="menu__item" data-group-action="merge" disabled={mergeTooLarge}
                    onSelect={() => dispatch({ type: 'MERGE_CUSTOM_GROUP', payload: index })}>
                    <GitMerge aria-hidden="true" />{mergeTooLarge ? '合并超出 600 张限制' : '向上合并'}
                  </DropdownMenu.Item>
                )}
                {group.items.length >= 2 && (
                  <DropdownMenu.Item className="menu__item" data-group-action="split" disabled={atCapacity}
                    onSelect={() => dispatch({ type: 'SPLIT_CUSTOM_GROUP', payload: index })}>
                    <Split aria-hidden="true" />{atCapacity ? `拆分（已达 ${SMOJI_MAX_PACKS} 组上限）` : '拆分分组'}
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Separator className="menu__sep" />
                <DropdownMenu.Item className="menu__item menu__item--danger" data-group-action="delete" onSelect={() => setDeleteOpen(true)}>
                  <Trash2 aria-hidden="true" />删除分组
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      )}

      <Tray groupIndex={index} items={group.items} onViewGroup={onViewGroup} />

      <Confirm open={deleteOpen} title="删除分组确认" confirmLabel="删除"
        returnSelector={`[data-custom-index="${index}"] .group__menu`}
        fallbackSelector={`[data-custom-index="${Math.min(index, total - 2)}"] .custom-pack-name, #custom-name-input`}
        description={`确定要删除分组「${group.label}」吗？包含 ${group.items.length} 张表情。此操作可通过撤销 (⌘/Ctrl+Z) 恢复。`}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => { setDeleteOpen(false); dispatch({ type: 'DELETE_CUSTOM_GROUP', payload: index }) }} />
    </div>
  )
}

export function Tray({ groupIndex, items, onViewGroup }: { groupIndex: number; items: readonly SmojiItem[]; onViewGroup?: () => void }) {
  const { state, dispatch } = useWorkbench()
  const compact = useMediaQuery('(max-width: 600px)')
  const [dragged, setDragged] = useState<number | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)
  const trayRef = useRef<HTMLDivElement | null>(null)
  const pendingFocus = useRef<{ src?: string; index: number; fallback?: HTMLElement | null } | null>(null)
  const limit = compact ? 12 : 30
  const visible = items.slice(0, limit)
  const remaining = items.length - visible.length
  const others = state.customGroups.groups.map((group, index) => ({ group, index })).filter(({ index }) => index !== groupIndex)

  function placePendingFocus() {
    const pending = pendingFocus.current
    if (!pending) return
    pendingFocus.current = null
    const buttons = Array.from(trayRef.current?.querySelectorAll<HTMLElement>('[data-tray-item]') ?? [])
    const same = pending.src ? buttons.find((button) => button.dataset.traySrc === pending.src) : undefined
    const target = same ?? buttons[Math.min(pending.index, buttons.length - 1)] ?? pending.fallback
    target?.focus()
  }

  useLayoutEffect(placePendingFocus, [items])

  // Captured before the change: once the last item leaves, the list itself is gone.
  const groupName = () => trayRef.current?.closest('[data-custom-index]')?.querySelector<HTMLElement>('.custom-pack-name') ?? null

  function move(itemIndex: number, direction: -1 | 1) {
    const toIndex = itemIndex + direction
    if (toIndex < 0 || toIndex >= items.length) return
    pendingFocus.current = { src: items[itemIndex]?.src, index: itemIndex, fallback: groupName() }
    dispatch({ type: 'REORDER_CUSTOM_ITEMS', payload: { groupIndex, fromIndex: itemIndex, toIndex } })
  }
  function remove(itemIndex: number) {
    pendingFocus.current = { index: itemIndex, fallback: groupName() }
    dispatch({ type: 'REMOVE_CUSTOM_ITEM', payload: { groupIndex, itemIndex } })
  }
  function onKeyDown(event: KeyboardEvent<HTMLElement>, itemIndex: number) {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.shiftKey) return
    if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault()
      move(itemIndex, event.key === 'ArrowLeft' ? -1 : 1)
    } else if (!event.altKey && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault()
      remove(itemIndex)
    }
  }

  if (items.length === 0) return <p className="group__hint">拖入表情，或在图库中点 +</p>

  return (
    <div ref={trayRef} role="list" aria-label="分组内表情缩略图" className="tray">
      {visible.map((item, itemIndex) => (
        <div key={item.src} role="listitem" className="tray__cell" data-dragging={dragged === itemIndex || undefined}
          data-drop={dropAt === itemIndex && dragged !== itemIndex ? (dragged !== null && dragged < itemIndex ? 'after' : 'before') : undefined}>
          <button type="button" className="tray__item" data-tray-item={itemIndex} data-tray-src={item.src} draggable
            aria-label={`${item.label}：Enter 预览，Alt 加左右方向键排序，Delete 移出`}
            onClick={() => dispatch({ type: 'OPEN_INSPECTOR', payload: item.src })}
            onKeyDown={(event) => onKeyDown(event, itemIndex)}
            onDragStart={(event) => {
              event.stopPropagation()
              setDragged(itemIndex)
              event.dataTransfer.setData('text/smoji-src', item.src)
              event.dataTransfer.setData('text/smoji-tray-index', String(itemIndex))
              event.dataTransfer.setData('text/smoji-tray-group', String(groupIndex))
              event.dataTransfer.effectAllowed = 'move'
            }}
            onDragEnd={() => { setDragged(null); setDropAt(null) }}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; if (dropAt !== itemIndex) setDropAt(itemIndex) }}
            onDrop={(event) => {
              event.preventDefault()
              setDropAt(null)
              if (event.dataTransfer.getData('text/smoji-tray-group') !== String(groupIndex)) return
              event.stopPropagation()
              const fromIndex = Number.parseInt(event.dataTransfer.getData('text/smoji-tray-index'), 10)
              if (!Number.isNaN(fromIndex) && fromIndex !== itemIndex) {
                dispatch({ type: 'REORDER_CUSTOM_ITEMS', payload: { groupIndex, fromIndex, toIndex: itemIndex } })
              }
              setDragged(null)
            }}>
            <Sticker src={item.src} alt="" />
          </button>
          <div className="tray__tools">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button type="button" className="tray__tool" aria-label={`排序或移动 ${item.label}`}><Ellipsis aria-hidden="true" /></button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="menu" align="start" sideOffset={4}
                  onCloseAutoFocus={(event) => {
                    if (!pendingFocus.current) return
                    event.preventDefault()
                    // A rejected move leaves the items untouched, so the layout effect never runs.
                    requestAnimationFrame(placePendingFocus)
                  }}>
                  <DropdownMenu.Label className="menu__label">排序与移动</DropdownMenu.Label>
                  <DropdownMenu.Item className="menu__item" disabled={itemIndex === 0} onSelect={() => move(itemIndex, -1)}>
                    <ArrowLeft aria-hidden="true" />左移
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className="menu__item" disabled={itemIndex === items.length - 1} onSelect={() => move(itemIndex, 1)}>
                    <ArrowRight aria-hidden="true" />右移
                  </DropdownMenu.Item>
                  {others.length > 0 && <DropdownMenu.Separator className="menu__sep" />}
                  {others.map(({ group, index }) => (
                    <DropdownMenu.Item key={group.id} className="menu__item" onSelect={() => {
                      pendingFocus.current = { index: itemIndex, fallback: groupName() }
                      dispatch({ type: 'MOVE_CUSTOM_ITEM_TO_GROUP', payload: { itemSrc: item.src, targetGroupIndex: index, sourceGroupIndex: groupIndex } })
                    }}>
                      <MoveRight aria-hidden="true" /><span className="menu__truncate">移至「{group.label}」</span>
                    </DropdownMenu.Item>
                  ))}
                  <DropdownMenu.Separator className="menu__sep" />
                  <DropdownMenu.Item className="menu__item menu__item--danger" onSelect={() => remove(itemIndex)}>
                    <X aria-hidden="true" />从分组移出
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <button type="button" className="tray__tool tray__tool--x" aria-label={`移出 ${item.label}`} onClick={() => remove(itemIndex)}>
              <X aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
      {remaining > 0 && (
        <button type="button" className="tray__more" onClick={() => {
          dispatch({ type: 'SET_ACTIVE_CUSTOM_GROUP', payload: groupIndex })
          dispatch({ type: 'SET_GALLERY_VIEW', payload: 'picked' })
          onViewGroup?.()
          requestAnimationFrame(() => document.getElementById('grid')?.focus())
        }}>
          {compact ? `查看全部 ${items.length} 项` : `+${remaining}`}
        </button>
      )}
    </div>
  )
}
