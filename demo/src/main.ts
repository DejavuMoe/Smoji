import {
  loadSmojiManifest,
  SMOJI_MANIFEST_MAX_BYTES,
  SMOJI_MAX_ITEMS,
  SMOJI_MAX_ITEMS_PER_PACK,
  SMOJI_MAX_PACKS,
} from 'smoji/manifest'
import { smojiMarker } from 'smoji/marker'
import type { SmojiItem, SmojiPack } from 'smoji'
import {
  downloadFormattedExport,
  dockExportFormats,
  generateFormattedExport,
  isDockExportFormat,
  listExportFormats,
  onExportRegistryChange,
  previewExportFormats,
  toolbarExportFormats,
  type ExportTargetFormat,
} from './export'
import {
  type EditableCustomPack,
  type RecentEntry,
  buildCustomGroupBundle,
  loadCopyFormat,
  loadCustomGroupExtensions,
  loadCustomPacks,
  loadDensity,
  loadExcludedSrcs,
  loadExportFormat,
  loadMode,
  loadRecentEntries,
  loadSelectedPackIds,
  parseCustomGroupBundle,
  parseCustomGroupExtensions,
  pushRecentEntry,
  saveCopyFormat,
  saveCustomGroupExtensions,
  saveCustomPacks,
  saveDensity,
  saveExcludedSrcs,
  saveExportFormat,
  saveMode,
  saveSelectedPackIds,
} from './storage'
import {
  applyPackGroupExtensions,
  listUnknownPackGroupExtensionIds,
  mergePackGroupExtensions,
} from './pack-group-extensions'
import {
  WORKBENCH_EXTENSION_ID,
  buildWorkbenchExtensionPayload,
  registerWorkbenchExtension,
  type WorkbenchExtensionPayload,
} from './workbench-extension'
import { canonicalAssetSrc, migratePackSelection, loadAssetAliases } from './asset-paths'
import { trapFocus } from './focus-trap'
import { HistoryStack } from './history'
import { WorkbenchStore, type WorkbenchState } from './state'
import { imagePreview, thumbnailSrc, loadImage } from './images'
import hosting from '../../data/hosting.json'
import publishedManifest from '../../data/smoji.json'
import { parseSmojiManifest } from 'smoji/manifest'
import './fonts.css'
import './site.css'

export type { EditableCustomPack }

const manifestUrl = import.meta.env.PROD
  ? new URL('smoji.json', hosting.assetBaseUrl).href
  : new URL(`${import.meta.env.BASE_URL}smoji.json`, window.location.href).href

// Core DOM Elements
const packNav = document.querySelector<HTMLElement>('#pack-nav')!
const grid = document.querySelector<HTMLElement>('#grid')!
const gridStatus = document.querySelector<HTMLElement>('#grid-status')!
const galleryTitle = document.querySelector<HTMLElement>('#gallery-title')!
const galleryExportCount = document.querySelector<HTMLElement>('#gallery-export-count')!
const galleryExportError = document.querySelector<HTMLElement>('#gallery-export-error')!
const exportToolbar = document.querySelector<HTMLElement>('.export-toolbar')!
let exportButtons: HTMLButtonElement[] = []
const galleryPackIcon = document.querySelector<HTMLElement>('#gallery-pack-icon')!

const menuToggle = document.querySelector<HTMLButtonElement>('#menu-toggle')!
const mobileGuideToggle = document.querySelector<HTMLButtonElement>('#mobile-guide-toggle')!
const backdrop = document.querySelector<HTMLElement>('#backdrop')!
const pop = document.querySelector<HTMLElement>('#pop')!
const popImage = document.querySelector<HTMLImageElement>('#pop-image')!
const popName = document.querySelector<HTMLElement>('#pop-name')!
const popMeta = document.querySelector<HTMLElement>('#pop-meta')!
const popPackBadge = document.querySelector<HTMLElement>('#pop-pack-badge')!
const popFormatBadge = document.querySelector<HTMLElement>('#pop-format-badge')!
const popStage = document.querySelector<HTMLElement>('#pop-stage')!
const popPrevBtn = document.querySelector<HTMLButtonElement>('#pop-prev-btn')!
const popNextBtn = document.querySelector<HTMLButtonElement>('#pop-next-btn')!
const popLoading = document.querySelector<HTMLElement>('#pop-loading')!
const popRetry = document.querySelector<HTMLButtonElement>('#pop-retry')!
const popCloseBtn = document.querySelector<HTMLButtonElement>('#pop-close-btn')!
const popGroupAction = document.querySelector<HTMLElement>('#pop-group-action')!
const popToggleGroupBtn = document.querySelector<HTMLButtonElement>('#pop-toggle-group-btn')!
const popTargetWrap = document.querySelector<HTMLElement>('#pop-target-wrap')!
const popTargetGroup = document.querySelector<HTMLSelectElement>('#pop-target-group')!
const copyFeedback = document.querySelector<HTMLElement>('#copy-feedback')!

const copyUrl = document.querySelector<HTMLInputElement>('#copy-url')!
const copyHtml = document.querySelector<HTMLInputElement>('#copy-html')!
const copyMd = document.querySelector<HTMLInputElement>('#copy-md')!
const copyBbcode = document.querySelector<HTMLInputElement>('#copy-bbcode')!

const copyActiveInput = document.querySelector<HTMLInputElement>('#copy-active-input')!
const btnCopyActive = document.querySelector<HTMLButtonElement>('#btn-copy-active')!
const copyTabs = document.querySelectorAll<HTMLButtonElement>('.copy-tab')!

const tabPacks = document.querySelector<HTMLButtonElement>('#tab-packs')!
const tabCustom = document.querySelector<HTMLButtonElement>('#tab-custom')!
const customBuilder = document.querySelector<HTMLElement>('#custom-builder')!
const customAddForm = document.querySelector<HTMLFormElement>('#custom-add-form')!
const customNameInput = document.querySelector<HTMLInputElement>('#custom-name-input')!
const customIdInput = document.querySelector<HTMLInputElement>('#custom-id-input')!
const customFormError = document.querySelector<HTMLElement>('#custom-form-error')!
const customPackList = document.querySelector<HTMLElement>('#custom-pack-list')!
const customPackStatus = document.querySelector<HTMLElement>('#custom-pack-status')!
const customPackCountBadge = document.querySelector<HTMLElement>('#custom-pack-count-badge')!
const customCapacity = document.querySelector<HTMLElement>('#custom-capacity')!
const customCapacityBar = document.querySelector<HTMLElement>('#custom-capacity-bar')!
const customCapacityLabel = document.querySelector<HTMLElement>('#custom-capacity-label')!
const sourcePacksLabel = document.querySelector<HTMLElement>('#source-packs-label')!
const sourcePacksSection = document.querySelector<HTMLElement>('#source-packs-section')!

// Header & Global Controls
const themeToggle = document.querySelector<HTMLButtonElement>('#theme-toggle')!
const densityToggle = document.querySelector<HTMLButtonElement>('#density-toggle')!
const densityLabel = document.querySelector<HTMLElement>('#density-label')!

// Batch Controls
const btnSelectAllPacks = document.querySelector<HTMLButtonElement>('#btn-select-all-packs')!
const btnInvertPacks = document.querySelector<HTMLButtonElement>('#btn-invert-packs')!
const btnClearPacks = document.querySelector<HTMLButtonElement>('#btn-clear-packs')!
const btnBatchPackAction = document.querySelector<HTMLButtonElement>('#btn-batch-pack-action')!
const batchPackActionIcon = document.querySelector<HTMLElement>('#batch-pack-action-icon')!
const batchPackActionText = document.querySelector<HTMLElement>('#batch-pack-action-text')!

// Code Modal Elements
const btnOpenCode = document.querySelector<HTMLButtonElement>('#btn-open-code')!
const codeModal = document.querySelector<HTMLElement>('#code-modal')!
const codeModalClose = document.querySelector<HTMLButtonElement>('#code-modal-close')!
const codeModalMeta = document.querySelector<HTMLElement>('#code-modal-meta')!
const codeModalStats = document.querySelector<HTMLElement>('#code-modal-stats')!
const codeModalBody = document.querySelector<HTMLElement>('.code-modal__body')!
const codePreviewContent = document.querySelector<HTMLElement>('#code-preview-content')!
const btnCopyCode = document.querySelector<HTMLButtonElement>('#btn-copy-code')!
const btnDownloadCurrentCode = document.querySelector<HTMLButtonElement>('#btn-download-current-code')!
const codeModalTabs = document.querySelector<HTMLElement>('.code-modal__tabs')!
let codeTabs: HTMLButtonElement[] = []
const codePreviewEmpty = document.querySelector<HTMLElement>('#code-preview-empty')!
const codePreviewEmptyMsg = document.querySelector<HTMLElement>('#code-preview-empty-msg')!
const btnPreviewCtaPrimary = document.querySelector<HTMLButtonElement>('#btn-preview-cta-primary')!
const btnPreviewCtaScope = document.querySelector<HTMLButtonElement>('#btn-preview-cta-scope')!
const previewScopeChips = document.querySelectorAll<HTMLButtonElement>('#code-modal .scope-chip')!
const popShortcutsHint = document.querySelector<HTMLElement>('#pop-shortcuts-hint')
const popStageWrap = document.querySelector<HTMLElement>('.pop__stage-wrap')!

// Guide Modal Elements
const btnOpenGuide = document.querySelector<HTMLButtonElement>('#btn-open-guide')!
const guideModal = document.querySelector<HTMLElement>('#guide-modal')!
const guideModalClose = document.querySelector<HTMLButtonElement>('#guide-modal-close')!
const guideModalConfirm = document.querySelector<HTMLButtonElement>('#guide-modal-confirm')!

const confirmModal = document.querySelector<HTMLElement>('#confirm-modal')!
const confirmTitle = document.querySelector<HTMLElement>('#confirm-title')!
const confirmMessage = document.querySelector<HTMLElement>('#confirm-message')!
const confirmOk = document.querySelector<HTMLButtonElement>('#confirm-ok')!
const confirmCancel = document.querySelector<HTMLButtonElement>('#confirm-cancel')!
const toastContainer = document.querySelector<HTMLElement>('#toast-container')!
const recentStrip = document.querySelector<HTMLElement>('#recent-strip')!
const recentStripList = document.querySelector<HTMLElement>('#recent-strip-list')!
const btnClearRecent = document.querySelector<HTMLButtonElement>('#btn-clear-recent')!
const btnExportGroups = document.querySelector<HTMLButtonElement>('#btn-export-groups')!
const btnImportGroups = document.querySelector<HTMLButtonElement>('#btn-import-groups')!
const btnClearGroups = document.querySelector<HTMLButtonElement>('#btn-clear-groups')!
const importGroupsFile = document.querySelector<HTMLInputElement>('#import-groups-file')!
const bundleNotesInput = document.querySelector<HTMLInputElement>('#bundle-notes-input')!
const galleryViewActive = document.querySelector<HTMLButtonElement>('#gallery-view-active')!
const galleryViewPicked = document.querySelector<HTMLButtonElement>('#gallery-view-picked')!
const galleryViewChips = [galleryViewActive, galleryViewPicked]
const scopeChipAll = document.querySelector<HTMLButtonElement>('#scope-chip-all')!
const sidebarFoot = document.querySelector<HTMLElement>('#sidebar-foot')!
const packNavStatus = document.querySelector<HTMLElement>('#pack-nav-status')!
const galleryEmptyCta = document.querySelector<HTMLElement>('#gallery-empty-cta')!
const btnCtaSelectCurrent = document.querySelector<HTMLButtonElement>('#btn-cta-select-current')!
const btnCtaCustom = document.querySelector<HTMLButtonElement>('#btn-cta-custom')!
const selectionDock = document.querySelector<HTMLElement>('#selection-dock')!
const selectionDockCount = document.querySelector<HTMLElement>('#selection-dock-count')!
const selectionDockHint = document.querySelector<HTMLElement>('#selection-dock-hint')!
const selectionDockMeter = document.querySelector<HTMLElement>('#selection-dock-meter')!
const selectionDockMeterBar = document.querySelector<HTMLElement>('#selection-dock-meter-bar')!
const selectionDockFormat = document.querySelector<HTMLSelectElement>('#selection-dock-format')!
const selectionDockPreview = document.querySelector<HTMLButtonElement>('#selection-dock-preview')!
const selectionDockExport = document.querySelector<HTMLButtonElement>('#selection-dock-export')!

/** Extensible custom-group architecture limits (from smoji.json contract). */
const CUSTOM_PACK_LIMIT = SMOJI_MAX_PACKS
const CUSTOM_PACK_ITEM_LIMIT = SMOJI_MAX_ITEMS_PER_PACK
const CUSTOM_TOTAL_ITEM_LIMIT = SMOJI_MAX_ITEMS
const TRAY_VISIBLE_CAP = 36
const GRID_RENDER_CHUNK = 72
const CUSTOM_PACK_NEAR_FULL = Math.max(1, CUSTOM_PACK_LIMIT - 4)
const CUSTOM_ITEM_NEAR_FULL = Math.round(CUSTOM_PACK_ITEM_LIMIT * 0.9)
const CUSTOM_TOTAL_NEAR_FULL = Math.round(CUSTOM_TOTAL_ITEM_LIMIT * 0.85)
const MANIFEST_NEAR_BUDGET_RATIO = 0.85

function manifestLimitLabel(): string {
  return `${SMOJI_MANIFEST_MAX_BYTES / 1024} KB`
}

function syncGuideLimitCopy(): void {
  document.querySelectorAll<HTMLElement>('[data-guide-limit]').forEach((el) => {
    switch (el.dataset.guideLimit) {
      case 'packs':
        el.textContent = `1 ~ ${CUSTOM_PACK_LIMIT}`
        break
      case 'packs-n':
        el.textContent = String(CUSTOM_PACK_LIMIT)
        break
      case 'items-per-pack':
        el.textContent = `1 ~ ${CUSTOM_PACK_ITEM_LIMIT}`
        break
      case 'items':
        el.textContent = `≤ ${CUSTOM_TOTAL_ITEM_LIMIT}`
        break
      case 'bytes':
        el.textContent = `≤ ${manifestLimitLabel()}`
        break
      default:
        break
    }
  })
}

let packs: readonly SmojiPack[] = []
let activePack = 0
let selected: SmojiItem | null = null
const selectedPackIds = loadSelectedPackIds()
const excludedItemSrcs = loadExcludedSrcs()

type ExportMode = 'packs' | 'custom'
let mode: ExportMode = loadMode()

const customPacks: EditableCustomPack[] = []
let activeCustomPackIndex = -1
/** Forward-compatible bag preserved across custom-group import/export. */
let customGroupExtensions: Record<string, unknown> = loadCustomGroupExtensions()

function extensionContext() {
  return {
    packCount: customPacks.length,
    itemCount: customPacks.reduce((acc, p) => acc + p.items.length, 0),
  }
}

let workbenchBundleNotes = ''
let announceExtensionApply = false

function syncWorkbenchExtensionPrefs(): void {
  const prev = customGroupExtensions[WORKBENCH_EXTENSION_ID]
  const notes =
    workbenchBundleNotes ||
    (prev && typeof prev === 'object' && !Array.isArray(prev) && typeof (prev as { notes?: unknown }).notes === 'string'
      ? (prev as { notes: string }).notes
      : undefined)
  customGroupExtensions = {
    ...customGroupExtensions,
    [WORKBENCH_EXTENSION_ID]: buildWorkbenchExtensionPayload({
      preferredDockFormat: selectionDockFormat.value,
      notes,
    }),
  }
}

function applyWorkbenchExtensionPayload(payload: WorkbenchExtensionPayload): void {
  if (payload.preferredDockFormat) {
    selectionDockFormat.value = payload.preferredDockFormat
    saveExportFormat(payload.preferredDockFormat)
  }
  workbenchBundleNotes = payload.notes?.trim() ?? ''
  if (bundleNotesInput) bundleNotesInput.value = workbenchBundleNotes
  if (announceExtensionApply && workbenchBundleNotes) {
    showToast(`分组备注：${workbenchBundleNotes}`, 'info')
  }
  updateSidebarFoot()
}

registerWorkbenchExtension({
  onApply: applyWorkbenchExtensionPayload,
})

function applyLoadedExtensions(silent = true): void {
  announceExtensionApply = !silent
  try {
    const errors = applyPackGroupExtensions(customGroupExtensions, extensionContext())
    if (!silent && errors.length) {
      showToast(`扩展校验：${errors[0]}`, 'error')
    }
  } finally {
    announceExtensionApply = false
  }
  updateSidebarFoot()
}

type UndoAction =
  | {
      type: 'custom-remove'
      packIndex: number
      item: SmojiItem
      itemIndex: number
    }
  | {
      type: 'custom-clear'
      packs: EditableCustomPack[]
      activeIndex: number
    }
  | {
      type: 'custom-delete'
      pack: EditableCustomPack
      packIndex: number
      activeIndex: number
    }

let lastUndo: UndoAction | null = null
const historyStack = new HistoryStack(50)

// Gallery & Preview State
let galleryView: 'active' | 'picked' = 'active'
let isComfortableDensity = loadDensity()
let currentCodeFormat: ExportTargetFormat = 'smoji'
let previewScope: 'active' | 'selected' | 'all' = 'active'
type ThemeMode = 'system' | 'light' | 'dark'
let currentTheme: ThemeMode = (localStorage.getItem('smoji-theme') as ThemeMode) || 'system'
let activeCopyFormat: 'md' | 'url' | 'html' | 'bbcode' = loadCopyFormat()
let recentEntries: RecentEntry[] = loadRecentEntries()

export const store = new WorkbenchStore({
  mode,
  activePack,
  selectedPackIds,
  excludedItemSrcs,
  customPacks,
  activeCustomPackIndex,
  previewScope,
  theme: currentTheme,
  comfortableDensity: isComfortableDensity,
  activeCopyFormat,
  currentCodeFormat,
})

let keyboardFocusIndex = -1
let gridRenderGen = 0
const itemBySrc = new Map<string, { item: SmojiItem; pack: SmojiPack; packIndex: number }>()
let releasePopFocus: (() => void) | null = null
let releaseCodeFocus: (() => void) | null = null
let codeMetaCopyTimer: number | null = null
let releaseGuideFocus: (() => void) | null = null
let codeModalTrigger: HTMLElement | null = null
let guideModalTrigger: HTMLElement | null = null
let confirmModalTrigger: HTMLElement | null = null
let releaseConfirmFocus: (() => void) | null = null
let releaseMenuFocus: (() => void) | null = null
let confirmResolver: ((ok: boolean) => void) | null = null
let workbenchReady = false
let persistenceWarned = false
let lastExportError: string | null = null
const shell = document.querySelector<HTMLElement>('.shell')!
const topBar = document.querySelector<HTMLElement>('header.top')!
const skipLink = document.querySelector<HTMLAnchorElement>('.skip-link')

/** Prefer Apple glyph on macOS/iOS; Ctrl elsewhere (handlers accept both). */
const isAppleModPlatform =
  /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ||
  /Mac OS X|iPhone|iPad|iPod/i.test(navigator.userAgent)
const modKeyLabel = isAppleModPlatform ? '⌘' : 'Ctrl'

function syncPlatformShortcutHints(): void {
  const dens = `${modKeyLabel}+D`
  const preview = `${modKeyLabel}+Shift+P`
  const exportHint = `${modKeyLabel}+E`
  densityToggle.title = `切换视图密度 (紧凑 / 舒适 · ${dens})`
  btnOpenCode.title = `预览导出数据 (${preview})`
  btnOpenCode.setAttribute('aria-label', `预览导出数据 (${preview})`)
  btnOpenCode.setAttribute('aria-keyshortcuts', 'Control+Shift+P Meta+Shift+P')
  btnOpenGuide.title = '查看接入说明与规范 (?)'
  btnOpenGuide.setAttribute('aria-label', '查看接入说明与规范 (?)')
  btnOpenGuide.setAttribute('aria-keyshortcuts', '?')
  mobileGuideToggle.title = '查看接入说明与规范 (?)'
  mobileGuideToggle.setAttribute('aria-label', '查看接入说明与规范 (?)')
  mobileGuideToggle.setAttribute('aria-keyshortcuts', '?')
  selectionDockPreview.title = `预览导出数据 (${preview})`
  selectionDockPreview.setAttribute('aria-label', `预览导出数据 (${preview})`)
  selectionDockExport.title = `导出当前配置 (${exportHint})`
  selectionDockExport.setAttribute('aria-label', `导出当前配置 (${exportHint})`)
  selectionDockFormat.title = `选择导出格式 (${modKeyLabel}+.)`
  selectionDockFormat.setAttribute('aria-keyshortcuts', 'Control+. Meta+.')
  tabPacks.setAttribute('aria-keyshortcuts', 'Control+1 Meta+1')
  tabCustom.setAttribute('aria-keyshortcuts', 'Control+2 Meta+2')
  for (const btn of [btnSelectAllPacks, btnInvertPacks, btnClearPacks]) {
    if (btn.title) btn.setAttribute('aria-label', btn.title)
  }
  for (const btn of [btnExportGroups, btnImportGroups, btnClearGroups]) {
    if (btn.title) btn.setAttribute('aria-label', btn.title)
  }
  document.querySelectorAll<HTMLButtonElement>('.bg-toggle-btn').forEach((btn) => {
    if (btn.title) btn.setAttribute('aria-label', btn.title)
  })
  document.querySelectorAll<HTMLElement>('[data-mod-kbd]').forEach((el) => {
    el.textContent = modKeyLabel
  })
  syncPopShortcutHint()
}

function syncPopShortcutHint(): void {
  if (!popShortcutsHint) return
  let spaceHint = ''
  if (!popGroupAction.hidden) {
    spaceHint = 'Space 勾选整包'
    if (mode === 'custom') {
      spaceHint = 'Space 加入/移出'
    } else if (selected) {
      const pack = itemBySrc.get(selected.src)?.pack ?? packs[activePack]
      if (pack && selectedPackIds.has(pack.id)) {
        spaceHint = excludedItemSrcs.has(selected.src) ? 'Space 恢复表情' : 'Space 剔除表情'
      }
    }
  }
  const spacePart = spaceHint ? ` • ${spaceHint}` : ''
  popShortcutsHint.textContent = `←/→ 翻页 • 1-4 选格式${spacePart} • Esc 关闭`
}
const galleryMain = document.querySelector<HTMLElement>('#gallery-main')!
const sidebar = document.querySelector<HTMLElement>('#sidebar')!

function persistWorkbenchState(): void {
  if (!workbenchReady) return
  const ok =
    saveSelectedPackIds(selectedPackIds) &&
    saveExcludedSrcs(excludedItemSrcs) &&
    saveCustomPacks(customPacks, activeCustomPackIndex) &&
    saveCustomGroupExtensions(customGroupExtensions)
  try {
    saveMode(mode)
    saveDensity(isComfortableDensity)
    saveCopyFormat(activeCopyFormat)
  } catch {
    // ignore secondary prefs
  }
  if (!ok && !persistenceWarned) {
    persistenceWarned = true
    showToast('浏览器存储已满或不可用，配置可能无法持久化', 'error')
  }
}

function anyModalOpen(): boolean {
  return !pop.hidden || !codeModal.hidden || !guideModal.hidden || !confirmModal.hidden
}

function syncOverlayInert(): void {
  const modalOpen = anyModalOpen()
  const menuOpen = document.body.classList.contains('menu-open')
  const sidebarBlocked = modalOpen || (mobileViewportMq.matches && !menuOpen)
  sidebar.toggleAttribute('inert', sidebarBlocked)
  sidebar.setAttribute('aria-hidden', String(sidebarBlocked))
  if (shell) {
    shell.toggleAttribute('inert', modalOpen)
    shell.setAttribute('aria-hidden', modalOpen ? 'true' : 'false')
  }

  // Header + export dock also sit outside `.shell` — keep Tab inside the dialog / mobile overlay.
  if (topBar) {
    topBar.toggleAttribute('inert', modalOpen)
    topBar.setAttribute('aria-hidden', modalOpen ? 'true' : 'false')
    const left = topBar.querySelector('.top__left')
    const actions = topBar.querySelector('.top__actions')
    const mobileMenuOverlay = menuOpen && mobileViewportMq.matches
    left?.toggleAttribute('inert', mobileMenuOverlay)
    if (actions) {
      if (mobileMenuOverlay) {
        actions.removeAttribute('inert')
        for (const child of [...actions.children]) {
          if (child === menuToggle) child.removeAttribute('inert')
          else child.toggleAttribute('inert', true)
        }
      } else {
        actions.removeAttribute('inert')
        for (const child of [...actions.children]) child.removeAttribute('inert')
      }
    }
  }
  if (selectionDock) {
    const dockBlocked = modalOpen || menuOpen
    selectionDock.toggleAttribute('inert', dockBlocked)
    selectionDock.setAttribute('aria-hidden', dockBlocked ? 'true' : 'false')
  }
  if (skipLink) {
    const skipBlocked = modalOpen || (menuOpen && mobileViewportMq.matches)
    skipLink.toggleAttribute('inert', skipBlocked)
    skipLink.setAttribute('aria-hidden', skipBlocked ? 'true' : 'false')
  }

  // Mobile drawer overlays the gallery — inert gallery while the drawer is open.
  if (galleryMain) {
    const galleryBlocked = modalOpen || menuOpen
    galleryMain.toggleAttribute('inert', galleryBlocked)
    galleryMain.setAttribute('aria-hidden', galleryBlocked ? 'true' : 'false')
  }
}

function resolveBackdrop(): void {
  if (anyModalOpen() || document.body.classList.contains('menu-open')) {
    backdrop.hidden = false
    return
  }
  backdrop.hidden = true
}

function closeConfirmModal(result: boolean): void {
  if (confirmModal.hidden) return
  confirmModal.hidden = true
  releaseConfirmFocus?.()
  releaseConfirmFocus = null
  const resolve = confirmResolver
  confirmResolver = null
  resolveBackdrop()
  syncOverlayInert()
  const trigger = confirmModalTrigger
  confirmModalTrigger = null
  resolve?.(result)
  if (trigger?.isConnected) trigger.focus({ preventScroll: true })
}

