import { StrictMode, useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { loadSmojiManifest } from 'smoji/manifest'
import type { SmojiPack } from 'smoji'
import hosting from '../../../../data/hosting.json'
import { loadAssetAliases } from '@wb/asset-paths'
import { ErrorBoundary } from '@wb/app/ErrorBoundary'
import { WorkbenchProvider } from '@wb/app/WorkbenchProvider'
import { App } from './app/App'
import { BootError, BootLoading } from './app/Boot'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/gallery.css'
import './styles/kit.css'
import './styles/overlays.css'

// Review-only state switches (?demo=loading | catalog-error | storage-error); no visible control.
const demo = new URLSearchParams(window.location.search).get('demo')
if (demo === 'storage-error') {
  const setItem = Storage.prototype.setItem
  Storage.prototype.setItem = function (key: string, value: string) {
    if (key.startsWith('smoji-prototype-v2:')) throw new DOMException('Quota exceeded', 'QuotaExceededError')
    return setItem.call(this, key, value)
  }
}

const catalogUrl = new URL('smoji.json', window.location.href).href
const manifestUrl = new URL('smoji.json', hosting.assetBaseUrl).href

function Root() {
  const [packs, setPacks] = useState<readonly SmojiPack[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      if (demo === 'loading') return await new Promise<never>(() => {})
      if (demo === 'catalog-error') throw new Error('清单请求失败（HTTP 503）')
      const [manifest] = await Promise.all([loadSmojiManifest(catalogUrl, { imageBaseUrl: manifestUrl }), loadAssetAliases()])
      setPacks(manifest.packs)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : '清单加载失败')
    }
  }, [])

  useEffect(() => { void load() }, [load])

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

createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>)
