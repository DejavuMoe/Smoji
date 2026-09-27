import { formatEmoji } from '@wb/domain/copy-format'
import type { CopyFormat } from '@wb/domain/state'
import { toExportItemSrc } from '@wb/export'
import type { SmojiItem } from 'smoji'

export const COPY_FORMATS: { id: CopyFormat; label: string; key: string }[] = [
  { id: 'md', label: 'Markdown', key: '1' },
  { id: 'url', label: 'URL', key: '2' },
  { id: 'hugo', label: 'Hugo', key: '3' },
  { id: 'html', label: 'HTML', key: '4' },
  { id: 'bbcode', label: 'BBCode', key: '5' },
]

export function copyValue(item: SmojiItem, format: CopyFormat, manifestUrl: string): string {
  return formatEmoji(item, format, (src) => toExportItemSrc(src, manifestUrl))
}

export async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function downloadText(filename: string, content: string): void {
  const type = filename.endsWith('.md') ? 'text/markdown;charset=utf-8' : 'application/json'
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function dateStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  return kb < 100 ? `${kb.toFixed(1)} KB` : `${Math.round(kb)} KB`
}

export function imageFormat(src: string): string {
  return /\.([a-z0-9]+)$/i.exec(src)?.[1]?.toUpperCase() ?? 'WEBP'
}
