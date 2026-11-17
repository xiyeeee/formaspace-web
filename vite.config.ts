import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const config = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      proxy: {
        '/api': { target: config.API_PROXY_TARGET || 'http://127.0.0.1:8080', changeOrigin: true },
        '/ws': { target: config.API_PROXY_TARGET || 'http://127.0.0.1:8080', changeOrigin: true, ws: true },
      },
    },
  }
})
