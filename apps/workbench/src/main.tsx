import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { loadSmojiManifest } from 'smoji/manifest'
import type { SmojiPack } from 'smoji'
import hosting from '../../../data/hosting.json'
import { loadAssetAliases } from './asset-paths'
import { App } from './app/App'
import { ErrorBoundary } from './app/ErrorBoundary'
import { WorkbenchProvider } from './app/WorkbenchProvider'
import './fonts.css'
import './styles/globals.css'

export { showToast } from './features/feedback/toast'

const manifestUrl = import.meta.env.PROD
  ? new URL('smoji.json', hosting.assetBaseUrl).href
  : new URL(`${import.meta.env.BASE_URL}smoji.json`, window.location.href).href

function Root() {
  const [packs, setPacks] = useState<SmojiPack[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        await Promise.allSettled([loadAssetAliases()])
        const manifest = await loadSmojiManifest(manifestUrl)
        if (active) setPacks(manifest.packs)
      } catch (err: any) {
        if (active) setError(err.message || '清单加载失败')
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-3 rounded-xl border border-destructive/20 bg-destructive/5 p-6">
          <h2 className="text-base font-semibold text-destructive">无法加载表情清单</h2>
          <p className="text-xs text-muted-foreground">{error}</p>
          <button
            type="button"
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() => window.location.reload()}
          >
            重试加载
          </button>
        </div>
      </div>
    )
  }

  if (!packs) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>加载表情工作台...</span>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <WorkbenchProvider initialPacks={packs} manifestUrl={manifestUrl}>
        <App />
      </WorkbenchProvider>
    </ErrorBoundary>
  )
}

const container = document.getElementById('root')
if (container) {
  const staticEl = document.getElementById('workbench-static')
  if (staticEl) staticEl.remove()

  createRoot(container).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  )
}
