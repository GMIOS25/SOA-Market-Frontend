import type { RefundLine } from '@/lib/refund'
import { APP_TIMEZONE, dayjs } from '@/lib/dayjs'
import {
  fallbackShopName,
  type BuyerSellerOrderDetailView,
  type PartialRefundBreakdownView,
} from './api'

export const ORDER_STATUS_FILTER_VALUES = ['ALL', 'PENDING_PAYMENT', 'PAID', 'COMPLETED', 'CANCELLED'] as const
export type OrderStatusFilter = (typeof ORDER_STATUS_FILTER_VALUES)[number]

export const TIME_PRESET_VALUES = ['ALL', '7D', '30D', '90D', 'CUSTOM'] as const
export type OrderTimePreset = (typeof TIME_PRESET_VALUES)[number]

export type DateRangeQuery = {
  from?: string
  to?: string
  invalidRange: boolean
}

const PRESET_DAYS: Partial<Record<OrderTimePreset, number>> = {
  '7D': 7,
  '30D': 30,
  '90D': 90,
}

export function isOrderStatusFilter(value: string | null): value is OrderStatusFilter {
  return value !== null && (ORDER_STATUS_FILTER_VALUES as readonly string[]).includes(value)
}

export function isOrderTimePreset(value: string | null): value is OrderTimePreset {
  return value !== null && (TIME_PRESET_VALUES as readonly string[]).includes(value)
}

/**
 * Chuyển bộ lọc thời gian (preset hoặc YYYY-MM-DD theo múi giờ UTC+7) sang RFC3339 UTC để gửi `GET /v1/orders`.
 */
export function toDateRangeQuery(
  preset: OrderTimePreset,
  customFrom: string,
  customTo: string,
  now: Date = new Date(),
): DateRangeQuery {
  if (preset === 'ALL') {
    return { invalidRange: false }
  }

  const presetDays = PRESET_DAYS[preset]
  if (presetDays !== undefined) {
    const end = dayjs.utc(now).tz(APP_TIMEZONE)
    const start = end.subtract(presetDays, 'day').startOf('day')
    return {
      from: start.utc().toISOString(),
      to: end.utc().toISOString(),
      invalidRange: false,
    }
  }

  // CUSTOM
  if (customFrom && customTo && customFrom > customTo) {
    return { invalidRange: true }
  }

  const from = customFrom ? dayjs.tz(`${customFrom} 00:00:00`, APP_TIMEZONE).utc().toISOString() : undefined
  const to = customTo ? dayjs.tz(`${customTo} 23:59:59`, APP_TIMEZONE).endOf('second').utc().toISOString() : undefined

  return { from, to, invalidRange: false }
}

function toRefundLineStatus(refundStatus: string): RefundLine['status'] {
  switch (refundStatus.toUpperCase()) {
    case 'SUCCEEDED':
    case 'FULL':
      return 'SUCCEEDED'
    case 'PROCESSING':
    case 'PARTIAL':
      return 'PROCESSING'
    case 'FAILED':
      return 'FAILED'
    default:
      return 'PENDING'
  }
}

/**
 * Ánh xạ `PartialRefundBreakdownView` từ `GET /v1/orders/{id}` sang props của `<PartialRefundBreakdown />`.
 * Trả về `refunds: []` khi đơn chưa thanh toán hoặc chưa có gói nào hoàn/hủy để component tự ẩn (FR-ORD-009).
 */
export function mapPartialRefundLines(
  breakdown: PartialRefundBreakdownView | undefined,
  sellerOrders: readonly BuyerSellerOrderDetailView[],
  shopNameMap: ReadonlyMap<string, string>,
): { paidTotal: number; refunds: RefundLine[] } {
  if (!breakdown) {
    return { paidTotal: 0, refunds: [] }
  }

  const paidTotal = breakdown.paidTotalAmount
  const items = breakdown.sellerOrders ?? []
  if (paidTotal <= 0 && breakdown.refundedSellerOrderCount <= 0) {
    return { paidTotal: 0, refunds: [] }
  }

  const refunds: RefundLine[] = []
  for (const item of items) {
    const hasRefund = item.isRefundedOrCancelled || (item.refundStatus && item.refundStatus !== 'NONE')
    if (!hasRefund || item.allocationAmount <= 0) continue

    const matchedSo = sellerOrders.find((so) => so.sellerOrderId === item.sellerOrderId)
    const shopName =
      item.shopName ||
      matchedSo?.shopName ||
      shopNameMap.get(item.shopId) ||
      fallbackShopName(item.shopId)

    refunds.push({
      sellerOrderId: item.sellerOrderId,
      sellerOrderCode: item.sellerOrderCode,
      shopName,
      amount: item.allocationAmount,
      status: toRefundLineStatus(item.refundStatus),
    })
  }

  return { paidTotal, refunds }
}

const CANCEL_ACTION_KEYS = new Set(['CANCEL', 'BUYER_CANCEL', 'CANCEL_SELLER_ORDER', 'CANCEL_ORDER'])
const RECEIPT_ACTION_KEYS = new Set(['RECEIPT', 'CONFIRM_RECEIPT', 'RECEIVE', 'CONFIRM_DELIVERY'])

/**
 * Kiểm tra quyền hủy gói theo giai đoạn vòng đời (FR-ORD-007 / BR-ORD-07):
 * ưu tiên `availableActions` từ backend nếu có, fallback theo `status` (`PENDING_PAYMENT` | `AWAITING_CONFIRMATION`).
 */
export function canBuyerCancelPackage(so: BuyerSellerOrderDetailView): boolean {
  if (Array.isArray(so.availableActions)) {
    return so.availableActions.some((action) => CANCEL_ACTION_KEYS.has(action.toUpperCase()))
  }
  return so.status === 'PENDING_PAYMENT' || so.status === 'AWAITING_CONFIRMATION'
}

/**
 * Kiểm tra quyền xác nhận đã nhận hàng (FR-ORD-010):
 * luôn bị khóa nếu gói đang có khiếu nại mở (`hasOpenComplaint = true`).
 */
export function canBuyerConfirmReceipt(so: BuyerSellerOrderDetailView): boolean {
  if (so.hasOpenComplaint) return false
  if (Array.isArray(so.availableActions)) {
    return so.availableActions.some((action) => RECEIPT_ACTION_KEYS.has(action.toUpperCase()))
  }
  return so.status === 'DELIVERED'
}

const TRACKABLE_STATUSES = new Set([
  'CONFIRMED',
  'SHIPPING',
  'DELIVERED',
  'COMPLETED',
  'DELIVERY_FAILED',
])

export function shouldFetchShipmentTracking(
  so: Pick<BuyerSellerOrderDetailView, 'status' | 'trackingCode'>,
  shippingDegraded: boolean,
): boolean {
  if (shippingDegraded) return false
  return Boolean(so.trackingCode) || TRACKABLE_STATUSES.has(so.status)
}
