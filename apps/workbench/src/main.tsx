import { StrictMode, useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { loadSmojiManifest } from 'smoji/manifest'
import type { SmojiPack } from 'smoji'
import hosting from '../../../data/hosting.json'
import { loadAssetAliases } from './asset-paths'
import { App } from './app/App'
import { BootError, BootLoading } from './app/Boot'
import { ErrorBoundary } from './app/ErrorBoundary'
import { WorkbenchProvider } from './app/WorkbenchProvider'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/gallery.css'
import './styles/kit.css'
import './styles/overlays.css'

export { showToast } from './features/feedback/toast'

// The build emits the same-version catalog next to the app; the published CDN copy is only a fallback.
const catalogUrl = new URL(`${import.meta.env.BASE_URL}smoji.json`, window.location.href).href
const publishedManifestUrl = new URL('smoji.json', hosting.assetBaseUrl).href
const manifestUrl = import.meta.env.PROD ? publishedManifestUrl : catalogUrl

async function loadCatalog() {
  try {
    return await loadSmojiManifest(catalogUrl, { imageBaseUrl: manifestUrl })
  } catch (localError) {
    if (manifestUrl === catalogUrl) throw localError
    return await loadSmojiManifest(manifestUrl)
  }
}

function Root() {
  const [packs, setPacks] = useState<readonly SmojiPack[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (isActive: () => boolean = () => true) => {
    setError(null)
    try {
      // Aliases must be ready before the provider can migrate saved groups; a failure keeps
      // the workbench unmounted so filtered data can never overwrite storage.
      const [manifest] = await Promise.all([loadCatalog(), loadAssetAliases()])
      if (isActive()) setPacks(manifest.packs)
    } catch (err) {
      if (isActive()) setError(err instanceof Error && err.message ? err.message : '清单加载失败')
    }
  }, [])

  useEffect(() => {
    let active = true
    void load(() => active)
    return () => { active = false }
  }, [load])

  if (error) return <BootError message={error} onRetry={() => void load()} />
  if (!packs) return <BootLoading />
  return (
    <ErrorBoundary>
      <WorkbenchProvider initialPacks={packs} manifestUrl={manifestUrl}>
        <App />
      </WorkbenchProvider>
    </ErrorBoundary>
  )
}

const container = document.getElementById('root')
if (container) createRoot(container).render(<StrictMode><Root /></StrictMode>)
