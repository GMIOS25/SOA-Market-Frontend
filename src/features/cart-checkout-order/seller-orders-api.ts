import { ApiError, unwrap } from '@/api/errors'
import type { SvcOrd, SvcSel } from '@/api/generated'
import {
  getShipmentLabel,
  listShipments,
  retryShipment,
  type Shipment,
  type ShipmentLabel,
} from '@/features/payment-shipping/api'
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

export type SellerShipmentView = Pick<Shipment, 'shipmentId' | 'sellerOrderId' | 'carrier' | 'status'> &
  Partial<Omit<Shipment, 'shipmentId' | 'sellerOrderId' | 'carrier' | 'status' | 'failureReason'>> & {
    failureReason?: string | null
    deliveryAttempts?: number
  }

export type ShipmentLabelResult = ShipmentLabel

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

export async function apiListShipmentsBySellerOrder(sellerOrderId: string): Promise<SellerShipmentView[]> {
  try {
    return await listShipments(sellerOrderId, 'seller')
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return []
    throw error
  }
}

export function pickActiveForwardShipment(shipments: SellerShipmentView[]): SellerShipmentView | null {
  if (shipments.length === 0) return null
  const forward = shipments.filter((s) => !s.kind || s.kind === 'FORWARD')
  const pool = forward.length > 0 ? forward : shipments
  const active = pool.find((s) => s.status !== 'CANCELLED')
  return active ?? pool[0] ?? null
}

export const apiGetShipmentLabel = getShipmentLabel
export const apiRetryShipment = retryShipment

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