function showConfirm(
  message: string,
  options: { title?: string; okLabel?: string; danger?: boolean } = {},
): Promise<boolean> {
  if (confirmResolver) {
    confirmResolver(false)
    confirmResolver = null
    confirmModalTrigger = null
  }
  return new Promise((resolve) => {
    const trigger = document.activeElement
    confirmModalTrigger = trigger instanceof HTMLElement ? trigger : null
    confirmResolver = resolve
    confirmTitle.textContent = options.title ?? '确认操作'
    confirmMessage.textContent = message
    confirmOk.textContent = options.okLabel ?? '确定'
    confirmOk.classList.toggle('is-danger', Boolean(options.danger))
    confirmModal.hidden = false
    backdrop.hidden = false
    releaseConfirmFocus?.()
    releaseConfirmFocus = trapFocus(confirmModal.querySelector('.confirm-modal__dialog') ?? confirmModal, {
      initialFocus: options.danger ? confirmCancel : confirmOk,
    })
    syncOverlayInert()
    // Destructive confirms: land on Cancel first so Enter isn't an accidental wipe.
    if (options.danger) confirmCancel.focus()
    else confirmOk.focus()
  })
}

function rebuildItemIndex(): void {
  itemBySrc.clear()
  packs.forEach((pack, packIndex) => {
    for (const item of pack.items) {
      itemBySrc.set(item.src, { item, pack, packIndex })
    }
  })

}

function resolveItemBySrc(src: string): SmojiItem | null {
  return itemBySrc.get(canonicalAssetSrc(src, manifestUrl))?.item ?? null
}

export function showToast(
  message: string,
  type: 'success' | 'error' | 'info' = 'info',
  action?: { label: string; run: () => void },
): void {
  if (!toastContainer) return

  const existing = [...toastContainer.querySelectorAll<HTMLElement>('.toast:not(.is-fading)')].find(
    (el) => el.dataset.toastKey === `${type}:${message}` && !el.querySelector('.toast__action'),
  )
  if (existing && !action) {
    bumpToastTimer(existing, type === 'error' ? 4200 : 2400)
    existing.classList.remove('is-pulse')
    void existing.offsetWidth
    existing.classList.add('is-pulse')
    return
  }

  const toast = document.createElement('div')
  toast.className = `toast toast--${type}`
  toast.dataset.toastKey = `${type}:${message}`
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status')
  toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite')
  toast.setAttribute('aria-atomic', 'true')
  const text = document.createElement('span')
  text.className = 'toast__text'
  text.textContent = message
  toast.append(text)

  if (action) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'toast__action'
    btn.textContent = action.label
    btn.addEventListener('click', () => {
      dismissToast(toast)
      action.run()
    })
    toast.append(btn)
  }

  const dismiss = document.createElement('button')
  dismiss.type = 'button'
  dismiss.className = 'toast__dismiss'
  dismiss.setAttribute('aria-label', '关闭通知')
  dismiss.textContent = '×'
  dismiss.addEventListener('click', () => dismissToast(toast))
  toast.append(dismiss)

  toastContainer.append(toast)

  const ttl = action ? 5200 : type === 'error' ? 4200 : 2400
  bumpToastTimer(toast, ttl)

  toast.addEventListener('mouseenter', () => pauseToastTimer(toast))
  toast.addEventListener('mouseleave', () => resumeToastTimer(toast))
  toast.addEventListener('focusin', () => pauseToastTimer(toast))
  toast.addEventListener('focusout', () => {
    if (!toast.contains(document.activeElement)) resumeToastTimer(toast)
  })

  const MAX_VISIBLE_TOASTS = mobileViewportMq.matches ? 1 : 2
  const visible = [...toastContainer.querySelectorAll<HTMLElement>('.toast:not(.is-fading)')]
  while (visible.length > MAX_VISIBLE_TOASTS) {
    const oldest = visible.shift()
    if (oldest) dismissToast(oldest)
  }
}

type ToastTimerState = { remaining: number; deadline: number; timer: number; paused: boolean }
const toastTimers = new WeakMap<HTMLElement, ToastTimerState>()

function bumpToastTimer(toast: HTMLElement, ttl: number): void {
  const prev = toastTimers.get(toast)
  if (prev) window.clearTimeout(prev.timer)
  const state: ToastTimerState = {
    remaining: ttl,
    deadline: Date.now() + ttl,
    paused: false,
    timer: window.setTimeout(() => dismissToast(toast), ttl),
  }
  toastTimers.set(toast, state)
}

function pauseToastTimer(toast: HTMLElement): void {
  const state = toastTimers.get(toast)
  if (!state || state.paused) return
  window.clearTimeout(state.timer)
  state.remaining = Math.max(0, state.deadline - Date.now())
  state.paused = true
}

function resumeToastTimer(toast: HTMLElement): void {
  const state = toastTimers.get(toast)
  if (!state || !state.paused) return
  state.paused = false
  state.deadline = Date.now() + state.remaining
  state.timer = window.setTimeout(() => dismissToast(toast), state.remaining)
}

function dismissToast(toast: HTMLElement): void {
  if (!toast.isConnected || toast.classList.contains('is-fading')) return
  const state = toastTimers.get(toast)
  if (state) window.clearTimeout(state.timer)
  toast.classList.add('is-fading')
  window.setTimeout(() => toast.remove(), 200)
}

const THEME_ARIA_LABEL: Record<ThemeMode, string> = {
  system: '当前主题：跟随系统，点击切换为浅色',
  light: '当前主题：浅色，点击切换为深色',
  dark: '当前主题：深色，点击切换为跟随系统',
}

export function applyTheme(theme: ThemeMode): void {
  currentTheme = theme
  localStorage.setItem('smoji-theme', theme)
  document.documentElement.dataset.theme = theme
  themeToggle.setAttribute('aria-label', THEME_ARIA_LABEL[theme])
  themeToggle.title = THEME_ARIA_LABEL[theme]
}

const systemThemeMq = window.matchMedia('(prefers-color-scheme: dark)')
systemThemeMq.addEventListener('change', () => {
  if (currentTheme === 'system') {
    // Re-apply so CSS [data-theme=system] + media query stays in sync visually for icons
    applyTheme('system')
    showToast(systemThemeMq.matches ? '系统已切换为深色' : '系统已切换为浅色', 'info')
  }
})

function cycleTheme(): void {
  const next: ThemeMode = currentTheme === 'system' ? 'light' : currentTheme === 'light' ? 'dark' : 'system'
  applyTheme(next)
  const labels: Record<ThemeMode, string> = {
    system: '已跟随系统外观',
    light: '已切换为浅色模式',
    dark: '已切换为深色模式',
  }
  showToast(labels[next], 'info')
}

function fileStem(item: SmojiItem): string {
  // Use the readable item name throughout the workbench.
  return item.label
}

function extOf(src: string): string {
  try {
    return (new URL(src).pathname.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase()
  } catch {
    return ''
  }
}

function packTitle(pack: SmojiPack): string {
  return pack.label
}

function currentItems(): readonly SmojiItem[] {
  return galleryView === 'picked'
    ? customPacks[activeCustomPackIndex]?.items ?? []
    : packs[activePack]?.items ?? []
}

function packsForWorkbenchExport(): Array<{ id: string; label: string; items: readonly SmojiItem[] }> {
  if (mode === 'custom') {
    return customPacks.filter((p) => p.items.length > 0)
  }
  return packs
    .filter((pack) => selectedPackIds.has(pack.id))
    .map((pack) => ({
      id: pack.id,
      label: pack.label,
      items: pack.items.filter((item) => !excludedItemSrcs.has(item.src)),
    }))
    .filter((pack) => pack.items.length > 0)
}

let exportSizeCacheKey = ''
let exportSizeCacheBytes = 0

function estimateExportBytes(exportPacks: Array<{ id: string; label: string; items: readonly SmojiItem[] }>): number {
  const key = exportPacks
    .map((p) => `${p.id}:${p.items.length}:${p.items[0]?.src ?? ''}:${p.items[p.items.length - 1]?.src ?? ''}`)
    .join('|')
  if (key === exportSizeCacheKey) return exportSizeCacheBytes
  try {
    const { content } = generateFormattedExport('smoji', exportPacks, manifestUrl)
    exportSizeCacheBytes = new TextEncoder().encode(content).length
  } catch {
    exportSizeCacheBytes = -1
  }
  exportSizeCacheKey = key
  return exportSizeCacheBytes
}

function updateExportState(): void {
  let disabled = false
  const exportPacks = packsForWorkbenchExport()
  const totalItems = exportPacks.reduce((acc, p) => acc + p.items.length, 0)
  const packCount = exportPacks.length
  exportToolbar.hidden = packCount === 0
  const bytes = exportPacks.length ? estimateExportBytes(exportPacks) : 0
  const kb = bytes > 0 ? bytes / 1024 : 0
  const overBudget = bytes > SMOJI_MANIFEST_MAX_BYTES
  const nearBudget = bytes > SMOJI_MANIFEST_MAX_BYTES * MANIFEST_NEAR_BUDGET_RATIO

  if (mode === 'custom') {
    galleryExportCount.textContent =
      packCount === customPacks.length
        ? `已配置 ${packCount} 个自选分组 / 共 ${totalItems} 个表情 (上限 ${CUSTOM_TOTAL_ITEM_LIMIT})`
        : `已配置 ${customPacks.length} 个分组 · 可导出 ${packCount} 个非空 / 共 ${totalItems} 个表情 (上限 ${CUSTOM_TOTAL_ITEM_LIMIT})`
    customPackCountBadge.textContent = `${customPacks.length}/${CUSTOM_PACK_LIMIT}`
    customPackCountBadge.classList.toggle('is-near-full', customPacks.length >= CUSTOM_PACK_NEAR_FULL)
    customPackCountBadge.classList.toggle('is-full', customPacks.length >= CUSTOM_PACK_LIMIT)
    updateCustomCapacityMeter(totalItems)
    disabled = packCount === 0 || overBudget || totalItems > CUSTOM_TOTAL_ITEM_LIMIT
  } else {
    customCapacity.hidden = true
    let excludedCount = 0
    for (const pack of packs) {
      if (selectedPackIds.has(pack.id)) {
        for (const item of pack.items) {
          if (excludedItemSrcs.has(item.src)) excludedCount++
        }
      }
    }
    if (excludedCount > 0) {
      galleryExportCount.textContent = `已选择 ${selectedPackIds.size} 个表情包 / ${totalItems} 个表情 (已剔除 ${excludedCount} 个)`
    } else {
      galleryExportCount.textContent = `已选择 ${selectedPackIds.size} 个表情包 / ${totalItems} 个表情`
    }
    disabled = totalItems === 0 || overBudget
  }

  if (overBudget) {
    lastExportError = null
    galleryExportError.hidden = false
    galleryExportError.textContent = `清单约 ${kb.toFixed(1)} KB，超过 ${manifestLimitLabel()} 规范上限，请减少表情后再导出`
    galleryExportError.setAttribute('role', 'alert')
    galleryExportError.classList.remove('gallery__export-error--warn')
  } else if (mode === 'custom' && totalItems > CUSTOM_TOTAL_ITEM_LIMIT) {
    lastExportError = null
    galleryExportError.hidden = false
    galleryExportError.textContent = `总表情数已超过 ${CUSTOM_TOTAL_ITEM_LIMIT} 上限，请移出后再导出`
    galleryExportError.setAttribute('role', 'alert')
    galleryExportError.classList.remove('gallery__export-error--warn')
  } else if (mode === 'packs' && selectedPackIds.size > 0 && totalItems === 0) {
    lastExportError = null
    galleryExportError.hidden = false
    galleryExportError.textContent = '所选表情包中的表情已全部剔除，无法导出'
    galleryExportError.setAttribute('role', 'alert')
    galleryExportError.classList.remove('gallery__export-error--warn')
  } else if (nearBudget) {
    lastExportError = null
    galleryExportError.hidden = false
    galleryExportError.textContent = `清单约 ${kb.toFixed(1)} KB，接近 ${manifestLimitLabel()} 上限（${Math.round((bytes / SMOJI_MANIFEST_MAX_BYTES) * 100)}%）`
    galleryExportError.setAttribute('role', 'status')
    galleryExportError.classList.add('gallery__export-error--warn')
  } else if (lastExportError) {
    galleryExportError.hidden = false
    galleryExportError.textContent = lastExportError
    galleryExportError.setAttribute('role', 'alert')
    galleryExportError.classList.remove('gallery__export-error--warn')
  } else {
    galleryExportError.hidden = true
    galleryExportError.textContent = ''
    galleryExportError.removeAttribute('role')
    galleryExportError.classList.remove('gallery__export-error--warn')
  }

  const linkExportError = !galleryExportError.hidden && Boolean(galleryExportError.id)
  exportButtons.forEach((btn) => {
    btn.disabled = disabled
    if (linkExportError) {
      btn.setAttribute('aria-describedby', galleryExportError.id)
    } else {
      btn.removeAttribute('aria-describedby')
    }
  })

  // First-run guidance when nothing is selected
  const showCta =
    packs.length > 0 &&
    guideModal.hidden &&
    ((mode === 'packs' && selectedPackIds.size === 0) ||
      (mode === 'custom' && customPacks.every((p) => p.items.length === 0)))
  const ctaWasHidden = galleryEmptyCta.hidden
  galleryEmptyCta.hidden = !showCta
  if (showCta) {
    const strong = galleryEmptyCta.querySelector('strong')
    const span = galleryEmptyCta.querySelector('span')
    if (mode === 'custom') {
      if (strong) strong.textContent = '精选分组：'
      if (span) span.textContent = '点击图片预览，使用「加入」整理自选分组。'
      btnCtaSelectCurrent.hidden = false
      btnCtaSelectCurrent.textContent = '去新建分组'
      btnCtaSelectCurrent.setAttribute('aria-label', '去新建分组')
      btnCtaCustom.hidden = true
    } else {
      if (strong) strong.textContent = '开始配置：'
      if (span) span.textContent = '点击图片预览；勾选分类后即可导出。'
      btnCtaSelectCurrent.hidden = false
      btnCtaSelectCurrent.hidden = true
      btnCtaSelectCurrent.textContent = '勾选当前分类'
      btnCtaSelectCurrent.setAttribute('aria-label', '勾选当前分类')
      btnCtaCustom.hidden = false
      btnCtaCustom.setAttribute('aria-label', btnCtaCustom.textContent?.trim() || '切换到自选分组')
    }
    if (ctaWasHidden) {
      galleryEmptyCta.classList.remove('gallery-empty-cta--enter')
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        void galleryEmptyCta.offsetWidth
        galleryEmptyCta.classList.add('gallery-empty-cta--enter')
      }
      if (gridStatus) {
        gridStatus.textContent =
          mode === 'custom'
            ? '尚未配置自选表情，可使用页内引导开始'
            : '尚未选择分类，可使用页内引导开始配置'
      }
    }
  } else {
    galleryEmptyCta.classList.remove('gallery-empty-cta--enter')
  }

  // Floating selection dock for export readiness
  if (!packs.length || showCta) {
    hideSelectionDock()
  } else {
    showSelectionDock()
    selectionDockCount.textContent = galleryExportCount.textContent || ''
    if (bytes > 0) {
      const pct = Math.min(100, Math.round((bytes / SMOJI_MANIFEST_MAX_BYTES) * 100))
      selectionDockHint.textContent = overBudget
        ? `约 ${kb.toFixed(1)} KB · 已超 ${manifestLimitLabel()} 上限，无法导出`
        : `约 ${kb.toFixed(1)} KB / ${manifestLimitLabel()} · ${selectionDockFormat?.selectedOptions[0]?.text ?? 'Smoji'} 可导出`
      selectionDockMeter.hidden = false
      selectionDockMeterBar.style.width = `${pct}%`
      selectionDockMeterBar.classList.toggle('is-warn', nearBudget && !overBudget)
      selectionDockMeterBar.classList.toggle('is-danger', overBudget)
      selectionDockMeter.setAttribute('aria-valuenow', String(pct))
      selectionDockMeter.setAttribute(
        'aria-valuetext',
        `约 ${kb.toFixed(1)} KB，占清单上限 ${pct}%`,
      )
    } else if (totalItems === 0) {
      selectionDockHint.textContent = '没有可导出的表情，请恢复或加入至少一张'
      selectionDockMeter.hidden = true
    } else {
      selectionDockHint.textContent =
        mode === 'custom'
          ? '自选分组已就绪 · 可导出多平台清单'
          : '整包选择已就绪 · 可预览 JSON 或直接下载'
      selectionDockMeter.hidden = true
    }
    selectionDockExport.disabled = disabled
    const fmtName = selectionDockFormat?.selectedOptions[0]?.text ?? 'Smoji'
    selectionDockExport.textContent = `导出 ${fmtName}`
    if (linkExportError) {
      selectionDockExport.setAttribute('aria-describedby', galleryExportError.id)
      const errTitle = galleryExportError.textContent || `导出 ${fmtName} (${modKeyLabel}+E)`
      selectionDockExport.title = errTitle
      selectionDockExport.setAttribute('aria-label', errTitle)
    } else {
      selectionDockExport.removeAttribute('aria-describedby')
      const exportTitle = `导出 ${fmtName} (${modKeyLabel}+E)`
      selectionDockExport.title = exportTitle
      selectionDockExport.setAttribute('aria-label', exportTitle)
    }
  }

  syncSelectionDockOffset()
  updateBatchPackActionButton()
  updateSidebarFoot()
  persistWorkbenchState()
}

function syncSelectionDockOffset(): void {
  if (selectionDock.hidden || selectionDock.classList.contains('is-leaving')) {
    document.documentElement.style.removeProperty('--selection-dock-offset')
    return
  }
  const rect = selectionDock.getBoundingClientRect()
  if (!rect.height) return
  const gap = 12
  const bottom = Number.parseFloat(getComputedStyle(selectionDock).bottom) || 12
  const offset = Math.ceil(rect.height + bottom + gap)
  document.documentElement.style.setProperty('--selection-dock-offset', `${offset}px`)
}

function syncKeyboardInset(): void {
  const vv = window.visualViewport
  if (!vv) {
    document.documentElement.style.setProperty('--keyboard-inset', '0px')
    return
  }
  const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
  document.documentElement.style.setProperty('--keyboard-inset', `${inset}px`)
  syncSelectionDockOffset()
}

let dockOffsetObserver: ResizeObserver | null = null
function ensureDockOffsetObserver(): void {
  if (dockOffsetObserver || typeof ResizeObserver === 'undefined') return
  dockOffsetObserver = new ResizeObserver(() => syncSelectionDockOffset())
  dockOffsetObserver.observe(selectionDock)
  window.addEventListener('resize', syncSelectionDockOffset, { passive: true })
  syncKeyboardInset()
  window.visualViewport?.addEventListener('resize', syncKeyboardInset, { passive: true })
  window.visualViewport?.addEventListener('scroll', syncKeyboardInset, { passive: true })
}

function updateBatchPackActionButton(): void {
  const pack = packs[activePack]
  if (!pack) {
    btnBatchPackAction.hidden = true
    return
  }

  if (galleryView === 'picked') {
    btnBatchPackAction.hidden = true
    return
  }
  btnBatchPackAction.hidden = false
  btnBatchPackAction.disabled = false

  if (mode === 'custom') {
    const activeCustom = activeCustomPackIndex >= 0 ? customPacks[activeCustomPackIndex] : null
    const totalItems = customPacks.reduce((acc, p) => acc + p.items.length, 0)
    const atCap = Boolean(
      activeCustom &&
        (activeCustom.items.length >= CUSTOM_PACK_ITEM_LIMIT || totalItems >= CUSTOM_TOTAL_ITEM_LIMIT),
    )
    batchPackActionIcon.textContent = '+'
    if (activeCustom) {
      batchPackActionText.textContent = atCap
        ? `「${activeCustom.label}」已达上限，无法批量加入`
        : `将「${packTitle(pack)}」全部加入「${activeCustom.label}」`
    } else {
      batchPackActionText.textContent = `将「${packTitle(pack)}」全部加入新分组`
    }
    btnBatchPackAction.disabled = atCap
  } else {
    const isSelected = selectedPackIds.has(pack.id)
    if (!isSelected) {
      batchPackActionIcon.textContent = '✓'
      batchPackActionText.textContent = `选择整包「${packTitle(pack)}」`
    } else {
      let packExcluded = 0
      for (const item of pack.items) {
        if (excludedItemSrcs.has(item.src)) packExcluded++
      }
      if (packExcluded === pack.items.length) {
        batchPackActionIcon.textContent = '↺'
        batchPackActionText.textContent = `恢复「${packTitle(pack)}」全部表情`
      } else {
        batchPackActionIcon.textContent = '✕'
        batchPackActionText.textContent = `剔除「${packTitle(pack)}」全部表情`
      }
    }
  }

  const batchLabel = batchPackActionText.textContent || '快速批量操作当前表情包'
  btnBatchPackAction.title = batchLabel
  btnBatchPackAction.setAttribute('aria-label', batchLabel)
}

function ensureActiveCustomPack(): EditableCustomPack {
  if (activeCustomPackIndex >= 0 && customPacks[activeCustomPackIndex]) {
    return customPacks[activeCustomPackIndex]!
  }
  const defaultLabel = packs[activePack] ? packTitle(packs[activePack]!) : '常用精选'
  let id = packs[activePack]?.id ?? 'fav'
  let counter = 1
  while (customPacks.some((p) => p.id === id)) {
    counter += 1
    id = `${packs[activePack]?.id ?? 'pack'}_${counter}`
  }
  const newPack: EditableCustomPack = { id, label: defaultLabel, items: [] }
  customPacks.push(newPack)
  activeCustomPackIndex = customPacks.length - 1
  renderCustomPackList()
  updateExportState()
  return newPack
}

function syncCustomGroupIoButtons(): void {
  const empty = customPacks.length === 0
  btnExportGroups.disabled = empty
  btnClearGroups.disabled = empty
  if (empty) {
    btnExportGroups.title = '导出分组（暂无自选分组）'
    btnExportGroups.setAttribute('aria-label', '导出分组（暂无自选分组）')
    btnClearGroups.title = '清空分组（暂无自选分组）'
    btnClearGroups.setAttribute('aria-label', '清空分组（暂无自选分组）')
  } else {
    const exportTitle = '导出自选分组为可移植 JSON，便于备份与后续扩展'
    const clearTitle = '清空全部自选分组'
    btnExportGroups.title = exportTitle
    btnExportGroups.setAttribute('aria-label', exportTitle)
    btnClearGroups.title = clearTitle
    btnClearGroups.setAttribute('aria-label', clearTitle)
  }
}

