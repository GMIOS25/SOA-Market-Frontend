import 'i18next'
import type { defaultNS, resources } from '@/lib/i18n'

// Type-safe translation keys: t('typo') fails typecheck.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS
    resources: (typeof resources)['vi']
  }
}
