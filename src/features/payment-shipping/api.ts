import { authFetch } from '@/api/auth-fetch'
import { createApiClient } from '@/api/client'
import { networkError, toApiError, unwrap } from '@/api/errors'
import type { SvcOrd, SvcPay, SvcShp } from '@/api/generated'
import { env } from '@/lib/env'

const ord = createApiClient<SvcOrd.paths>()
const pay = createApiClient<SvcPay.paths>()
const shp = createApiClient<SvcShp.paths>()

export type Shipment = SvcShp.components['schemas']['Shipment']
export type TrackingEvent = SvcShp.components['schemas']['TrackingEvent']
export type ShipmentLabel = SvcShp.components['schemas']['WaybillLabelOutput']

export type Payment = SvcPay.components['schemas']['Payment']
export type Refund = SvcPay.components['schemas']['Refund']
export type PayablesSummary = SvcPay.components['schemas']['PayablesSummary']
export type ShopPayableSummary = SvcPay.components['schemas']['ShopPayableSummary']
export type SellerLedgerEntry = SvcPay.components['schemas']['SellerLedgerEntry']
export type PaginationMeta = SvcPay.components['schemas']['PaginationMeta']
export type MarkManualSuccessInput = SvcPay.components['schemas']['MarkManualSuccessInput']

export type RefundStatus = 'REQUESTED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED'
export type RefundSource = 'CANCELLATION' | 'DELIVERY_FAILED' | 'LATE_PAYMENT' | 'COMPLAINT'
export type PayableStatus = 'NOT_ELIGIBLE' | 'ON_HOLD' | 'ELIGIBLE'

export type AdminRefundFilter = {
  status?: RefundStatus
  source?: RefundSource
  paymentId?: string
  orderId?: string
  sellerOrderId?: string
  needsReconciliation?: 'true' | 'false'
  retryingOnly?: 'true' | 'false'
  exhaustedOnly?: 'true' | 'false'
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export type AdminPayablesFilter = {
  shopId?: string
  status?: PayableStatus
  page?: number
  pageSize?: number
}

export type AdminPaymentFilter = {
  orderId?: string
  status?: 'INITIATED' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED'
  needsManualReview?: 'true' | 'false'
  page?: number
  pageSize?: number
}

export type AdminShipmentFilter = {
  sellerOrderId?: string
  shopId?: string
  page?: number
  pageSize?: number
}

export type RptExceptionItem = {
  exceptionId: string
  type: string
  entityType: string
  entityId: string
  summary: string
  status: string
  createdAt: string
}

export type RptExceptionsResponse = {
  data: RptExceptionItem[]
  pagination?: PaginationMeta
  syncedAt?: string | null
}

export const paymentShippingKeys = {
  all: ['payment-shipping'] as const,
  refunds: (filter: AdminRefundFilter) => [...paymentShippingKeys.all, 'admin-refunds', filter] as const,
  payables: (filter: AdminPayablesFilter) => [...paymentShippingKeys.all, 'admin-payables', filter] as const,
  payments: (filter: AdminPaymentFilter) => [...paymentShippingKeys.all, 'admin-payments', filter] as const,
  failedShipments: (filter: AdminShipmentFilter) =>
    [...paymentShippingKeys.all, 'admin-failed-shipments', filter] as const,
  rptExceptions: () => [...paymentShippingKeys.all, 'admin-rpt-exceptions'] as const,
}

export function retryOrderPayment(orderId: string, previousPaymentId: string) {
  return unwrap(ord.POST('/v1/orders/{id}/payment/retry', {
    params: { path: { id: orderId } },
    body: { previousPaymentId },
  }))
}

export function getPayment(paymentId: string, signal?: AbortSignal) {
  return unwrap(pay.GET('/v1/payments/{id}', { params: { path: { id: paymentId } }, signal }))
}

export async function listShipments(sellerOrderId: string, scope: 'buyer' | 'seller') {
  const result = await unwrap(shp.GET('/v1/shipments', {
    params: { query: { sellerOrderId, scope, pageSize: 100 } },
  }))
  return result.shipments ?? []
}

export function getTracking(shipmentId: string, page = 1) {
  return unwrap(shp.GET('/v1/shipments/{id}/tracking', {
    params: { path: { id: shipmentId }, query: { page, pageSize: 100 } },
  }))
}

export async function getShipmentTimeline(shipmentId: string) {
  const tracking = await getTracking(shipmentId)
  const events = new Map((tracking.events ?? []).map((event) => [event.eventId, event]))
  for (let page = 2; page <= (tracking.pagination?.totalPages ?? 1); page += 1) {
    const next = await getTracking(shipmentId, page)
    for (const event of next.events ?? []) events.set(event.eventId, event)
  }
  return { ...tracking, events: [...events.values()] }
}

export function getShipmentLabel(shipmentId: string) {
  return unwrap(shp.GET('/v1/shipments/{id}/label', { params: { path: { id: shipmentId } } }))
}

export function retryShipment(shipmentId: string) {
  return unwrap(shp.POST('/v1/shipments/{id}/retry', { params: { path: { id: shipmentId } } }))
}

export function listAdminRefunds(query: AdminRefundFilter, signal?: AbortSignal) {
  return unwrap(pay.GET('/v1/admin/refunds', { params: { query }, signal }))
}

export function markRefundManualSuccess(refundId: string, body: MarkManualSuccessInput) {
  return unwrap(pay.POST('/v1/admin/refunds/{id}/mark-manual-success', {
    params: { path: { id: refundId } },
    body,
  }))
}

export function listAdminPayables(query: AdminPayablesFilter, signal?: AbortSignal) {
  return unwrap(pay.GET('/v1/admin/payables', { params: { query }, signal }))
}

export function listAdminPayments(query: AdminPaymentFilter, signal?: AbortSignal) {
  return unwrap(pay.GET('/v1/payments', { params: { query }, signal }))
}

export function listFailedShipments(query: AdminShipmentFilter = {}, signal?: AbortSignal) {
  // Không truyền `scope` để SVC-SHP nhận diện actor ADMINISTRATOR / CS xem toàn sàn.
  return unwrap(shp.GET('/v1/shipments', {
    params: { query: { status: 'CREATE_FAILED', ...query } },
    signal,
  }))
}

export function canManuallyConfirmRefund(refund: Refund): boolean {
  if (refund.status === 'SUCCEEDED') return false
  return refund.status === 'FAILED' || refund.needsReconciliation
}

/**
 * Đọc tổng hợp ngoại lệ từ SVC-RPT (T1-10) nếu đã sẵn sàng.
 * Khi SVC-RPT chưa triển khai hoặc đang gián đoạn (404/502/503/504), component hiển thị ServiceFallbackBanner cục bộ.
 */
export async function listRptExceptions(signal?: AbortSignal): Promise<RptExceptionsResponse> {
  const base = env.apiBaseUrl.replace(/\/$/, '')
  let response: Response
  try {
    response = await authFetch(new Request(`${base}/v1/admin/exceptions`, { method: 'GET', signal }))
  } catch {
    throw networkError()
  }
  const text = await response.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown
    } catch {
      parsed = null
    }
  }
  if (!response.ok) {
    throw toApiError(parsed, response)
  }
  const payload = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Partial<RptExceptionsResponse>
  return {
    data: Array.isArray(payload.data) ? payload.data : [],
    pagination: payload.pagination,
    syncedAt: payload.syncedAt ?? null,
  }
}

export function httpUrl(value: string) {
  try {
    const url = new URL(value, window.location.origin)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href
  } catch {
    return undefined
  }
}
