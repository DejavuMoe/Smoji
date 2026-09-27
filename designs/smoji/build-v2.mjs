// v2 prototype: new UI in v2-src/, production domain modules imported read-only at build time.
// `node designs/smoji/build-v2.mjs` writes v2/; `--dev` serves v2-src/ with HMR on 127.0.0.1:4312.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { build, createServer } from 'vite'

const project = import.meta.dirname
const root = resolve(project, '../..')
const workbench = resolve(root, 'apps/workbench')
const posix = (path) => path.replaceAll('\\', '/')
const wbModules = posix(resolve(workbench, 'node_modules'))
const requireWb = createRequire(resolve(workbench, 'package.json'))
const react = (await import(pathToFileURL(requireWb.resolve('@vitejs/plugin-react')).href)).default
const dev = process.argv.includes('--dev')

const json = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'))
const hosting = await json('data/hosting.json')
const catalog = await json('data/smoji.json')
// Same published shape as the production build: absolute CDN originals, catalog order unchanged.
const manifest = JSON.stringify({
  ...catalog,
  packs: catalog.packs.map((pack) => ({
    ...pack,
    items: pack.items.map((item) => ({ ...item, src: new URL(item.src, hosting.assetBaseUrl).href })),
  })),
})

const workbenchSrc = posix(resolve(workbench, 'src'))
const smojiSrc = posix(resolve(root, 'packages/smoji/src'))

const config = {
  configFile: false,
  root: resolve(project, 'v2-src'),
  base: './',
  logLevel: dev ? 'info' : 'error',
  resolve: {
    alias: [
      { find: /^smoji\/manifest$/, replacement: `${smojiSrc}/manifest.ts` },
      { find: /^smoji\/marker$/, replacement: `${smojiSrc}/marker.ts` },
      { find: /^smoji$/, replacement: `${smojiSrc}/index.ts` },
      { find: /^@wb\//, replacement: `${workbenchSrc}/` },
      { find: /^@\//, replacement: `${workbenchSrc}/` },
      { find: /^(react|react-dom|radix-ui|lucide-react)(\/.*)?$/, replacement: `${wbModules}/$1$2` },
      { find: /^@fontsource\/(.*)$/, replacement: `${posix(resolve(root, 'node_modules/@fontsource'))}/$1` },
    ],
    dedupe: ['react', 'react-dom'],
  },
  plugins: [
    react(),
    {
      name: 'smoji-v2-isolation',
      enforce: 'pre',
      // CI thumbnails are not part of the repository; the prototype shows CDN originals.
      resolveId(id) { if (id.endsWith('/data/previews.json')) return '\0v2-previews' },
      load(id) { if (id === '\0v2-previews') return 'export default {}' },
      transform(code, id) {
        if (!posix(id).startsWith(workbenchSrc)) return
        return code.replaceAll('smoji-workbench:', 'smoji-prototype-v2:').replaceAll("'smoji-theme'", "'smoji-prototype-v2:theme'")
      },
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (!req.url?.split('?')[0].endsWith('/smoji.json')) return next()
          res.setHeader('Content-Type', 'application/json')
          res.end(manifest)
        })
      },
      async generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'smoji.json', source: manifest })
        for (const [fileName, path] of [
          ['LICENSE', 'LICENSE'],
          ['OFL-ibm-plex-sans.txt', 'node_modules/@fontsource/ibm-plex-sans/LICENSE'],
          ['OFL-ibm-plex-mono.txt', 'node_modules/@fontsource/ibm-plex-mono/LICENSE'],
        ]) this.emitFile({ type: 'asset', fileName, source: await readFile(resolve(root, path)) })
      },
    },
  ],
  server: { host: '127.0.0.1', port: 4312, strictPort: true, fs: { allow: [root] } },
  build: { outDir: resolve(project, 'v2'), emptyOutDir: true, sourcemap: false, chunkSizeWarningLimit: 900 },
}

if (dev) {
  const server = await createServer(config)
  await server.listen()
  server.printUrls()
} else {
  await build(config)
  const packs = catalog.packs.length
  const items = catalog.packs.reduce((count, pack) => count + pack.items.length, 0)
  console.log(`v2: ${packs} packs / ${items} items / ${Buffer.byteLength(manifest)} bytes`)
}
