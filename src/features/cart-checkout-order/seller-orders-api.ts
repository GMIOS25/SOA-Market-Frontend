import { authFetch } from '@/api/auth-fetch'
import { ApiError, networkError, toApiError, unwrap } from '@/api/errors'
import type { SvcOrd, SvcSel } from '@/api/generated'
import { env } from '@/lib/env'
import { ordClient, selClient } from './api'

export type SellerOrderSummaryView = SvcOrd.components['schemas']['SellerOrderSummaryView']
export type SellerOrderListResult = SvcOrd.components['schemas']['SellerOrderListResult']
export type SellerOrderDetailView = SvcOrd.components['schemas']['SellerOrderDetailView']
export type SellerOrderActionResult = SvcOrd.components['schemas']['SellerOrderActionResult']
export type OrderItemView = SvcOrd.components['schemas']['OrderItemView']
export type OrderStatusHistoryView = SvcOrd.components['schemas']['OrderStatusHistoryView']
export type ReasonActionRequestBody = SvcOrd.components['schemas']['ReasonActionRequestBody']

export type ShopDTO = SvcSel.components['schemas']['ShopDTO']
export type PickupAddressDTO = SvcSel.components['schemas']['PickupAddressDTO']

export type SellerOrderListParams = {
  shopId?: string
  status?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

export type SellerShipmentStatus =
  | 'PENDING_CREATION'
  | 'CREATE_FAILED'
  | 'CREATED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'RETURNING'
  | 'RETURNED'
  | 'CANCELLED'
  | (string & {})

/**
 * Hợp đồng SVC-SHP (02-TRD.md §B.6, 05-Backend-Schema.md §3.6) cho tới khi `svc-shp.yaml`
 * được đồng bộ vào `src/api/generated/`.
 */
export type SellerShipmentView = {
  shipmentId: string
  sellerOrderId: string
  shopId?: string
  buyerId?: string
  kind?: string
  carrier: string
  trackingCode?: string | null
  status: SellerShipmentStatus
  fee?: number
  feeVnd?: number
  etaAt?: string | null
  labelUrl?: string | null
  failureReason?: string | null
  deliveryAttempts?: number
  createAttempts?: number
  createdAt?: string
  updatedAt?: string
}

export type ShipmentTrackingEventView = {
  eventId?: string
  carrierEventId?: string
  carrier?: string
  status: string
  note?: string | null
  location?: string | null
  occurredAt: string
  receivedAt?: string
}

export type ShipmentLabelResult = {
  trackingCode?: string
  labelUrl?: string
  expiresAt?: string
  htmlContent?: string
}

export const PICKUP_ADDRESS_SETTINGS_PATH = '/seller/shop'

const PICKED_UP_STATUSES = new Set([
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'RETURNING',
  'RETURNED',
])

export function apiListSellerOrders(params: SellerOrderListParams = {}): Promise<SellerOrderListResult> {
  return unwrap(
    ordClient.GET('/v1/seller-orders', {
      params: {
        query: {
          shopId: params.shopId || undefined,
          status: params.status || undefined,
          from: params.from || undefined,
          to: params.to || undefined,
          page: params.page,
          limit: params.limit,
        },
      },
    }),
  )
}

export function apiGetSellerOrderDetail(sellerOrderId: string): Promise<SellerOrderDetailView> {
  return unwrap(
    ordClient.GET('/v1/seller-orders/{id}', {
      params: { path: { id: sellerOrderId } },
    }),
  )
}

export function apiConfirmSellerOrder(sellerOrderId: string): Promise<SellerOrderActionResult> {
  return unwrap(
    ordClient.POST('/v1/seller-orders/{id}/confirm', {
      params: { path: { id: sellerOrderId } },
    }),
  )
}

export function apiRejectSellerOrder(sellerOrderId: string, reason: string): Promise<SellerOrderActionResult> {
  return unwrap(
    ordClient.POST('/v1/seller-orders/{id}/reject', {
      params: { path: { id: sellerOrderId } },
      body: { reason: reason.trim() },
    }),
  )
}

export function apiCancelSellerOrder(sellerOrderId: string, reason: string): Promise<SellerOrderActionResult> {
  return unwrap(
    ordClient.POST('/v1/seller-orders/{id}/cancel', {
      params: { path: { id: sellerOrderId } },
      body: { reason: reason.trim() },
    }),
  )
}

export function apiGetSellerShop(): Promise<ShopDTO> {
  return unwrap(selClient.GET('/v1/seller/shop'))
}

export function hasValidPickupAddress(addr?: PickupAddressDTO | null): boolean {
  if (!addr) return false
  return Boolean(
    addr.contactName?.trim() &&
      addr.phone?.trim() &&
      addr.line?.trim() &&
      addr.ward?.trim() &&
      addr.district?.trim() &&
      addr.province?.trim(),
  )
}

export function isPickupAddressMissingError(
  error: unknown,
  context: 'shipment_action' | 'general' = 'general',
): error is ApiError {
  if (!(error instanceof ApiError) || error.status !== 422) return false
  if (context === 'shipment_action') return true
  if (error.code === 'PICKUP_ADDRESS_REQUIRED' || error.code.includes('PICKUP')) return true
  if (error.details.some((detail) => detail.field.toLowerCase().includes('pickup'))) return true
  return /lấy hàng|pickup/i.test(error.message)
}

async function fetchGatewayJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await authFetch(new Request(`${env.apiBaseUrl}${path}`, init))
  } catch {
    throw networkError()
  }

  const body = (await response.json().catch(() => null)) as unknown
  if (!response.ok) {
    throw toApiError(body, response)
  }
  return body as T
}

