import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-192x192.png', 'pwa-512x512.png', 'icon-monochrome.svg'],
      manifest: {
        name: 'interstitial journal',
        short_name: 'interstitial',
        description: 'A personal interstitial journal for notes, tasks, and ideas.',
        theme_color: '#f2ebe0',
        background_color: '#f2ebe0',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-monochrome.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'monochrome'
          }
        ]
      }
    })
  ],
})