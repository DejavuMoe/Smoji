import hosting from '../../data/hosting.json'
import type { SmojiItem, SmojiManifest, SmojiManifestInput, SmojiPack } from '../../packages/smoji/src/types'
import { assertManifestSize, parseSmojiManifest } from '../../packages/smoji/src/manifest'

export interface CustomPackInput {
  readonly id: string
  readonly label: string
  readonly items: readonly SmojiItem[]
}

function exportManifestUrl(manifestUrl: string): string {
  const url = new URL(manifestUrl)
  return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    ? new URL('smoji.json', hosting.assetBaseUrl).href : url.href
}

export function toExportItemSrc(itemSrc: string, manifestUrl: string): string {
  let itemUrl: URL
  try {
    itemUrl = new URL(itemSrc, manifestUrl)
  } catch {
    throw new Error(`无效的表情资源地址: "${itemSrc}"`)
  }

  if (itemUrl.protocol !== 'http:' && itemUrl.protocol !== 'https:') {
    throw new Error(`表情资源协议必须为 http 或 https: "${itemSrc}"`)
  }

  if (itemUrl.username || itemUrl.password) {
    throw new Error(`表情资源地址不能包含凭据: "${itemSrc}"`)
  }

  if (itemUrl.search || itemUrl.hash) {
    throw new Error(`表情资源地址不能包含查询参数或片段: "${itemSrc}"`)
  }

  if (itemSrc.includes('..')) {
    throw new Error(`表情资源相对路径非法: "${itemSrc}"`)
  }

  const relativePath = itemUrl.pathname.replace(/^\/+/, '')
  if (!relativePath || relativePath.split('/').includes('..')) {
    throw new Error(`表情资源相对路径非法: "${itemSrc}"`)
  }

  const published = exportManifestUrl(manifestUrl)
  const original = new URL(manifestUrl)
  if (published !== original.href && itemUrl.origin === original.origin) {
    const directory = new URL('./', original).pathname
    if (!itemUrl.pathname.startsWith(directory)) throw new Error('表情图片不在清单目录内')
    return new URL(itemUrl.pathname.slice(directory.length), new URL('./', published)).href
  }
  return itemUrl.href
}

export function buildExportManifest(
  sourcePacks: readonly SmojiPack[],
  selectedPackIds: ReadonlySet<string>,
  manifestUrl: string,
): SmojiManifest {
  if (!selectedPackIds.size) {
    throw new Error('未选择任何表情包')
  }

  const selectedPacks = sourcePacks.filter((pack) => selectedPackIds.has(pack.id))
  if (!selectedPacks.length) {
    throw new Error('未选择任何表情包')
  }

  const packs: SmojiPack[] = selectedPacks.map((pack) => {
    const items: SmojiItem[] = pack.items.map((item) => ({
      id: item.id,
      label: item.label,
      src: toExportItemSrc(item.src, manifestUrl),
    }))

    return {
      id: pack.id,
      label: pack.label,
      items,
    }
  })

  return {
    version: 1,
    packs,
  }
}

export function buildCustomExportManifest(
  customPacks: readonly CustomPackInput[],
  manifestUrl: string,
): SmojiManifest {
  const validPacks = customPacks.filter((p) => p.items.length > 0)
  if (!validPacks.length) {
    throw new Error('未在任何分组中添加表情')
  }

  const packIds = new Set<string>()
  const packs: SmojiPack[] = validPacks.map((pack) => {
    const trimmedId = pack.id.trim()
    const trimmedLabel = pack.label.trim()

    if (!trimmedId) throw new Error('分组 ID 不能为空')
    if (!trimmedLabel) throw new Error('分组名称不能为空')
    if (packIds.has(trimmedId)) throw new Error(`分组 ID 重复: "${trimmedId}"`)
    packIds.add(trimmedId)

    const itemIds = new Set<string>()
    const items: SmojiItem[] = pack.items.map((item) => {
      let itemId = item.id
      if (itemIds.has(itemId)) {
        let counter = 1
        while (itemIds.has(`${item.id}_${counter}`)) counter += 1
        itemId = `${item.id}_${counter}`
      }
      itemIds.add(itemId)

      return {
        id: itemId,
        label: item.label,
        src: toExportItemSrc(item.src, manifestUrl),
      }
    })

    return {
      id: trimmedId,
      label: trimmedLabel,
      items,
    }
  })

  return {
    version: 1,
    packs,
  }
}