function renderCustomPackList(): void {
  const prevListScroll = customPackList.scrollTop
  customPackList.replaceChildren()
  customPackCountBadge.textContent = `${customPacks.length}/${CUSTOM_PACK_LIMIT}`
  const totalItems = customPacks.reduce((acc, p) => acc + p.items.length, 0)
  updateCustomCapacityMeter(totalItems)
  syncCustomGroupIoButtons()

  if (!customPacks.length) {
    const empty = document.createElement('div')
    empty.className = 'custom-pack-empty custom-pack-empty--cta'
    const title = document.createElement('p')
    title.className = 'custom-pack-empty__title'
    title.textContent = '还没有自选分组'
    const tip = document.createElement('p')
    tip.className = 'custom-pack-empty__tip'
    tip.textContent = packs[activePack]
      ? `也可直接收集「${packTitle(packs[activePack]!)}」的 ${packs[activePack]!.items.length} 张表情。`
      : '在上方填写名称，新建一个分组。'
    const actions = document.createElement('div')
    actions.className = 'custom-pack-empty__actions'
    const fromPack = document.createElement('button')
    fromPack.type = 'button'
    fromPack.className = 'btn-primary btn-sm'
    const fromLabel = packs[activePack] ? `从「${packTitle(packs[activePack]!)}」创建` : '从当前分类创建'
    fromPack.textContent = '从当前分类创建'
    fromPack.disabled = customPacks.length >= CUSTOM_PACK_LIMIT || !packs[activePack]
    if (fromPack.disabled) {
      const reason =
        customPacks.length >= CUSTOM_PACK_LIMIT
          ? `已达 ${CUSTOM_PACK_LIMIT} 组上限`
          : '暂无可用分类'
      fromPack.title = reason
      fromPack.setAttribute('aria-label', `${fromLabel}（${reason}）`)
    } else {
      fromPack.title = fromLabel
      fromPack.setAttribute('aria-label', fromLabel)
    }
    fromPack.addEventListener('click', () => {
      const pack = packs[activePack]
      if (!pack) return
      createCustomPack(pack)
    })
    actions.append(fromPack)
    empty.append(title, tip, actions)
    customPackList.append(empty)
    if (customPackStatus) customPackStatus.textContent = '暂无自选分组'
    return
  }

  const fragment = document.createDocumentFragment()

  customPacks.forEach((pack, index) => {
    if (pack.isEditing) {
      const editBox = document.createElement('div')
      editBox.className = 'custom-pack-edit-box'

      const nameInput = document.createElement('input')
      nameInput.value = pack.label
      nameInput.placeholder = '例如：常用'
      nameInput.className = 'custom-input'
      nameInput.id = `edit-name-${index}`
      const nameLabel = document.createElement('label')
      nameLabel.htmlFor = nameInput.id
      nameLabel.textContent = '分组名称'
      nameInput.maxLength = 40

      const idInput = document.createElement('input')
      idInput.value = pack.id
      idInput.placeholder = '分组 ID'
      idInput.className = 'custom-input'
      idInput.id = `edit-id-${index}`
      idInput.spellcheck = false
      const idLabel = document.createElement('label')
      idLabel.htmlFor = idInput.id
      idLabel.textContent = '分组 ID'
      idInput.maxLength = 64

      const errText = document.createElement('p')
      errText.className = 'custom-error'
      errText.hidden = true

      const actions = document.createElement('div')
      actions.className = 'custom-pack-edit-actions'

      const cancelBtn = document.createElement('button')
      cancelBtn.type = 'button'
      cancelBtn.textContent = '取消'
      cancelBtn.addEventListener('click', () => {
        pack.isEditing = false
        renderCustomPackList()
      })

      const saveBtn = document.createElement('button')
      saveBtn.type = 'button'
      saveBtn.className = 'save'
      saveBtn.textContent = '保存'
      saveBtn.addEventListener('click', () => {
        const newLabel = nameInput.value.trim()
        const newId = idInput.value.trim()
        if (!newLabel) {
          errText.hidden = false
          errText.textContent = '名称不能为空'
          return
        }
        if (!newId || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(newId)) {
          errText.hidden = false
          errText.textContent = 'ID 需以字母数字开头 (允许 ._-)'
          return
        }
        if (customPacks.some((p, i) => i !== index && p.id === newId)) {
          errText.hidden = false
          errText.textContent = `ID "${newId}" 已存在`
          return
        }
        pack.label = newLabel
        pack.id = newId
        pack.isEditing = false
        renderCustomPackList()
        renderGrid()
        updatePopGroupBtn()
        showToast(`已重命名分组为「${newLabel}」`, 'success')
      })

      actions.append(cancelBtn, saveBtn)
      editBox.append(nameLabel, nameInput, idLabel, idInput, errText, actions)
      fragment.append(editBox)
      return
    }

    const item = document.createElement('div')
    item.className = 'custom-pack-item'
    if (index === activeCustomPackIndex) item.classList.add('is-active')
    item.dataset.customIndex = String(index)
    item.setAttribute('role', 'listitem')
    if (index === activeCustomPackIndex) item.setAttribute('aria-current', 'true')
    item.tabIndex =
      index === activeCustomPackIndex || (activeCustomPackIndex < 0 && index === 0) ? 0 : -1
    const canDragPack = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    item.draggable = canDragPack

    const handle = document.createElement('span')
    handle.className = 'custom-pack-handle'
    handle.title = canDragPack
      ? '拖拽调整分组顺序（导出顺序）'
      : '使用 ↑/↓ 或 Alt+↑/↓ 调整分组顺序'
    handle.setAttribute('aria-hidden', 'true')
    handle.textContent = '⋮⋮'

    const indicator = document.createElement('span')
    indicator.className = 'custom-pack-indicator'
    indicator.setAttribute('aria-hidden', 'true')
    indicator.textContent = index === activeCustomPackIndex ? '●' : '○'
    indicator.title = index === activeCustomPackIndex ? '当前目标分组' : '点击设为当前添加目标'

    const name = document.createElement('span')
    name.className = 'custom-pack-name'
    name.id = `custom-pack-name-${index}`
    name.textContent = pack.label
    name.title = `${pack.label} · ${pack.id}`
    item.setAttribute('aria-labelledby', name.id)

    const editBtn = document.createElement('button')
    editBtn.type = 'button'
    editBtn.className = 'custom-pack-edit-btn'
    editBtn.dataset.editIndex = String(index)
    editBtn.title = '编辑名称和ID'
    editBtn.setAttribute('aria-label', `编辑分组「${pack.label}」`)
    editBtn.textContent = '编辑'

    const dupBtn = document.createElement('button')
    dupBtn.type = 'button'
    dupBtn.className = 'custom-pack-dup-btn'
    dupBtn.dataset.dupIndex = String(index)
    const atPackCap = customPacks.length >= CUSTOM_PACK_LIMIT
    if (atPackCap) {
      dupBtn.disabled = true
      dupBtn.title = `已达 ${CUSTOM_PACK_LIMIT} 组上限`
      dupBtn.setAttribute('aria-label', `复制分组「${pack.label}」（已达 ${CUSTOM_PACK_LIMIT} 组上限）`)
    } else {
      dupBtn.title = '复制此分组（便于扩展变体）'
      dupBtn.setAttribute('aria-label', `复制分组「${pack.label}」`)
    }
    dupBtn.textContent = '复制'

    const mergeBtn = document.createElement('button')
    mergeBtn.type = 'button'
    mergeBtn.className = 'custom-pack-merge-btn'
    mergeBtn.dataset.mergeIndex = String(index)
    mergeBtn.disabled = index === 0
    if (mergeBtn.disabled) {
      mergeBtn.title = '已是第一个分组，无法上合并'
      mergeBtn.setAttribute('aria-label', `合并「${pack.label}」到上一分组（已是第一个分组）`)
    } else {
      mergeBtn.title = '合并到上一分组'
      mergeBtn.setAttribute('aria-label', `合并「${pack.label}」到上一分组`)
    }
    mergeBtn.textContent = '上合并'

    const upBtn = document.createElement('button')
    upBtn.type = 'button'
    upBtn.className = 'custom-pack-move-btn'
    upBtn.dataset.moveIndex = String(index)
    upBtn.dataset.moveDir = '-1'
    upBtn.disabled = index === 0
    if (upBtn.disabled) {
      upBtn.title = '已是第一个分组'
      upBtn.setAttribute('aria-label', `上移分组「${pack.label}」（已是第一个分组）`)
    } else {
      upBtn.title = '上移分组（Alt+↑）'
      upBtn.setAttribute('aria-label', `上移分组「${pack.label}」`)
    }
    upBtn.textContent = '上移'

    const downBtn = document.createElement('button')
    downBtn.type = 'button'
    downBtn.className = 'custom-pack-move-btn'
    downBtn.dataset.moveIndex = String(index)
    downBtn.dataset.moveDir = '1'
    downBtn.disabled = index >= customPacks.length - 1
    if (downBtn.disabled) {
      downBtn.title = '已是最后一个分组'
      downBtn.setAttribute('aria-label', `下移分组「${pack.label}」（已是最后一个分组）`)
    } else {
      downBtn.title = '下移分组（Alt+↓）'
      downBtn.setAttribute('aria-label', `下移分组「${pack.label}」`)
    }
    downBtn.textContent = '下移'

    const splitBtn = document.createElement('button')
    splitBtn.type = 'button'
    splitBtn.className = 'custom-pack-split-btn'
    splitBtn.dataset.splitIndex = String(index)
    splitBtn.disabled = pack.items.length < 2 || atPackCap
    if (pack.items.length < 2) {
      splitBtn.title = '至少需要 2 项才能拆分'
      splitBtn.setAttribute('aria-label', `拆分分组「${pack.label}」（至少需要 2 项）`)
    } else if (atPackCap) {
      splitBtn.title = `已达 ${CUSTOM_PACK_LIMIT} 组上限`
      splitBtn.setAttribute('aria-label', `拆分分组「${pack.label}」（已达 ${CUSTOM_PACK_LIMIT} 组上限）`)
    } else {
      splitBtn.title = '拆分下半部分为新分组'
      splitBtn.setAttribute('aria-label', `拆分分组「${pack.label}」`)
    }
    splitBtn.textContent = '拆分'

    const count = document.createElement('button')
    count.type = 'button'
    count.className = 'custom-pack-count'
    count.dataset.expandIndex = String(index)
    count.setAttribute('aria-expanded', String(Boolean(pack.isExpanded)))
    count.setAttribute('aria-controls', `custom-tray-${index}`)
    count.setAttribute(
      'aria-label',
      `${pack.isExpanded ? '折叠' : '展开'}「${pack.label}」缩略图，${pack.items.length} 项`,
    )
    count.title = pack.isExpanded ? '折叠缩略图' : '展开缩略图'
    const countPct = Math.min(100, Math.round((pack.items.length / CUSTOM_PACK_ITEM_LIMIT) * 100))
    count.style.setProperty('--pack-fill', `${countPct}%`)
    count.classList.toggle('is-near-full', pack.items.length >= CUSTOM_ITEM_NEAR_FULL)
    count.classList.toggle('is-full', pack.items.length >= CUSTOM_PACK_ITEM_LIMIT)
    count.textContent = `${pack.items.length}/${CUSTOM_PACK_ITEM_LIMIT}${pack.isExpanded ? ' ▴' : ' ▾'}`

    const delBtn = document.createElement('button')
    delBtn.type = 'button'
    delBtn.className = 'custom-pack-del'
    delBtn.dataset.deleteIndex = String(index)
    delBtn.title = '删除此分组'
    delBtn.setAttribute('aria-label', `删除分组「${pack.label}」`)
    delBtn.textContent = '删除'

    const mainRow = document.createElement('div')
    mainRow.className = 'custom-pack-row'
    mainRow.append(handle, indicator, name)
    const metaRow = document.createElement('div')
    metaRow.className = 'custom-pack-meta'
    metaRow.append(count, delBtn)

    const tools = document.createElement('div')
    tools.className = 'custom-pack-tools'
    tools.append(editBtn, dupBtn, mergeBtn, upBtn, downBtn, splitBtn)

    item.append(mainRow, metaRow, tools)
    fragment.append(item)

    if (pack.isExpanded) {
      const tray = document.createElement('div')
      tray.className = 'custom-pack-tray'
      tray.id = `custom-tray-${index}`
      tray.dataset.trayDropPack = String(index)
      tray.setAttribute('role', 'list')
      tray.setAttribute('aria-label', `${pack.label} 表情托盘`)

      if (pack.items.length === 0) {
        tray.classList.add('is-empty')
        tray.tabIndex = 0
        tray.setAttribute('role', 'button')
        tray.setAttribute('aria-label', `将「${pack.label}」设为目标分组`)
        const hint = document.createElement('p')
        hint.className = 'custom-pack-tray__hint'
        const canDrag = window.matchMedia('(hover: hover) and (pointer: fine)').matches
        hint.textContent = canDrag
          ? '拖入表情到此分组'
          : '点此设为目标分组，再从网格加入'
        tray.append(hint)
        fragment.append(tray)
      } else {
      const TRAY_CAP = TRAY_VISIBLE_CAP
      const visible = pack.items.slice(0, TRAY_CAP)
      visible.forEach((trayItem, itemIdx) => {
        const thumb = document.createElement('div')
        thumb.className = 'tray-thumb'
        const canDrag = window.matchMedia('(hover: hover) and (pointer: fine)').matches
        thumb.draggable = canDrag
        thumb.tabIndex = 0
        thumb.dataset.trayPack = String(index)
        thumb.dataset.trayItem = String(itemIdx)
        thumb.dataset.traySrc = trayItem.src
        thumb.title = canDrag
          ? `点击查看 · 拖拽或 Alt+←/→ 调整「${trayItem.label}」顺序`
          : `点击查看 · 使用左右按钮或 Alt+←/→ 调整「${trayItem.label}」顺序`
        thumb.setAttribute('role', 'listitem')
        thumb.setAttribute('aria-label', `${trayItem.label}，第 ${itemIdx + 1} 项，按 Enter 查看详情`)
        const img = document.createElement('img')
        img.alt = trayItem.label
        img.loading = 'lazy'
        loadImage(img, thumbnailSrc(trayItem.src))
        img.draggable = false
        img.addEventListener(
          'error',
          () => {
            thumb.classList.add('is-broken')
            img.alt = ''
            thumb.setAttribute('aria-label', `${trayItem.label}（图片加载失败），第 ${itemIdx + 1} 项`)
          },
          { once: true },
        )
        const idxBadge = document.createElement('span')
        idxBadge.className = 'tray-thumb-idx'
        idxBadge.textContent = String(itemIdx + 1)
        const delThumb = document.createElement('button')
        delThumb.type = 'button'
        delThumb.className = 'tray-thumb-del'
        delThumb.dataset.removePack = String(index)
        delThumb.dataset.removeItem = String(itemIdx)
        delThumb.textContent = '×'
        delThumb.title = `从分组移出 ${trayItem.label}`
        delThumb.setAttribute('aria-label', delThumb.title)

        const moves = document.createElement('div')
        moves.className = 'tray-thumb-moves'
        const moveLeft = document.createElement('button')
        moveLeft.type = 'button'
        moveLeft.className = 'tray-thumb-move'
        moveLeft.dataset.trayMovePack = String(index)
        moveLeft.dataset.trayMoveItem = String(itemIdx)
        moveLeft.dataset.trayMoveDir = '-1'
        moveLeft.textContent = '◀'
        const canCrossLeft = itemIdx === 0 && index > 0
        moveLeft.disabled = itemIdx === 0 && !canCrossLeft
        moveLeft.setAttribute(
          'aria-label',
          canCrossLeft
            ? `将「${trayItem.label}」移到上一分组`
            : `左移「${trayItem.label}」`,
        )
        const moveRight = document.createElement('button')
        moveRight.type = 'button'
        moveRight.className = 'tray-thumb-move'
        moveRight.dataset.trayMovePack = String(index)
        moveRight.dataset.trayMoveItem = String(itemIdx)
        moveRight.dataset.trayMoveDir = '1'
        moveRight.textContent = '▶'
        const canCrossRight = itemIdx >= pack.items.length - 1 && index < customPacks.length - 1
        moveRight.disabled = itemIdx >= pack.items.length - 1 && !canCrossRight
        moveRight.setAttribute(
          'aria-label',
          canCrossRight
            ? `将「${trayItem.label}」移到下一分组`
            : `右移「${trayItem.label}」`,
        )
        moves.append(moveLeft, moveRight)

        thumb.append(img, idxBadge, delThumb, moves)
        tray.append(thumb)
      })
      if (pack.items.length > TRAY_CAP) {
        const more = document.createElement('button')
        more.type = 'button'
        more.className = 'tray-more'
        more.textContent = `+${pack.items.length - TRAY_CAP}`
        more.title = '在「已入组」视图中查看并管理全部表情'
        more.setAttribute(
          'aria-label',
          `还有 ${pack.items.length - TRAY_CAP} 个表情未展示，打开已入组视图`,
        )
        more.addEventListener('click', (event) => {
          event.stopPropagation()
          activeCustomPackIndex = index
          customPacks.forEach((p, i) => {
            p.isExpanded = i === index
          })
          renderCustomPackList()
          setGalleryView('picked')
          showToast(`已切换到「${pack.label}」已入组视图`, 'info')
        })
        tray.append(more)
      }
      fragment.append(tray)
      }
    }
  })

  customPackList.append(fragment)
  customPackList.scrollTop = prevListScroll
  const active = activeCustomPackIndex >= 0 ? customPacks[activeCustomPackIndex] : customPacks[0]
  if (customPackStatus && active) {
    customPackStatus.textContent = `当前目标分组：${active.label}，${active.items.length} 项`
  }
}

function reorderCustomPack(fromIndex: number, toIndex: number): void {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= customPacks.length ||
    toIndex >= customPacks.length
  ) {
    return
  }
  const [moved] = customPacks.splice(fromIndex, 1)
  if (!moved) return
  customPacks.splice(toIndex, 0, moved)
  if (activeCustomPackIndex === fromIndex) activeCustomPackIndex = toIndex
  else if (fromIndex < activeCustomPackIndex && toIndex >= activeCustomPackIndex) activeCustomPackIndex -= 1
  else if (fromIndex > activeCustomPackIndex && toIndex <= activeCustomPackIndex) activeCustomPackIndex += 1
  renderCustomPackList()
  updateExportState()
  updatePopGroupBtn()
  showToast('已调整自选分组顺序', 'success')
}

function reorderTrayItem(packIndex: number, fromItem: number, toItem: number): void {
  const pack = customPacks[packIndex]
  if (!pack) return
  if (
    fromItem === toItem ||
    fromItem < 0 ||
    toItem < 0 ||
    fromItem >= pack.items.length ||
    toItem >= pack.items.length
  ) {
    return
  }
  const [moved] = pack.items.splice(fromItem, 1)
  if (!moved) return
  pack.items.splice(toItem, 0, moved)
  renderCustomPackList()
  renderGrid()
  updateExportState()
  updatePopGroupBtn()
  showToast('已调整分组内表情顺序', 'success')
}

function moveTrayItemAcrossPacks(
  fromPack: number,
  fromItem: number,
  toPack: number,
  toItem?: number,
): void {
  if (fromPack === toPack) {
    if (toItem !== undefined) reorderTrayItem(fromPack, fromItem, toItem)
    return
  }
  const source = customPacks[fromPack]
  const target = customPacks[toPack]
  if (!source || !target) return
  const moved = source.items[fromItem]
  if (!moved) return
  if (target.items.some((i) => i.src === moved.src)) {
    showToast(`「${target.label}」已包含该表情`, 'info')
    return
  }
  if (target.items.length >= CUSTOM_PACK_ITEM_LIMIT) {
    showToast(`「${target.label}」已达 ${CUSTOM_PACK_ITEM_LIMIT} 上限`, 'error')
    return
  }
  source.items.splice(fromItem, 1)
  const insertAt =
    toItem === undefined ? target.items.length : Math.min(Math.max(0, toItem), target.items.length)
  target.items.splice(insertAt, 0, moved)
  target.isExpanded = true
  renderCustomPackList()
  renderGrid()
  updateExportState()
  updatePopGroupBtn()
  showToast(`已移至「${target.label}」`, 'success')
}

function duplicateCustomPack(index: number): void {
  const source = customPacks[index]
  if (!source) return
  if (customPacks.length >= CUSTOM_PACK_LIMIT) {
    showToast(`最多创建 ${CUSTOM_PACK_LIMIT} 个分组`, 'error')
    return
  }
  let id = `${source.id}_copy`
  let n = 1
  while (customPacks.some((p) => p.id === id)) {
    id = `${source.id}_copy${n++}`
  }
  const label = `${source.label} 副本`
  customPacks.splice(index + 1, 0, {
    id,
    label: label.slice(0, 40),
    items: source.items.slice(),
  })
  activeCustomPackIndex = index + 1
  renderCustomPackList()
  renderGrid()
  updateExportState()
  updatePopGroupBtn()
  showToast(`已复制分组「${source.label}」`, 'success')
}

function mergeCustomPackIntoPrevious(index: number): void {
  if (index <= 0 || index >= customPacks.length) return
  const source = customPacks[index]
  const target = customPacks[index - 1]
  if (!source || !target) return

  const seen = new Set(target.items.map((i) => i.src))
  let added = 0
  let skipped = 0
  const totalWithoutSource = customPacks.reduce(
    (acc, p, i) => (i === index ? acc : acc + p.items.length),
    0,
  )

  for (const item of source.items) {
    if (seen.has(item.src)) {
      skipped++
      continue
    }
    if (target.items.length >= CUSTOM_PACK_ITEM_LIMIT || totalWithoutSource + added >= CUSTOM_TOTAL_ITEM_LIMIT) {
      skipped++
      continue
    }
    target.items.push(item)
    seen.add(item.src)
    added++
  }

  customPacks.splice(index, 1)
  if (activeCustomPackIndex === index) activeCustomPackIndex = index - 1
  else if (activeCustomPackIndex > index) activeCustomPackIndex -= 1

  renderCustomPackList()
  renderGrid()
  updateExportState()
  updatePopGroupBtn()
  const extra = skipped > 0 ? `（跳过 ${skipped}）` : ''
  showToast(`已合并到「${target.label}」+${added}${extra}`, 'success')
}

function splitCustomPack(index: number): void {
  const source = customPacks[index]
  if (!source || source.items.length < 2) {
    showToast('至少 2 个表情才能拆分', 'info')
    return
  }
  if (customPacks.length >= CUSTOM_PACK_LIMIT) {
    showToast(`最多创建 ${CUSTOM_PACK_LIMIT} 个分组`, 'error')
    return
  }
  const mid = Math.ceil(source.items.length / 2)
  const moved = source.items.splice(mid)
  let id = `${source.id}_part`
  let n = 1
  while (customPacks.some((p) => p.id === id)) {
    id = `${source.id}_part${n++}`
  }
  const label = `${source.label} · 下半`.slice(0, 40)
  customPacks.splice(index + 1, 0, {
    id,
    label,
    items: moved,
    isExpanded: true,
  })
  activeCustomPackIndex = index + 1
  renderCustomPackList()
  renderGrid()
  updateExportState()
  updatePopGroupBtn()
  showToast(`已拆出「${label}」（${moved.length} 项）`, 'success')
}

function syncSourcePacksTabpanel(): void {
  // In custom mode the source list stays visible as auxiliary nav — not the active tabpanel.
  if (mode === 'packs') {
    sourcePacksSection.setAttribute('role', 'tabpanel')
    sourcePacksSection.setAttribute('aria-labelledby', 'tab-packs')
    sourcePacksSection.removeAttribute('aria-hidden')
  } else {
    sourcePacksSection.removeAttribute('role')
    sourcePacksSection.removeAttribute('aria-labelledby')
    sourcePacksSection.setAttribute('aria-label', '浏览源分类')
  }
}

function setMode(newMode: ExportMode, options: { silent?: boolean } = {}): void {
  mode = newMode
  document.body.classList.toggle('mode-custom', mode === 'custom')
  tabPacks.classList.toggle('is-active', mode === 'packs')
  tabPacks.setAttribute('aria-selected', String(mode === 'packs'))
  tabPacks.tabIndex = mode === 'packs' ? 0 : -1
  tabCustom.classList.toggle('is-active', mode === 'custom')
  tabCustom.setAttribute('aria-selected', String(mode === 'custom'))
  tabCustom.tabIndex = mode === 'custom' ? 0 : -1
  customBuilder.hidden = mode !== 'custom'
  galleryViewPicked.hidden = mode !== 'custom'
  syncSourcePacksTabpanel()
  if (mode !== 'custom' && galleryView === 'picked') {
    setGalleryView('active', { silent: true })
  } else {
    syncGalleryViewChips()
  }
  sourcePacksLabel.textContent = mode === 'custom' ? '浏览源分类' : '表情分类'
  syncPreviewScopeChipLabels()
  syncPopShortcutHint()
  closePop()
  keyboardFocusIndex = -1
  grid.scrollTop = 0
  renderGrid()
  updateSidebarFoot()
  updateExportState()
  if (mode === 'custom' && mobileViewportMq.matches) setMenuOpen(true)
  if (!codeModal.hidden) {
    syncPreviewScopeChipLabels()
    updateCodePreview(currentCodeFormat)
  }
  if (!options.silent) {
    showToast(`已切换至「${mode === 'custom' ? '自选分组' : '整包导出'}」模式`, 'info')
  }
}

function syncGalleryViewChips(): void {
  galleryViewActive.parentElement!.hidden = mode !== 'custom'
  galleryViewPicked.hidden = mode !== 'custom'
  for (const chip of galleryViewChips) {
    const scope = (chip.dataset.galleryView as typeof galleryView) || 'active'
    const on = galleryView === scope && !chip.hidden
    chip.classList.toggle('is-active', on)
    chip.setAttribute('aria-checked', String(on))
    chip.tabIndex = on ? 0 : -1
    if (chip.title) chip.setAttribute('aria-label', chip.title)
  }
  // If active chip is hidden (left custom mode), keep a visible chip in tab order.
  if (galleryViewChips.every((c) => c.tabIndex !== 0)) {
    const fallback = galleryViewChips.find((c) => !c.hidden) ?? galleryViewActive
    fallback.tabIndex = 0
  }
}

function setGalleryView(scope: 'active' | 'picked', options: { silent?: boolean } = {}): void {
  if (scope === 'picked' && mode !== 'custom') scope = 'active'
  galleryView = scope
  syncGalleryViewChips()
  keyboardFocusIndex = -1
  grid.scrollTop = 0
  renderGrid()
  if (!options.silent) {
    if (scope === 'picked') showToast('已切换为仅看当前自选分组', 'info')
  }
}

function renderRecentStrip(): void {
  recentStripList.replaceChildren()
  const valid = recentEntries.filter((e) => itemBySrc.has(e.src))
  recentEntries = valid
  if (!valid.length) {
    recentStrip.hidden = true
    return
  }
  recentStrip.hidden = false
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const fragment = document.createDocumentFragment()
  valid.forEach((entry, index) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'recent-thumb'
    if (!reduceMotion) btn.classList.add('recent-thumb--enter')
    btn.tabIndex = index === 0 ? 0 : -1
    const packLabel = itemBySrc.get(entry.src)?.pack.label ?? entry.packId
    btn.title = `${entry.label} · ${packLabel}`
    btn.setAttribute('aria-label', `${entry.label}，来自 ${packLabel}`)
    btn.dataset.recentSrc = entry.src
    const img = document.createElement('img')
    img.alt = entry.label
    img.loading = 'lazy'
    loadImage(img, thumbnailSrc(entry.src))
    img.decoding = 'async'
    img.referrerPolicy = 'no-referrer'
    img.addEventListener(
      'error',
      () => {
        btn.classList.add('is-broken')
        img.alt = ''
        img.setAttribute('aria-hidden', 'true')
        btn.setAttribute('aria-label', `${entry.label}，来自 ${packLabel}，图片加载失败`)
      },
      { once: true },
    )
    const badge = document.createElement('span')
    badge.className = 'recent-thumb__pack'
    badge.textContent = packLabel
    btn.append(img, badge)
    fragment.append(btn)
  })
  recentStripList.append(fragment)
}

function rememberRecent(item: SmojiItem, pack: SmojiPack): void {
  recentEntries = pushRecentEntry({
    src: item.src,
    packId: pack.id,
    label: item.label || fileStem(item),
  })
  renderRecentStrip()
}

