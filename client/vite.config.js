import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa';
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),tailwindcss(),
    babel({ presets: [reactCompilerPreset()] }),
    VitePWA({ 
      registerType: 'autoUpdate',
      manifest: false // Tells the plugin to use your existing public/manifest.json
    })
  ],
})
