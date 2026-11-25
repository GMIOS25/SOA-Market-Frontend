/**
 * Ánh xạ mã trạng thái nghiệp vụ → tông màu badge (04-UI-UX-Design-Brief §2.2).
 * Badge luôn kèm chữ tiếng Việt (locales/vi/status.json) — không bao giờ chỉ dùng màu (WCAG AA).
 */
export type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger'

export const STATUS_TONES = {
  // Neutral / Draft
  DRAFT: 'neutral',
  SUBMITTED: 'neutral',
  PENDING_VERIFICATION: 'neutral',
  INITIATED: 'neutral',
  PENDING_CREATION: 'neutral',
  CREATED: 'info',
  NONE: 'neutral',
  WITHDRAWN: 'neutral',
  NOT_ELIGIBLE: 'neutral',
  // Info / In Progress
  CONFIRMED: 'info',
  SHIPPING: 'info',
  PICKED_UP: 'info',
  IN_TRANSIT: 'info',
  OUT_FOR_DELIVERY: 'info',
  PROCESSING: 'info',
  UNDER_REVIEW: 'info',
  EXECUTING: 'info',
  // Warning / Action Needed
  /** Hồ sơ nhà bán hoặc giao dịch đang chờ xử lý (SVC-SEL, SVC-PAY). */
  PENDING: 'warning',
  PENDING_PAYMENT: 'warning',
  AWAITING_CONFIRMATION: 'warning',
  PENDING_REVIEW: 'warning',
  PENDING_MODERATION: 'warning',
  AWAITING_SELLER: 'warning',
  NEGOTIATING: 'warning',
  SUSPENDED: 'warning',
  ON_HOLD: 'warning',
  RETURNING: 'warning',
  PARTIAL: 'warning',
  // Success / Completed
  ACTIVE: 'success',
  APPROVED: 'success',
  PAID: 'success',
  DELIVERED: 'success',
  COMPLETED: 'success',
  SUCCEEDED: 'success',
  CAPTURED: 'success',
  PUBLISHED: 'success',
  ELIGIBLE: 'success',
  CLOSED: 'success',
  // Danger / Failed / Escalated
  CANCELLED: 'danger',
  REJECTED: 'danger',
  LOCKED: 'danger',
  FAILED: 'danger',
  EXPIRED: 'danger',
  CREATE_FAILED: 'danger',
  DELIVERY_FAILED: 'danger',
  DELIVERY_ATTEMPT_FAILED: 'danger',
  RETURNED: 'danger',
  ESCALATED: 'danger',
  HIDDEN: 'danger',
} as const satisfies Record<string, StatusTone>

export type KnownStatus = keyof typeof STATUS_TONES

export function isKnownStatus(status: string): status is KnownStatus {
  return Object.hasOwn(STATUS_TONES, status)
}

/** Trạng thái lạ (BE thêm mới chưa kịp map) rơi về `neutral` thay vì làm vỡ UI. */
export function getStatusTone(status: string): StatusTone {
  return isKnownStatus(status) ? STATUS_TONES[status] : 'neutral'
}
