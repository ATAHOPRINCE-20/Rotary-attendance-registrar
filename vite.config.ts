import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    VitePWA({
      // Auto-update the service worker silently in the background
      registerType: 'autoUpdate',
      // Include the service worker in the build output
      injectRegister: 'auto',
      // Precache all app shell assets
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Don't cache Supabase API calls — always fetch fresh
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/rest/, /^\/auth/],
        runtimeCaching: [
          {
            // Cache landing images (stale-while-revalidate)
            urlPattern: /\/assets\/landing\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'landing-images',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Cache app icons and logos
            urlPattern: /\/assets\/.*\.(png|svg|ico)/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-icons',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
        ],
      },
      // Use the existing manifest.json values
      manifest: {
        name: 'Rotary Connect — Attendance & Events',
        short_name: 'RotaryConnect',
        description: 'Streamline Rotary event registration, QR check-ins, and community engagement.',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#081c3b',
        theme_color: '#17458F',
        categories: ['productivity', 'utilities'],
        icons: [
          {
            src: '/assets/rotary_gold_logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/assets/rotary_gold_logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Admin Dashboard',
            short_name: 'Dashboard',
            url: '/admin/dashboard',
            description: 'Open the admin dashboard',
          },
        ],
      },
      // Dev mode: also enable SW in local dev server
      devOptions: {
        enabled: false, // keep disabled in dev to avoid HMR conflicts
      },
    }),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})