function updateCustomCapacityMeter(totalItems: number): void {
  customCapacity.hidden = false
  const pct = Math.min(100, Math.round((totalItems / CUSTOM_TOTAL_ITEM_LIMIT) * 100))
  const nearFull = totalItems >= CUSTOM_TOTAL_NEAR_FULL && totalItems < CUSTOM_TOTAL_ITEM_LIMIT
  customCapacityBar.style.width = `${pct}%`
  customCapacityBar.classList.toggle('is-warn', nearFull)
  customCapacityBar.classList.toggle('is-danger', totalItems >= CUSTOM_TOTAL_ITEM_LIMIT)
  customCapacityLabel.textContent = `${totalItems} / ${CUSTOM_TOTAL_ITEM_LIMIT} 项`
  customCapacityLabel.classList.toggle('is-warn', nearFull)
  if (nearFull) customCapacityLabel.setAttribute('role', 'status')
  else customCapacityLabel.removeAttribute('role')
  customCapacity.setAttribute('role', 'progressbar')
  customCapacity.setAttribute('aria-labelledby', 'custom-capacity-label')
  customCapacity.setAttribute('aria-valuemin', '0')
  customCapacity.setAttribute('aria-valuemax', String(CUSTOM_TOTAL_ITEM_LIMIT))
  customCapacity.setAttribute('aria-valuenow', String(totalItems))
  customCapacity.setAttribute(
    'aria-valuetext',
    nearFull
      ? `已用 ${totalItems} / ${CUSTOM_TOTAL_ITEM_LIMIT} 项，约 ${pct}%，接近上限`
      : `已用 ${totalItems} / ${CUSTOM_TOTAL_ITEM_LIMIT} 项，约 ${pct}%`,
  )
  customCapacity.removeAttribute('aria-describedby')
  customCapacity.removeAttribute('aria-label')

  const atPackLimit = customPacks.length >= CUSTOM_PACK_LIMIT
  const submitBtn = customAddForm.querySelector<HTMLButtonElement>('button[type="submit"]')
  customNameInput.disabled = atPackLimit
  customIdInput.disabled = atPackLimit
  if (submitBtn) {
    submitBtn.disabled = atPackLimit
    if (atPackLimit) {
      const limitMsg = `已达 ${CUSTOM_PACK_LIMIT} 组上限`
      submitBtn.title = limitMsg
      submitBtn.setAttribute('aria-label', `${submitBtn.textContent?.trim() || '新建自选分组'}（${limitMsg}）`)
    } else {
      submitBtn.title = ''
      submitBtn.removeAttribute('aria-label')
    }
  }
  if (atPackLimit) {
    showCustomFormError(`已达 ${CUSTOM_PACK_LIMIT} 个分组上限，请删除或合并后再新建`, 'both')
  } else if (customFormError.textContent.includes('上限')) {
    clearCustomFormError()
  }

  if (atPackLimit || nearFull) {
    const ids = ['custom-capacity-label']
    if (!customFormError.hidden) ids.push('custom-form-error')
    const describedBy = ids.join(' ')
    customNameInput.setAttribute('aria-describedby', describedBy)
    submitBtn?.setAttribute('aria-describedby', describedBy)
  } else if (customFormError.hidden) {
    customNameInput.removeAttribute('aria-describedby')
    submitBtn?.removeAttribute('aria-describedby')
  }
}

function updateSidebarFoot(): void {
  if (!packs.length) {
    sidebarFoot.hidden = true
    return
  }
  const total = packs.reduce((acc, p) => acc + p.items.length, 0)
  sidebarFoot.hidden = false
  sidebarFoot.replaceChildren()

  const statRow = document.createElement('div')
  statRow.className = 'sidebar-foot__row'
  const statSpan = document.createElement('span')
  statSpan.className = 'sidebar-foot__stat'

  const limitRow = document.createElement('div')
  limitRow.className = 'sidebar-foot__row'
  const limitSpan = document.createElement('span')
  limitSpan.className = 'sidebar-foot__limit'

  if (mode === 'custom') {
    const customTotal = customPacks.reduce((acc, p) => acc + p.items.length, 0)
    statSpan.textContent = `源库 ${packs.length} 组 · ${total} 表情`
    limitSpan.textContent = `自选 ${customPacks.length}/${CUSTOM_PACK_LIMIT} 组 · ${customTotal}/${CUSTOM_TOTAL_ITEM_LIMIT} 项`
  } else {
    statSpan.textContent = `${packs.length} 组 · ${total} 表情`
    limitSpan.textContent = `可扩展至 ${CUSTOM_PACK_LIMIT} 组 / ${CUSTOM_TOTAL_ITEM_LIMIT} 项`
  }

  statRow.append(statSpan)
  limitRow.append(limitSpan)
  sidebarFoot.append(statRow, limitRow)

  if (workbenchBundleNotes) {
    const noteRow = document.createElement('div')
    noteRow.className = 'sidebar-foot__row'
    const noteSpan = document.createElement('span')
    noteSpan.className = 'sidebar-foot__note'
    noteSpan.title = workbenchBundleNotes
    noteSpan.textContent = `备注：${workbenchBundleNotes}`
    noteRow.append(noteSpan)
    sidebarFoot.append(noteRow)
  }

  if (scopeChipAll) {
    scopeChipAll.textContent = `全部表情 (${packs.length}包)`
  }
}

export function handleCustomItemClick(item: SmojiItem): void {
  const activeCustom = ensureActiveCustomPack()
  const existingIndex = activeCustom.items.findIndex((i) => i.src === item.src)
  if (existingIndex !== -1) {
    const [removed] = activeCustom.items.splice(existingIndex, 1)
    if (removed) {
      const packIdx = activeCustomPackIndex
      const removedIndex = existingIndex
      const removedItem = removed
      historyStack.push({
        description: `从「${activeCustom.label}」移出表情「${removed.label}」`,
        undo: () => {
          const targetPack = customPacks[packIdx]
          if (targetPack && !targetPack.items.some((i) => i.src === removedItem.src)) {
            targetPack.items.splice(Math.min(removedIndex, targetPack.items.length), 0, removedItem)
            activeCustomPackIndex = packIdx
            renderCustomPackList()
            renderGrid()
            updateExportState()
            updatePopGroupBtn()
          }
        },
        redo: () => {
          const targetPack = customPacks[packIdx]
          if (targetPack) {
            const idx = targetPack.items.findIndex((i) => i.src === removedItem.src)
            if (idx !== -1) targetPack.items.splice(idx, 1)
            activeCustomPackIndex = packIdx
            renderCustomPackList()
            renderGrid()
            updateExportState()
            updatePopGroupBtn()
          }
        },
      })
      lastUndo = {
        type: 'custom-remove',
        packIndex: activeCustomPackIndex,
        item: removed,
        itemIndex: existingIndex,
      }
    }
    if (!pop.hidden) {
      showPopFeedback(`已从「${activeCustom.label}」移出`, 'info', {
        label: '撤销',
        run: () => {
          undoLastAction()
        },
      })
    } else {
      showToast(`已从「${activeCustom.label}」移出`, 'info', {
        label: '撤销',
        run: () => {
          undoLastAction()
        },
      })
    }
    renderCustomPackList()
    renderGrid()
    updateExportState()
    updatePopGroupBtn()
    return
  }
  addItemToCustomPackAt(activeCustomPackIndex, item)
}

function showPopFeedback(
  message: string,
  kind: 'error' | 'info' | 'success' = 'info',
  action?: { label: string; run: () => void },
): void {
  if (pop.hidden) return
  copyFeedback.hidden = false
  copyFeedback.replaceChildren()
  const text = document.createElement('span')
  text.textContent = message
  copyFeedback.append(text)
  if (action) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'pop__feedback-action'
    btn.textContent = action.label
    btn.addEventListener('click', () => {
      copyFeedback.hidden = true
      action.run()
    })
    copyFeedback.append(btn)
  }
  copyFeedback.classList.toggle('pop__feedback--error', kind === 'error')
  copyFeedback.classList.toggle('pop__feedback--success', kind === 'success')
}

/** Add an item to a specific custom pack (used by tray drop / click-add). Returns false on cap/dup. */
function addItemToCustomPackAt(
  packIndex: number,
  item: SmojiItem,
  options: { silentToast?: boolean } = {},
): boolean {
  const pack = customPacks[packIndex]
  if (!pack) return false
  if (pack.items.some((i) => i.src === item.src)) {
    if (!options.silentToast) {
      if (!pop.hidden) showPopFeedback(`「${pack.label}」已包含该表情`, 'info')
      else showToast(`「${pack.label}」已包含该表情`, 'info')
    }
    return false
  }
  if (pack.items.length >= CUSTOM_PACK_ITEM_LIMIT) {
    const msg = `分组「${pack.label}」表情数已达 ${CUSTOM_PACK_ITEM_LIMIT} 上限`
    if (!pop.hidden) showPopFeedback(msg, 'error')
    else {
      galleryExportError.hidden = false
      galleryExportError.textContent = msg
      showToast(`「${pack.label}」已达到 ${CUSTOM_PACK_ITEM_LIMIT} 上限`, 'error')
    }
    return false
  }
  const totalItemsCount = customPacks.reduce((acc, p) => acc + p.items.length, 0)
  if (totalItemsCount >= CUSTOM_TOTAL_ITEM_LIMIT) {
    const msg = `总表情数已达 ${CUSTOM_TOTAL_ITEM_LIMIT} 上限`
    if (!pop.hidden) showPopFeedback(msg, 'error')
    else {
      galleryExportError.hidden = false
      galleryExportError.textContent = msg
      showToast(`所有分组总表情数已达 ${CUSTOM_TOTAL_ITEM_LIMIT} 上限`, 'error')
    }
    return false
  }
  pack.items.push(item)
  pack.isExpanded = true
  activeCustomPackIndex = packIndex
  const addedItem = item
  const packIdx = packIndex
  historyStack.push({
    description: `表情加入「${pack.label}」`,
    undo: () => {
      const targetPack = customPacks[packIdx]
      if (targetPack) {
        const idx = targetPack.items.findIndex((i) => i.src === addedItem.src)
        if (idx !== -1) targetPack.items.splice(idx, 1)
        activeCustomPackIndex = packIdx
        renderCustomPackList()
        renderGrid()
        updateExportState()
        updatePopGroupBtn()
      }
    },
    redo: () => {
      const targetPack = customPacks[packIdx]
      if (targetPack && !targetPack.items.some((i) => i.src === addedItem.src)) {
        targetPack.items.push(addedItem)
        activeCustomPackIndex = packIdx
        renderCustomPackList()
        renderGrid()
        updateExportState()
        updatePopGroupBtn()
      }
    },
  })
  lastUndo = null
  if (!options.silentToast) {
    if (!pop.hidden) showPopFeedback(`已将表情加入「${pack.label}」(#${pack.items.length})`, 'success')
    else showToast(`已将表情加入「${pack.label}」(#${pack.items.length})`, 'success')
  }
  renderCustomPackList()
  renderGrid()
  updateExportState()
  updatePopGroupBtn()
  return true
}

function undoLastAction(): boolean {
  if (historyStack.canUndo) {
    const cmd = historyStack.undo()
    if (cmd) {
      showToast(`已撤销：${cmd.description}`, 'info')
      return true
    }
  }
  if (!lastUndo) return false
  const action = lastUndo
  lastUndo = null

  if (action.type === 'custom-remove') {
    const pack = customPacks[action.packIndex]
    if (!pack) {
      showToast('无法撤销：分组已不存在', 'error')
      return false
    }
    if (pack.items.some((i) => i.src === action.item.src)) {
      showToast('表情已在分组中，无需撤销', 'info')
      return false
    }
    if (pack.items.length >= CUSTOM_PACK_ITEM_LIMIT) {
      showToast('撤销失败：分组已满', 'error')
      return false
    }
    const insertAt = Math.min(action.itemIndex, pack.items.length)
    pack.items.splice(insertAt, 0, action.item)
    activeCustomPackIndex = action.packIndex
    renderCustomPackList()
    renderGrid()
    updateExportState()
    updatePopGroupBtn()
    showToast('已撤销移出', 'success')
    return true
  }

  if (action.type === 'custom-clear') {
    customPacks.length = 0
    for (const pack of action.packs) {
      customPacks.push({
        id: pack.id,
        label: pack.label,
        items: pack.items.slice(),
        isExpanded: pack.isExpanded,
      })
    }
    activeCustomPackIndex = action.activeIndex
    renderCustomPackList()
    renderGrid()
    updateExportState()
    updatePopGroupBtn()
    showToast('已恢复自选分组', 'success')
    return true
  }

  if (action.type === 'custom-delete') {
    if (customPacks.length >= CUSTOM_PACK_LIMIT) {
      showToast('无法撤销：分组数已满', 'error')
      return false
    }
    customPacks.splice(action.packIndex, 0, {
      id: action.pack.id,
      label: action.pack.label,
      items: action.pack.items.slice(),
      isExpanded: action.pack.isExpanded,
    })
    activeCustomPackIndex = action.activeIndex
    renderCustomPackList()
    renderGrid()
    updateExportState()
    updatePopGroupBtn()
    showToast(`已恢复分组「${action.pack.label}」`, 'success')
    return true
  }

  return false
}

function redoLastAction(): boolean {
  if (historyStack.canRedo) {
    const cmd = historyStack.redo()
    if (cmd) {
      showToast(`已重做：${cmd.description}`, 'success')
      return true
    }
  }
  return false
}

async function clearAllCustomGroups(): Promise<void> {
  if (!customPacks.length) {
    showToast('暂无自选分组可清空', 'info')
    return
  }
  const ok = await showConfirm(`确定清空全部 ${customPacks.length} 个自选分组？可用 Ctrl+Z 撤销。`, {
    title: '清空自选分组',
    okLabel: '清空',
    danger: true,
  })
  if (!ok) return
  const snapshotPacks = customPacks.map((p) => ({
    id: p.id,
    label: p.label,
    items: p.items.slice(),
    isExpanded: p.isExpanded,
  }))
  const snapshotActive = activeCustomPackIndex
  historyStack.push({
    description: '清空自选分组',
    undo: () => {
      customPacks.length = 0
      for (const p of snapshotPacks) {
        customPacks.push({
          id: p.id,
          label: p.label,
          items: p.items.slice(),
          isExpanded: p.isExpanded,
        })
      }
      activeCustomPackIndex = snapshotActive
      renderCustomPackList()
      renderGrid()
      updateExportState()
      updatePopGroupBtn()
    },
    redo: () => {
      customPacks.length = 0
      activeCustomPackIndex = -1
      renderCustomPackList()
      renderGrid()
      updateExportState()
      updatePopGroupBtn()
    },
  })
  lastUndo = {
    type: 'custom-clear',
    packs: snapshotPacks,
    activeIndex: snapshotActive,
  }
  customPacks.length = 0
  activeCustomPackIndex = -1
  renderCustomPackList()
  renderGrid()
  updateExportState()
  updatePopGroupBtn()
  showToast('已清空自选分组', 'info', {
    label: '撤销',
    run: () => {
      undoLastAction()
    },
  })
}

export function handlePackItemToggle(item: SmojiItem): void {
  const resolved = itemBySrc.get(item.src)
  const pack = resolved?.pack ?? packs[activePack]
  if (!pack) return
  const announce = (message: string, kind: 'success' | 'info' | 'error') => {
    if (!pop.hidden) showPopFeedback(message, kind)
    else showToast(message, kind)
  }
  if (!selectedPackIds.has(pack.id)) {
    selectedPackIds.add(pack.id)
    renderPackNav()
    announce(`已勾选「${packTitle(pack)}」整包导出`, 'success')
  } else {
    if (excludedItemSrcs.has(item.src)) {
      excludedItemSrcs.delete(item.src)
      announce('已恢复此表情导出', 'success')
    } else {
      excludedItemSrcs.add(item.src)
      announce('已将此表情从导出中剔除', 'info')
    }
  }
  renderGrid()
  updateExportState()
  updatePopGroupBtn()
}

function updatePopGroupBtn(): void {
  if (!selected) {
    popGroupAction.hidden = true
    syncPopShortcutHint()
    return
  }
  popGroupAction.hidden = false
  if (mode === 'custom') {
    const showTarget = customPacks.length > 0
    popTargetWrap.hidden = !showTarget
    if (showTarget) {
      popTargetGroup.replaceChildren()
      customPacks.forEach((pack, index) => {
        const opt = document.createElement('option')
        opt.value = String(index)
        opt.textContent = `${pack.label} (${pack.items.length})`
        popTargetGroup.append(opt)
      })
      if (activeCustomPackIndex < 0 || activeCustomPackIndex >= customPacks.length) {
        activeCustomPackIndex = 0
      }
      popTargetGroup.value = String(activeCustomPackIndex)
    }

    const activeCustom = activeCustomPackIndex >= 0 ? customPacks[activeCustomPackIndex] : null
    if (!activeCustom) {
      popToggleGroupBtn.textContent = '+ 创建自选分组并加入'
      popToggleGroupBtn.classList.remove('is-active', 'is-danger')
      syncPopToggleGroupAria()
      syncPopShortcutHint()
      return
    }
    const pickIndex = activeCustom.items.findIndex((i) => i.src === selected!.src)
    if (pickIndex !== -1) {
      popToggleGroupBtn.textContent = `✓ 已在「${activeCustom.label}」(#${pickIndex + 1}) · 点击移出`
      popToggleGroupBtn.classList.remove('is-danger')
      popToggleGroupBtn.classList.add('is-active')
    } else {
      popToggleGroupBtn.textContent = `+ 加入「${activeCustom.label}」(#${activeCustom.items.length + 1})`
      popToggleGroupBtn.classList.remove('is-active', 'is-danger')
    }
  } else {
    popTargetWrap.hidden = true
    const pack = itemBySrc.get(selected.src)?.pack ?? packs[activePack]
    if (!pack) {
      popGroupAction.hidden = true
      syncPopShortcutHint()
      return
    }
    if (selectedPackIds.has(pack.id)) {
      if (excludedItemSrcs.has(selected.src)) {
        popToggleGroupBtn.textContent = '↺ 恢复此表情 · 重新加入整包导出'
        popToggleGroupBtn.classList.remove('is-danger')
        popToggleGroupBtn.classList.add('is-active')
      } else {
        popToggleGroupBtn.textContent = '✕ 剔除此表情 · 整包导出时排除'
        popToggleGroupBtn.classList.remove('is-active')
        popToggleGroupBtn.classList.add('is-danger')
      }
    } else {
      popToggleGroupBtn.textContent = `+ 勾选「${packTitle(pack)}」整包导出`
      popToggleGroupBtn.classList.remove('is-active', 'is-danger')
    }
  }
  syncPopToggleGroupAria()
  syncPopShortcutHint()
}

function syncPopToggleGroupAria(): void {
  const label = popToggleGroupBtn.textContent?.trim() || '分组操作'
  popToggleGroupBtn.title = label
  popToggleGroupBtn.setAttribute('aria-label', label)
}

function setMenuOpen(open: boolean): void {
  document.body.classList.toggle('menu-open', open)
  menuToggle.setAttribute('aria-expanded', String(open))
  menuToggle.setAttribute('aria-label', open ? '关闭侧边栏菜单' : '打开侧边栏菜单')
  if (open) {
    backdrop.hidden = false
    releaseMenuFocus?.()
    releaseMenuFocus = trapFocus(sidebar, {
      initialFocus: sidebar.querySelector<HTMLElement>('.mode-tab.is-active') ?? sidebar.querySelector<HTMLElement>('.pack.is-on'),
    })
    sidebar.style.transform = ''
  } else {
    releaseMenuFocus?.()
    releaseMenuFocus = null
    sidebar.style.transform = ''
    resolveBackdrop()
  }
  syncOverlayInert()
}

/** Mobile drawer: swipe left to close. */
let menuSwipeX: number | null = null
let menuSwipeY: number | null = null
let menuSwipeActive = false
sidebar.addEventListener(
  'pointerdown',
  (event) => {
    if (!mobileViewportMq.matches || !document.body.classList.contains('menu-open')) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    menuSwipeX = event.clientX
    menuSwipeY = event.clientY
    menuSwipeActive = true
  },
  { passive: true },
)
sidebar.addEventListener(
  'pointermove',
  (event) => {
    if (!menuSwipeActive || menuSwipeX == null || menuSwipeY == null) return
    const dx = event.clientX - menuSwipeX
    const dy = event.clientY - menuSwipeY
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
      menuSwipeActive = false
      sidebar.style.transform = ''
      return
    }
    if (dx >= 0) {
      sidebar.style.transform = ''
      return
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduceMotion) sidebar.style.transform = `translateX(${Math.max(dx, -sidebar.offsetWidth)}px)`
  },
  { passive: true },
)
const endMenuSwipe = (event: PointerEvent) => {
  if (!menuSwipeActive || menuSwipeX == null) {
    menuSwipeX = null
    menuSwipeY = null
    menuSwipeActive = false
    return
  }
  const dx = event.clientX - menuSwipeX
  menuSwipeX = null
  menuSwipeY = null
  menuSwipeActive = false
  sidebar.style.transform = ''
  if (dx < -48 && document.body.classList.contains('menu-open')) {
    setMenuOpen(false)
  }
}
sidebar.addEventListener('pointerup', endMenuSwipe, { passive: true })
sidebar.addEventListener('pointercancel', endMenuSwipe, { passive: true })

const mobileViewportMq = window.matchMedia('(max-width: 720px)')
mobileViewportMq.addEventListener('change', () => {
  if (!mobileViewportMq.matches && document.body.classList.contains('menu-open')) setMenuOpen(false)
  if (mobileViewportMq.matches && sidebar.contains(document.activeElement)) menuToggle.focus()
  syncOverlayInert()
})
syncOverlayInert()

function syncSelection(): void {
  const items = currentItems()
  grid.querySelectorAll<HTMLElement>('.card').forEach((card) => {
    const index = Number(card.dataset.itemIndex)
    const item = items[index]
    card.classList.toggle('is-on', Boolean(selected && item && selected.src === item.src))
  })
}

function renderPackNav(): void {
  packNav.replaceChildren()
  const fragment = document.createDocumentFragment()
  packs.forEach((pack, index) => {
    const title = packTitle(pack)
    const row = document.createElement('div')
    row.className = 'pack-row'
    row.dataset.packIndex = String(index)
    if (index === activePack) row.classList.add('is-on')
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.className = 'pack-check'
    checkbox.dataset.packId = pack.id
    checkbox.checked = selectedPackIds.has(pack.id)
    checkbox.setAttribute('aria-checked', String(checkbox.checked))
    checkbox.setAttribute('aria-label', `选择 ${title}`)
    if (mode === 'custom') {
      checkbox.disabled = true
      checkbox.tabIndex = -1
      checkbox.setAttribute('aria-hidden', 'true')
    } else {
      checkbox.tabIndex = -1
    }

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'pack'
    button.dataset.packIndex = String(index)
    if (index === activePack) button.classList.add('is-on')
    if (index === activePack) button.setAttribute('aria-current', 'true')
    else button.removeAttribute('aria-current')
    const icon = document.createElement('img')
    icon.className = 'pack__icon'
    icon.alt = ''
    icon.loading = 'lazy'
    if (pack.items[0]) loadImage(icon, thumbnailSrc(pack.items[0].src))
    icon.decoding = 'async'
    icon.referrerPolicy = 'no-referrer'
    icon.setAttribute('aria-hidden', 'true')
    icon.addEventListener(
      'error',
      () => {
        icon.classList.add('is-broken')
        icon.removeAttribute('src')
      },
      { once: true },
    )

    const text = document.createElement('span')
    text.className = 'pack__text'
    const name = document.createElement('span')
    name.className = 'pack__name'
    name.textContent = title
    const id = document.createElement('span')
    id.className = 'pack__id'
    id.textContent = pack.id
    text.append(name, id)

    const count = document.createElement('span')
    count.className = 'pack__count'
    count.textContent = String(pack.items.length)

    button.append(icon, text, count)
    row.append(checkbox, button)
    fragment.append(row)
  })

  packNav.append(fragment)
  const packButtons = [...packNav.querySelectorAll<HTMLButtonElement>('button.pack')]
  let focusIdx = packButtons.findIndex((b) => Number(b.dataset.packIndex) === activePack)
  if (focusIdx < 0) focusIdx = 0
  packButtons.forEach((b, i) => {
    b.tabIndex = i === focusIdx ? 0 : -1
  })
}

