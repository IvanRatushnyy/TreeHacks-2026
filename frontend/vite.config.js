import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

const frontendRoot = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    fs: {
      allow: [
        frontendRoot,
        '/root/TreeHacks-2026/backend/pii-model/node_modules/@huggingface/transformers/dist',
      ],
    },
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/docs': { target: 'http://localhost:8000', changeOrigin: true },
      '/openapi.json': { target: 'http://localhost:8000', changeOrigin: true },
      '/health': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
