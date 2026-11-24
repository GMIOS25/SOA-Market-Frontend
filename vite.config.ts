/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Traefik API Gateway of soa-market-backend (entrypoint `web` on :80).
  const gatewayTarget = env.VITE_DEV_GATEWAY_TARGET || 'http://localhost'
  const demoProxy: Record<string, ProxyOptions> = env.VITE_DEMO_MODE === 'true' ? {
    '/mock/pay': { target: env.DEMO_PAYMENT_PROXY_TARGET || 'http://localhost:8085', changeOrigin: true },
    '/mock/ship': { target: env.DEMO_SHIPPING_PROXY_TARGET || 'http://localhost:8086', changeOrigin: true },
  } : {}

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
        ...demoProxy,
      },
    },
    preview: { port: 4173 },
    test: {
      environment: 'node',
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }
})
