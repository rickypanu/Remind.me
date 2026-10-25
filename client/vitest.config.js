import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.js on purpose: tests do not need Tailwind, the React Compiler
// or the PWA plugin, and skipping them keeps the test run fast and deterministic.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
    clearMocks: true,
    restoreMocks: true,
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/test/**', 'src/**/*.{test,spec}.{js,jsx}', 'src/main.jsx'],
    },
  },
})
