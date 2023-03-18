/** Built-in pack-group extension: portable workbench prefs in custom-group bundles. */

import { isDockExportFormat, type DockExportFormat } from './export'
import { registerPackGroupExtension } from './pack-group-extensions'

export const WORKBENCH_EXTENSION_ID = 'smoji.workbench'

export type WorkbenchExtensionPayload = {
  preferredDockFormat?: DockExportFormat
  notes?: string
}

export function parseWorkbenchExtension(value: unknown): WorkbenchExtensionPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const out: WorkbenchExtensionPayload = {}

  if (typeof raw.preferredDockFormat === 'string' && isDockExportFormat(raw.preferredDockFormat)) {
    out.preferredDockFormat = raw.preferredDockFormat
  }
  if (typeof raw.notes === 'string' && raw.notes.trim()) {
    out.notes = raw.notes.trim().slice(0, 240)
  }

  return out
}

export function mergeWorkbenchExtension(current: unknown, incoming: unknown): WorkbenchExtensionPayload {
  const a = parseWorkbenchExtension(current) ?? {}
  const b = parseWorkbenchExtension(incoming) ?? {}
  return { ...a, ...b }
}

export type WorkbenchExtensionHandlers = {
  onApply: (payload: WorkbenchExtensionPayload) => void
}

/** Register once; `onApply` is invoked when extensions are applied (boot / import). */
export function registerWorkbenchExtension(handlers: WorkbenchExtensionHandlers): void {
  registerPackGroupExtension(WORKBENCH_EXTENSION_ID, {
    merge: mergeWorkbenchExtension,
    validate: (value) => {
      if (value == null) return
      if (typeof value !== 'object' || Array.isArray(value)) return 'expected object'
    },
    apply: (value) => {
      const parsed = parseWorkbenchExtension(value)
      if (parsed) handlers.onApply(parsed)
    },
  })
}

export function buildWorkbenchExtensionPayload(input: {
  preferredDockFormat: string
  notes?: string
}): WorkbenchExtensionPayload {
  const payload: WorkbenchExtensionPayload = {}
  if (isDockExportFormat(input.preferredDockFormat)) {
    payload.preferredDockFormat = input.preferredDockFormat
  }
  if (input.notes?.trim()) payload.notes = input.notes.trim().slice(0, 240)
  return payload
}
