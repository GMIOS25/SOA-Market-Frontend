const demoMode = import.meta.env.VITE_DEMO_MODE === 'true'
const allowDevDemoTokens = import.meta.env.DEV && demoMode

/**
 * Nguồn ảnh công khai: API trả `imageRef` dạng object key (VD `products/<shopId>/<uuid>.jpg`) trong bucket
 * `public-products` của MinIO (cho tải nặc danh), nên phải ghép với URL này. Để trống trong bản build production
 * = hiện nền thay thế ảnh. Dev mặc định về MinIO của docker-compose backend (README backend: `localhost:9000`).
 */
const mediaBaseUrl = (
  import.meta.env.VITE_MEDIA_BASE_URL ??
  (import.meta.env.DEV ? 'http://localhost:9000/public-products' : '')
).replace(/\/+$/, '')

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  demoMode,
  paymentDemoToken: allowDevDemoTokens ? (import.meta.env.VITE_PAYMENT_DEMO_TOKEN ?? '') : '',
  shippingDemoToken: allowDevDemoTokens ? (import.meta.env.VITE_SHIPPING_DEMO_TOKEN ?? '') : '',
  mediaBaseUrl,
} as const
