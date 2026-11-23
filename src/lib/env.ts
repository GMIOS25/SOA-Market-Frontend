export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  demoMode: import.meta.env.VITE_DEMO_MODE === 'true',
} as const
