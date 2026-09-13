import { Header } from '../features/shell/Header'
import { Sidebar } from '../features/shell/Sidebar'
import { MobileNavSheet } from '../features/shell/MobileNavSheet'
import { GalleryHeader } from '../features/gallery/GalleryHeader'
import { EmojiGrid } from '../features/gallery/EmojiGrid'
import { ExportDock } from '../features/export/ExportDock'
import { DetailInspectorDialog } from '../features/inspector/DetailInspectorDialog'
import { CodePreviewDialog } from '../features/export/CodePreviewDialog'
import { HelpDialog } from '../features/help/HelpDialog'
import { ToastContainer } from '../features/feedback/ToastContainer'

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
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Gallery Area */}
        <main className="flex flex-1 flex-col overflow-y-auto bg-background/50">
          <GalleryHeader />
          <EmojiGrid />
        </main>
      </div>

      {/* Overlays */}
      <MobileNavSheet />
      <DetailInspectorDialog />
      <CodePreviewDialog />
      <HelpDialog />
      <ExportDock />
      <ToastContainer />
    </div>
  )
}
