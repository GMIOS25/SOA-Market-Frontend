import { authFetch } from '@/api/auth-fetch'
import { createApiClient } from '@/api/client'
import { ApiError, networkError, toApiError, unwrap } from '@/api/errors'
import type { SvcIdn, SvcOrd, SvcSel } from '@/api/generated'
import { idempotencyHeaders } from '@/api/idempotency'
import { env } from '@/lib/env'
import type { ReasonActionRequestBody, SellerOrderActionResult } from './seller-orders-api'

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
export type CheckoutPaymentView = SvcOrd.components['schemas']['CheckoutPaymentView']

export type BuyerOrderListResult = SvcOrd.components['schemas']['BuyerOrderListResult']
export type BuyerOrderSummaryView = SvcOrd.components['schemas']['BuyerOrderSummaryView']
export type BuyerSellerOrderSummaryItem = SvcOrd.components['schemas']['BuyerSellerOrderSummaryItem']
export type BuyerOrderDetailView = SvcOrd.components['schemas']['BuyerOrderDetailView']
export type BuyerSellerOrderDetailView = SvcOrd.components['schemas']['BuyerSellerOrderDetailView']
export type PartialRefundBreakdownView = SvcOrd.components['schemas']['PartialRefundBreakdownView']
export type PartialRefundSellerOrderItem = SvcOrd.components['schemas']['PartialRefundSellerOrderItem']
export type ListOrdersParams = SvcOrd.operations['list-orders']['parameters']['query']

export type ShipmentTrackingEvent = {
  eventId: string
  status: string
  note?: string
  location?: string
  occurredAt: string
  receivedAt?: string
}

export type ShipmentSummary = {
  shipmentId: string
  sellerOrderId: string
  kind?: string
  carrier: string
  trackingCode?: string
  status: string
  fee?: number
  etaAt?: string
  deliveryAttempts?: number
  failureReason?: string
  updatedAt?: string
}

export type ShipmentTrackingResult = {
  shipment: ShipmentSummary | null
  events: ShipmentTrackingEvent[]
}

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

export function apiListOrders(params?: ListOrdersParams): Promise<BuyerOrderListResult> {
  return unwrap(
    ordClient.GET('/v1/orders', {
      params: { query: params },
    }),
  )
}

export function apiGetOrder(orderId: string): Promise<BuyerOrderDetailView> {
  return unwrap(
    ordClient.GET('/v1/orders/{id}', {
      params: { path: { id: orderId } },
    }),
  )
}

export function apiBuyerCancelSellerOrder(
  sellerOrderId: string,
  body?: ReasonActionRequestBody,
): Promise<SellerOrderActionResult> {
  return unwrap(
    ordClient.POST('/v1/seller-orders/{id}/cancel', {
      params: { path: { id: sellerOrderId } },
      body: body ?? {},
    }),
  )
}

export function apiConfirmSellerOrderReceipt(sellerOrderId: string): Promise<SellerOrderActionResult> {
  return unwrap(
    ordClient.POST('/v1/seller-orders/{id}/receipt', {
      params: { path: { id: sellerOrderId } },
    }),
  )
}

async function fetchJsonWithAuth(url: string): Promise<unknown> {
  let response: Response
  try {
    response = await authFetch(new Request(url, { method: 'GET' }))
  } catch {
    throw networkError()
  }

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    throw toApiError(body, response)
  }

  return body
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function normalizeShipmentSummary(raw: unknown): ShipmentSummary | null {
  const obj = asRecord(raw)
  if (!obj) return null
  const shipmentId = asString(obj.shipmentId) ?? asString(obj.id)
  if (!shipmentId) return null

  return {
    shipmentId,
    sellerOrderId: asString(obj.sellerOrderId) ?? '',
    kind: asString(obj.kind),
    carrier: asString(obj.carrier) ?? '',
    trackingCode: asString(obj.trackingCode),
    status: asString(obj.status) ?? 'CREATED',
    fee: asNumber(obj.fee),
    etaAt: asString(obj.etaAt),
    deliveryAttempts: asNumber(obj.deliveryAttempts),
    failureReason: asString(obj.failureReason),
    updatedAt: asString(obj.updatedAt),
  }
}

function normalizeTrackingEvent(raw: unknown, index: number): ShipmentTrackingEvent | null {
  const obj = asRecord(raw)
  if (!obj) return null
  const status = asString(obj.status)
  const occurredAt = asString(obj.occurredAt)
  if (!status || !occurredAt) return null

  return {
    eventId: asString(obj.eventId) ?? asString(obj.id) ?? `${status}-${occurredAt}-${index}`,
    status,
    note: asString(obj.note),
    location: asString(obj.location),
    occurredAt,
    receivedAt: asString(obj.receivedAt),
  }
}

function extractArray(body: unknown, keys: readonly string[]): unknown[] {
  if (Array.isArray(body)) return body
  const obj = asRecord(body)
  if (!obj) return []
  for (const key of keys) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[]
  }
  return []
}

/**
 * Tải thông tin vận đơn và hành trình từ SVC-SHP cho một gói `SellerOrder`.
 * Khi SVC-SHP lỗi (502/503/504), trả ApiError để riêng khối tracking hiển thị `<ServiceFallbackBanner />` (NFR-REL-005).
 */
export async function apiGetSellerOrderTracking(sellerOrderId: string): Promise<ShipmentTrackingResult> {
  const listUrl = `${env.apiBaseUrl}/v1/shipments?sellerOrderId=${encodeURIComponent(sellerOrderId)}`
  const listBody = await fetchJsonWithAuth(listUrl)
  const candidates = extractArray(listBody, ['items', 'shipments', 'data'])
    .map(normalizeShipmentSummary)
    .filter((item): item is ShipmentSummary => item !== null)

  const shipment =
    candidates.find((item) => item.kind === 'FORWARD' && item.status !== 'CANCELLED') ??
    candidates.find((item) => item.kind === 'FORWARD') ??
    candidates[0] ??
    null

  if (!shipment) {
    return { shipment: null, events: [] }
  }

  const trackingUrl = `${env.apiBaseUrl}/v1/shipments/${encodeURIComponent(shipment.shipmentId)}/tracking`
  const trackingBody = await fetchJsonWithAuth(trackingUrl)
  const trackingObj = asRecord(trackingBody)

  const mergedShipment =
    normalizeShipmentSummary(trackingObj?.shipment) ??
    (trackingObj && asString(trackingObj.status)
      ? {
          ...shipment,
          status: asString(trackingObj.status) ?? shipment.status,
          carrier: asString(trackingObj.carrier) ?? shipment.carrier,
          trackingCode: asString(trackingObj.trackingCode) ?? shipment.trackingCode,
          etaAt: asString(trackingObj.etaAt) ?? shipment.etaAt,
          deliveryAttempts: asNumber(trackingObj.deliveryAttempts) ?? shipment.deliveryAttempts,
          failureReason: asString(trackingObj.failureReason) ?? shipment.failureReason,
        }
      : shipment)

  const rawEvents = extractArray(trackingBody, ['events', 'trackingEvents', 'items', 'data'])
  const events = rawEvents
    .map((ev, index) => normalizeTrackingEvent(ev, index))
    .filter((ev): ev is ShipmentTrackingEvent => ev !== null)

  return { shipment: mergedShipment, events }
}

export * from './seller-orders-api'
