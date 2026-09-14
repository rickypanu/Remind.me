import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] }),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // Reads your public/manifest.json directly
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon-*.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,json}'],
        globStrict: false,
        navigateFallback: '/index.html',
      },
    }),
  ],
})