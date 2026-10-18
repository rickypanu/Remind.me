import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const pwaPlugin = VitePWA({
  registerType: 'autoUpdate',
  manifest: false,
  includeAssets: ['favicon.ico', 'favicon-*.png', 'apple-touch-icon.png', 'icon-*.png', 'robots.txt'],
  workbox: {
    // Loads your push / notification / background-sync handlers inside the generated sw.js
    importScripts: ['/push-sw.js'],

    // 1. App shell: every built file is precached, so the app opens and navigates with no connection.
    globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2,json}'],
    maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: true,

    // Any page URL (/dashboard, /create-task, /profile ...) is answered with the cached index.html and
    // React Router takes over. API calls and avatar images are never answered with HTML.
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/uploads\//, /^\/api\//, /\.[a-z0-9]+$/i],

    runtimeCaching: [
      // Google Fonts: stylesheet (revalidated) + font files (immutable)
      {
        urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'google-fonts-css' },
      },
      {
        urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-files',
          cacheableResponse: { statuses: [0, 200] },
          expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
        },
      },
      // Profile pictures served by the API
      {
        urlPattern: ({ url }) => url.pathname.startsWith('/uploads/avatars/'),
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'avatars',
          cacheableResponse: { statuses: [0, 200] },
          expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      // Everything else the app loads itself
      {
        urlPattern: ({ request }) =>
          request.destination === 'document' ||
          request.destination === 'script' ||
          request.destination === 'style' ||
          request.destination === 'image',
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'app-cache', cacheableResponse: { statuses: [0, 200] } },
      },
      // NOTE: /tasks, /user ... API data is deliberately NOT cached here. It lives in IndexedDB
      // (src/offline), where it can be edited offline and synced.
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