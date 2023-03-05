import { resolve } from 'node:path'
import { build } from 'vite'

const outDir = resolve(import.meta.dirname, '../packages/smoji/dist')
const src = resolve(import.meta.dirname, '../packages/smoji/src')

const minify = {
  minify: 'terser',
  terserOptions: {
    compress: {
      passes: 5,
      unsafe: true,
      unsafe_arrows: true,
      pure_getters: true,
    },
    format: { comments: false },
  },
}

async function buildEntry(entry) {
  await build({
    configFile: false,
    build: {
      ...minify,
      lib: {
        entry,
        formats: ['es'],
        fileName: (_format, entryName) => `${entryName}.js`,
      },
      outDir,
      emptyOutDir: false,
      cssCodeSplit: true,
      cssMinify: true,
      rollupOptions: {
        output: { assetFileNames: 'style.css' },
      },
    },
    logLevel: 'warn',
  })
}

// Separate builds so shared modules are inlined into each entry.
await buildEntry({
  index: resolve(src, 'index.ts'),
  style: resolve(src, 'style.css'),
})
await buildEntry({
  manifest: resolve(src, 'manifest.ts'),
})
await buildEntry({
  marker: resolve(src, 'marker.ts'),
})