function renderGrid(): void {
  updateBatchPackActionButton()
  const pack = packs[activePack]
  const items = currentItems()
  if (!items.length) keyboardFocusIndex = -1
  else if (keyboardFocusIndex >= items.length) keyboardFocusIndex = Math.min(keyboardFocusIndex, items.length - 1)
  const activeCustom = activeCustomPackIndex >= 0 ? customPacks[activeCustomPackIndex] : null
  const pickedPositions = new Map(activeCustom?.items.map((item, index) => [item.src, index]))
  const atCap = Boolean(activeCustom && (activeCustom.items.length >= CUSTOM_PACK_ITEM_LIMIT ||
    customPacks.reduce((total, group) => total + group.items.length, 0) >= CUSTOM_TOTAL_ITEM_LIMIT))

  const iconSrc =
    galleryView === 'picked' && activeCustom?.items[0]
      ? activeCustom.items[0].src
      : pack?.items[0]?.src
  galleryPackIcon.classList.remove('is-broken')
  if (iconSrc) {
    galleryPackIcon.hidden = false
    const probe = new Image()
    probe.decoding = 'async'
    probe.onload = () => {
      if (galleryPackIcon.dataset.pendingSrc !== iconSrc) return
      galleryPackIcon.style.backgroundImage = `url("${thumbnailSrc(iconSrc)}")`
      galleryPackIcon.classList.remove('is-broken')
      delete galleryPackIcon.dataset.pendingSrc
    }
    probe.onerror = () => {
      if (galleryPackIcon.dataset.pendingSrc !== iconSrc) return
      galleryPackIcon.style.backgroundImage = ''
      galleryPackIcon.classList.add('is-broken')
      delete galleryPackIcon.dataset.pendingSrc
    }
    galleryPackIcon.dataset.pendingSrc = iconSrc
    probe.src = thumbnailSrc(iconSrc)
  } else {
    galleryPackIcon.style.backgroundImage = ''
    galleryPackIcon.hidden = true
    delete galleryPackIcon.dataset.pendingSrc
  }

  if (galleryView === 'picked') {
    galleryTitle.textContent = activeCustom
      ? `已入组 · 「${activeCustom.label}」 ${items.length} 张`
      : '已入组 · 请先选择自选分组'
  } else if (mode === 'custom') {
    galleryTitle.textContent = pack
      ? `${packTitle(pack)} · ${items.length} 张` +
        (activeCustom ? ` (目标：「${activeCustom.label}」)` : '')
      : '—'
  } else if (pack) {
    const isSelected = selectedPackIds.has(pack.id)
    let packExcluded = 0
    for (const item of pack.items) {
      if (excludedItemSrcs.has(item.src)) packExcluded++
    }
    if (isSelected && packExcluded > 0) {
      galleryTitle.textContent = `${packTitle(pack)} · ${pack.items.length - packExcluded} / ${pack.items.length} 张 (已剔除 ${packExcluded} 张)`
    } else {
      galleryTitle.textContent = `${packTitle(pack)} · ${pack.items.length} 张`
    }
  } else {
    galleryTitle.textContent = '—'
  }

  grid.classList.remove('is-loading-more')

function updateCardActions(card: HTMLElement, item: SmojiItem, index: number): void {
  const itemPack = itemBySrc.get(item.src)?.pack ?? pack
  const restoreFocus = card.contains(document.activeElement)
  card.querySelectorAll(':scope > button').forEach((button) => button.remove())
  card.classList.remove('is-picked', 'is-excluded', 'is-on')
  if (mode === 'custom') {
    if (activeCustom) {
      const pickIndex = pickedPositions.get(item.src) ?? -1
      if (pickIndex !== -1) {
        card.classList.add('is-picked')
        const badge = document.createElement('button')
        badge.type = 'button'
        badge.tabIndex = -1
        badge.className = 'card__badge'
        badge.dataset.badgeItemIndex = String(index)
        badge.title = `从「${activeCustom.label}」移除 (#${pickIndex + 1})`
        badge.setAttribute('aria-label', badge.title)
        badge.textContent = `已加入 ${pickIndex + 1}`
        card.append(badge)
      } else {
        const hoverCheck = document.createElement('button')
        hoverCheck.type = 'button'
        hoverCheck.tabIndex = -1
        hoverCheck.className = 'card__check-hover'
        hoverCheck.dataset.checkItemIndex = String(index)
        hoverCheck.disabled = atCap
        hoverCheck.title = atCap
          ? `「${activeCustom.label}」或总容量已达上限`
          : `加入「${activeCustom.label}」`
        hoverCheck.setAttribute('aria-label', hoverCheck.title)
        hoverCheck.textContent = '加入'
        card.append(hoverCheck)
      }
    } else {
      const hoverCheck = document.createElement('button')
      hoverCheck.type = 'button'
      hoverCheck.tabIndex = -1
      hoverCheck.className = 'card__check-hover'
      hoverCheck.dataset.checkItemIndex = String(index)
      hoverCheck.title = '创建分组并加入'
      hoverCheck.setAttribute('aria-label', hoverCheck.title)
      hoverCheck.textContent = '加入'
      card.append(hoverCheck)
    }
  } else {
    const isPackSelected = itemPack && selectedPackIds.has(itemPack.id)
    const isExcluded = Boolean(isPackSelected && excludedItemSrcs.has(item.src))
    if (isExcluded) {
      card.classList.add('is-excluded')
      const actionBtn = document.createElement('button')
      actionBtn.type = 'button'
      actionBtn.tabIndex = -1
      actionBtn.className = 'card__action-btn card__action-btn--restore'
      actionBtn.dataset.excludeItemIndex = String(index)
      actionBtn.title = '恢复此表情 (重新加入整包导出)'
      actionBtn.setAttribute('aria-label', actionBtn.title)
      actionBtn.textContent = '恢复'
      card.append(actionBtn)
    } else if (isPackSelected) {
      const actionBtn = document.createElement('button')
      actionBtn.type = 'button'
      actionBtn.tabIndex = -1
      actionBtn.className = 'card__action-btn card__action-btn--exclude'
      actionBtn.dataset.excludeItemIndex = String(index)
      actionBtn.title = '剔除此表情 (整包导出时排除)'
      actionBtn.setAttribute('aria-label', actionBtn.title)
      actionBtn.textContent = '剔除'
      card.append(actionBtn)
    }

    if (selected?.src === item.src) card.classList.add('is-on')
  }

  card.draggable = mode === 'custom' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
  if (card.draggable) card.title = '拖到自选分组托盘可加入；点击打开详情'
  else card.removeAttribute('title')
  if (restoreFocus) {
    keyboardFocusIndex = index
    card.focus({ preventScroll: true })
  }
  card.tabIndex = index === keyboardFocusIndex ? 0 : -1
  card.classList.toggle('is-keyboard-focus', index === keyboardFocusIndex)
}

function createCardNode(
  item: SmojiItem,
  index: number,
): HTMLElement {
  const name = fileStem(item)
  const card = document.createElement('div')
  card.className = 'card'
  card.dataset.itemIndex = String(index)
  card.dataset.itemSrc = item.src
  card.tabIndex = index === keyboardFocusIndex ? 0 : -1
  if (index === keyboardFocusIndex) card.classList.add('is-keyboard-focus')
  card.setAttribute('role', 'group')
  card.setAttribute(
    'aria-label',
    `${item.label} (${name})`,
  )

  updateCardActions(card, item, index)

  if (keyboardFocusIndex === index) card.classList.add('is-keyboard-focus')

  const imageBox = document.createElement('div')
  imageBox.className = 'card__image-box'

  const image = document.createElement('img')
  image.alt = item.label
  image.loading = 'lazy'
  imageBox.classList.add('is-loading')
  loadImage(image, thumbnailSrc(item.src), {
    load: () => imageBox.classList.remove('is-loading'),
    error: () => {
      imageBox.classList.remove('is-loading')
      imageBox.classList.add('is-broken')
      image.alt = ''
      image.setAttribute('aria-hidden', 'true')
      imageBox.setAttribute('role', 'img')
      imageBox.setAttribute('aria-label', `图片加载失败：${item.label || name}，打开详情可重试`)
      card.setAttribute('aria-label', `${item.label || name}，图片加载失败，打开详情可重试`)
    },
  })

  imageBox.append(image)
  card.append(imageBox)

  const label = document.createElement('span')
  label.className = 'card__label'
  label.textContent = item.label || name
  card.append(label)

  return card
}

  const existing = [...grid.querySelectorAll<HTMLElement>('.card[data-item-src]')]
  if (items.length && existing.length === items.length &&
      existing.every((card, index) => card.dataset.itemSrc === items[index]?.src)) {
    gridRenderGen++
    existing.forEach((card, index) => updateCardActions(card, items[index]!, index))
    restoreGridKeyboardFocus()
    grid.removeAttribute('aria-busy')
    gridStatus.textContent = gridStatusLabel(items.length)
    return
  }
  grid.replaceChildren()
  const renderGen = ++gridRenderGen
  const CHUNK = GRID_RENDER_CHUNK
  let cardCursor = 0
  const finishPump = (): void => {
    if (renderGen !== gridRenderGen) return
    grid.classList.remove('is-loading-more')
    grid.removeAttribute('aria-busy')
    if (gridStatus) {
      gridStatus.textContent = gridStatusLabel(items.length)
    }
    restoreGridKeyboardFocus()
  }
  const pumpCards = (): void => {
    if (renderGen !== gridRenderGen) return
    if (!items.length) {
      finishPump()
      return
    }
    const frag = document.createDocumentFragment()
    const end = Math.min(cardCursor + CHUNK, items.length)
    for (; cardCursor < end; cardCursor++) {
      frag.append(createCardNode(items[cardCursor]!, cardCursor))
    }
    grid.append(frag)
    if (keyboardFocusIndex >= 0 && keyboardFocusIndex < cardCursor) {
      restoreGridKeyboardFocus()
    }
    if (cardCursor < items.length) {
      grid.classList.add('is-loading-more')
      grid.setAttribute('aria-busy', 'true')
      if (gridStatus) {
        gridStatus.textContent = `正在加载 ${cardCursor}/${items.length} 张…`
      }
      window.setTimeout(pumpCards, 0)
    } else {
      finishPump()
    }
  }

  pumpCards()

  if (!items.length) {
    grid.removeAttribute('aria-busy')
    const empty = document.createElement('div')
    empty.className = 'muted grid__empty'
    empty.setAttribute('role', 'status')
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      empty.classList.add('grid__empty--enter')
    }
    const emptyIcon = document.createElement('span')
    emptyIcon.className = 'grid__empty-icon'
    emptyIcon.textContent = '○'
    const emptyMsg = document.createElement('span')
    if (galleryView === 'picked') {
      emptyMsg.textContent =
        activeCustomPackIndex >= 0
          ? '当前分组还没有表情，请切换到源分类浏览并加入'
          : '请先新建或选择一个自选分组'
      empty.append(emptyIcon, emptyMsg)
      if (activeCustomPackIndex < 0) {
        const create = document.createElement('button')
        create.type = 'button'
        create.className = 'btn-ghost btn-sm grid__empty-action'
        create.textContent = '去新建分组'
        create.addEventListener('click', () => {
          if (mobileViewportMq.matches) setMenuOpen(true)
          customNameInput.focus()
          customNameInput.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        })
        empty.append(create)
      } else {
        const browse = document.createElement('button')
        browse.type = 'button'
        browse.className = 'btn-ghost btn-sm grid__empty-action'
        browse.textContent = '浏览源分类添加'
        browse.addEventListener('click', () => {
          setGalleryView('active')
          if (mobileViewportMq.matches) setMenuOpen(true)
          packNav.focus?.()
          packNav.querySelector<HTMLButtonElement>('button.pack[tabindex="0"]')?.focus()
        })
        empty.append(browse)
      }
      const tip = document.createElement('button')
      tip.type = 'button'
      tip.className = 'btn-ghost btn-sm grid__empty-action'
      tip.textContent = '返回浏览分类'
      tip.addEventListener('click', () => setGalleryView('active'))
      empty.append(tip)
      grid.append(empty)
      if (gridStatus) gridStatus.textContent = emptyMsg.textContent
      return
    } else {
      emptyMsg.textContent = packs.length ? '此分类暂无表情' : '正在加载表情库…'
    }
    empty.append(emptyIcon, emptyMsg)
    grid.append(empty)
    if (gridStatus) gridStatus.textContent = emptyMsg.textContent || '暂无表情'
    return
  }

  if (gridStatus) {
    gridStatus.textContent = gridStatusLabel(items.length)
  }
}

function gridStatusLabel(count: number): string {
  return `当前展示 ${count} 张表情`
}

function updateActiveCopyField(): void {
  const panel = document.querySelector<HTMLElement>('#copy-active-panel')
  const formatKeys: Record<string, string> = { md: '1', url: '2', html: '3', bbcode: '4' }
  copyTabs.forEach((tab) => {
    const fmt = tab.dataset.copyFormat || 'md'
    const on = fmt === activeCopyFormat
    tab.classList.toggle('is-active', on)
    tab.setAttribute('aria-selected', String(on))
    tab.tabIndex = on ? 0 : -1
    const key = formatKeys[fmt]
    if (key) tab.setAttribute('aria-keyshortcuts', key)
    if (tab.title) tab.setAttribute('aria-label', tab.title)
    if (on && panel && tab.id) panel.setAttribute('aria-labelledby', tab.id)
  })
  const map = { url: copyUrl, html: copyHtml, md: copyMd, bbcode: copyBbcode } as const
  const field = map[activeCopyFormat]
  if (field && copyActiveInput) {
    copyActiveInput.value = field.value
  }
  syncCopyActionAria()
}

const COPY_FORMAT_LABELS: Record<string, string> = {
  md: 'Markdown',
  url: 'URL',
  html: 'HTML',
  bbcode: 'BBCode',
}

function syncCopyActionAria(): void {
  const fmtLabel = COPY_FORMAT_LABELS[activeCopyFormat] ?? activeCopyFormat
  const copyLabel = `复制 ${fmtLabel} 格式到剪贴板`
  btnCopyActive.title = copyLabel
  btnCopyActive.setAttribute('aria-label', copyLabel)

  const codeFmtLabel =
    codeTabs.find((t) => t.dataset.codeFormat === currentCodeFormat)?.textContent?.trim() ||
    currentCodeFormat
  btnCopyCode.setAttribute('aria-label', `复制完整 ${codeFmtLabel} 代码`)
  btnDownloadCurrentCode.setAttribute('aria-label', `下载 ${codeFmtLabel} 文件`)
}

function showPopImage(src: string): void {
  if (!selected) return
  const item = selected
  const preview = imagePreview(item.src)
  const original = src === item.src
  popStage.classList.remove('is-broken')
  popStage.classList.add('is-loading')
  popRetry.hidden = true
  popLoading.hidden = false
  popLoading.textContent = original && preview?.animated ? '正在加载动图…' : '正在加载图片…'
  pop.setAttribute('aria-busy', 'true')
  popImage.alt = item.label
  popImage.removeAttribute('aria-hidden')
  pop.removeAttribute('aria-describedby')
  loadImage(popImage, src, {
    load: () => {
      popStage.classList.remove('is-loading')
      popLoading.hidden = true
      pop.removeAttribute('aria-busy')
      syncPopMeta()
    },
    error: () => {
      popStage.classList.remove('is-loading')
      popStage.classList.add('is-broken')
      popLoading.hidden = true
      pop.removeAttribute('aria-busy')
      popImage.alt = ''
      popImage.setAttribute('aria-hidden', 'true')
      popRetry.hidden = false
      popMeta.textContent = '图片加载失败，可重试；复制链接仍可使用'
      pop.setAttribute('aria-describedby', 'pop-meta')
    },
  })
}

popRetry.addEventListener('click', () => {
  if (selected) showPopImage(popImage.getAttribute('src') || thumbnailSrc(selected.src))
})
document.addEventListener('visibilitychange', () => {
  if (!selected || !imagePreview(selected.src)) return
  showPopImage(document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? thumbnailSrc(selected.src) : selected.src)
})

function openPop(item: SmojiItem, pack: SmojiPack, opts: { retainFocus?: boolean } = {}): void {
  selected = item
  const name = fileStem(item)
  const kind = extOf(item.src).toUpperCase() || 'IMAGE'
  const wasOpen = !pop.hidden
  popImage.loading = 'eager'
  showPopImage(imagePreview(item.src)?.animated && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? thumbnailSrc(item.src) : item.src)

  popName.textContent = item.label || name
  popPackBadge.textContent = packTitle(pack)
  popFormatBadge.textContent = kind
  syncPopMeta()

  copyUrl.value = item.src
  copyHtml.value = `<img src="${item.src}" alt="${(item.label || name).replace(/"/g, '&quot;')}">`
  copyMd.value = smojiMarker(item)
  copyBbcode.value = `[img]${item.src}[/img]`
  copyFeedback.hidden = true

  rememberRecent(item, pack)
  updateActiveCopyField()
  updatePopGroupBtn()
  setMenuOpen(false)
  syncSelection()

  // Clean CSS Grid centered modal with zero inline transform layout-thrashing
  pop.hidden = false
  syncPopNavButtons()
  backdrop.hidden = false
  if (!opts.retainFocus || !wasOpen || !releasePopFocus) {
    releasePopFocus?.()
    releasePopFocus = trapFocus(pop, {
      initialFocus: btnCopyActive ?? popCloseBtn,
    })
  }
  syncOverlayInert()
}

function closePop(): void {
  if (pop.hidden) return
  selected = null
  pop.hidden = true
  popImage.removeAttribute('src')
  popImage.onload = null
  popImage.onerror = null
  popStage.classList.remove('is-loading', 'is-broken')
  pop.removeAttribute('aria-busy')
  syncPopNavButtons()
  releasePopFocus?.()
  releasePopFocus = null
  resolveBackdrop()
  syncSelection()
  syncOverlayInert()
  if (keyboardFocusIndex >= 0) restoreGridKeyboardFocus({ force: true })
}

function syncPopNavButtons(): void {
  const items = currentItems()
  const idx = selected ? items.findIndex((i) => i.src === selected!.src) : -1
  const total = items.length
  if (pop.hidden || total <= 1 || idx < 0) {
    popPrevBtn.disabled = true
    popNextBtn.disabled = true
    popPrevBtn.setAttribute('aria-disabled', 'true')
    popNextBtn.setAttribute('aria-disabled', 'true')
    popPrevBtn.title = '上一个表情'
    popNextBtn.title = '下一个表情'
    popPrevBtn.setAttribute('aria-label', '上一个表情')
    popNextBtn.setAttribute('aria-label', '下一个表情')
    return
  }
  popPrevBtn.disabled = idx <= 0
  popNextBtn.disabled = idx >= total - 1
  popPrevBtn.setAttribute('aria-disabled', String(idx <= 0))
  popNextBtn.setAttribute('aria-disabled', String(idx >= total - 1))
  const prevLabel = `上一个表情 (${idx}/${total})`
  const nextLabel = `下一个表情 (${idx + 2}/${total})`
  popPrevBtn.title = `${prevLabel} (快捷键 ←)`
  popNextBtn.title = `${nextLabel} (快捷键 →)`
  popPrevBtn.setAttribute('aria-label', prevLabel)
  popNextBtn.setAttribute('aria-label', nextLabel)
}

function syncPopMeta(): void {
  if (!selected) return
  const name = fileStem(selected)
  const kind = extOf(selected.src).toUpperCase() || 'IMAGE'
  const items = currentItems()
  const idx = items.findIndex((i) => i.src === selected!.src)
  if (popStage.classList.contains('is-broken')) {
    popMeta.textContent = `${name} · ${kind} · 图片加载失败`
    return
  }
  popMeta.textContent =
    idx >= 0 ? `${idx + 1} / ${items.length} · ${name} · ${kind}` : `${name} · ${kind}`
}

export function navigatePop(direction: -1 | 1): void {
  const items = currentItems()
  if (!items.length || !selected) return
  const currentIdx = items.findIndex((i) => i.src === selected!.src)
  if (currentIdx === -1) return
  const nextIdx = currentIdx + direction
  if (nextIdx < 0 || nextIdx >= items.length) {
    popMeta.textContent = nextIdx < 0 ? '已在当前列表第一张' : '已在当前列表最后一张'
    popMeta.classList.add('pop__meta--edge')
    window.setTimeout(() => {
      popMeta.classList.remove('pop__meta--edge')
      syncPopMeta()
    }, 900)
    syncPopNavButtons()
    return
  }
  const nextItem = items[nextIdx]
  if (!nextItem) return
  keyboardFocusIndex = nextIdx
  const resolved = itemBySrc.get(nextItem.src)
  const pack = resolved?.pack ?? packs[activePack]
  if (nextItem && pack) {
    if (resolved && resolved.packIndex !== activePack && galleryView !== 'picked') {
      activePack = resolved.packIndex
      renderPackNav()
    }
    openPop(nextItem, pack, { retainFocus: true })
  }
}

function activatePack(index: number, opts?: { closePop?: boolean }): void {
  setMenuOpen(false)
  if (!packs[index] || (index === activePack && galleryView === 'active')) return
  galleryView = 'active'
  syncGalleryViewChips()
  activePack = index
  keyboardFocusIndex = -1
  if (opts?.closePop !== false) closePop()
    packNav.querySelectorAll<HTMLElement>('.pack-row').forEach((row) => {
      const rowIndex = Number(row.dataset.packIndex)
      const isActive = rowIndex === activePack
      row.classList.toggle('is-on', isActive)
      row.classList.remove('pack-row--pinned')
      const btn = row.querySelector<HTMLButtonElement>('.pack')
      btn?.classList.toggle('is-on', isActive)
      if (btn) {
        if (isActive) btn.setAttribute('aria-current', 'true')
        else btn.removeAttribute('aria-current')
      }
    })
    const packButtons = [...packNav.querySelectorAll<HTMLButtonElement>('button.pack')]
    packButtons.forEach((b) => {
      b.tabIndex = Number(b.dataset.packIndex) === activePack ? 0 : -1
    })
  grid.scrollTop = 0
  packNav.querySelector<HTMLElement>('.pack-row.is-on')?.scrollIntoView({ block: 'nearest' })
  renderGrid()
  updateExportState()
}

function restoreGridKeyboardFocus(opts: { force?: boolean } = {}): void {
  if (keyboardFocusIndex < 0) return
  const card = grid.querySelector<HTMLElement>(`[data-item-index="${keyboardFocusIndex}"]`)
  if (!card) return
  grid.querySelectorAll<HTMLElement>('.card.is-keyboard-focus').forEach((el) => {
    el.classList.remove('is-keyboard-focus')
    el.tabIndex = -1
  })
  card.classList.add('is-keyboard-focus')
  card.tabIndex = 0
  if (
    opts.force ||
    grid.contains(document.activeElement) ||
    document.activeElement === document.body
  ) {
    card.focus({ preventScroll: true })
    card.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
}

function gridColumnCount(): number {
  const styles = getComputedStyle(grid)
  const template = styles.gridTemplateColumns
  if (!template || template === 'none') return 1
  return template.split(' ').filter(Boolean).length || 1
}

function moveKeyboardFocus(delta: number): void {
  const items = currentItems()
  if (!items.length) return
  const prev = keyboardFocusIndex
  const base = keyboardFocusIndex < 0 ? 0 : keyboardFocusIndex
  let next = Math.max(0, Math.min(items.length - 1, base + delta))
  if (next === keyboardFocusIndex && keyboardFocusIndex >= 0) {
    if (gridStatus) {
      gridStatus.textContent = next === 0 ? '已在列表首项' : '已在列表末项'
    }
    return
  }
  const busy = grid.getAttribute('aria-busy') === 'true'
  if (busy) {
    const rendered = grid.querySelectorAll<HTMLElement>('.card[data-item-index]')
    const maxRendered = rendered.length - 1
    if (maxRendered < 0) {
      if (gridStatus) gridStatus.textContent = '正在加载表情…'
      return
    }
    if (next > maxRendered) {
      next = maxRendered
      if (gridStatus) gridStatus.textContent = '正在加载更多表情…'
      if (next === keyboardFocusIndex) return
    }
  }
  keyboardFocusIndex = next
  if (prev >= 0) {
    const prevCard = grid.querySelector<HTMLElement>(`[data-item-index="${prev}"]`)
    prevCard?.classList.remove('is-keyboard-focus')
    if (prevCard) prevCard.tabIndex = -1
  }
  const card = grid.querySelector<HTMLElement>(`[data-item-index="${keyboardFocusIndex}"]`)
  if (card) {
    card.classList.add('is-keyboard-focus')
    card.tabIndex = 0
    card.focus({ preventScroll: true })
    card.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
}

function openKeyboardFocused(): void {
  const items = currentItems()
  const item = items[keyboardFocusIndex]
  if (!item) return
  const resolved = itemBySrc.get(item.src)
  const pack = resolved?.pack ?? packs[activePack]
  if (pack) openPop(item, pack)
}

function exportCustomGroupsFile(): void {
  if (!customPacks.length) {
    showToast('暂无自选分组可导出', 'error')
    return
  }
  syncWorkbenchExtensionPrefs()
  const bundle = buildCustomGroupBundle(customPacks, customGroupExtensions)
  const json = JSON.stringify(bundle, null, 2) + '\n'
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `smoji-custom-groups-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`
  link.click()
  URL.revokeObjectURL(url)
  showToast('已导出自选分组文件', 'success')
}

function importCustomGroupsFromFile(file: File): void {
  const reader = new FileReader()
  reader.onload = () => {
    void (async () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        const entries = parseCustomGroupBundle(parsed)
        const incomingExtensions = parseCustomGroupExtensions(parsed)
        if (!entries.length) throw new Error('文件中没有可导入的有效分组')

        const incomingItems = entries.reduce((n, e) => n + (e.itemSrcs?.length ?? 0), 0)
        const roomPacks = Math.max(0, CUSTOM_PACK_LIMIT - customPacks.length)
        const currentTotal = customPacks.reduce((acc, p) => acc + p.items.length, 0)
        const roomItems = Math.max(0, CUSTOM_TOTAL_ITEM_LIMIT - currentTotal)
        const preview = [
          `文件含 ${entries.length} 组 / 约 ${incomingItems} 项`,
          `当前已用 ${customPacks.length}/${CUSTOM_PACK_LIMIT} 组 · ${currentTotal}/${CUSTOM_TOTAL_ITEM_LIMIT} 项`,
          `本次最多还可并入 ${roomPacks} 组、约 ${roomItems} 项（超出将自动跳过）`,
        ].join('\n')

        if (customPacks.length > 0 || entries.length > roomPacks || incomingItems > roomItems) {
          const ok = await showConfirm(
            customPacks.length > 0
              ? `${preview}\n\n将与现有自选分组合并（同名 ID 会自动改名）。继续？`
              : `${preview}\n\n确认导入？`,
            { title: '导入自选分组', okLabel: '导入' },
          )
          if (!ok) return
        }

        const snapshot = customPacks.map((p) => ({
          id: p.id,
          label: p.label,
          items: p.items.slice(),
          isExpanded: p.isExpanded,
        }))
        const snapshotActive = activeCustomPackIndex

        let imported = 0
        let skippedStale = 0
        let skippedCap = 0
        let totalItems = customPacks.reduce((acc, p) => acc + p.items.length, 0)

        for (const entry of entries) {
          if (customPacks.length >= CUSTOM_PACK_LIMIT) {
            skippedCap += 1
            continue
          }
          if (!entry.id || !entry.label || !Array.isArray(entry.itemSrcs)) continue
          let id = entry.id
          let n = 1
          while (customPacks.some((p) => p.id === id)) {
            id = `${entry.id}_${n++}`
          }
          const items: SmojiItem[] = []
          const seen = new Set<string>()
          for (const src of entry.itemSrcs) {
            const item = resolveItemBySrc(src)
            if (!item) {
              skippedStale++
              continue
            }
            if (seen.has(item.src)) continue
            if (items.length >= CUSTOM_PACK_ITEM_LIMIT || totalItems + items.length >= CUSTOM_TOTAL_ITEM_LIMIT) {
              skippedCap++
              continue
            }
            items.push(item)
            seen.add(item.src)
          }
          if (!items.length) continue
          customPacks.push({ id, label: entry.label, items })
          totalItems += items.length
          imported++
        }

        if (!imported) throw new Error('文件中没有可导入的有效分组')

        if (incomingExtensions) {
          const unknownExt = listUnknownPackGroupExtensionIds(incomingExtensions)
          customGroupExtensions = mergePackGroupExtensions(customGroupExtensions, incomingExtensions)
          applyLoadedExtensions(false)
          if (unknownExt.length) {
            const sample = unknownExt.slice(0, 2).join('、')
            const more = unknownExt.length > 2 ? ` 等` : ''
            showToast(`已保留 ${unknownExt.length} 个未识别扩展：${sample}${more}`, 'info')
          }
        }

        lastUndo = {
          type: 'custom-clear',
          packs: snapshot,
          activeIndex: snapshotActive,
        }

        activeCustomPackIndex = customPacks.length - 1
        if (mode !== 'custom') setMode('custom', { silent: true })
        else {
          renderCustomPackList()
          renderGrid()
          updateExportState()
        }
        if (mobileViewportMq.matches) setMenuOpen(true)
        const parts = [`已导入 ${imported} 个分组`]
        if (skippedStale) parts.push(`跳过 ${skippedStale} 失效项`)
        if (skippedCap) parts.push(`${skippedCap} 项因上限未导入`)
        showToast(parts.join(' · '), 'success', {
          label: '撤销',
          run: () => {
            undoLastAction()
          },
        })
      } catch (err) {
        showToast(err instanceof Error ? err.message : '导入失败', 'error')
      }
    })()
  }
  reader.readAsText(file)
}