export interface ArtalkGroup {
  name: string
  type: 'image'
  items: Array<{
    key: string
    val: string
  }>
}

export type ArtalkManifest = ArtalkGroup[]

export function buildArtalkExport(
  packs: readonly CustomPackInput[],
  manifestUrl: string,
): ArtalkManifest {
  const validPacks = packs.filter((p) => p.items.length > 0)
  if (!validPacks.length) {
    throw new Error('未选择任何表情包')
  }

  return validPacks.map((pack) => ({
    name: pack.label.trim() || pack.id,
    type: 'image',
    items: pack.items.map((item) => ({
      key: item.label.trim() || item.id,
      val: toExportItemSrc(item.src, manifestUrl),
    })),
  }))
}

export interface TwikooPackContainer {
  type: 'image'
  container: Array<{
    text: string
    icon: string
  }>
}

export type TwikooManifest = Record<string, TwikooPackContainer>

export function buildTwikooExport(
  packs: readonly CustomPackInput[],
  manifestUrl: string,
): TwikooManifest {
  const validPacks = packs.filter((p) => p.items.length > 0)
  if (!validPacks.length) {
    throw new Error('未选择任何表情包')
  }

  const result: TwikooManifest = Object.create(null)
  for (const pack of validPacks) {
    const key = pack.label.trim() || pack.id
    if (Object.prototype.hasOwnProperty.call(result, key)) throw new Error(`分组名称重复：${key}，请重命名后导出`)
    result[key] = {
      type: 'image',
      container: pack.items.map((item) => ({
        text: item.id || item.label,
        icon: `<img src="${toExportItemSrc(item.src, manifestUrl)}">`,
      })),
    }
  }
  return result
}

export interface OwOPackContainer {
  type: 'image'
  name?: string
  container: Array<{
    icon: string
    text: string
  }>
}

export type OwOManifest = Record<string, OwOPackContainer>

export function buildOwOExport(
  packs: readonly CustomPackInput[],
  manifestUrl: string,
): OwOManifest {
  const validPacks = packs.filter((p) => p.items.length > 0)
  if (!validPacks.length) {
    throw new Error('未选择任何表情包')
  }

  const result: OwOManifest = Object.create(null)
  for (const pack of validPacks) {
    const key = pack.label.trim() || pack.id
    if (Object.prototype.hasOwnProperty.call(result, key)) throw new Error(`分组名称重复：${key}，请重命名后导出`)
    result[key] = {
      type: 'image',
      name: pack.id,
      container: pack.items.map((item) => ({
        icon: `<img src="${toExportItemSrc(item.src, manifestUrl)}">`,
        text: item.id || item.label,
      })),
    }
  }
  return result
}

/** Waline joins folder + "/" + item; keep extensions in keys for mixed formats. */
export function buildWalineExport(packs: readonly CustomPackInput[], manifestUrl: string) {
  const groups: Array<{ name: string; folder: string; prefix: string; type: string; icon: string; items: string[] }> = []
  const urlsByKey = new Map<string, string>()
  for (const pack of packs) {
    let group: typeof groups[number] | undefined
    for (const item of pack.items) {
      const url = new URL(toExportItemSrc(item.src, manifestUrl))
      const key = url.pathname.slice(1)
      // Waline's :key: parser cannot round-trip a literal colon in a path.
      if (key.includes(':')) throw new Error('Waline 表情路径不能包含冒号')
      const previous = urlsByKey.get(key)
      if (previous && previous !== url.href) throw new Error(`Waline 表情键冲突：${key}`)
      urlsByKey.set(key, url.href)
      if (!group || group.folder !== url.origin) {
        group = { name: pack.label.trim() || pack.id, folder: url.origin, prefix: '', type: '', icon: key, items: [] }
        groups.push(group)
      }
      group.items.push(key)
    }
  }
  if (!groups.length) throw new Error('未选择任何表情包')
  return groups
}

export function compactExportManifest(manifest: SmojiManifest, manifestUrl: string): SmojiManifestInput {
  const directory = new URL('./', exportManifestUrl(manifestUrl)).href
  return {
    version: 1,
    base: directory + '{pack}/{id}.webp',
    packs: manifest.packs.map((pack) => ({
      id: pack.id, label: pack.label,
      items: pack.items.map(({ id, label, src }) => src === `${directory}${pack.id}/${id}.webp`
        ? { id, label } : { id, label, src }),
    })),
  }
}

