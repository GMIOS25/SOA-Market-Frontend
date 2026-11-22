import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import common from '@/locales/vi/common.json'

// Toàn bộ chuỗi giao diện tách vào locales/vi/*.json (NFR-USA-001).
export const defaultNS = 'common'
export const resources = {
  vi: { common },
} as const

void i18n.use(initReactI18next).init({
  lng: 'vi',
  fallbackLng: 'vi',
  defaultNS,
  ns: [defaultNS],
  resources,
  interpolation: { escapeValue: false },
})

export default i18n
