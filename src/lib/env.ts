const demoMode = import.meta.env.VITE_DEMO_MODE === 'true'
const allowDevDemoTokens = import.meta.env.DEV && demoMode

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  demoMode,
  paymentDemoToken: allowDevDemoTokens ? (import.meta.env.VITE_PAYMENT_DEMO_TOKEN ?? '') : '',
  shippingDemoToken: allowDevDemoTokens ? (import.meta.env.VITE_SHIPPING_DEMO_TOKEN ?? '') : '',
} as const
