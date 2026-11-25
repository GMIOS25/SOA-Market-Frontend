import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import checkout from '@/locales/vi/checkout.json'
import common from '@/locales/vi/common.json'
import nav from '@/locales/vi/nav.json'
import orders from '@/locales/vi/orders.json'
import paymentShipping from '@/locales/vi/paymentShipping.json'
import sellerOrders from '@/locales/vi/sellerOrders.json'
import shared from '@/locales/vi/shared.json'
import status from '@/locales/vi/status.json'

// Toàn bộ chuỗi giao diện tách vào locales/vi/*.json (NFR-USA-001).
export const defaultNS = 'common'
export const resources = {
  vi: { common, nav, shared, status, checkout, orders, sellerOrders, paymentShipping },
} as const

void i18n.use(initReactI18next).init({
  lng: 'vi',
  fallbackLng: 'vi',
  defaultNS,
  ns: ['common', 'nav', 'shared', 'status', 'checkout', 'orders', 'sellerOrders', 'paymentShipping'],
  resources,
  interpolation: { escapeValue: false },
})

export default i18n
