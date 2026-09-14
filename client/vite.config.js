import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const pwaPlugin = VitePWA({
  registerType: 'autoUpdate',
  manifest: false,
  includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon-*.png'],
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,json}'],
    navigateFallback: '/index.html',
    runtimeCaching: [
      {
        urlPattern: ({ request }) =>
          request.destination === 'document' ||
          request.destination === 'script' ||
          request.destination === 'style' ||
          request.destination === 'image',
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'app-cache',
        },
      },
    ],
  },
})

// Strip the offending globStrict key injected by the plugin
if (Array.isArray(pwaPlugin)) {
  pwaPlugin.forEach((p) => {
    if (p?._pwaOptions?.workbox) delete p._pwaOptions.workbox.globStrict
  })
} else if (pwaPlugin?._pwaOptions?.workbox) {
  delete pwaPlugin._pwaOptions.workbox.globStrict
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] }),
    pwaPlugin,
  ],
})