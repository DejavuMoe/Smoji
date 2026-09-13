import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: {
    '@': resolve(import.meta.dirname, 'apps/workbench/src'),
    'smoji/manifest': resolve(import.meta.dirname, 'packages/smoji/src/manifest.ts'),
    'smoji/marker': resolve(import.meta.dirname, 'packages/smoji/src/marker.ts'),
  } },
  test: {
    environment: 'jsdom',
    globals: true,
    include: [
      'packages/smoji/test/**/*.test.ts',
      'apps/workbench/src/**/*.test.ts',
      'apps/workbench/src/**/*.test.tsx',
    ],
  },
})
