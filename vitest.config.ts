import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: {
    'smoji/manifest': resolve(import.meta.dirname, 'packages/smoji/src/manifest.ts'),
    'smoji/marker': resolve(import.meta.dirname, 'packages/smoji/src/marker.ts'),
  } },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['packages/smoji/test/**/*.test.ts', 'demo/src/**/*.test.ts'],
  },
})
