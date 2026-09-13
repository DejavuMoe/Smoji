import { lazy, Suspense } from 'react'
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
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      <a
        href="#grid"
        className="skip-link sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-xs focus:font-medium focus:text-primary-foreground focus:shadow-md"
      >
        跳到表情图库
      </a>

      {/* Header */}
      <Header />

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
        <CodePreviewDialog />
        <HelpDialog />
      </Suspense>
      <ExportDock />
      <ToastContainer />
    </div>
  )
}
