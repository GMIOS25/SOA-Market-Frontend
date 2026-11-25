import i18n from '@/lib/i18n'

type EventTime = { occurredAt: string; receivedAt?: string }

export function sortTrackingEvents<T extends EventTime>(events: readonly T[]): T[] {
  return [...events].sort((a, b) =>
    Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
    (b.receivedAt ? Date.parse(b.receivedAt) : 0) - (a.receivedAt ? Date.parse(a.receivedAt) : 0),
  )
}

type FailureReasonKey =
  | 'tracking.failureReasons.carrierUnavailable'
  | 'tracking.failureReasons.operationUnconfirmed'
  | 'tracking.failureReasons.pickupAddressIncomplete'
  | 'tracking.failureReasons.parcelInvalid'

const SHIPMENT_FAILURE_REASON_PATTERNS: readonly [RegExp, FailureReasonKey][] = [
  [/\b(?:CARRIER_CREATE_UNAVAILABLE|CARRIER_UNAVAILABLE|CARRIER_TIMEOUT)\b/i, 'tracking.failureReasons.carrierUnavailable'],
  [/\b(?:CARRIER_OPERATION_UNCONFIRMED|OUTCOME_UNKNOWN)\b/i, 'tracking.failureReasons.operationUnconfirmed'],
  [/\b(?:PICKUP_ADDRESS_INCOMPLETE|SHOP_PICKUP_INCOMPLETE|INVALID_ADDRESS)\b/i, 'tracking.failureReasons.pickupAddressIncomplete'],
  [/\b(?:PARCEL_INVALID|WEIGHT_EXCEEDED)\b/i, 'tracking.failureReasons.parcelInvalid'],
]

const RAW_CODE_PREFIX_RE = /^[A-Z][A-Z0-9_]{2,}(?::|\s|$)/

/**
 * Chuẩn hóa `shipment.failureReason` từ backend sang thông báo tiếng Việt thân thiện qua i18n,
 * tránh lộ mã lỗi kỹ thuật (`CARRIER_CREATE_UNAVAILABLE: ...`) lên giao diện người dùng.
 */
export function formatShipmentFailureReason(reason?: string | null): string | undefined {
  const trimmed = reason?.trim()
  if (!trimmed) return undefined

  for (const [pattern, key] of SHIPMENT_FAILURE_REASON_PATTERNS) {
    if (pattern.test(trimmed)) return i18n.t(key, { ns: 'paymentShipping' })
  }

  if (RAW_CODE_PREFIX_RE.test(trimmed)) {
    return i18n.t('tracking.failureReasons.generic', { ns: 'paymentShipping' })
  }

  return trimmed
}
