/** Controls whose own keyboard interaction must take precedence over page shortcuts. */
export function isEditing(target: EventTarget | null, allowReadOnly = false): boolean {
  if (!(target instanceof HTMLElement)) return false
  const field = target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
  return Boolean(field && !(allowReadOnly && field instanceof HTMLInputElement && field.readOnly))
}

export function hasOpenOverlay(): boolean {
  return Boolean(document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'))
}

export function ownsArrowKeys(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest(
    '[role="tablist"], [role="combobox"], [role="listbox"], [role="menu"], [role="radiogroup"], [data-slot="toggle-group"]',
  ))
}
