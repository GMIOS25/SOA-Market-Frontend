import { createApiClient } from '@/api/client'
import { ApiError, unwrap } from '@/api/errors'
import type { SvcIdn, SvcOrd, SvcSel } from '@/api/generated'
import { idempotencyHeaders } from '@/api/idempotency'

export type CartView = SvcOrd.components['schemas']['CartView']
export type ShopCartGroup = SvcOrd.components['schemas']['ShopCartGroup']
export type CartItemView = SvcOrd.components['schemas']['CartItemView']
export type CartWarning = SvcOrd.components['schemas']['CartWarning']
export type UpdateCartItemRequestBody = SvcOrd.components['schemas']['UpdateCartItemRequestBody']

export type AddressSnapshot = SvcOrd.components['schemas']['AddressSnapshot']
export type CheckoutSummaryRequestBody = SvcOrd.components['schemas']['CheckoutSummaryRequestBody']
export type CheckoutSummaryView = SvcOrd.components['schemas']['CheckoutSummaryView']
export type CheckoutSummaryPackage = SvcOrd.components['schemas']['CheckoutSummaryPackage']
export type CheckoutSummaryItem = SvcOrd.components['schemas']['CheckoutSummaryItem']
export type ExcludedCheckoutItem = SvcOrd.components['schemas']['ExcludedCheckoutItem']

export type CheckoutRequestBody = SvcOrd.components['schemas']['CheckoutRequestBody']
export type CheckoutExpectedItem = SvcOrd.components['schemas']['CheckoutExpectedItem']
export type CheckoutResult = SvcOrd.components['schemas']['CheckoutResult']

export type PublicShopDTO = SvcSel.components['schemas']['PublicShopDTO']
export type AddressDTO = SvcIdn.components['schemas']['AddressDTO']
export type AddressBody = SvcIdn.components['schemas']['AddressBody']
export type AddressListResponse = SvcIdn.components['schemas']['AddressListResponseBody']

export type PaymentGateway = 'MOCK_PAY' | 'VNPAY'

export type ConflictItemDisplay = {
  key: string
  productName: string
  variantLabel?: string
  shopName?: string
  requestedQuantity?: number
  reason: string
  imageRef?: string
}

export const ordClient = createApiClient<SvcOrd.paths>()
export const selClient = createApiClient<SvcSel.paths>()
export const idnClient = createApiClient<SvcIdn.paths>()

export function apiGetCart(): Promise<CartView> {
  return unwrap(ordClient.GET('/v1/cart'))
}

export function apiUpdateCartItem(cartItemId: string, body: UpdateCartItemRequestBody): Promise<CartView> {
  return unwrap(
    ordClient.PUT('/v1/cart/items/{id}', {
      params: { path: { id: cartItemId } },
      body,
    }),
  )
}

export function apiDeleteCartItem(cartItemId: string): Promise<CartView> {
  return unwrap(
    ordClient.DELETE('/v1/cart/items/{id}', {
      params: { path: { id: cartItemId } },
    }),
  )
}

export function apiGetCheckoutSummary(body: CheckoutSummaryRequestBody): Promise<CheckoutSummaryView> {
  return unwrap(ordClient.POST('/v1/checkout/summary', { body }))
}

export function apiSubmitCheckout(
  body: CheckoutRequestBody,
  idempotencyKey: string,
): Promise<CheckoutResult> {
  return unwrap(
    ordClient.POST('/v1/checkout', {
      body,
      headers: idempotencyHeaders(idempotencyKey),
    }),
  )
}

export function apiGetPublicShop(shopId: string): Promise<PublicShopDTO> {
  return unwrap(
    selClient.GET('/v1/shops/{id}', {
      params: { path: { id: shopId } },
    }),
  )
}

export function apiListAddresses(): Promise<AddressListResponse> {
  return unwrap(idnClient.GET('/v1/users/me/addresses'))
}

export function apiCreateAddress(body: AddressBody): Promise<AddressDTO> {
  return unwrap(idnClient.POST('/v1/users/me/addresses', { body }))
}

/** SVC-IDN dùng `receiver` trong khi SVC-ORD `AddressSnapshot` dùng `contactName`. */
export function toAddressSnapshot(address: AddressDTO): AddressSnapshot {
  return {
    contactName: address.receiver,
    phone: address.phone,
    line: address.line,
    ward: address.ward,
    district: address.district,
    province: address.province,
  }
}

export function fallbackShopName(shopId: string): string {
  return `Gian hàng #${shopId.slice(0, 8).toUpperCase()}`
}

const STOCK_OR_AVAILABILITY_CODES = new Set([
  'INSUFFICIENT_STOCK',
  'ITEM_UNAVAILABLE',
  'PRICE_CHANGED',
  'SHIPPING_FEE_CHANGED',
  'SHOP_NOT_ACTIVE',
  'NO_VALID_ITEMS_FOR_CHECKOUT',
  'EMPTY_CHECKOUT_SELECTION',
])

export function isStockOrAvailabilityConflict(error: ApiError): boolean {
  return (error.status === 409 || error.status === 422) && STOCK_OR_AVAILABILITY_CODES.has(error.code)
}

/**
 * Ánh xạ `details[].field` từ Huma Error Model (`items[0].variantId`, UUID `variantId`, hoặc UUID `shopId`)
 * về sản phẩm cụ thể trong `CheckoutSummaryView` để hiển thị rõ ràng trong modal thiếu kho.
 */
export function parseConflictItems(error: ApiError, summary?: CheckoutSummaryView): ConflictItemDisplay[] {
  const packages = summary?.packages ?? []
  const flatItems: Array<{ item: CheckoutSummaryItem; shopName: string }> = []
  for (const pkg of packages) {
    for (const item of pkg.items ?? []) {
      flatItems.push({ item, shopName: pkg.shopName || fallbackShopName(pkg.shopId) })
    }
  }

  const results: ConflictItemDisplay[] = []
  for (const [idx, detail] of error.details.entries()) {
    const indexMatch = /^items\[(\d+)\]/.exec(detail.field)
    if (indexMatch) {
      const flatIdx = Number.parseInt(indexMatch[1]!, 10)
      const matched = flatItems[flatIdx]
      if (matched) {
        results.push({
          key: `${detail.field}-${idx}`,
          productName: matched.item.productName,
          variantLabel: matched.item.variantLabel,
          shopName: matched.shopName,
          requestedQuantity: matched.item.quantity,
          reason: detail.reason,
          imageRef: matched.item.imageRef,
        })
        continue
      }
    }

    const byVariant = flatItems.find(
      ({ item }) => item.variantId === detail.field || detail.field.includes(item.variantId),
    )
    if (byVariant) {
      results.push({
        key: `${detail.field}-${idx}`,
        productName: byVariant.item.productName,
        variantLabel: byVariant.item.variantLabel,
        shopName: byVariant.shopName,
        requestedQuantity: byVariant.item.quantity,
        reason: detail.reason,
        imageRef: byVariant.item.imageRef,
      })
      continue
    }

    const byShop = packages.find((pkg) => pkg.shopId === detail.field)
    if (byShop) {
      results.push({
        key: `${detail.field}-${idx}`,
        productName: byShop.shopName || fallbackShopName(byShop.shopId),
        reason: detail.reason,
      })
      continue
    }

    results.push({
      key: `${detail.field}-${idx}`,
      productName: detail.field === 'shippingTotal' ? 'Phí vận chuyển' : 'Sản phẩm trong đơn',
      reason: detail.reason,
    })
  }

  return results
}

export function redirectToPaymentUrl(url: string): void {
  window.location.assign(url)
}

export * from './seller-orders-api'
