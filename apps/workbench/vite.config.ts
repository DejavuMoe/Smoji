import { resolve } from 'node:path'
import { readFile, access } from 'node:fs/promises'
import manifest from '../../data/smoji.json'
import hosting from '../../data/hosting.json'
import publishedAliases from '../../data/published-aliases.json'
import { defineConfig } from 'vite'

const workspace = resolve(import.meta.dirname, '../..')
const smojiSrc = resolve(workspace, 'packages/smoji/src')

export default defineConfig({
  root: import.meta.dirname,
  publicDir: resolve(import.meta.dirname, 'public'),
  resolve: {
    alias: {
      'smoji/manifest': resolve(smojiSrc, 'manifest.ts'),
      'smoji/marker': resolve(smojiSrc, 'marker.ts'),
      'smoji/style.css': resolve(smojiSrc, 'style.css'),
      smoji: resolve(smojiSrc, 'index.ts'),
    },
  },
  plugins: [{
    name: 'published-asset-aliases',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname.slice(1))
          if (path === 'smoji.json') {
            res.setHeader('Content-Type', 'application/json')
            res.end(await readFile(resolve(workspace, 'data/smoji.json')))
            return
          }
          const target = (publishedAliases as Record<string, string>)[path] ?? path
          if (!/^[a-z-]+\/[a-z0-9]+\.(png|gif|webp)$/.test(target)) return next()
          try {
            await access(resolve(workspace, 'packs', target))
            req.url = `/@fs/${resolve(workspace, 'packs', target)}`
          } catch {
            res.writeHead(302, { Location: new URL(target, hosting.assetBaseUrl).href })
            res.end()
            return
          }
        } catch { /* Let Vite handle malformed URLs. */ }
        next()
      })
    },
    async generateBundle() {
      const published = { ...manifest, packs: manifest.packs.map((pack) => ({
        ...pack, items: pack.items.map((item) => ({ ...item, src: new URL(item.src, hosting.assetBaseUrl).href })),
      })) }
      this.emitFile({ type: 'asset', fileName: 'smoji.json', source: JSON.stringify(published) })
      for (const [fileName, path] of [
        ['LICENSE', 'LICENSE'],
        ['OFL-ibm-plex-sans.txt', 'node_modules/@fontsource/ibm-plex-sans/LICENSE'],
        ['OFL-ibm-plex-mono.txt', 'node_modules/@fontsource/ibm-plex-mono/LICENSE'],
      ]) {
        this.emitFile({ type: 'asset', fileName, source: await readFile(resolve(workspace, path)) })
      }
    },
  }],
  server: {
    fs: { allow: [workspace] },
  },
  build: {
    outDir: 'dist',
    manifest: true,
    emptyOutDir: true,
  },
})
