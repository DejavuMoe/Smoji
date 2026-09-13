import { useState, useRef, type ChangeEvent } from 'react'
import { Download, Upload } from 'lucide-react'
import { useWorkbench } from '../../app/WorkbenchContext'
import {
  buildCustomGroupBundle,
  parseCustomGroupBundle,
  parseCustomGroupExtensions,
} from '../../storage'
import { CustomGroupCreateForm } from './CustomGroupCreateForm'
import { CustomGroupRow } from './CustomGroupRow'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'
import type { EditableCustomPack } from '../../domain/state'

export function CustomGroupList() {
  const { state, dispatch, itemLookup } = useWorkbench()
  const groups = state.customGroups.groups
  const activeIndex = state.customGroups.activeGroupIndex
  const notes = state.customGroups.notes ?? ''

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [pendingImport, setPendingImport] = useState<EditableCustomPack[] | null>(null)

  function handleNotesChange(e: ChangeEvent<HTMLInputElement>) {
    dispatch({ type: 'SET_CUSTOM_NOTES', payload: e.target.value })
  }

  function handleExportBundle() {
    if (groups.length === 0) return
    const bundle = buildCustomGroupBundle(groups as any, notes ? { 'smoji.workbench': { notes } } : undefined)
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `smoji-groups-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleFileImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const persistedPacks = parseCustomGroupBundle(json)
      const extensions = parseCustomGroupExtensions(json)
      const importedNotes = (extensions?.['smoji.workbench'] as { notes?: string } | undefined)?.notes

      const parsedGroups: EditableCustomPack[] = persistedPacks.map((p) => ({
        id: p.id,
        label: p.label,
        items: p.itemSrcs
          .map((src) => itemLookup.get(src))
          .filter((item): item is NonNullable<typeof item> => Boolean(item)),
      }))

      if (importedNotes) {
        dispatch({ type: 'SET_CUSTOM_NOTES', payload: importedNotes })
      }

      setPendingImport(parsedGroups)
    } catch (err: any) {
      alert(err.message || '导入文件格式错误')
    }
    // Reset file input value
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div id="custom-builder" className="flex flex-col gap-3">
      {/* Creation form */}
      <CustomGroupCreateForm />

      {/* Bundle notes */}
      <div className="px-1">
        <input
          id="bundle-notes-input"
          type="text"
          placeholder="分组配置备注 (可选)"
          className="h-7 w-full rounded border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          value={notes}
          onChange={handleNotesChange}
        />
      </div>

      {/* Import / Export actions */}
      <div className="flex items-center justify-between px-1">
        <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Upload className="h-3.5 w-3.5" />
          <span>导入分组</span>
          <input
            ref={fileInputRef}
            id="import-groups-file"
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileImport}
          />
        </label>
        <button
          id="btn-export-groups"
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          disabled={groups.length === 0}
          onClick={handleExportBundle}
        >
          <Download className="h-3.5 w-3.5" />
          <span>备份分组</span>
        </button>
      </div>

      {/* Group List */}
      <div
        id="custom-pack-list"
        role="list"
        aria-label="自选分组列表"
        className="flex flex-col gap-1 overflow-y-auto px-1"
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
        description={`确定要导入 ${pendingImport?.length ?? 0} 个分组吗？将追加至当前自选列表中。此操作可通过撤销 (⌘+Z) 恢复。`}
        onConfirm={() => {
          if (pendingImport) {
            dispatch({ type: 'IMPORT_CUSTOM_GROUPS', payload: pendingImport })
          }
          setPendingImport(null)
        }}
        onCancel={() => setPendingImport(null)}
      />
    </div>
  )
}
