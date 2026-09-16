import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { useState, useRef } from 'react'
import { Plus, ChevronDown } from 'lucide-react'
import { isValidSmojiLabel, SMOJI_ID_PATTERN } from '../../../../../packages/smoji/src/validate'
import { useWorkbench } from '../../app/WorkbenchContext'
import { SMOJI_MAX_PACKS } from '../../domain/limits'

const LABEL_ERROR = '名称需为 1–40 个字符，且不能包含 ] 或控制字符'
const ID_ERROR = 'ID 需以字母或数字开头，仅含字母、数字、点、下划线和连字符'

export function CustomGroupCreateForm() {
  const { state, dispatch, setMobileDrawerOpen } = useWorkbench()
  const [name, setName] = useState('')
  const [id, setId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const detailsRef = useRef<HTMLDetailsElement | null>(null)

  const groups = state.customGroups.groups
  const atCapacity = groups.length >= SMOJI_MAX_PACKS

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedId = id.trim()
    if (!isValidSmojiLabel(name.trim())) {
      setError(LABEL_ERROR)
      return
    }
    if (atCapacity) {
      setError(`分组数量已达上限 ${SMOJI_MAX_PACKS} 个`)
      return
    }
    if (trimmedId && !SMOJI_ID_PATTERN.test(trimmedId)) {
      setError(ID_ERROR)
      return
    }
    if (trimmedId && groups.some((group) => group.id === trimmedId)) {
      setError(`分组 ID「${trimmedId}」已存在`)
      return
    }

    dispatch({
      type: 'CREATE_CUSTOM_GROUP',
      payload: { label: name.trim(), ...(trimmedId ? { id: trimmedId } : {}) },
    })

    // Only clear/collapse after the group is actually accepted.
    setError(null)
    setName('')
    setId('')
    setMobileDrawerOpen(false)
    if (detailsRef.current) {
      detailsRef.current.open = false
      detailsRef.current.querySelector('summary')?.focus()
    }
  }

  return (
    <details ref={detailsRef} id="custom-create" open className="group rounded-lg border border-dashed border-border p-2">
      <summary className="flex cursor-pointer items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground list-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          <span>新建分组</span>
        </span>
        {atCapacity && <span className="text-[11px] text-warning">已达 {SMOJI_MAX_PACKS} 组上限</span>}
        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <form id="custom-add-form" className="mt-2 flex flex-col gap-1.5" onSubmit={handleSubmit}>
        <div className="flex gap-1.5">
          <label htmlFor="custom-name-input" className="sr-only">分组名称</label>
          <Input
            id="custom-name-input"
            type="text"
            placeholder="分组名称，如：常用"
            className="h-7 min-w-0 flex-1 rounded border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground "
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "custom-create-error" : undefined}
            value={name}
            maxLength={40}
            onChange={(e) => {
              setName(e.target.value)
              if (error) setError(null)
            }}
          />
          <Button variant="ghost"
            id="btn-create-custom-pack"
            type="submit"
            disabled={atCapacity}
            className="shrink-0 rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40 "
          >
            添加
          </Button>
        </div>
        <div className="flex gap-1.5">
          <label htmlFor="custom-id-input" className="sr-only">分组 ID（可选）</label>
          <Input
            id="custom-id-input"
            type="text"
            placeholder="分组 ID（可选，默认按名称生成）"
            className="h-7 min-w-0 flex-1 rounded border border-input bg-background px-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground "
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "custom-create-error" : undefined}
            value={id}
            maxLength={64}
            onChange={(e) => {
              setId(e.target.value)
              if (error) setError(null)
            }}
          />
        </div>
        {error && (
          <p id="custom-create-error" role="alert" className="text-[11px] text-destructive">
            {error}
          </p>
        )}
      </form>
    </details>
  )
}
