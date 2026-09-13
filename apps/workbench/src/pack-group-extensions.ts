/** Minimal pack-group extension hooks for forward-compatible plugins. */

export type PackGroupExtensionContext = {
  packCount: number
  itemCount: number
}

export type PackGroupExtensionHandler = {
  /** Merge incoming extension payload into the stored bag (default shallow merge). */
  merge?: (current: unknown, incoming: unknown) => unknown
  /** Validate after merge; throw or return error string. */
  validate?: (value: unknown) => void | string
  /** Optional side-effect when extensions are applied (boot / import). */
  apply?: (value: unknown, ctx: PackGroupExtensionContext) => void
}

const handlers = new Map<string, PackGroupExtensionHandler>()

export function registerPackGroupExtension(id: string, handler: PackGroupExtensionHandler): void {
  if (!id.trim()) throw new Error('extension id required')
  handlers.set(id, handler)
}

export function listPackGroupExtensionIds(): string[] {
  return [...handlers.keys()]
}

export function listUnknownPackGroupExtensionIds(extensions: Record<string, unknown>): string[] {
  return Object.keys(extensions).filter((id) => !handlers.has(id))
}

export function mergePackGroupExtensions(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...current }
  for (const [id, value] of Object.entries(incoming)) {
    const handler = handlers.get(id)
    next[id] = handler?.merge ? handler.merge(current[id], value) : value
  }
  return next
}

export function applyPackGroupExtensions(
  extensions: Record<string, unknown>,
  ctx: PackGroupExtensionContext,
): string[] {
  const errors: string[] = []
  for (const [id, value] of Object.entries(extensions)) {
    const handler = handlers.get(id)
    if (!handler) continue
    try {
      const invalid = handler.validate?.(value)
      if (typeof invalid === 'string' && invalid) {
        errors.push(`${id}: ${invalid}`)
        continue
      }
      handler.apply?.(value, ctx)
    } catch (err) {
      errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return errors
}
