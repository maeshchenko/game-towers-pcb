import { defineConfig, type Plugin } from 'vite'
import { resolve } from 'path'

// serve /kit and /kit2 (no trailing slash) by redirecting to the directory index
const kitRoutes: Plugin = {
  name: 'kit-routes',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === '/kit' || req.url === '/kit2') req.url += '/'
      next()
    })
  },
}

export default defineConfig({
  plugins: [kitRoutes],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        kit: resolve(__dirname, 'kit/index.html'),
        kit2: resolve(__dirname, 'kit2/index.html'),
      },
    },
  },
})
