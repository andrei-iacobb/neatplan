import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // `server-only` is a build-time marker: Next resolves it and fails the
      // build if a client bundle pulls one of these modules in. Under vitest
      // there is no bundler to resolve it, so it points at an empty module.
      // Stubbing it here keeps the marker in the source, where it does its job.
      'server-only': path.resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
})
