import { useEffect, useRef, useState } from 'react'
import { ChevronUp, X } from 'lucide-react'
import type { SmojiItem } from 'smoji'
import { useWorkbench } from './WorkbenchContext'
import { useMediaQuery } from '../hooks/use-media-query'
import { hasOpenOverlay, isEditing } from '../keyboard'
import { MobileTop, Rail } from '../features/Chrome'
import { PackList } from '../features/PackList'
import { Gallery } from '../features/Gallery'
import { Kit, ModeSwitch } from '../features/Kit'
import { useExportDownload } from '../features/ExportBar'
import { Inspector } from '../features/Inspector'
import { Preview } from '../features/Preview'
import { Help } from '../features/Help'
import { Toasts } from '../features/Toasts'
import { Sheet } from '../ui/overlays'

export function App() {
  const { state, dispatch, storageWarning, dismissStorageWarning, mobileDrawerOpen, setMobileDrawerOpen } = useWorkbench()
  const desktop = useMediaQuery('(min-width: 900px)')
  const [kitOpen, setKitOpen] = useState(false)
  const navRef = useRef<readonly SmojiItem[]>([])
  const { canExport, download } = useExportDownload()

  // Two copies of the pack list or kit must never coexist across the breakpoint.
  useEffect(() => {
    if (desktop) { setMobileDrawerOpen(false); setKitOpen(false) }
  }, [desktop, setMobileDrawerOpen])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.altKey || isEditing(event.target) || hasOpenOverlay()) return
      const mod = event.metaKey || event.ctrlKey
      if (!mod && event.key === '?') {
        event.preventDefault()
        dispatch({ type: 'SET_HELP_DIALOG_OPEN', payload: true })
      } else if (mod && !event.shiftKey && event.key.toLowerCase() === 'e' && canExport) {
        event.preventDefault()
        download()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dispatch, canExport, download])

  return (
    <div className="app" data-mode={state.mode}>
      <a href="#grid" className="skip-link">跳到表情图库</a>
      {desktop
        ? <Rail />
        : <MobileTop drawerOpen={mobileDrawerOpen} onOpenDrawer={() => setMobileDrawerOpen(true)} />}

      <main className="stage">
        {storageWarning && (
          <div className="banner" role="alert">
            <span>{storageWarning}</span>
            <button type="button" className="icon-btn icon-btn--sm" aria-label="忽略存储警告" onClick={dismissStorageWarning}><X aria-hidden="true" /></button>
          </div>
        )}
        <Gallery navRef={navRef} />
      </main>

      {desktop ? (
        <aside className="kit-col"><Kit /></aside>
      ) : (
        <MobileBar onOpen={() => setKitOpen(true)} />
      )}

      {!desktop && (
        <>
          <Sheet id="mobile-sidebar" side="left" title="表情分类" open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}
            fallbackSelector="#grid" returnSelector="#menu-toggle">
            <PackList showTitle={false} onNavigate={() => setMobileDrawerOpen(false)} />
          </Sheet>
          <Sheet id="kit-sheet" side="bottom" title="导出" open={kitOpen} onOpenChange={setKitOpen} fallbackSelector="#grid" returnSelector="#kit-open">
            <Kit showModeSwitch={false} onNavigate={() => setKitOpen(false)} />
          </Sheet>
        </>
      )}

      <Inspector navRef={navRef} />
      {state.export.codeDialogOpen && <Preview />}
      {state.export.helpDialogOpen && <Help />}
      <Toasts />
    </div>
  )
}

function MobileBar({ onOpen }: { onOpen: () => void }) {
  const { state, exportItemCount, activeCustomGroup } = useWorkbench()
  const isCustom = state.mode === 'custom'
  return (
    <div className="mbar" data-fly-target="bar">
      <ModeSwitch size="sm" />
      <button id="kit-open" type="button" className="mbar__open" aria-haspopup="dialog" onClick={onOpen}>
        <span className="mbar__sum">
          <strong>{exportItemCount}</strong> 张
          {isCustom && activeCustomGroup && <em>「{activeCustomGroup.label}」</em>}
        </span>
        <span className="mbar__cta">导出<ChevronUp aria-hidden="true" /></span>
      </button>
    </div>
  )
}
