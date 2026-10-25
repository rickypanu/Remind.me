import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Service worker (finding P10). What changed and why:
//  * One caching strategy for the app itself: everything Vite builds is PRECACHED with content hashes, so a new
//    release replaces files exactly once. The old catch-all "app-cache" StaleWhileRevalidate rule matched the same
//    requests a second time (double storage, and it could serve a stale script next to a fresh index.html).
//  * registerType "prompt": a new version waits until the user agrees (see components/UpdatePrompt.jsx) instead of
//    skipWaiting + clientsClaim swapping code under an open session, mid-edit.
//  * No private plugin internals are touched any more (the `_pwaOptions.workbox.globStrict` deletion is gone), and
//    the 4 MB size limit is back to the default: code splitting (P1) keeps every file small.
const pwaPlugin = VitePWA({
  registerType: 'prompt',
  injectRegister: false, // registration happens in src/components/UpdatePrompt.jsx
  manifest: false, // public/manifest.json is the single manifest
  includeAssets: ['favicon.ico', 'favicon-*.png', 'apple-touch-icon.png', 'icon-*.png'],
  workbox: {
    // Loads the push / notification / background-sync handlers inside the generated sw.js
    importScripts: ['/push-sw.js'],

    // App shell: every built file is precached, so the app opens and navigates with no connection.
    globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
    // The social-share card and screenshots are not needed offline; keep them out of the install download.
    globIgnores: ['og-image.png', 'screenshot-*.png', 'app-shell.html'],
    cleanupOutdatedCaches: true,

    // Any page URL (/dashboard, /create-task, /profile ...) is answered with the cached index.html and
    // React Router takes over. API calls and avatar images are never answered with HTML.
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/uploads\//, /^\/v1\//, /^\/api\//, /\.[a-z0-9]+$/i],

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
      // NOTE: /v1/** API data is deliberately NOT cached here. It lives in IndexedDB (src/offline),
      // where it can be edited offline and synced.
    ],
  },
})

export default defineConfig(({ mode }) => {
  // A production build WITHOUT VITE_API_BASE_URL silently points the app at http://localhost:8000, which the browser
  // blocks on a deployed https site (CSP + mixed content): login, sign-up and every list then fail. Stop the build
  // instead, with a message that says what to set.
  if (mode === 'production') {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    const api = (env.VITE_API_BASE_URL || '').trim()
    if (!/^https:\/\/[^/\s]+/i.test(api) && !process.env.ALLOW_LOCAL_API_BUILD) {
      throw new Error(
        'VITE_API_BASE_URL must be set to your deployed API (https://<name>.onrender.com, no trailing slash) for a ' +
          'production build. On Vercel: Project > Settings > Environment Variables, then redeploy. ' +
          'For a local production preview set ALLOW_LOCAL_API_BUILD=1.',
      )
    }
  }
  return { plugins: [react(), tailwindcss(), babel({ presets: [reactCompilerPreset()] }), pwaPlugin] }
})