function copyText(
  text: string,
  options: {
    onSuccess?: () => void
    selectFallback?: () => void
  } = {},
): void {
  void navigator.clipboard
    .writeText(text)
    .then(() => {
      options.onSuccess?.()
    })
    .catch(() => {
      options.selectFallback?.()
      if (!options.selectFallback && pop.hidden) {
        showToast(`请按 ${modKeyLabel}+C 手动复制`, 'info')
      } else if (!options.selectFallback) {
        showPopFeedback(`请按 ${modKeyLabel}+C 手动复制`, 'info')
      }
    })
}

function copyValue(kind: string, triggerBtn?: HTMLButtonElement): void {
  const map = { url: copyUrl, html: copyHtml, md: copyMd, bbcode: copyBbcode } as const
  const field = map[kind as keyof typeof map]
  if (!field) return

  copyText(field.value, {
    onSuccess: () => {
      copyFeedback.hidden = false
      copyFeedback.textContent = '已成功复制到剪贴板'
      if (triggerBtn) {
        const orig = triggerBtn.textContent
        triggerBtn.classList.add('is-copied')
        triggerBtn.textContent = '已复制'
        triggerBtn.setAttribute('aria-label', '已复制到剪贴板')
        setTimeout(() => {
          triggerBtn.classList.remove('is-copied')
          triggerBtn.textContent = orig
          syncCopyActionAria()
        }, 1600)
      }
      // Inline feedback already covers success — skip stacking a toast.
    },
    selectFallback: () => {
      field.select()
      copyFeedback.hidden = false
      copyFeedback.textContent = `请按 ${modKeyLabel}+C 手动复制`
      if (pop.hidden) showToast(`请按 ${modKeyLabel}+C 手动复制`, 'info')
    },
  })
}

// Export Trigger Function
export function triggerExport(format: ExportTargetFormat): void {
  try {
    const packsToExport = packsForWorkbenchExport()

    if (!packsToExport.length) {
      throw new Error('未选择任何有效表情')
    }

    downloadFormattedExport(format, packsToExport, manifestUrl)
    lastExportError = null
    showToast(`已成功导出 ${format.toUpperCase()} 表情清单！`, 'success')
  } catch (error) {
    const msg = error instanceof Error ? error.message : '导出失败'
    lastExportError = msg
    galleryExportError.hidden = false
    galleryExportError.textContent = msg
    galleryExportError.setAttribute('role', 'alert')
    galleryExportError.classList.remove('gallery__export-error--warn')
    showToast(msg, 'error')
  } finally {
    updateExportState()
  }
}

// Code Preview Modal Helpers
export function packsForPreviewScope(): Array<{ id: string; label: string; items: readonly SmojiItem[] }> {
  if (previewScope === 'active') {
    if (mode === 'custom') {
      const activeCustom = activeCustomPackIndex >= 0 ? customPacks[activeCustomPackIndex] : null
      return activeCustom?.items.length
        ? [{ id: activeCustom.id, label: activeCustom.label, items: activeCustom.items }]
        : []
    }
    const currentPack = packs[activePack]
    if (!currentPack) return []
    const items = currentPack.items.filter((item) => !excludedItemSrcs.has(item.src))
    return items.length ? [{ id: currentPack.id, label: currentPack.label, items }] : []
  }
  if (previewScope === 'all') {
    if (mode === 'custom') {
      return customPacks.filter((p) => p.items.length > 0)
    }
    return packs.map((pack) => ({
      id: pack.id,
      label: pack.label,
      items: pack.items,
    }))
  }
  // selected
  if (mode === 'custom') {
    return customPacks.filter((p) => p.items.length > 0)
  }
  return packs
    .filter((pack) => selectedPackIds.has(pack.id))
    .map((pack) => ({
      id: pack.id,
      label: pack.label,
      items: pack.items.filter((item) => !excludedItemSrcs.has(item.src)),
    }))
    .filter((pack) => pack.items.length > 0)
}

function syncPreviewScopeChipLabels(): void {
  previewScopeChips.forEach((chip) => {
    const scope = chip.dataset.scope
    if (scope === 'active') {
      chip.textContent = mode === 'custom' ? '当前自选分组' : '当前分类'
      chip.title = mode === 'custom' ? '仅预览当前自选分组' : '仅预览当前分类'
    } else if (scope === 'selected') {
      chip.textContent = mode === 'custom' ? '全部自选分组' : '已勾选项目'
      chip.title = mode === 'custom' ? '预览全部自选分组' : '预览已勾选的表情包'
    } else if (scope === 'all') {
      chip.title = '预览全部表情'
    }
    if (chip.title) chip.setAttribute('aria-label', chip.title)
  })
  if (scopeChipAll) {
    scopeChipAll.hidden = mode === 'custom'
    if (mode === 'custom' && previewScope === 'all') {
      setPreviewScope('selected')
    }
  }
}

export function updateCodePreview(format: ExportTargetFormat): void {
  currentCodeFormat = format
  if (codeMetaCopyTimer) {
    clearTimeout(codeMetaCopyTimer)
    codeMetaCopyTimer = null
  }
  if (codeModalBody) codeModalBody.scrollTop = 0
  codeTabs.forEach((tab) => {
    const on = tab.dataset.codeFormat === format
    tab.classList.toggle('is-active', on)
    tab.setAttribute('aria-selected', String(on))
    tab.tabIndex = on ? 0 : -1
    if (on) {
      tab.scrollIntoView({ inline: 'nearest', block: 'nearest' })
      if (tab.id) codeModalBody.setAttribute('aria-labelledby', tab.id)
    }
  })
  syncCopyActionAria()

  const packsToExport = packsForPreviewScope()

  if (!packsToExport.length) {
    const emptyMsg =
      mode === 'custom'
        ? '当前范围暂无自选分组数据。请先加入表情，或切换预览范围为「全部自选分组」。'
        : '当前范围暂无选中的表情数据。请在左侧勾选表情包，或切换预览范围。'
    codePreviewContent.textContent = `// ${emptyMsg}`
    codePreviewEmpty.hidden = false
    codePreviewEmptyMsg.textContent = emptyMsg
    codePreviewEmpty.setAttribute('aria-live', 'polite')
    btnPreviewCtaPrimary.textContent = mode === 'custom' ? '进入自选分组' : '勾选当前分类'
    btnPreviewCtaScope.textContent =
      mode === 'custom' ? '切换全部自选分组' : '切换全部表情'
    btnPreviewCtaPrimary.setAttribute('aria-label', btnPreviewCtaPrimary.textContent.trim())
    btnPreviewCtaScope.setAttribute('aria-label', btnPreviewCtaScope.textContent.trim())
    btnCopyCode.disabled = true
    btnDownloadCurrentCode.disabled = true
    btnCopyCode.setAttribute('aria-describedby', 'code-preview-empty-msg')
    btnDownloadCurrentCode.setAttribute('aria-describedby', 'code-preview-empty-msg')
    codeModalStats.textContent = '0 个表情包 · 0 个表情'
    codeModalMeta.textContent = '无可用数据'
    return
  }

  codePreviewEmpty.hidden = true
  codePreviewEmpty.removeAttribute('aria-live')
  btnCopyCode.removeAttribute('aria-describedby')
  btnDownloadCurrentCode.removeAttribute('aria-describedby')

  try {
    const { content, filename } = generateFormattedExport(format, packsToExport, manifestUrl)
    codePreviewContent.textContent = content
    const totalItems = packsToExport.reduce((acc, p) => acc + p.items.length, 0)
    const byteSize = new TextEncoder().encode(content).length
    const kb = (byteSize / 1024).toFixed(1)
    const manifestBytes = estimateExportBytes(packsToExport)
    const overBudget = manifestBytes > SMOJI_MANIFEST_MAX_BYTES
    const nearBudget = manifestBytes > SMOJI_MANIFEST_MAX_BYTES * MANIFEST_NEAR_BUDGET_RATIO
    codeModalStats.textContent = `${packsToExport.length} 个表情包 · ${totalItems} 个表情 · 约 ${kb} KB`
    if (overBudget) {
      const mkb = (manifestBytes / 1024).toFixed(1)
      codeModalMeta.textContent = `清单约 ${mkb} KB，超过 ${manifestLimitLabel()} 上限，无法复制/下载`
      btnCopyCode.disabled = true
      btnDownloadCurrentCode.disabled = true
      btnCopyCode.setAttribute('aria-describedby', 'code-modal-meta')
      btnDownloadCurrentCode.setAttribute('aria-describedby', 'code-modal-meta')
    } else {
      btnCopyCode.disabled = false
      btnDownloadCurrentCode.disabled = false
      codeModalMeta.textContent = nearBudget
        ? `${filename} • 接近上限（${Math.round((manifestBytes / SMOJI_MANIFEST_MAX_BYTES) * 100)}%）`
        : `${filename} • 校验通过`
    }
  } catch (err) {
    codePreviewContent.textContent = `// 数据生成错误: ${err instanceof Error ? err.message : String(err)}`
    codeModalMeta.textContent = '格式转换异常'
    btnCopyCode.disabled = true
    btnDownloadCurrentCode.disabled = true
    btnCopyCode.setAttribute('aria-describedby', 'code-modal-meta')
    btnDownloadCurrentCode.setAttribute('aria-describedby', 'code-modal-meta')
  }
}

function openCodeModal(): void {
  if (!pop.hidden) closePop()
  if (!guideModal.hidden) closeGuideModal()
  if (!confirmModal.hidden) closeConfirmModal(false)
  const trigger = document.activeElement
  codeModalTrigger = trigger instanceof HTMLElement ? trigger : null
  codeModal.hidden = false
  backdrop.hidden = false
  syncPreviewScopeChipLabels()
  updateCodePreview(currentCodeFormat)
  const activeTab =
    codeModalTabs.querySelector<HTMLButtonElement>('.code-tab.is-active') ??
    codeModalTabs.querySelector<HTMLButtonElement>('.code-tab')
  releaseCodeFocus?.()
  releaseCodeFocus = trapFocus(codeModal.querySelector('.code-modal__dialog') ?? codeModal, {
    initialFocus: activeTab ?? codeModalClose,
  })
  syncOverlayInert()
  activeTab?.focus()
}

function closeCodeModal(): void {
  codeModal.hidden = true
  releaseCodeFocus?.()
  releaseCodeFocus = null
  resolveBackdrop()
  syncOverlayInert()
  const trigger = codeModalTrigger
  codeModalTrigger = null
  if (trigger?.isConnected) trigger.focus({ preventScroll: true })
}

// Guide Modal Helpers
function openGuideModal(): void {
  const trigger = document.activeElement
  guideModalTrigger = trigger instanceof HTMLElement ? trigger : null
  guideModal.hidden = false
  backdrop.hidden = false
  const guideContent = guideModal.querySelector<HTMLElement>('.guide-content')
  if (guideContent) guideContent.scrollTop = 0
  releaseGuideFocus?.()
  releaseGuideFocus = trapFocus(guideModal.querySelector('.code-modal__dialog') ?? guideModal, {
    initialFocus: guideModalConfirm,
  })
  syncOverlayInert()
  updateExportState()
  guideModalConfirm.focus()
}

function closeGuideModal(): void {
  guideModal.hidden = true
  releaseGuideFocus?.()
  releaseGuideFocus = null
  resolveBackdrop()
  syncOverlayInert()
  updateExportState()
  const trigger = guideModalTrigger
  guideModalTrigger = null
  if (trigger?.isConnected) trigger.focus({ preventScroll: true })
}

// Event Listeners
document.querySelector<HTMLButtonElement>('#sidebar-close')!.addEventListener('click', () => setMenuOpen(false))
menuToggle.addEventListener('click', () => {
  setMenuOpen(!document.body.classList.contains('menu-open'))
})

themeToggle.addEventListener('click', cycleTheme)

function syncDensityAriaLabel(): void {
  densityToggle.setAttribute(
    'aria-label',
    `视图密度：${isComfortableDensity ? '舒适' : '紧凑'}，按 ${modKeyLabel}+D 切换`,
  )
  densityToggle.setAttribute('aria-pressed', String(isComfortableDensity))
}

densityToggle.addEventListener('click', () => {
  isComfortableDensity = !isComfortableDensity
  document.body.classList.toggle('density-comfortable', isComfortableDensity)
  densityLabel.textContent = isComfortableDensity ? '舒适' : '紧凑'
  syncDensityAriaLabel()
  saveDensity(isComfortableDensity)
  showToast(`已切换为${isComfortableDensity ? '舒适' : '紧凑'}网格视图`, 'info')
})

galleryViewActive.addEventListener('click', () => setGalleryView('active'))
galleryViewPicked.addEventListener('click', () => setGalleryView('picked'))

galleryViewChips.forEach((chip) => {
  chip.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const visible = galleryViewChips.filter((c) => !c.hidden)
    const idx = visible.indexOf(chip)
    if (idx < 0) return
    let next = idx
    if (event.key === 'ArrowLeft') next = (idx + visible.length - 1) % visible.length
    if (event.key === 'ArrowRight') next = (idx + 1) % visible.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = visible.length - 1
    const target = visible[next]!
    const scope = (target.dataset.galleryView as typeof galleryView) || 'active'
    setGalleryView(scope)
    target.focus()
  })
})

btnCtaSelectCurrent.addEventListener('click', () => {
  if (mode === 'custom') {
    if (mobileViewportMq.matches) setMenuOpen(true)
    customNameInput.focus()
    customNameInput.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    showToast('输入分组名称后点击新建', 'info')
    return
  }
  const pack = packs[activePack]
  if (!pack) return
  selectedPackIds.add(pack.id)
  renderPackNav()
  renderGrid()
  updateExportState()
  showToast(`已勾选「${packTitle(pack)}」`, 'success')
})

btnCtaCustom.addEventListener('click', () => {
  setMode('custom')
  if (mobileViewportMq.matches) setMenuOpen(true)
  customNameInput.focus()
  customNameInput.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
})

selectionDockPreview.addEventListener('click', () => {
  setPreviewScope('selected')
  openCodeModal()
})

selectionDockFormat.addEventListener('change', () => {
  const format = isDockExportFormat(selectionDockFormat.value) ? selectionDockFormat.value : 'smoji'
  selectionDockFormat.value = format
  saveExportFormat(format)
  syncWorkbenchExtensionPrefs()
  persistWorkbenchState()
  updateExportState()
})

selectionDockExport.addEventListener('click', () => {
  const format = (selectionDockFormat.value as ExportTargetFormat) || 'smoji'
  triggerExport(format)
})

btnExportGroups.addEventListener('click', exportCustomGroupsFile)
btnImportGroups.addEventListener('click', () => importGroupsFile.click())
btnClearGroups.addEventListener('click', clearAllCustomGroups)
bundleNotesInput.addEventListener('change', () => {
  workbenchBundleNotes = bundleNotesInput.value.trim().slice(0, 240)
  bundleNotesInput.value = workbenchBundleNotes
  syncWorkbenchExtensionPrefs()
  updateSidebarFoot()
  persistWorkbenchState()
})
let bundleNotesDebounce: number | null = null
bundleNotesInput.addEventListener('input', () => {
  workbenchBundleNotes = bundleNotesInput.value.slice(0, 240)
  if (bundleNotesDebounce !== null) window.clearTimeout(bundleNotesDebounce)
  bundleNotesDebounce = window.setTimeout(() => {
    workbenchBundleNotes = bundleNotesInput.value.trim().slice(0, 240)
    syncWorkbenchExtensionPrefs()
    updateSidebarFoot()
    persistWorkbenchState()
    bundleNotesDebounce = null
  }, 320)
})
importGroupsFile.addEventListener('change', () => {
  const file = importGroupsFile.files?.[0]
  if (file) importCustomGroupsFromFile(file)
  importGroupsFile.value = ''
})

btnClearRecent.addEventListener('click', () => {
  if (!recentEntries.length) {
    showToast('最近使用已为空', 'info')
    return
  }
  void (async () => {
    const ok = await showConfirm(`确定清空 ${recentEntries.length} 条最近使用记录？`, {
      title: '清空最近使用',
      okLabel: '清空',
      danger: true,
    })
    if (!ok) return
    recentEntries = []
    localStorage.removeItem('smoji-workbench:recent-srcs')
    renderRecentStrip()
    showToast('已清空最近使用', 'info')
  })()
})

function openRecentFromSrc(src: string): void {
  const resolved = itemBySrc.get(src)
  if (!resolved) return
  if (resolved.packIndex !== activePack) activatePack(resolved.packIndex, { closePop: false })
  keyboardFocusIndex = currentItems().findIndex((i) => i.src === resolved.item.src)
  openPop(resolved.item, resolved.pack)
}

recentStripList.addEventListener('click', (event) => {
  const btn = (event.target as Element).closest<HTMLButtonElement>('[data-recent-src]')
  if (!btn?.dataset.recentSrc) return
  openRecentFromSrc(btn.dataset.recentSrc)
})

recentStripList.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-recent-src]')
    if (!btn?.dataset.recentSrc) return
    event.preventDefault()
    openRecentFromSrc(btn.dataset.recentSrc)
    return
  }
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') {
    return
  }
  const thumbs = [...recentStripList.querySelectorAll<HTMLButtonElement>('.recent-thumb')]
  if (!thumbs.length) return
  const current = (event.target as HTMLElement).closest<HTMLButtonElement>('.recent-thumb')
  const idx = current ? thumbs.indexOf(current) : 0
  if (idx < 0) return
  event.preventDefault()
  let next = idx
  if (event.key === 'ArrowLeft') next = (idx + thumbs.length - 1) % thumbs.length
  if (event.key === 'ArrowRight') next = (idx + 1) % thumbs.length
  if (event.key === 'Home') next = 0
  if (event.key === 'End') next = thumbs.length - 1
  thumbs.forEach((t, i) => {
    t.tabIndex = i === next ? 0 : -1
  })
  thumbs[next]?.focus()
})

// Batch Actions for Packs Mode
btnSelectAllPacks.addEventListener('click', () => {
  packs.forEach((p) => selectedPackIds.add(p.id))
  renderPackNav()
  renderGrid()
  updateExportState()
  showToast(`已全选 ${packs.length} 个表情包`, 'success')
})

btnInvertPacks.addEventListener('click', () => {
  packs.forEach((p) => {
    if (selectedPackIds.has(p.id)) selectedPackIds.delete(p.id)
    else selectedPackIds.add(p.id)
  })
  renderPackNav()
  renderGrid()
  updateExportState()
  showToast('已反选表情包', 'info')
})

btnClearPacks.addEventListener('click', () => {
  selectedPackIds.clear()
  renderPackNav()
  renderGrid()
  updateExportState()
  showToast('已清空所有勾选的表情包', 'info')
})

// Batch Action Button for Current Pack
btnBatchPackAction.addEventListener('click', () => {
  const pack = packs[activePack]
  if (!pack) return

  if (mode === 'custom') {
    const activeCustom = ensureActiveCustomPack()
    const sourceItems = pack.items
    const sourceLabel = `「${packTitle(pack)}」`
    let addedCount = 0
    let skippedDup = 0
    let skippedCap = 0
    let totalItems = customPacks.reduce((acc, p) => acc + p.items.length, 0)
    for (const item of sourceItems) {
      if (activeCustom.items.some((i) => i.src === item.src)) {
        skippedDup++
        continue
      }
      if (activeCustom.items.length >= CUSTOM_PACK_ITEM_LIMIT || totalItems >= CUSTOM_TOTAL_ITEM_LIMIT) {
        skippedCap++
        continue
      }
      activeCustom.items.push(item)
      totalItems++
      addedCount++
    }
    renderCustomPackList()
    renderGrid()
    updateExportState()
    const parts: string[] = []
    if (skippedDup > 0) parts.push(`${skippedDup} 项已在组内`)
    if (skippedCap > 0) parts.push(`${skippedCap} 项因上限未加入`)
    const extra = parts.length ? `（${parts.join('，')}）` : ''
    showToast(
      `已将${sourceLabel}的 ${addedCount} 个表情批量加入「${activeCustom.label}」${extra}`,
      addedCount ? 'success' : 'info',
    )
  } else {
    const isSelected = selectedPackIds.has(pack.id)
    if (!isSelected) {
      selectedPackIds.add(pack.id)
      for (const item of pack.items) excludedItemSrcs.delete(item.src)
      showToast(`已勾选「${packTitle(pack)}」整包`, 'success')
    } else {
      let packExcluded = 0
      for (const item of pack.items) {
        if (excludedItemSrcs.has(item.src)) packExcluded++
      }
      if (packExcluded === pack.items.length) {
        for (const item of pack.items) excludedItemSrcs.delete(item.src)
        showToast(`已恢复「${packTitle(pack)}」全部表情`, 'success')
      } else {
        for (const item of pack.items) excludedItemSrcs.add(item.src)
        showToast(`已全部剔除「${packTitle(pack)}」的表情`, 'info')
      }
    }
    renderPackNav()
    renderGrid()
    updateExportState()
  }
})

// Pack Nav Click & Checkbox Handling
packNav.addEventListener('change', (event) => {
  const target = event.target as HTMLElement | null
  if (target instanceof HTMLInputElement && target.classList.contains('pack-check')) {
    target.setAttribute('aria-checked', String(target.checked))
    const packId = target.dataset.packId
    if (!packId) return
    if (target.checked) {
      selectedPackIds.add(packId)
      const pack = packs.find((p) => p.id === packId)
      showToast(`已勾选「${pack ? packTitle(pack) : packId}」`, 'success')
    } else {
      selectedPackIds.delete(packId)
      const pack = packs.find((p) => p.id === packId)
      showToast(`已取消勾选「${pack ? packTitle(pack) : packId}」`, 'info')
    }
    updateExportState()
    if (packs[activePack]?.id === packId) {
      renderGrid()
      updatePopGroupBtn()
    }
  }
})

// In-place high-performance pack switching without DOM teardown
packNav.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLElement>('button.pack[data-pack-index]')
  if (!button || !packNav.contains(button)) return
  const index = Number(button.dataset.packIndex)
  activatePack(index)
})

packNav.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement
  if (target instanceof HTMLInputElement && target.classList.contains('pack-check')) {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      const btn = target.closest('.pack-row')?.querySelector<HTMLButtonElement>('button.pack')
      btn?.focus()
      return
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const checks = [...packNav.querySelectorAll<HTMLInputElement>('.pack-check:not([disabled])')]
      const idx = checks.indexOf(target)
      if (idx >= 0) {
        const next = event.key === 'ArrowUp' ? Math.max(0, idx - 1) : Math.min(checks.length - 1, idx + 1)
        checks[next]?.focus()
      }
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      target.checked = !target.checked
      target.dispatchEvent(new Event('change', { bubbles: true }))
      return
    }
  }

  if (event.key === ' ' && mode === 'packs') {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button.pack')
    if (button && packNav.contains(button)) {
      event.preventDefault()
      const checkbox = button.closest('.pack-row')?.querySelector<HTMLInputElement>('.pack-check')
      if (checkbox && !checkbox.disabled) {
        checkbox.checked = !checkbox.checked
        checkbox.dispatchEvent(new Event('change', { bubbles: true }))
      }
      return
    }
  }

  if (event.key === 'ArrowLeft' && mode === 'packs') {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button.pack')
    if (button && packNav.contains(button)) {
      const checkbox = button.closest('.pack-row')?.querySelector<HTMLInputElement>('.pack-check')
      if (checkbox && !checkbox.disabled) {
        event.preventDefault()
        checkbox.focus()
        return
      }
    }
  }

  if (
    event.key !== 'ArrowUp' &&
    event.key !== 'ArrowDown' &&
    event.key !== 'Home' &&
    event.key !== 'End'
  ) {
    return
  }
  const buttons = [...packNav.querySelectorAll<HTMLButtonElement>('button.pack')]
  if (!buttons.length) return
  const current =
    target.closest<HTMLButtonElement>('button.pack') ??
    target.closest('.pack-row')?.querySelector<HTMLButtonElement>('button.pack') ??
    null
  if (!current || !packNav.contains(current)) return
  const idx = buttons.indexOf(current)
  if (idx < 0) return
  event.preventDefault()
  let next = idx
  if (event.key === 'ArrowUp') next = Math.max(0, idx - 1)
  if (event.key === 'ArrowDown') next = Math.min(buttons.length - 1, idx + 1)
  if (event.key === 'Home') next = 0
  if (event.key === 'End') next = buttons.length - 1
  if (next === idx) {
    if (packNavStatus) {
      packNavStatus.textContent = idx === 0 ? '已在分类列表首项' : '已在分类列表末项'
    }
    return
  }
  const packIndex = Number(buttons[next]!.dataset.packIndex)
  activatePack(packIndex)
  const focused = packNav.querySelector<HTMLButtonElement>(
    `button.pack[data-pack-index="${packIndex}"]`,
  )
  focused?.focus()
  focused?.scrollIntoView({ block: 'nearest' })
  if (packNavStatus) {
    const pack = packs[packIndex]
    if (pack) packNavStatus.textContent = `已切换至「${packTitle(pack)}」`
  }
})

tabPacks.addEventListener('click', () => setMode('packs'))
tabCustom.addEventListener('click', () => setMode('custom'))