export function serializeAndValidateManifest(
  manifest: SmojiManifest,
  manifestUrl: string,
): string {
  const compact = compactExportManifest(manifest, manifestUrl)
  parseSmojiManifest(compact, exportManifestUrl(manifestUrl))
  const json = JSON.stringify(compact, null, 2) + '\n'
  assertManifestSize(json)
  return json
}

export function downloadExportManifest(
  sourcePacks: readonly SmojiPack[],
  selectedPackIds: ReadonlySet<string>,
  manifestUrl: string,
  filename = 'smoji.json',
): void {
  const manifest = buildExportManifest(sourcePacks, selectedPackIds, manifestUrl)
  const json = serializeAndValidateManifest(manifest, manifestUrl)

  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadCustomExportManifest(
  customPacks: readonly CustomPackInput[],
  manifestUrl: string,
  filename = 'smoji.json',
): void {
  const manifest = buildCustomExportManifest(customPacks, manifestUrl)
  const json = serializeAndValidateManifest(manifest, manifestUrl)

  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export type BuiltInExportFormat = 'smoji' | 'artalk' | 'twikoo' | 'owo' | 'waline' | 'ecoku' | 'markdown'
/** Built-in ids plus any runtime-registered format plugins. */
export type ExportTargetFormat = BuiltInExportFormat | (string & {})

/** Dock-visible export targets (subset of registered formats). */
export const DOCK_EXPORT_FORMAT_IDS = ['smoji', 'artalk', 'twikoo', 'owo', 'waline'] as const
export type DockExportFormat = string

export type ExportFormatDescriptor = {
  id: ExportTargetFormat
  label: string
  /** Shown in the bottom selection dock <select>. */
  dock?: boolean
  /** Shown as a gallery toolbar export button. */
  toolbar?: boolean
  /** Shown as a code-preview modal tab. */
  preview?: boolean
  /** Guide table: target product / plugin description. */
  guideTarget?: string
  /** Guide table: example download filename. */
  guideFilename?: string
}

export type ExportGenerator = (
  packs: readonly CustomPackInput[],
  manifestUrl: string,
) => { content: string; filename: string }

/**
 * Built-in registry snapshot (stable for tests / docs).
 * Runtime UI reads through listExportFormats() so plugins can extend it.
 */
export const EXPORT_FORMAT_REGISTRY: readonly ExportFormatDescriptor[] = [
  {
    id: 'smoji',
    label: 'Smoji',
    dock: true,
    toolbar: true,
    preview: true,
    guideTarget: 'Ecoku 原生评论系统、Smoji Picker 官方核心库',
    guideFilename: 'smoji.json',
  },
  {
    id: 'artalk',
    label: 'Artalk',
    dock: true,
    toolbar: true,
    preview: true,
    guideTarget: 'Artalk 自托管评论系统 v2+',
    guideFilename: 'artalk.json',
  },
  {
    id: 'twikoo',
    label: 'Twikoo',
    dock: true,
    toolbar: true,
    preview: true,
    guideTarget: 'Twikoo 无服务器评论系统',
    guideFilename: 'twikoo.json',
  },
  {
    id: 'owo',
    label: 'OwO',
    dock: true,
    toolbar: true,
    preview: true,
    guideTarget: 'Valine 及各类兼容 OwO 规范的独立博客',
    guideFilename: 'OwO.json',
  },
  {
    id: 'waline',
    label: 'Waline',
    dock: true,
    toolbar: true,
    preview: true,
    guideTarget: 'Waline emoji 配置对象数组',
    guideFilename: 'waline.json',
  },
  {
    id: 'ecoku',
    label: 'Ecoku 响应示例',
    preview: true,
    guideTarget: 'Ecoku 公共响应示例（formConfig.smoji），不是后台导入文件',
    guideFilename: 'ecoku.json',
  },
  {
    id: 'markdown',
    label: 'Markdown 标记',
    preview: true,
    guideTarget: 'Markdown / 文档预览用绝对地址标记',
    guideFilename: 'smoji-markers.md',
  },
]

const exportFormatRegistry: ExportFormatDescriptor[] = EXPORT_FORMAT_REGISTRY.map((f) => ({ ...f }))
const exportGenerators = new Map<string, ExportGenerator>()
const exportRegistryListeners = new Set<() => void>()

/** Subscribe to runtime registry mutations (e.g. refresh dock / guide chrome). */
export function onExportRegistryChange(listener: () => void): () => void {
  exportRegistryListeners.add(listener)
  return () => {
    exportRegistryListeners.delete(listener)
  }
}

function notifyExportRegistryChange(): void {
  for (const listener of exportRegistryListeners) listener()
}

/** Register or replace a dock/toolbar/preview format descriptor (optional custom generator). */
export function registerExportFormat(
  descriptor: ExportFormatDescriptor,
  generate?: ExportGenerator,
): void {
  const id = descriptor.id.trim()
  if (!id) throw new Error('export format id required')
  const next = { ...descriptor, id }
  const idx = exportFormatRegistry.findIndex((f) => f.id === id)
  if (idx >= 0) exportFormatRegistry[idx] = { ...exportFormatRegistry[idx], ...next }
  else exportFormatRegistry.push(next)
  if (generate) exportGenerators.set(id, generate)
  notifyExportRegistryChange()
}

export function listExportFormats(): readonly ExportFormatDescriptor[] {
  return exportFormatRegistry
}

export function isDockExportFormat(value: string): value is DockExportFormat {
  return exportFormatRegistry.some((f) => f.dock && f.id === value)
}

export function dockExportFormats(): ExportFormatDescriptor[] {
  return exportFormatRegistry.filter((f) => f.dock)
}

export function toolbarExportFormats(): ExportFormatDescriptor[] {
  return exportFormatRegistry.filter((f) => f.toolbar)
}

export function previewExportFormats(): ExportFormatDescriptor[] {
  return exportFormatRegistry.filter((f) => f.preview)
}

export function generateFormattedExport(
  format: ExportTargetFormat,
  packs: readonly CustomPackInput[],
  manifestUrl: string,
): { content: string; filename: string } {
  const plugin = exportGenerators.get(format)
  if (plugin) return plugin(packs, manifestUrl)

  let content: string
  let filename: string

  switch (format) {
    case 'smoji': {
      const manifest = buildCustomExportManifest(packs, manifestUrl)
      content = serializeAndValidateManifest(manifest, manifestUrl)
      filename = 'smoji.json'
      break
    }
    case 'artalk': {
      const artalk = buildArtalkExport(packs, manifestUrl)
      content = JSON.stringify(artalk, null, 2) + '\n'
      filename = 'artalk.json'
      break
    }
    case 'twikoo': {
      const twikoo = buildTwikooExport(packs, manifestUrl)
      content = JSON.stringify(twikoo, null, 2) + '\n'
      filename = 'twikoo.json'
      break
    }
    case 'owo': {
      const owo = buildOwOExport(packs, manifestUrl)
      content = JSON.stringify(owo, null, 2) + '\n'
      filename = 'OwO.json'
      break
    }
    case 'waline': {
      content = JSON.stringify(buildWalineExport(packs, manifestUrl), null, 2) + '\n'
      filename = 'waline.json'
      break
    }
    case 'ecoku': {
      const ecokuConfig = {
        formConfig: {
          smoji: {
            enabled: true,
            manifestUrl: exportManifestUrl(manifestUrl),
          },
        },
      }
      content = JSON.stringify(ecokuConfig, null, 2) + '\n'
      filename = 'ecoku.json'
      break
    }
    case 'markdown': {
      const lines: string[] = []
      for (const pack of packs) {
        if (!pack.items.length) continue
        lines.push(`### ${pack.label} (${pack.id})`)
        for (const item of pack.items) {
          lines.push(`![smoji:${item.label}](${toExportItemSrc(item.src, manifestUrl)})`)
        }
        lines.push('')
      }
      content = lines.join('\n')
      filename = 'smoji-markers.md'
      break
    }
    default:
      throw new Error(`未知导出格式：${format}`)
  }

  return { content, filename }
}

/** Stamp download names so repeated exports don't silently overwrite. */
export function stampDownloadFilename(filename: string): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const dot = filename.lastIndexOf('.')
  if (dot <= 0) return `${filename}-${stamp}`
  return `${filename.slice(0, dot)}-${stamp}${filename.slice(dot)}`
}

export function downloadFormattedExport(
  format: ExportTargetFormat,
  packs: readonly CustomPackInput[],
  manifestUrl: string,
): void {
  const { content, filename } = generateFormattedExport(format, packs, manifestUrl)
  const downloadName = stampDownloadFilename(filename)

  const mimeType = filename.endsWith('.md') ? 'text/markdown;charset=utf-8' : 'application/json'
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = downloadName
  link.click()
  URL.revokeObjectURL(url)
}
