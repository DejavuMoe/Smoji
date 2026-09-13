import { useState, useRef } from 'react'
import { Plus } from 'lucide-react'
import { useWorkbench } from '../../app/WorkbenchContext'

export function CustomGroupCreateForm() {
  const { dispatch, setMobileDrawerOpen } = useWorkbench()
  const [name, setName] = useState('')
  const detailsRef = useRef<HTMLDetailsElement | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    dispatch({
      type: 'CREATE_CUSTOM_GROUP',
      payload: { label: trimmed },
    })

    setName('')
    if (detailsRef.current) {
      detailsRef.current.open = false
    }
    // Close mobile drawer so user can immediately see the gallery and newly created group
    setMobileDrawerOpen(false)
  }

  return (
    <details ref={detailsRef} id="custom-create" className="group rounded-lg border border-dashed border-border p-2">
      <summary className="flex cursor-pointer items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground">
        <span className="flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          <span>新建分组</span>
        </span>
      </summary>
      <form id="custom-add-form" className="mt-2 flex gap-1.5" onSubmit={handleSubmit}>
        <input
          id="custom-name-input"
          type="text"
          placeholder="分组名称，如：常用"
          className="h-7 min-w-0 flex-1 rounded border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          value={name}
          maxLength={64}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="submit"
          className="rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          添加
        </button>
      </form>
    </details>
  )
}