const modeTabs = [tabPacks, tabCustom]
modeTabs.forEach((tab) => {
  tab.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const idx = modeTabs.indexOf(tab)
    let next = idx
    if (event.key === 'ArrowLeft') next = (idx + modeTabs.length - 1) % modeTabs.length
    if (event.key === 'ArrowRight') next = (idx + 1) % modeTabs.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = modeTabs.length - 1
    const target = modeTabs[next]!
    target.focus()
    setMode(target === tabPacks ? 'packs' : 'custom')
  })
})

function clearCustomFormError(): void {
  customFormError.hidden = true
  customFormError.textContent = ''
  for (const el of [customNameInput, customIdInput]) {
    el.removeAttribute('aria-invalid')
    el.removeAttribute('aria-describedby')
  }
}

function showCustomFormError(message: string, field: 'name' | 'id' | 'both' = 'both'): void {
  customFormError.hidden = false
  customFormError.textContent = message
  const mark = (el: HTMLInputElement, on: boolean) => {
    el.setAttribute('aria-invalid', on ? 'true' : 'false')
    if (on) el.setAttribute('aria-describedby', 'custom-form-error')
    else el.removeAttribute('aria-describedby')
  }
  mark(customNameInput, field === 'name' || field === 'both')
  mark(customIdInput, field === 'id' || field === 'both')
}

// Custom Group Creation Form
customAddForm.addEventListener('submit', (event) => {
  event.preventDefault()
  createCustomPack()
})

function createCustomPack(source?: SmojiPack): void {
  clearCustomFormError()

  const label = source ? packTitle(source) : customNameInput.value.trim()
  let id = source?.id ?? customIdInput.value.trim()

  if (!label) {
    showCustomFormError('分组名称不能为空', 'name')
    customNameInput.focus()
    return
  }

  if (!id) {
    let counter = customPacks.length + 1
    while (customPacks.some((p) => p.id === `pack_${counter}`)) counter += 1
    id = `pack_${counter}`
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(id)) {
    showCustomFormError('ID 格式不合法 (需以字母数字开头，允许 ._-)', 'id')
    customIdInput.focus()
    return
  }

  if (customPacks.some((p) => p.id === id)) {
    showCustomFormError(`分组 ID "${id}" 已存在`, 'id')
    customIdInput.focus()
    return
  }

  if (customPacks.length >= CUSTOM_PACK_LIMIT) {
    showCustomFormError(`最多创建 ${CUSTOM_PACK_LIMIT} 个分组`, 'both')
    return
  }

  const items = source ? [...source.items] : []
  if (items.length > CUSTOM_PACK_ITEM_LIMIT ||
      customPacks.reduce((total, pack) => total + pack.items.length, 0) + items.length > CUSTOM_TOTAL_ITEM_LIMIT) {
    showCustomFormError('当前分类超出分组容量，请新建空分组后逐项加入', 'both')
    return
  }
  customPacks.push({ id, label, items })
  if (source) {
    galleryView = 'picked'
    syncGalleryViewChips()
  }
  activeCustomPackIndex = customPacks.length - 1
  customNameInput.value = ''
  customIdInput.value = ''
  renderCustomPackList()
  renderGrid()
  updateExportState()
  updatePopGroupBtn()
  showToast(`已新建自选分组「${label}」${source ? `，已加入 ${items.length} 张表情` : ''}`, 'success')
}

// Custom Pack List Events (Delete, Expand, Edit, Select)
customPackList.addEventListener('click', (event) => {
  const target = event.target as HTMLElement

  const trayMove = target.closest<HTMLButtonElement>('[data-tray-move-pack]')
  if (trayMove) {
    event.stopPropagation()
    const packIdx = Number(trayMove.dataset.trayMovePack)
    const itemIdx = Number(trayMove.dataset.trayMoveItem)
    const dir = Number(trayMove.dataset.trayMoveDir)
    if (Number.isFinite(packIdx) && Number.isFinite(itemIdx) && Number.isFinite(dir)) {
      const pack = customPacks[packIdx]
      if (!pack) return
      if (dir < 0 && itemIdx === 0 && packIdx > 0) {
        const dest = customPacks[packIdx - 1]
        moveTrayItemAcrossPacks(packIdx, itemIdx, packIdx - 1, dest?.items.length ?? 0)
      } else if (dir > 0 && itemIdx >= pack.items.length - 1 && packIdx < customPacks.length - 1) {
        moveTrayItemAcrossPacks(packIdx, itemIdx, packIdx + 1, 0)
      } else {
        reorderTrayItem(packIdx, itemIdx, itemIdx + dir)
      }
    }
    return
  }

  const emptyTray = target.closest<HTMLElement>('.custom-pack-tray.is-empty')
  if (emptyTray) {
    event.stopPropagation()
    const packIdx = Number(emptyTray.dataset.trayDropPack)
    if (Number.isFinite(packIdx) && customPacks[packIdx]) {
      activeCustomPackIndex = packIdx
      renderCustomPackList()
      updateExportState()
      showToast(`已将「${customPacks[packIdx].label}」设为目标分组`, 'info')
    }
    return
  }

  const trayThumb = target.closest<HTMLElement>('.tray-thumb[data-tray-src]')
  if (trayThumb && !target.closest('button')) {
    event.stopPropagation()
    const src = trayThumb.dataset.traySrc
    if (src) {
      const resolved = itemBySrc.get(src)
      if (resolved) openPop(resolved.item, resolved.pack, { retainFocus: true })
    }
    return
  }

  const delThumb = target.closest<HTMLButtonElement>('[data-remove-pack]')
  if (delThumb) {
    const packIdx = Number(delThumb.dataset.removePack)
    const itemIdx = Number(delThumb.dataset.removeItem)
    const pack = customPacks[packIdx]
    const removed = pack?.items[itemIdx]
    if (pack && removed) {
      pack.items.splice(itemIdx, 1)
      const packIndex = packIdx
      const removedIndex = itemIdx
      const removedItem = removed
      historyStack.push({
        description: `从「${pack.label}」移出表情「${removed.label}」`,
        undo: () => {
          const targetPack = customPacks[packIndex]
          if (targetPack && !targetPack.items.some((i) => i.src === removedItem.src)) {
            targetPack.items.splice(Math.min(removedIndex, targetPack.items.length), 0, removedItem)
            activeCustomPackIndex = packIndex
            renderCustomPackList()
            renderGrid()
            updateExportState()
            updatePopGroupBtn()
          }
        },
        redo: () => {
          const targetPack = customPacks[packIndex]
          if (targetPack) {
            const idx = targetPack.items.findIndex((i) => i.src === removedItem.src)
            if (idx !== -1) targetPack.items.splice(idx, 1)
            activeCustomPackIndex = packIndex
            renderCustomPackList()
            renderGrid()
            updateExportState()
            updatePopGroupBtn()
          }
        },
      })
      lastUndo = {
        type: 'custom-remove',
        packIndex: packIdx,
        item: removed,
        itemIndex: itemIdx,
      }
      renderCustomPackList()
      renderGrid()
      updateExportState()
      updatePopGroupBtn()
      showToast(`已从「${pack.label}」移出`, 'info', {
        label: '撤销',
        run: () => {
          undoLastAction()
        },
      })
    }
    return
  }

  const expandBtn = target.closest<HTMLElement>('[data-expand-index]')
  if (expandBtn) {
    const idx = Number(expandBtn.dataset.expandIndex)
    if (customPacks[idx]) {
      const willExpand = !customPacks[idx]!.isExpanded
      customPacks[idx]!.isExpanded = willExpand
      renderCustomPackList()
      if (willExpand) {
        requestAnimationFrame(() => {
          const tray = document.getElementById(`custom-tray-${idx}`)
          const focusable =
            tray?.querySelector<HTMLElement>('.tray-thumb') ??
            customPackList.querySelector<HTMLElement>(`[data-expand-index="${idx}"]`)
          focusable?.focus()
        })
      } else {
        requestAnimationFrame(() => {
          customPackList.querySelector<HTMLElement>(`[data-expand-index="${idx}"]`)?.focus()
        })
      }
    }
    return
  }

  const editBtn = target.closest<HTMLButtonElement>('[data-edit-index]')
  if (editBtn) {
    const idx = Number(editBtn.dataset.editIndex)
    if (customPacks[idx]) {
      customPacks[idx]!.isEditing = true
      renderCustomPackList()
    }
    return
  }

  const dupBtn = target.closest<HTMLButtonElement>('[data-dup-index]')
  if (dupBtn) {
    duplicateCustomPack(Number(dupBtn.dataset.dupIndex))
    return
  }

  const mergeBtn = target.closest<HTMLButtonElement>('[data-merge-index]')
  if (mergeBtn && !mergeBtn.disabled) {
    mergeCustomPackIntoPrevious(Number(mergeBtn.dataset.mergeIndex))
    return
  }

  const moveBtn = target.closest<HTMLButtonElement>('[data-move-index]')
  if (moveBtn && !moveBtn.disabled) {
    const from = Number(moveBtn.dataset.moveIndex)
    const dir = Number(moveBtn.dataset.moveDir)
    reorderCustomPack(from, from + dir)
    return
  }

  const splitBtn = target.closest<HTMLButtonElement>('[data-split-index]')
  if (splitBtn && !splitBtn.disabled) {
    splitCustomPack(Number(splitBtn.dataset.splitIndex))
    return
  }

  const delBtn = target.closest<HTMLButtonElement>('[data-delete-index]')
  if (delBtn) {
    const idx = Number(delBtn.dataset.deleteIndex)
    const deleted = customPacks[idx]
    if (!deleted) return
    void (async () => {
      const ok = await showConfirm(`确定删除分组「${deleted.label}」？`, {
        title: '删除分组',
        okLabel: '删除',
        danger: true,
      })
      if (!ok) return
      const still = customPacks[idx]
      if (!still || still.id !== deleted.id) return
      const packSnapshot = {
        id: deleted.id,
        label: deleted.label,
        items: deleted.items.slice(),
        isExpanded: deleted.isExpanded,
      }
      const deleteIdx = idx
      const prevActive = activeCustomPackIndex
      historyStack.push({
        description: `删除分组「${deleted.label}」`,
        undo: () => {
          customPacks.splice(deleteIdx, 0, {
            id: packSnapshot.id,
            label: packSnapshot.label,
            items: packSnapshot.items.slice(),
            isExpanded: packSnapshot.isExpanded,
          })
          activeCustomPackIndex = prevActive
          renderCustomPackList()
          renderGrid()
          updateExportState()
          updatePopGroupBtn()
        },
        redo: () => {
          const targetIdx = customPacks.findIndex((p) => p.id === packSnapshot.id)
          if (targetIdx !== -1) {
            customPacks.splice(targetIdx, 1)
            activeCustomPackIndex = Math.min(prevActive, customPacks.length - 1)
            renderCustomPackList()
            renderGrid()
            updateExportState()
            updatePopGroupBtn()
          }
        },
      })
      lastUndo = {
        type: 'custom-delete',
        pack: packSnapshot,
        packIndex: idx,
        activeIndex: activeCustomPackIndex,
      }
      customPacks.splice(idx, 1)
      if (activeCustomPackIndex >= customPacks.length) {
        activeCustomPackIndex = customPacks.length - 1
      }
      renderCustomPackList()
      renderGrid()
      updateExportState()
      updatePopGroupBtn()
      showToast(`已删除分组「${deleted.label}」`, 'info', {
        label: '撤销',
        run: () => {
          undoLastAction()
        },
      })
    })()
    return
  }

  const row = target.closest<HTMLElement>('[data-custom-index]')
  if (row && !target.closest('button')) {
    activeCustomPackIndex = Number(row.dataset.customIndex)
    customPacks.forEach((pack, index) => {
      pack.isExpanded = index === activeCustomPackIndex
    })
    renderCustomPackList()
    renderGrid()
    updatePopGroupBtn()
  }
})

customPackList.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  const target = event.target as HTMLElement
  if (target.closest('button, input, textarea, select')) return
  const emptyTray = target.closest<HTMLElement>('.custom-pack-tray.is-empty')
  if (emptyTray && customPackList.contains(emptyTray)) {
    event.preventDefault()
    const packIdx = Number(emptyTray.dataset.trayDropPack)
    if (Number.isFinite(packIdx) && customPacks[packIdx]) {
      activeCustomPackIndex = packIdx
      renderCustomPackList()
      updateExportState()
      showToast(`已将「${customPacks[packIdx].label}」设为目标分组`, 'info')
    }
    return
  }
  const trayThumb = target.closest<HTMLElement>('.tray-thumb[data-tray-src]')
  if (trayThumb && customPackList.contains(trayThumb)) {
    event.preventDefault()
    const src = trayThumb.dataset.traySrc
    if (src) {
      const resolved = itemBySrc.get(src)
      if (resolved) openPop(resolved.item, resolved.pack, { retainFocus: true })
    }
    return
  }
  const row = target.closest<HTMLElement>('.custom-pack-item[data-custom-index]')
  if (!row || !customPackList.contains(row)) return
  event.preventDefault()
  activeCustomPackIndex = Number(row.dataset.customIndex)
  customPacks.forEach((pack, index) => {
    pack.isExpanded = index === activeCustomPackIndex
  })
  renderCustomPackList()
  renderGrid()
  updatePopGroupBtn()
  requestAnimationFrame(() => {
    customPackList.querySelector<HTMLElement>(`[data-custom-index="${activeCustomPackIndex}"]`)?.focus()
  })
})

let dragFromIndex = -1
let trayDragPack = -1
let trayDragItem = -1
let gridDragSrc: string | null = null
let dragGhostEl: HTMLElement | null = null

function clearDragGhost(): void {
  dragGhostEl?.remove()
  dragGhostEl = null
}

function setDragGhost(event: DragEvent, source: HTMLElement, size = 48): void {
  clearDragGhost()
  const img = source.querySelector('img')
  const ghost = document.createElement('div')
  ghost.className = 'drag-ghost'
  ghost.setAttribute('aria-hidden', 'true')
  if (img?.src) {
    const clone = document.createElement('img')
    clone.src = img.currentSrc || img.src
    clone.alt = ''
    ghost.append(clone)
  } else {
    ghost.textContent = source.textContent?.trim().slice(0, 8) || '·'
  }
  Object.assign(ghost.style, {
    position: 'fixed',
    top: '-200px',
    left: '-200px',
    width: `${size}px`,
    height: `${size}px`,
    pointerEvents: 'none',
    zIndex: '9999',
  })
  document.body.append(ghost)
  dragGhostEl = ghost
  event.dataTransfer?.setDragImage(ghost, size / 2, size / 2)
}

customPackList.addEventListener('dragstart', (event) => {
  const trayThumb = (event.target as Element).closest<HTMLElement>('[data-tray-pack]')
  if (trayThumb && !(event.target as HTMLElement).closest('button')) {
    trayDragPack = Number(trayThumb.dataset.trayPack)
    trayDragItem = Number(trayThumb.dataset.trayItem)
    trayThumb.classList.add('is-dragging')
    customPackList.classList.add('is-drag-source')
    event.dataTransfer?.setData('text/tray', `${trayDragPack}:${trayDragItem}`)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
    setDragGhost(event, trayThumb, 44)
    return
  }

  const row = (event.target as Element).closest<HTMLElement>('[data-custom-index]')
  if (!row || (event.target as HTMLElement).closest('button, input')) {
    event.preventDefault()
    return
  }
  dragFromIndex = Number(row.dataset.customIndex)
  row.classList.add('is-dragging')
  customPackList.classList.add('is-drag-source')
  event.dataTransfer?.setData('text/plain', String(dragFromIndex))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  setDragGhost(event, row, 56)
})

customPackList.addEventListener('dragend', () => {
  customPackList.classList.remove('is-drag-source')
  customPackList.querySelectorAll('.custom-pack-item').forEach((el) => {
    el.classList.remove('is-dragging', 'is-drop-target')
  })
  customPackList.querySelectorAll('.tray-thumb').forEach((el) => {
    el.classList.remove('is-dragging', 'is-drop-target')
  })
  customPackList.querySelectorAll('.custom-pack-tray').forEach((el) => {
    el.classList.remove('is-drop-target')
  })
  clearDragGhost()
  dragFromIndex = -1
  trayDragPack = -1
  trayDragItem = -1
})

customPackList.addEventListener('dragover', (event) => {
  event.preventDefault()
  const isGridDrag =
    gridDragSrc != null ||
    [...(event.dataTransfer?.types ?? [])].includes('text/smoji-src')

  if (trayDragPack >= 0 || isGridDrag) {
    const thumb = (event.target as Element).closest<HTMLElement>('[data-tray-pack]')
    const emptyTray = (event.target as Element).closest<HTMLElement>('.custom-pack-tray.is-empty')
    const row = (event.target as Element).closest<HTMLElement>('[data-custom-index]')
    customPackList.querySelectorAll('.tray-thumb').forEach((el) => el.classList.remove('is-drop-target'))
    customPackList.querySelectorAll('.custom-pack-item').forEach((el) => el.classList.remove('is-drop-target'))
    customPackList.querySelectorAll('.custom-pack-tray').forEach((el) => el.classList.remove('is-drop-target'))
    if (thumb && trayDragPack >= 0) {
      const targetPack = Number(thumb.dataset.trayPack)
      const targetItem = Number(thumb.dataset.trayItem)
      if (targetPack !== trayDragPack || targetItem !== trayDragItem) {
        thumb.classList.add('is-drop-target')
      }
    } else if (emptyTray) {
      const targetPack = Number(emptyTray.dataset.trayDropPack)
      if (Number.isFinite(targetPack) && (isGridDrag || targetPack !== trayDragPack)) {
        emptyTray.classList.add('is-drop-target')
      }
    } else if (row) {
      const idx = Number(row.dataset.customIndex)
      if (isGridDrag || idx !== trayDragPack) row.classList.add('is-drop-target')
    }
    if (event.dataTransfer) event.dataTransfer.dropEffect = isGridDrag ? 'copy' : 'move'
    return
  }

  const row = (event.target as Element).closest<HTMLElement>('[data-custom-index]')
  customPackList.querySelectorAll('.custom-pack-item').forEach((el) => el.classList.remove('is-drop-target'))
  if (row && Number(row.dataset.customIndex) !== dragFromIndex) {
    row.classList.add('is-drop-target')
  }
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
})

customPackList.addEventListener('drop', (event) => {
  event.preventDefault()
  const gridSrc =
    gridDragSrc ||
    event.dataTransfer?.getData('text/smoji-src') ||
    ''
  if (gridSrc) {
    const item = itemBySrc.get(gridSrc)?.item
    const emptyTray = (event.target as Element).closest<HTMLElement>('.custom-pack-tray.is-empty')
    const row = (event.target as Element).closest<HTMLElement>('[data-custom-index]')
    const trayThumb = (event.target as Element).closest<HTMLElement>('[data-tray-pack]')
    let targetPack =
      Number(emptyTray?.dataset.trayDropPack) ||
      Number(trayThumb?.dataset.trayPack) ||
      Number(row?.dataset.customIndex)
    if (!Number.isFinite(targetPack) || targetPack < 0) targetPack = activeCustomPackIndex
    if (item && Number.isFinite(targetPack) && targetPack >= 0) {
      addItemToCustomPackAt(targetPack, item)
    }
    gridDragSrc = null
    return
  }

  if (trayDragPack >= 0) {
    const thumb = (event.target as Element).closest<HTMLElement>('[data-tray-pack]')
    const emptyTray = (event.target as Element).closest<HTMLElement>('.custom-pack-tray.is-empty')
    const row = (event.target as Element).closest<HTMLElement>('[data-custom-index]')
    if (thumb) {
      moveTrayItemAcrossPacks(
        trayDragPack,
        trayDragItem,
        Number(thumb.dataset.trayPack),
        Number(thumb.dataset.trayItem),
      )
      return
    }
    if (emptyTray) {
      const targetPack = Number(emptyTray.dataset.trayDropPack)
      if (Number.isFinite(targetPack)) {
        moveTrayItemAcrossPacks(trayDragPack, trayDragItem, targetPack, 0)
      }
      return
    }
    if (row) {
      moveTrayItemAcrossPacks(trayDragPack, trayDragItem, Number(row.dataset.customIndex))
      return
    }
    return
  }
  const row = (event.target as Element).closest<HTMLElement>('[data-custom-index]')
  if (!row || dragFromIndex < 0) return
  const toIndex = Number(row.dataset.customIndex)
  reorderCustomPack(dragFromIndex, toIndex)
})

grid.addEventListener('dragstart', (event) => {
  if (mode !== 'custom') {
    event.preventDefault()
    return
  }
  const card = (event.target as Element).closest<HTMLElement>('.card[data-item-src]')
  if (!card || !grid.contains(card) || (event.target as HTMLElement).closest('button')) {
    event.preventDefault()
    return
  }
  const src = card.dataset.itemSrc
  if (!src) {
    event.preventDefault()
    return
  }
  gridDragSrc = src
  card.classList.add('is-dragging')
  event.dataTransfer?.setData('text/smoji-src', src)
  event.dataTransfer?.setData('text/plain', src)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
  setDragGhost(event, card, 52)
})

grid.addEventListener('dragend', () => {
  grid.querySelectorAll('.card.is-dragging').forEach((el) => el.classList.remove('is-dragging'))
  customPackList.querySelectorAll('.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'))
  clearDragGhost()
  gridDragSrc = null
})

// Export Buttons (registry-rendered; delegated)
exportToolbar.addEventListener('click', (event) => {
  const btn = (event.target as Element).closest<HTMLButtonElement>('.export-btn')
  if (!btn || !exportToolbar.contains(btn)) return
  const format = btn.dataset.format as ExportTargetFormat
  if (format) triggerExport(format)
})

// Pop Modal Actions
popToggleGroupBtn.addEventListener('click', () => {
  if (selected) {
    if (mode === 'custom') {
      handleCustomItemClick(selected)
    } else {
      handlePackItemToggle(selected)
    }
  }
})

popTargetGroup.addEventListener('change', () => {
  const idx = Number(popTargetGroup.value)
  if (!Number.isFinite(idx) || idx < 0 || idx >= customPacks.length) return
  activeCustomPackIndex = idx
  renderCustomPackList()
  renderGrid()
  updatePopGroupBtn()
})

popCloseBtn.addEventListener('click', closePop)
popPrevBtn.addEventListener('click', () => navigatePop(-1))
popNextBtn.addEventListener('click', () => navigatePop(1))

let popSwipeX: number | null = null
popStageWrap.addEventListener(
  'pointerdown',
  (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    popSwipeX = event.clientX
  },
  { passive: true },
)
popStageWrap.addEventListener(
  'pointerup',
  (event) => {
    if (popSwipeX == null) return
    const dx = event.clientX - popSwipeX
    popSwipeX = null
    if (Math.abs(dx) < 40) return
    navigatePop(dx < 0 ? 1 : -1)
  },
  { passive: true },
)
popStageWrap.addEventListener(
  'pointercancel',
  () => {
    popSwipeX = null
  },
  { passive: true },
)

// Preview Stage Background Toggle
document.querySelectorAll<HTMLButtonElement>('.bg-toggle-btn').forEach((btn) => {
  if (btn.title) btn.setAttribute('aria-label', btn.title)
  btn.addEventListener('click', () => {
    document.querySelectorAll<HTMLButtonElement>('.bg-toggle-btn').forEach((b) => {
      b.classList.remove('is-active')
      b.setAttribute('aria-pressed', 'false')
    })
    btn.classList.add('is-active')
    btn.setAttribute('aria-pressed', 'true')
    const bg = btn.dataset.bg
    popStage.classList.remove('is-checkered', 'is-light', 'is-dark')
    if (bg === 'light') popStage.classList.add('is-light')
    else if (bg === 'dark') popStage.classList.add('is-dark')
    else popStage.classList.add('is-checkered')
  })
})

// Grid Item Click & Delegations
grid.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  const target = event.target as HTMLElement
  const overlay = target.closest<HTMLElement>(
    '[data-exclude-item-index], [data-badge-item-index], [data-check-item-index], [data-jump-pack]',
  )
  if (overlay && grid.contains(overlay)) {
    event.preventDefault()
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    return
  }
  const card = target.closest<HTMLElement>('[data-item-index]')
  if (!card || !grid.contains(card)) return
  event.preventDefault()
  event.stopPropagation()
  const index = Number(card.dataset.itemIndex)
  const item = currentItems()[index]
  if (!item) return
  const resolved = itemBySrc.get(item.src)
  const pack = resolved?.pack ?? packs[activePack]
  if (!pack) return
  keyboardFocusIndex = index
  openPop(item, pack)
})

grid.addEventListener('click', (event) => {
  const target = event.target as HTMLElement

  const excludeBtn = target.closest<HTMLElement>('[data-exclude-item-index]')
  if (excludeBtn) {
    event.stopPropagation()
    const item = currentItems()[Number(excludeBtn.dataset.excludeItemIndex)]
    if (item) handlePackItemToggle(item)
    return
  }

  const badge = target.closest<HTMLElement>('[data-badge-item-index]')
  if (badge) {
    event.stopPropagation()
    const item = currentItems()[Number(badge.dataset.badgeItemIndex)]
    if (item) handleCustomItemClick(item)
    return
  }

  const check = target.closest<HTMLElement>('[data-check-item-index]')
  if (check) {
    event.stopPropagation()
    const item = currentItems()[Number(check.dataset.checkItemIndex)]
    if (item) handleCustomItemClick(item)
    return
  }

  const card = target.closest<HTMLElement>('[data-item-index]')
  if (!card || !grid.contains(card)) return
  const item = currentItems()[Number(card.dataset.itemIndex)]
  if (!item) return
  const resolved = itemBySrc.get(item.src)
  const pack = resolved?.pack ?? packs[activePack]
  if (!pack) return
  keyboardFocusIndex = Number(card.dataset.itemIndex)
  openPop(item, pack)
})

// Copy Buttons in Pop
pop.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-copy]')
  if (button?.dataset.copy) copyValue(button.dataset.copy, button)
})

copyTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    activeCopyFormat = (tab.dataset.copyFormat as typeof activeCopyFormat) || 'md'
    saveCopyFormat(activeCopyFormat)
    updateActiveCopyField()
  })
  tab.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const tabs = [...copyTabs]
    const idx = tabs.indexOf(tab)
    let next = idx
    if (event.key === 'ArrowLeft') next = (idx + tabs.length - 1) % tabs.length
    if (event.key === 'ArrowRight') next = (idx + 1) % tabs.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = tabs.length - 1
    const target = tabs[next]!
    activeCopyFormat = (target.dataset.copyFormat as typeof activeCopyFormat) || 'md'
    saveCopyFormat(activeCopyFormat)
    updateActiveCopyField()
    target.focus()
  })
})

btnCopyActive.addEventListener('click', () => {
  copyValue(activeCopyFormat, btnCopyActive)
})

copyActiveInput.addEventListener('focus', () => {
  copyActiveInput.select()
})
copyActiveInput.addEventListener('click', () => {
  copyActiveInput.select()
})

// Code Preview Modal
btnOpenCode.addEventListener('click', openCodeModal)
codeModalClose.addEventListener('click', closeCodeModal)

codeModalTabs.addEventListener('click', (event) => {
  const tab = (event.target as Element).closest<HTMLButtonElement>('.code-tab')
  if (!tab || !codeModalTabs.contains(tab)) return
  const fmt = tab.dataset.codeFormat as ExportTargetFormat
  if (fmt) updateCodePreview(fmt)
})

codeModalTabs.addEventListener('keydown', (event) => {
  const tab = (event.target as Element).closest<HTMLButtonElement>('.code-tab')
  if (!tab || !codeModalTabs.contains(tab)) return
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  const tabs = codeTabs
  const idx = tabs.indexOf(tab)
  if (idx < 0) return
  let next = idx
  if (event.key === 'ArrowLeft') next = (idx + tabs.length - 1) % tabs.length
  if (event.key === 'ArrowRight') next = (idx + 1) % tabs.length
  if (event.key === 'Home') next = 0
  if (event.key === 'End') next = tabs.length - 1
  const target = tabs[next]!
  const fmt = target.dataset.codeFormat as ExportTargetFormat
  if (fmt) updateCodePreview(fmt)
  target.focus()
})

btnPreviewCtaPrimary.addEventListener('click', () => {
  closeCodeModal()
  if (mode === 'custom') {
    if (mobileViewportMq.matches) setMenuOpen(true)
    customNameInput.focus()
    customNameInput.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    return
  }
  const pack = packs[activePack]
  if (!pack) return
  selectedPackIds.add(pack.id)
  renderPackNav()
  renderGrid()
  updateExportState()
  showToast(`已勾选「${packTitle(pack)}」`, 'success')
})

btnPreviewCtaScope.addEventListener('click', () => {
  if (mode === 'custom') {
    setPreviewScope('selected')
    showToast('已切换预览范围为全部自选分组', 'info')
    return
  }
  setPreviewScope('all')
  showToast('已切换预览范围为全部表情', 'info')
})

function syncPreviewScopeChips(): void {
  previewScopeChips.forEach((chip) => {
    const on = !chip.hidden && chip.dataset.scope === previewScope
    chip.classList.toggle('is-active', on)
    chip.setAttribute('aria-checked', String(on))
    chip.tabIndex = on ? 0 : -1
  })
  if (![...previewScopeChips].some((c) => c.tabIndex === 0)) {
    const fallback = [...previewScopeChips].find((c) => !c.hidden)
    if (fallback) fallback.tabIndex = 0
  }
}

function setPreviewScope(scope: typeof previewScope): void {
  previewScope = scope
  syncPreviewScopeChips()
  updateCodePreview(currentCodeFormat)
}

previewScopeChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    setPreviewScope((chip.dataset.scope as typeof previewScope) || 'active')
  })
  chip.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const chips = [...previewScopeChips].filter((c) => !c.hidden)
    const idx = chips.indexOf(chip)
    if (idx < 0) return
    let next = idx
    if (event.key === 'ArrowLeft') next = (idx + chips.length - 1) % chips.length
    if (event.key === 'ArrowRight') next = (idx + 1) % chips.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = chips.length - 1
    const target = chips[next]!
    setPreviewScope((target.dataset.scope as typeof previewScope) || 'active')
    target.focus()
  })
})

btnCopyCode.addEventListener('click', () => {
  const code = codePreviewContent.textContent || ''
  const labelEl = btnCopyCode.querySelector('span') ?? btnCopyCode
  const orig = labelEl.textContent || '复制完整代码'
  copyText(code, {
    onSuccess: () => {
      btnCopyCode.classList.add('is-copied')
      labelEl.textContent = '已复制'
      btnCopyCode.setAttribute('aria-label', '已复制到剪贴板')
      const priorMeta = codeModalMeta.textContent || ''
      if (codeMetaCopyTimer) clearTimeout(codeMetaCopyTimer)
      codeModalMeta.textContent = '已复制到剪贴板'
      codeMetaCopyTimer = window.setTimeout(() => {
        codeMetaCopyTimer = null
        if (codeModalMeta.textContent === '已复制到剪贴板') {
          codeModalMeta.textContent = priorMeta
        }
      }, 1600)
      window.setTimeout(() => {
        btnCopyCode.classList.remove('is-copied')
        labelEl.textContent = orig
        syncCopyActionAria()
      }, 1600)
    },
    selectFallback: () => {
      const range = document.createRange()
      range.selectNodeContents(codePreviewContent)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
      codePreviewContent.focus({ preventScroll: true })
      showToast(`请按 ${modKeyLabel}+C 手动复制`, 'info')
    },
  })
})

codePreviewContent.addEventListener('click', () => {
  if (btnCopyCode.disabled) return
  const range = document.createRange()
  range.selectNodeContents(codePreviewContent)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
})

btnDownloadCurrentCode.addEventListener('click', () => {
  const packsToExport = packsForPreviewScope()
  if (!packsToExport.length) {
    showToast('当前范围没有可导出的表情数据', 'error')
    return
  }

  downloadFormattedExport(currentCodeFormat, packsToExport, manifestUrl)
  showToast(`已下载 ${currentCodeFormat.toUpperCase()} 格式文件`, 'success')
})

// Guide Modal
btnOpenGuide.addEventListener('click', openGuideModal)
mobileGuideToggle.addEventListener('click', openGuideModal)
guideModalClose.addEventListener('click', closeGuideModal)
guideModalConfirm.addEventListener('click', closeGuideModal)

// Backdrop Click Closes All
backdrop.addEventListener('click', () => {
  if (!confirmModal.hidden) {
    closeConfirmModal(false)
    return
  }
  closePop()
  closeCodeModal()
  closeGuideModal()
  setMenuOpen(false)
})

confirmOk.addEventListener('click', () => closeConfirmModal(true))
confirmCancel.addEventListener('click', () => closeConfirmModal(false))

// Global Keyboard Shortcuts
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (!confirmModal.hidden) {
      event.preventDefault()
      closeConfirmModal(false)
      return
    }
    closePop()
    closeCodeModal()
    closeGuideModal()
    setMenuOpen(false)
      return
  }

  if ((event.metaKey || event.ctrlKey) && event.key === '1') {
    const tag = (document.activeElement as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (anyModalOpen()) return
    event.preventDefault()
    setMode('packs')
    tabPacks.focus()
    return
  }
  if ((event.metaKey || event.ctrlKey) && event.key === '2') {
    const tag = (document.activeElement as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (anyModalOpen()) return
    event.preventDefault()
    setMode('custom')
    tabCustom.focus()
    return
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'e') {
    const tag = (document.activeElement as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (anyModalOpen()) return
    if (selectionDock.hidden) {
      showToast('当前没有可导出的表情配置', 'info')
      return
    }
    if (selectionDockExport.disabled) {
      const reason =
        galleryExportError.textContent?.trim() ||
        selectionDockHint.textContent?.trim() ||
        '当前配置无法导出'
      showToast(reason, 'info')
      return
    }
    event.preventDefault()
    selectionDockExport.click()
    return
  }
  if ((event.metaKey || event.ctrlKey) && event.key === '.') {
    const tag = (document.activeElement as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (anyModalOpen()) return
    if (selectionDock.hidden) return
    event.preventDefault()
    selectionDockFormat.focus()
    return
  }
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'p') {
    const tag = (document.activeElement as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (!codeModal.hidden) return
    event.preventDefault()
    openCodeModal()
    return
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
    const tag = (document.activeElement as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (anyModalOpen()) return
    event.preventDefault()
    densityToggle.click()
    return
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
    const tag = (document.activeElement as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    // Allow undo while the pop is open; block other modals.
    if (!codeModal.hidden || !guideModal.hidden || !confirmModal.hidden) return
    if (event.shiftKey) {
      if (redoLastAction()) {
        event.preventDefault()
      }
    } else {
      if (undoLastAction()) {
        event.preventDefault()
      }
    }
    return
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
    const tag = (document.activeElement as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    if (!codeModal.hidden || !guideModal.hidden || !confirmModal.hidden) return
    if (redoLastAction()) {
      event.preventDefault()
    }
    return
  }
  if (
    event.altKey &&
    (event.key === 'ArrowUp' || event.key === 'ArrowDown') &&
    mode === 'custom' &&
    document.activeElement?.closest?.('#custom-pack-list')
  ) {
    const row = (document.activeElement as HTMLElement).closest<HTMLElement>('[data-custom-index]')
    if (row) {
      event.preventDefault()
      const from = Number(row.dataset.customIndex)
      const to = from + (event.key === 'ArrowUp' ? -1 : 1)
      reorderCustomPack(from, to)
      requestAnimationFrame(() => {
        customPackList
          .querySelector<HTMLElement>(`[data-custom-index="${Math.max(0, Math.min(customPacks.length - 1, to))}"]`)
          ?.focus()
      })
    }
    return
  }
  if (
    !event.altKey &&
    (event.key === 'ArrowUp' || event.key === 'ArrowDown') &&
    mode === 'custom' &&
    (document.activeElement as HTMLElement | null)?.classList?.contains('custom-pack-item')
  ) {
    const row = document.activeElement as HTMLElement
    const from = Number(row.dataset.customIndex)
    if (!Number.isFinite(from)) return
    const to = from + (event.key === 'ArrowUp' ? -1 : 1)
    if (to < 0 || to >= customPacks.length) {
      if (customPackStatus) {
        customPackStatus.textContent = to < 0 ? '已在分组列表首项' : '已在分组列表末项'
      }
      return
    }
    event.preventDefault()
    activeCustomPackIndex = to
    customPacks.forEach((pack, index) => {
      pack.isExpanded = index === activeCustomPackIndex
    })
    renderCustomPackList()
    renderGrid()
    updatePopGroupBtn()
    if (customPackStatus) {
      const pack = customPacks[to]
      if (pack) customPackStatus.textContent = `已切换至「${pack.label}」`
    }
    requestAnimationFrame(() => {
      customPackList.querySelector<HTMLElement>(`[data-custom-index="${to}"]`)?.focus()
    })
    return
  }
  if (
    event.altKey &&
    (event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
    mode === 'custom' &&
    document.activeElement?.closest?.('.tray-thumb')
  ) {
    const thumb = (document.activeElement as HTMLElement).closest<HTMLElement>('.tray-thumb')
    if (thumb) {
      event.preventDefault()
      const packIndex = Number(thumb.dataset.trayPack)
      const fromItem = Number(thumb.dataset.trayItem)
      const pack = customPacks[packIndex]
      if (!pack) return
      if (event.key === 'ArrowLeft' && fromItem === 0 && packIndex > 0) {
        const destIdx = packIndex - 1
        const destLen = customPacks[destIdx]?.items.length ?? 0
        moveTrayItemAcrossPacks(packIndex, fromItem, destIdx, destLen)
        requestAnimationFrame(() => {
          customPackList
            .querySelector<HTMLElement>(`[data-tray-pack="${destIdx}"][data-tray-item="${destLen}"]`)
            ?.focus()
        })
      } else if (
        event.key === 'ArrowRight' &&
        fromItem >= pack.items.length - 1 &&
        packIndex < customPacks.length - 1
      ) {
        const destIdx = packIndex + 1
        moveTrayItemAcrossPacks(packIndex, fromItem, destIdx, 0)
        requestAnimationFrame(() => {
          customPackList
            .querySelector<HTMLElement>(`[data-tray-pack="${destIdx}"][data-tray-item="0"]`)
            ?.focus()
        })
      } else {
        const toItem = fromItem + (event.key === 'ArrowLeft' ? -1 : 1)
        reorderTrayItem(packIndex, fromItem, toItem)
        requestAnimationFrame(() => {
          customPackList
            .querySelector<HTMLElement>(
              `[data-tray-pack="${packIndex}"][data-tray-item="${Math.max(0, toItem)}"]`,
            )
            ?.focus()
        })
      }
    }
    return
  }
  if (
    event.key === '?' &&
    document.activeElement?.tagName !== 'INPUT' &&
    document.activeElement?.tagName !== 'TEXTAREA' &&
    document.activeElement?.tagName !== 'SELECT'
  ) {
    if (anyModalOpen()) return
    event.preventDefault()
    openGuideModal()
    return
  }
  // Pop Modal Keyboard Shortcuts
  if (!pop.hidden) {
    const ae = document.activeElement as HTMLElement | null
    const onCopyField = ae === copyActiveInput
    const onTextControl =
      !onCopyField && Boolean(ae?.closest('input, textarea, select, [contenteditable="true"]'))
    const allowFormatKeys = !ae || ae.tagName !== 'INPUT' || onCopyField
    if (event.key === 'ArrowLeft' && !onTextControl) {
      event.preventDefault()
      navigatePop(-1)
    } else if (event.key === 'ArrowRight' && !onTextControl) {
      event.preventDefault()
      navigatePop(1)
    } else if (event.key === '1' && allowFormatKeys) {
      event.preventDefault()
      activeCopyFormat = 'md'
      saveCopyFormat(activeCopyFormat)
      updateActiveCopyField()
    } else if (event.key === '2' && allowFormatKeys) {
      event.preventDefault()
      activeCopyFormat = 'url'
      saveCopyFormat(activeCopyFormat)
      updateActiveCopyField()
    } else if (event.key === '3' && allowFormatKeys) {
      event.preventDefault()
      activeCopyFormat = 'html'
      saveCopyFormat(activeCopyFormat)
      updateActiveCopyField()
    } else if (event.key === '4' && allowFormatKeys) {
      event.preventDefault()
      activeCopyFormat = 'bbcode'
      saveCopyFormat(activeCopyFormat)
      updateActiveCopyField()
    } else if (event.key === ' ') {
      if (popGroupAction.hidden) return
      const ae = document.activeElement as HTMLElement | null
      const onInteractive = ae?.closest('button, input, select, textarea, a[href], [role="tab"]')
      if (onInteractive) return
      event.preventDefault()
      popToggleGroupBtn.click()
    }
    return
  }

  // Grid keyboard navigation only on the grid shell or the roving card
  // (not nested chips, empty CTAs, or card overlay buttons).
  if (pop.hidden && codeModal.hidden && guideModal.hidden && confirmModal.hidden) {
    const active = document.activeElement as HTMLElement | null
    const onRovingCard = Boolean(active?.closest?.('.card[data-item-index]'))
    if (active === grid || onRovingCard) {
      const cols = gridColumnCount()
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        moveKeyboardFocus(1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        moveKeyboardFocus(-1)
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        moveKeyboardFocus(cols)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        moveKeyboardFocus(-cols)
      } else if (event.key === 'Enter' || event.key === ' ') {
        if (keyboardFocusIndex < 0 && active === grid) {
          event.preventDefault()
          moveKeyboardFocus(0)
          openKeyboardFocused()
        } else if (keyboardFocusIndex >= 0 && (active === grid || onRovingCard)) {
          event.preventDefault()
          openKeyboardFocused()
        }
      }
    }
  }
})

grid.addEventListener('scroll', () => {
  const header = document.querySelector('.gallery__header')
  header?.classList.toggle('is-scrolled', grid.scrollTop > 8)
}, { passive: true })

// App Bootstrapping
let dockLeaveTimer: number | null = null

function showSelectionDock(): void {
  if (dockLeaveTimer !== null) {
    window.clearTimeout(dockLeaveTimer)
    dockLeaveTimer = null
  }
  selectionDock.classList.remove('is-leaving')
  selectionDock.hidden = false
  document.body.classList.add('has-selection-dock')
  exportToolbar.toggleAttribute('inert', true)
  exportToolbar.setAttribute('aria-hidden', 'true')
}

function hideSelectionDock(): void {
  if (selectionDock.hidden && !selectionDock.classList.contains('is-leaving')) {
    document.body.classList.remove('has-selection-dock')
    exportToolbar.toggleAttribute('inert', false)
    exportToolbar.setAttribute('aria-hidden', 'false')
    return
  }
  if (selectionDock.classList.contains('is-leaving')) return
  document.body.classList.remove('has-selection-dock')
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const finishHide = (): void => {
    selectionDock.hidden = true
    selectionDock.classList.remove('is-leaving')
    dockLeaveTimer = null
    exportToolbar.toggleAttribute('inert', false)
    exportToolbar.setAttribute('aria-hidden', 'false')
    syncSelectionDockOffset()
  }
  if (reduceMotion) {
    finishHide()
    return
  }
  selectionDock.classList.add('is-leaving')
  if (dockLeaveTimer !== null) window.clearTimeout(dockLeaveTimer)
  dockLeaveTimer = window.setTimeout(finishHide, 220)
}

function syncGuideExportTable(): void {
  const tbody = document.querySelector<HTMLTableSectionElement>('#guide-export-tbody')
  if (!tbody) return
  tbody.replaceChildren()
  for (const fmt of listExportFormats()) {
    if (!fmt.guideTarget && !fmt.guideFilename && !fmt.dock && !fmt.toolbar && !fmt.preview) continue
    const tr = document.createElement('tr')
    const name = document.createElement('td')
    const strong = document.createElement('strong')
    strong.textContent = fmt.label
    name.append(strong)
    const target = document.createElement('td')
    target.textContent = fmt.guideTarget ?? (fmt.dock || fmt.toolbar ? '扩展注册格式' : '代码预览格式')
    const file = document.createElement('td')
    const code = document.createElement('code')
    code.textContent = fmt.guideFilename ?? `${fmt.id}.json`
    file.append(code)
    tr.append(name, target, file)
    tbody.append(tr)
  }
}

function syncExportChrome(): void {
  const preferred = loadExportFormat()
  selectionDockFormat.replaceChildren()
  for (const fmt of dockExportFormats()) {
    const opt = document.createElement('option')
    opt.value = fmt.id
    opt.textContent = fmt.label
    selectionDockFormat.append(opt)
  }
  selectionDockFormat.value = preferred
  if (selectionDockFormat.value !== preferred) selectionDockFormat.value = 'smoji'

  exportToolbar.querySelectorAll('.export-btn').forEach((el) => el.remove())
  for (const fmt of toolbarExportFormats()) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'export-btn'
    btn.dataset.format = fmt.id
    btn.textContent = fmt.label
    btn.title = `导出为 ${fmt.label}`
    btn.setAttribute('aria-label', btn.title)
    btn.disabled = true
    exportToolbar.append(btn)
  }
  exportButtons = [...exportToolbar.querySelectorAll<HTMLButtonElement>('.export-btn')]

  codeModalTabs.replaceChildren()
  const previewFormats = previewExportFormats()
  previewFormats.forEach((fmt, index) => {
    const tab = document.createElement('button')
    tab.type = 'button'
    tab.className = 'code-tab'
    tab.id = `code-tab-${fmt.id}`
    tab.dataset.codeFormat = fmt.id
    tab.setAttribute('role', 'tab')
    tab.setAttribute('aria-controls', 'code-preview-panel')
    const on = fmt.id === currentCodeFormat || (index === 0 && !previewFormats.some((f) => f.id === currentCodeFormat))
    tab.classList.toggle('is-active', on)
    tab.setAttribute('aria-selected', String(on))
    tab.tabIndex = on ? 0 : -1
    tab.textContent = fmt.label
    const tabLabel = fmt.guideTarget ? `${fmt.label}：${fmt.guideTarget}` : fmt.label
    tab.title = tabLabel
    tab.setAttribute('aria-label', tabLabel)
    codeModalTabs.append(tab)
  })
  codeTabs = [...codeModalTabs.querySelectorAll<HTMLButtonElement>('.code-tab')]
  if (!previewFormats.some((f) => f.id === currentCodeFormat) && previewFormats[0]) {
    currentCodeFormat = previewFormats[0].id
  }
  const activeCodeTab = codeTabs.find((t) => t.classList.contains('is-active'))
  if (activeCodeTab?.id) codeModalBody.setAttribute('aria-labelledby', activeCodeTab.id)

  syncGuideExportTable()
}

async function boot(): Promise<void> {
  syncPlatformShortcutHints()
  syncExportChrome()
  onExportRegistryChange(() => {
    syncExportChrome()
    updateExportState()
    if (!codeModal.hidden) updateCodePreview(currentCodeFormat)
  })
  ensureDockOffsetObserver()
  applyTheme(currentTheme)
  syncGuideLimitCopy()
  densityToggle.setAttribute('aria-keyshortcuts', 'Control+D Meta+D')
  document.body.classList.toggle('density-comfortable', isComfortableDensity)
  densityLabel.textContent = isComfortableDensity ? '舒适' : '紧凑'
  syncDensityAriaLabel()
  if (mode !== 'custom' && galleryView === 'picked') galleryView = 'active'
  syncGalleryViewChips()
  galleryTitle.textContent = '正在加载表情清单…'
  galleryMain.setAttribute('aria-busy', 'true')
  grid.replaceChildren()
  const skeleton = document.createElement('div')
  skeleton.className = 'grid-skeleton'
  skeleton.setAttribute('aria-hidden', 'true')
  for (let i = 0; i < 24; i++) {
    const cell = document.createElement('div')
    cell.className = 'grid-skeleton__cell'
    skeleton.append(cell)
  }
  grid.append(skeleton)

  try {
    const [manifest] = await Promise.all([import.meta.env.PROD ? parseSmojiManifest(publishedManifest, manifestUrl) : loadSmojiManifest(manifestUrl), loadAssetAliases()])
    packs = manifest.packs
    rebuildItemIndex()

    // Migrate local selections after asset naming changes, before dropping stale references.
    const excluded = [...excludedItemSrcs].map((src) => canonicalAssetSrc(src, manifestUrl))
    excludedItemSrcs.clear()
    excluded.forEach((src) => excludedItemSrcs.add(src))
    migratePackSelection(selectedPackIds, excludedItemSrcs, packs, manifestUrl)
    const recentSrcs = new Set<string>()
    recentEntries = recentEntries.map((entry) => {
      const src = canonicalAssetSrc(entry.src, manifestUrl)
      const resolved = itemBySrc.get(src)
      return { ...entry, src, packId: resolved?.pack.id ?? entry.packId, label: resolved?.item.label ?? entry.label }
    }).filter((entry) => {
      if (recentSrcs.has(entry.src)) return false
      recentSrcs.add(entry.src)
      return true
    })
    localStorage.setItem('smoji-workbench:recent-srcs', JSON.stringify(recentEntries))

    // Drop stale selected ids that no longer exist
    for (const id of [...selectedPackIds]) {
      if (!packs.some((p) => p.id === id)) selectedPackIds.delete(id)
    }

    const restored = loadCustomPacks(resolveItemBySrc)
    customPacks.splice(0, customPacks.length, ...restored.packs)
    activeCustomPackIndex = restored.activeIndex
    if (activeCustomPackIndex >= 0 && customPacks[activeCustomPackIndex]) {
      customPacks.forEach((pack, index) => {
        pack.isExpanded = index === activeCustomPackIndex
      })
    }
    applyLoadedExtensions(true)
    syncWorkbenchExtensionPrefs()

    document.body.classList.toggle('mode-custom', mode === 'custom')
    tabPacks.classList.toggle('is-active', mode === 'packs')
    tabPacks.setAttribute('aria-selected', String(mode === 'packs'))
    tabPacks.tabIndex = mode === 'packs' ? 0 : -1
    tabCustom.classList.toggle('is-active', mode === 'custom')
    tabCustom.setAttribute('aria-selected', String(mode === 'custom'))
    tabCustom.tabIndex = mode === 'custom' ? 0 : -1
    customBuilder.hidden = mode !== 'custom'
    sourcePacksLabel.textContent = mode === 'custom' ? '浏览源分类' : '表情分类'
    syncSourcePacksTabpanel()
    // Prefer localStorage dock format first; smoji.workbench extension may already have overridden above.

    updateSidebarFoot()
    renderPackNav()
    renderCustomPackList()
    renderRecentStrip()
    renderGrid()
    workbenchReady = true
    persistWorkbenchState()
    galleryMain.removeAttribute('aria-busy')
    updateExportState()
    updateActiveCopyField()
  } catch (error) {
    const msg = error instanceof Error ? error.message : '加载失败'
    galleryTitle.textContent = msg
    galleryMain.removeAttribute('aria-busy')
    if (gridStatus) {
      gridStatus.setAttribute('aria-live', 'assertive')
      gridStatus.textContent = `清单加载失败：${msg}`
    }
    packNav.replaceChildren()
    const sideRetry = document.createElement('button')
    sideRetry.type = 'button'
    sideRetry.className = 'btn-ghost'
    sideRetry.style.margin = '0.75rem'
    sideRetry.textContent = '重试加载清单'
    sideRetry.setAttribute('aria-label', '重试加载表情清单')
    sideRetry.addEventListener('click', () => {
      void boot()
    })
    packNav.append(sideRetry)
    sidebarFoot.hidden = false
    sidebarFoot.textContent = '清单加载失败'
    grid.replaceChildren()
    const alert = document.createElement('div')
    alert.className = 'grid__empty'
    alert.setAttribute('role', 'alert')
    const alertText = document.createElement('p')
    alertText.textContent = `无法加载表情清单：${msg}`
    const retry = document.createElement('button')
    retry.type = 'button'
    retry.className = 'btn-ghost'
    retry.textContent = '重试加载'
    retry.setAttribute('aria-label', '重试加载表情清单')
    retry.addEventListener('click', () => {
      void boot()
    })
    alert.append(alertText, retry)
    grid.append(alert)
    workbenchReady = true
    updateExportState()
    showToast('清单加载失败，请检查网络或配置', 'error')
  }
}

void boot()
