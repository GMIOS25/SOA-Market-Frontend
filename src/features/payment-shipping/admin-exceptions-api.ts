import { createApiClient } from '@/api/client'
import { unwrap } from '@/api/errors'
import type { SvcPay, SvcShp } from '@/api/generated'
import i18n from '@/lib/i18n'

const pay = createApiClient<SvcPay.paths>()
const shp = createApiClient<SvcShp.paths>()

export type AdminRefund = SvcPay.components['schemas']['Refund']
export type AdminPayment = SvcPay.components['schemas']['Payment']
export type AdminLedgerEntry = SvcPay.components['schemas']['SellerLedgerEntry']
export type AdminPayablesSummary = SvcPay.components['schemas']['PayablesSummary']
export type AdminShopPayableSummary = SvcPay.components['schemas']['ShopPayableSummary']
export type AdminShipment = SvcShp.components['schemas']['Shipment']
export type MarkManualSuccessPayload = Omit<SvcPay.components['schemas']['MarkManualSuccessInput'], '$schema'>

export type AdminRefundQuery = NonNullable<SvcPay.operations['list-admin-refunds']['parameters']['query']>
export type AdminPayablesQuery = NonNullable<SvcPay.operations['list-admin-payables']['parameters']['query']>

export function listAdminRefunds(query: AdminRefundQuery = {}) {
  return unwrap(pay.GET('/v1/admin/refunds', { params: { query } }))
}

export function markRefundManualSuccess(refundId: string, body: MarkManualSuccessPayload) {
  return unwrap(
    pay.POST('/v1/admin/refunds/{id}/mark-manual-success', {
      params: { path: { id: refundId } },
      body,
    }),
  )
}

export function listAdminPayables(query: AdminPayablesQuery = {}) {
  return unwrap(pay.GET('/v1/admin/payables', { params: { query } }))
}

export function listAdminReviewPayments(page = 1, pageSize = 10) {
  return unwrap(
    pay.GET('/v1/payments', {
      params: { query: { needsManualReview: 'true', page, pageSize } },
    }),
  )
}

export function listAdminFailedShipments(page = 1, pageSize = 10) {
  return unwrap(
    shp.GET('/v1/shipments', {
      params: { query: { status: 'CREATE_FAILED', page, pageSize } },
    }),
  )
}

type FailureReasonKey =
  | 'exceptions.failureReasons.carrierUnavailable'
  | 'exceptions.failureReasons.operationUnconfirmed'
  | 'exceptions.failureReasons.pickupAddressIncomplete'
  | 'exceptions.failureReasons.parcelInvalid'

const SHIPMENT_FAILURE_PATTERNS: readonly [RegExp, FailureReasonKey][] = [
  [/\b(?:CARRIER_CREATE_UNAVAILABLE|CARRIER_UNAVAILABLE|CARRIER_TIMEOUT)\b/i, 'exceptions.failureReasons.carrierUnavailable'],
  [/\b(?:CARRIER_OPERATION_UNCONFIRMED|OUTCOME_UNKNOWN)\b/i, 'exceptions.failureReasons.operationUnconfirmed'],
  [/\b(?:PICKUP_ADDRESS_INCOMPLETE|SHOP_PICKUP_INCOMPLETE|INVALID_ADDRESS)\b/i, 'exceptions.failureReasons.pickupAddressIncomplete'],
  [/\b(?:PARCEL_INVALID|WEIGHT_EXCEEDED)\b/i, 'exceptions.failureReasons.parcelInvalid'],
]

const RAW_CODE_PREFIX_RE = /^[A-Z][A-Z0-9_]{2,}(?::|\s|$)/

export function formatAdminFailureReason(reason?: string | null): string | undefined {
  const trimmed = reason?.trim()
  if (!trimmed) return undefined
  for (const [pattern, key] of SHIPMENT_FAILURE_PATTERNS) {
    if (pattern.test(trimmed)) return i18n.t(key, { ns: 'adminExceptions' })
  }
  if (RAW_CODE_PREFIX_RE.test(trimmed)) {
    return i18n.t('exceptions.failureReasons.generic', { ns: 'adminExceptions' })
  }
  return trimmed
}

/**
 * Rút gọn UUID/mã dài ở GIỮA (`8 ký tự đầu … 4 ký tự cuối`, VD `01a20fa5…9ca8`)
 * để giữ cả prefix thời gian (UUIDv7) lẫn hậu tố phân biệt từng dòng, trong khi CopyableId vẫn chép mã đầy đủ.
 */
export function compactId(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length <= 16) return trimmed
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-4)}`
}