function normalizeShipmentsPayload(payload: unknown): SellerShipmentView[] {
  if (Array.isArray(payload)) return payload as SellerShipmentView[]
  if (typeof payload !== 'object' || payload === null) return []
  const record = payload as Record<string, unknown>
  if (Array.isArray(record.shipments)) return record.shipments as SellerShipmentView[]
  if (Array.isArray(record.items)) return record.items as SellerShipmentView[]
  if (Array.isArray(record.data)) return record.data as SellerShipmentView[]
  if (typeof record.shipmentId === 'string') return [record as unknown as SellerShipmentView]
  return []
}

function normalizeTrackingPayload(payload: unknown): ShipmentTrackingEventView[] {
  let list: ShipmentTrackingEventView[] = []
  if (Array.isArray(payload)) {
    list = payload as ShipmentTrackingEventView[]
  } else if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>
    if (Array.isArray(record.events)) list = record.events as ShipmentTrackingEventView[]
    else if (Array.isArray(record.trackingEvents)) list = record.trackingEvents as ShipmentTrackingEventView[]
    else if (Array.isArray(record.items)) list = record.items as ShipmentTrackingEventView[]
    else if (Array.isArray(record.data)) list = record.data as ShipmentTrackingEventView[]
  }
  return [...list].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
}

export async function apiListShipmentsBySellerOrder(sellerOrderId: string): Promise<SellerShipmentView[]> {
  try {
    const payload = await fetchGatewayJson<unknown>(
      `/v1/shipments?sellerOrderId=${encodeURIComponent(sellerOrderId)}`,
      { method: 'GET' },
    )
    return normalizeShipmentsPayload(payload)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return []
    }
    throw err
  }
}

export function pickActiveForwardShipment(shipments: SellerShipmentView[]): SellerShipmentView | null {
  if (shipments.length === 0) return null
  const forward = shipments.filter((s) => !s.kind || s.kind === 'FORWARD')
  const pool = forward.length > 0 ? forward : shipments
  const active = pool.find((s) => s.status !== 'CANCELLED')
  return active ?? pool[0] ?? null
}

export async function apiGetShipmentTracking(shipmentId: string): Promise<ShipmentTrackingEventView[]> {
  const payload = await fetchGatewayJson<unknown>(
    `/v1/shipments/${encodeURIComponent(shipmentId)}/tracking`,
    { method: 'GET' },
  )
  return normalizeTrackingPayload(payload)
}

export async function apiGetShipmentLabel(shipmentId: string): Promise<ShipmentLabelResult> {
  let response: Response
  try {
    response = await authFetch(
      new Request(`${env.apiBaseUrl}/v1/shipments/${encodeURIComponent(shipmentId)}/label`, {
        method: 'GET',
      }),
    )
  } catch {
    throw networkError()
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!response.ok) {
    const errBody = contentType.includes('application/json')
      ? ((await response.json().catch(() => null)) as unknown)
      : null
    throw toApiError(errBody, response)
  }

  if (contentType.includes('application/json')) {
    const data = (await response.json().catch(() => ({}))) as {
      trackingCode?: string
      labelUrl?: string
      url?: string
      expiresAt?: string
      html?: string
      htmlContent?: string
    }
    return {
      trackingCode: data.trackingCode,
      labelUrl: data.labelUrl ?? data.url,
      expiresAt: data.expiresAt,
      htmlContent: data.htmlContent ?? data.html,
    }
  }

  if (contentType.includes('text/html')) {
    const htmlContent = await response.text()
    const labelUrl =
      typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(new Blob([htmlContent], { type: 'text/html' }))
        : undefined
    return { htmlContent, labelUrl }
  }

  const blob = await response.blob()
  const labelUrl =
    typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(blob)
      : undefined
  return { labelUrl }
}

export function apiRetryShipment(shipmentId: string): Promise<SellerShipmentView> {
  return fetchGatewayJson<SellerShipmentView>(`/v1/shipments/${encodeURIComponent(shipmentId)}/retry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
}

export function isShipmentPickedUp(status?: string | null): boolean {
  if (!status) return false
  return PICKED_UP_STATUSES.has(status.toUpperCase())
}

export function canSellerCancelBeforePickup(
  orderStatus: string,
  availableActions: readonly string[] | null | undefined,
  shipmentStatus?: string | null,
): boolean {
  if (isShipmentPickedUp(shipmentStatus)) return false
  if (orderStatus !== 'CONFIRMED') return false
  return availableActions == null || availableActions.includes('CANCEL')
}

export function canPrintShipmentLabel(shipment?: SellerShipmentView | null): boolean {
  if (!shipment?.shipmentId) return false
  return (
    shipment.status !== 'PENDING_CREATION' &&
    shipment.status !== 'CREATE_FAILED' &&
    shipment.status !== 'CANCELLED'
  )
}

export function resolveConfirmStartedAt(
  createdAt: string,
  updatedAt?: string,
  confirmDueAt?: string,
): string {
  if (updatedAt && confirmDueAt) {
    const updatedMs = Date.parse(updatedAt)
    const dueMs = Date.parse(confirmDueAt)
    if (Number.isFinite(updatedMs) && Number.isFinite(dueMs) && updatedMs < dueMs) {
      return updatedAt
    }
  }
  return createdAt
}
