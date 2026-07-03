import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import fs from 'fs'
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

export default defineConfig(({ mode }) => {
  // Load environment variables from .env file and merge into process.env so serverless functions can read them
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
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
            sizes: '447x447',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/assets/rotary_gold_logo.png',
            sizes: '447x447',
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
    {
      name: 'local-api-serverless-runner',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url && req.url.startsWith('/api/')) {
            const urlObj = new URL(req.url, 'http://localhost');
            const apiPath = urlObj.pathname;
            const filename = apiPath.replace('/api/', '') + '.ts';
            const filePath = path.resolve('api', filename);
            console.log(`[Local API Runner] Request: ${req.url} -> filename: ${filename} -> filePath: ${filePath}`);
            console.log(`[Local API Runner] Exists: ${fs.existsSync(filePath)}`);

            try {
              if (fs.existsSync(filePath)) {
                // Dynamically compile and load the serverless function module using Vite SSR
                const module = await server.ssrLoadModule(filePath);
                const handler = module.default;

                if (typeof handler === 'function') {
                  // Parse POST/PUT request body
                  let body = {};
                  if (req.method === 'POST' || req.method === 'PUT') {
                    body = await new Promise((resolve) => {
                      let data = '';
                      req.on('data', chunk => data += chunk);
                      req.on('end', () => {
                        try {
                          resolve(JSON.parse(data));
                        } catch {
                          resolve({});
                        }
                      });
                    });
                  }

                  // Construct query parameters
                  const query: Record<string, string> = {};
                  urlObj.searchParams.forEach((val, key) => {
                    query[key] = val;
                  });

                  // Mock Vercel request and response wrappers
                  const vercelReq = Object.assign(req, { body, query }) as any;
                  const vercelRes = {
                    status(code: number) {
                      res.statusCode = code;
                      return vercelRes;
                    },
                    json(jsonVal: any) {
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify(jsonVal));
                      return vercelRes;
                    },
                    setHeader(name: string, value: string) {
                      res.setHeader(name, value);
                      return vercelRes;
                    },
                    end(data?: any) {
                      res.end(data);
                      return vercelRes;
                    }
                  } as any;

                  await handler(vercelReq, vercelRes);
                  return;
                }
              }
            } catch (err: any) {
              console.error('Error running serverless function locally:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
              return;
            }
          }
          next();
        });
      }
    },
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})

