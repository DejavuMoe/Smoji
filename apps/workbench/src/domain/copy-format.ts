import type { SmojiItem } from '../../../../packages/smoji/src/types'
import { smojiMarker } from '../../../../packages/smoji/src/marker'
import type { CopyFormat } from './state'

export function formatEmoji(
  item: SmojiItem,
  format: CopyFormat,
  resolveExportSrc: (src: string) => string = (s) => s,
): string {
  const exportedSrc = resolveExportSrc(item.src)
  const label = item.label || item.id
  const exportedItem = { ...item, src: exportedSrc }

  switch (format) {
    case 'url':
      return exportedSrc
    case 'hugo':
      return `{{< inTextImg url=${JSON.stringify(exportedSrc)} alt=${JSON.stringify(label)} >}}`
    case 'html':
      return `<img src="${exportedSrc}" alt="${label.replace(/"/g, '&quot;')}">`
    case 'md':
      return smojiMarker(exportedItem)
    case 'bbcode':
      return `[img]${exportedSrc}[/img]`
  }
}
