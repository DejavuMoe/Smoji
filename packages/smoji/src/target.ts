import type { InsertTarget, SmojiItem, SmojiPack } from './types'

export interface TextTargetOptions {
  serialize: (item: SmojiItem, pack: SmojiPack) => string
}

export function textTarget(
  element: HTMLInputElement | HTMLTextAreaElement,
  options: TextTargetOptions,
): InsertTarget {
  return {
    insert(item: SmojiItem, pack: SmojiPack): void {
      const v = options.serialize(item, pack)
      element.focus()
      try {
        if (document.execCommand?.('insertText', false, v)) return
      } catch {}
      const s = element.selectionStart ?? element.value.length
      element.setRangeText(v, s, element.selectionEnd ?? s, 'end')
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: v }))
      element.focus()
    },
  }
}
