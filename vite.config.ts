import { defineConfig, type Plugin } from 'vite'
import { resolve } from 'path'

// serve /kit and /kit2 (no trailing slash) by redirecting to the directory index
const kitRoutes: Plugin = {
  name: 'kit-routes',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === '/kit' || req.url === '/kit2' || req.url === '/editor') req.url += '/'
      next()
    })
  },
}

export default defineConfig(({ mode }) => ({
  // Relative asset paths: itch.io (and other portals) serve the game from a deeply nested
  // CDN path, so absolute /assets URLs would 404 there. Dev server is unaffected.
  base: './',
  plugins: [kitRoutes],
  server: { port: 5173 },
  build: {
    // 'hidden' emits .map files for error-tracking upload (Sentry) but does NOT append the
    // //# sourceMappingURL comment — so the browser never fetches them and the source stays
    // effectively private in production, while stack traces remain de-minifiable server-side.
    sourcemap: 'hidden',
    rollupOptions: {
      // Engine libs change rarely — a separate vendor chunk lets browsers cache them across
      // game updates and downloads both chunks in parallel on first load.
      output: { manualChunks: { vendor: ['pixi.js', 'gsap', 'pixi-filters'] } },
      // kit/kit2 are internal component galleries and editor is a dev tool — served by the
      // dev server but excluded from the production bundle (weight + no editor backdoor).
      input:
        mode === 'production'
          ? { main: resolve(__dirname, 'index.html') }
          : {
              main: resolve(__dirname, 'index.html'),
              kit: resolve(__dirname, 'kit/index.html'),
              kit2: resolve(__dirname, 'kit2/index.html'),
              editor: resolve(__dirname, 'editor/index.html'),
            },
    },
  },
}))
