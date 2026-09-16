import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { useState, useRef, useMemo, type ChangeEvent } from 'react'
import { Download, Upload, Trash2, ShieldAlert } from 'lucide-react'
import { useWorkbench } from '../../app/WorkbenchContext'
import {
  assertCustomGroupBundleSize,
  buildCustomGroupBundle,
  loadRawCustomPacksBackup,
  parseCustomGroupBundle,
  parseCustomGroupExtensions,
  resolvePersistedItems,
} from '../../storage'
import { extensionsWithNotes } from '../../persistence/storage'
import { CustomGroupCreateForm } from './CustomGroupCreateForm'
import { CustomGroupRow } from './CustomGroupRow'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'
import type { CustomGroupExtensions, EditableCustomPack } from '../../domain/state'
import { canonicalAssetSrc } from '../../asset-paths'
import { SMOJI_MAX_PACKS, SMOJI_MAX_ITEMS } from '../../domain/limits'
import { showToast } from '../feedback/toast'

function downloadJson(filename: string, payload: string): void {
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}

export function CustomGroupList() {
  const { state, dispatch, itemLookup, manifestUrl, canUndo, canRedo } = useWorkbench()
  const groups = state.customGroups.groups
  const activeIndex = state.customGroups.activeGroupIndex
  const notes = state.customGroups.notes ?? ''

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [pendingImport, setPendingImport] = useState<{
    groups: EditableCustomPack[]
    notes?: string
    extensions?: CustomGroupExtensions
  } | null>(null)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const rawBackup = useMemo(() => loadRawCustomPacksBackup(), [])

  function handleNotesChange(e: ChangeEvent<HTMLInputElement>) {
    dispatch({ type: 'SET_CUSTOM_NOTES', payload: e.target.value })
  }

  function handleExportBundle() {
    if (groups.length === 0) return
    const bundle = buildCustomGroupBundle(groups as any, extensionsWithNotes(state))
    downloadJson(`smoji-groups-${stamp()}.json`, JSON.stringify(bundle, null, 2))
  }

  function handleDownloadRawBackup() {
    if (!rawBackup) return
    downloadJson(`smoji-groups-raw-${rawBackup.savedAt.slice(0, 10).replace(/-/g, '')}.json`, rawBackup.raw)
  }

  async function handleFileImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      assertCustomGroupBundleSize(text)
      const json = JSON.parse(text)
      const persistedPacks = parseCustomGroupBundle(json)
      const extensions = parseCustomGroupExtensions(json)
      const importedNotes = extensions?.['smoji.workbench'] as { notes?: unknown } | undefined
      if (importedNotes?.notes !== undefined && typeof importedNotes.notes !== 'string') {
        throw new Error('分组备注必须为文本')
      }

      // Import and restore must share the same normalization/dedupe rules.
      let unresolved = 0
      const parsedGroups: EditableCustomPack[] = persistedPacks.map((p) => {
        const resolved = resolvePersistedItems(p.itemSrcs, (src) =>
          itemLookup.get(canonicalAssetSrc(src, manifestUrl)) ?? null,
        )
        unresolved += resolved.unresolved
        return { id: p.id, label: p.label, items: resolved.items }
      })

      if (unresolved > 0) {
        throw new Error(`有 ${unresolved} 张表情不在当前清单中，已取消导入以避免丢失，请检查备份版本。`)
      }

      const existingSrcs = new Set(groups.flatMap((group) => group.items.map((item) => item.src)))
      const addedCount = parsedGroups.reduce(
        (count, group) => count + group.items.filter((item) => !existingSrcs.has(item.src)).length,
        0,
      )
      if (groups.length + parsedGroups.length > SMOJI_MAX_PACKS ||
        groups.reduce((count, group) => count + group.items.length, 0) + addedCount > SMOJI_MAX_ITEMS) {
        throw new Error('导入后将超过 64 个分组或 6000 张表情限制，请先精简分组。')
      }
      setPendingImport({
        groups: parsedGroups,
        notes: typeof importedNotes?.notes === 'string' ? importedNotes.notes : undefined,
        extensions,
      })
    } catch (err: any) {
      showToast(err.message || '导入文件格式错误', 'error')
    }
    // Reset file input value
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div id="custom-builder" className="flex min-w-0 flex-col gap-3">
      <div className="flex gap-2 sm:hidden">
        <Button variant="ghost" type="button" className="rounded border px-3 py-2 text-xs disabled:opacity-40" disabled={!canUndo} onClick={() => dispatch({ type: 'UNDO' })}>撤销</Button>
        <Button variant="ghost" type="button" className="rounded border px-3 py-2 text-xs disabled:opacity-40" disabled={!canRedo} onClick={() => dispatch({ type: 'REDO' })}>重做</Button>
      </div>
      {/* Creation form */}
      <CustomGroupCreateForm />

      {/* Bundle notes */}
      <div className="px-1">
        <Input
          id="bundle-notes-input"
          type="text"
          placeholder="分组配置备注 (可选)"
          aria-label="分组配置备注"
          className="h-7 w-full rounded border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground "
          value={notes}
          onChange={handleNotesChange}
        />
      </div>

      {/* Import / Export actions */}
      <div className="grid min-w-0 grid-cols-3 gap-0.5">
        <Button variant="ghost" type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex min-w-0 cursor-pointer items-center gap-1 px-0 text-[11px] text-muted-foreground hover:text-foreground">
          <Upload className="hidden size-3 min-[1100px]:block" />
          <span>导入分组</span>
        </Button>
        <input
          ref={fileInputRef}
          id="import-groups-file"
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileImport}
        />
        <div className="contents">
          <Button variant="ghost"
            id="btn-clear-all-groups"
            type="button"
            className="inline-flex min-w-0 items-center gap-1 px-0 text-[11px] text-destructive hover:underline disabled:pointer-events-none disabled:opacity-40"
            disabled={groups.length === 0}
            onClick={() => setClearDialogOpen(true)}
          >
            <Trash2 className="hidden size-3 min-[1100px]:block" />
            <span>清空全部</span>
          </Button>
          <Button variant="ghost"
            id="btn-export-groups"
            type="button"
            className="inline-flex min-w-0 items-center gap-1 px-0 text-[11px] text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            disabled={groups.length === 0}
            onClick={handleExportBundle}
          >
            <Download className="hidden size-3 min-[1100px]:block" />
            <span>备份分组</span>
          </Button>
        </div>
      </div>

      {/* Pre-migration raw backup recovery entry */}
      {rawBackup && (
        <div className="flex items-start gap-1.5 rounded-lg border border-warning/40 bg-warning/5 px-2 py-1.5 text-[11px] text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <div className="min-w-0">
            <p>历史数据原始备份（{rawBackup.savedAt.slice(0, 10)}，{rawBackup.unresolvedItems} 张未解析）。</p>
            <Button variant="ghost"
              id="btn-download-raw-backup"
              type="button"
              className="text-primary hover:underline"
              onClick={handleDownloadRawBackup}
            >
              下载原始备份
            </Button>
          </div>
        </div>
      )}

      {/* Group List */}
      <div
        id="custom-pack-list"
        role="list"
        aria-label="自选分组列表"
        className="flex flex-col gap-1 min-w-0 px-1"
      >
        {groups.map((group, index) => (
          <CustomGroupRow
            key={group.id}
            group={group}
            index={index}
            isActive={index === activeIndex}
            totalGroups={groups.length}
          />
        ))}

        {groups.length === 0 && (
          <div className="py-6 text-center text-xs text-muted-foreground">
            尚未创建分组，点击上方新建
          </div>
        )}
      </div>

      {/* Import confirmation dialog */}
      <DeleteConfirmDialog
        open={pendingImport !== null}
        title="导入分组确认"
        description={`确定要导入 ${pendingImport?.groups.length ?? 0} 个分组吗？将追加至当前自选列表中。此操作可通过撤销 (⌘/Ctrl+Z) 恢复。`}
        onConfirm={() => {
          if (pendingImport) {
            dispatch({
              type: 'IMPORT_CUSTOM_GROUPS',
              payload: {
                groups: pendingImport.groups,
                ...(pendingImport.notes !== undefined ? { notes: pendingImport.notes } : {}),
                ...(pendingImport.extensions !== undefined ? { extensions: pendingImport.extensions } : {}),
              },
            })
          }
          setPendingImport(null)
        }}
        onCancel={() => setPendingImport(null)}
      />

      {/* Clear-all confirmation */}
      <DeleteConfirmDialog
        open={clearDialogOpen}
        title="清空自选分组确认"
        description={`确定要清空全部 ${groups.length} 个自选分组吗？此操作可通过撤销 (⌘/Ctrl+Z) 恢复。`}
        onConfirm={() => {
          setClearDialogOpen(false)
          dispatch({ type: 'CLEAR_ALL_CUSTOM_GROUPS' })
        }}
        onCancel={() => setClearDialogOpen(false)}
      />
    </div>
  )
}
