import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Traefik API Gateway of soa-market-backend (entrypoint `web` on :80).
  const gatewayTarget = env.VITE_DEV_GATEWAY_TARGET || 'http://localhost'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      port: 5173,
      strictPort: true,
      // Same-origin calls in dev: /v1/* is forwarded to Traefik, mirroring production Nginx-behind-Traefik.
      proxy: {
        '/v1': { target: gatewayTarget, changeOrigin: true },
      },
    },
    preview: { port: 4173 },
  }
})
