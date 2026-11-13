/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages sert le site sous /<nom-du-dépôt>/ : le workflow fournit BASE_PATH.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    preact(),
    tailwindcss(),
    // PWA : manifest + service worker Workbox qui précache tout le build (JS, CSS, polices, icônes).
    // `autoUpdate` : une nouvelle version s'installe d'elle-même au prochain lancement ; l'état de la
    // partie est dans localStorage, donc rien n'est perdu au rechargement.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'PokerVice',
        short_name: 'PokerVice',
        description: 'Gérer une partie de poker cash game entre amis.',
        lang: 'fr',
        display: 'standalone',
        background_color: '#F5F1E9',
        theme_color: '#F5F1E9',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Icônes du manifest et includeAssets sont ajoutés par le plugin : pas besoin de les globber.
        globPatterns: ['**/*.{js,css,html,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
