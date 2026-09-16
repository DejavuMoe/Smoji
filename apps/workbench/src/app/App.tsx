import { Button } from '../components/ui/button'
import { lazy, Suspense } from 'react'
import { useWorkbench } from './WorkbenchContext'
import { Header } from '../features/shell/Header'
import { Sidebar } from '../features/shell/Sidebar'
import { MobileNavSheet } from '../features/shell/MobileNavSheet'
import { GalleryHeader } from '../features/gallery/GalleryHeader'
import { EmojiGrid } from '../features/gallery/EmojiGrid'
import { ExportDock } from '../features/export/ExportDock'
import { DetailInspectorDialog } from '../features/inspector/DetailInspectorDialog'
import { ToastContainer } from '../features/feedback/ToastContainer'

const CodePreviewDialog = lazy(() =>
  import('../features/export/CodePreviewDialog').then((m) => ({ default: m.CodePreviewDialog })),
)
const HelpDialog = lazy(() =>
  import('../features/help/HelpDialog').then((m) => ({ default: m.HelpDialog })),
)

export function App() {
  const { state, storageWarning, dismissStorageWarning } = useWorkbench()
  return (
    <div className="h-dvh overflow-hidden bg-background text-foreground flex flex-col antialiased">
      <a
        href="#grid"
        className="skip-link sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-xs focus:font-medium focus:text-primary-foreground focus:shadow-md"
      >
        跳到表情图库
      </a>

      {/* Header */}
      <Header />

      {/* Storage failure banner: never imply the data was persisted when the browser refused */}
      {storageWarning && (
        <div
          role="alert"
          className="flex shrink-0 items-start justify-between gap-3 border-b border-warning/40 bg-warning/10 px-4 py-2 text-xs text-foreground"
        >
          <span className="min-w-0">{storageWarning}</span>
          <Button variant="ghost"
            type="button"
            className="shrink-0 rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="忽略存储警告"
            onClick={dismissStorageWarning}
          >
            ✕
          </Button>
        </div>
      )}

      {/* Main Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Gallery Area */}
        <main className="flex flex-1 flex-col min-w-0 min-h-0 overflow-y-auto bg-background/50">
          <GalleryHeader />
          <EmojiGrid />
        </main>
      </div>

      {/* Overlays */}
      <MobileNavSheet />
      <DetailInspectorDialog />
      <Suspense fallback={null}>
        {state.export.codeDialogOpen && <CodePreviewDialog />}
        {state.export.helpDialogOpen && <HelpDialog />}
      </Suspense>
      <ExportDock />
      <ToastContainer />
    </div>
  )
}
