import { ApiError } from '@/api/errors'
import { APP_TIMEZONE, dayjs } from '@/lib/dayjs'
import { formatNumber } from '@/lib/format'
import type {
  ComplaintDetailView,
  ComplaintMessageView,
  ComplaintStatusHistoryView,
  ComplaintSummaryView,
  EvidenceView,
  ProposalPayload,
} from './api'

export const COMPLAINT_STATUS_FILTERS = [
  'ALL',
  'AWAITING_SELLER',
  'NEGOTIATING',
  'ESCALATED',
  'UNDER_REVIEW',
  'EXECUTING',
  'CLOSED',
  'WITHDRAWN',
  'REJECTED',
] as const

export type ComplaintStatusFilter = (typeof COMPLAINT_STATUS_FILTERS)[number]

export const COMPLAINT_TYPES = [
  'NOT_RECEIVED',
  'WRONG_ITEM',
  'DAMAGED',
  'NOT_AS_DESCRIBED',
  'OTHER',
] as const

export type ComplaintType = (typeof COMPLAINT_TYPES)[number]

export const REQUESTED_RESOLUTIONS = [
  'FULL_REFUND',
  'PARTIAL_REFUND',
  'RETURN_REFUND',
  'EXCHANGE',
] as const

export type RequestedResolution = (typeof REQUESTED_RESOLUTIONS)[number]

export const MAX_EVIDENCE_PER_PARTY = 5
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_MEDIA_BYTES = 20 * 1024 * 1024

export const ACCEPTED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const ACCEPTED_MEDIA_MIMES = ['video/mp4', 'video/webm', 'application/pdf'] as const
export const ACCEPTED_EVIDENCE_MIMES = [...ACCEPTED_IMAGE_MIMES, ...ACCEPTED_MEDIA_MIMES] as const

const EXTENSION_MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  pdf: 'application/pdf',
}

export type ComplaintSlaInfo = {
  deadline: string
  startedAt: string
  labelKey: 'sla.seller' | 'sla.negotiate' | 'sla.cs'
}

function resolveStartedAt(createdAt: string, updatedAt: string, deadline: string): string {
  const updatedMs = Date.parse(updatedAt)
  const deadlineMs = Date.parse(deadline)
  if (Number.isFinite(updatedMs) && Number.isFinite(deadlineMs) && updatedMs < deadlineMs) {
    return updatedAt
  }
  return createdAt
}

/**
 * Xác định mốc SLA đang hoạt động theo trạng thái khiếu nại (T_CPL_SELLER / T_CPL_NEGOTIATE / SLA CSKH).
 */
export function resolveComplaintSla(complaint: Pick<
  ComplaintSummaryView,
  'status' | 'sellerDueAt' | 'negotiateDueAt' | 'slaDueAt' | 'createdAt' | 'updatedAt'
>): ComplaintSlaInfo | null {
  if (complaint.status === 'AWAITING_SELLER' && complaint.sellerDueAt) {
    return {
      deadline: complaint.sellerDueAt,
      startedAt: resolveStartedAt(complaint.createdAt, complaint.updatedAt, complaint.sellerDueAt),
      labelKey: 'sla.seller',
    }
  }
  if (complaint.status === 'NEGOTIATING' && complaint.negotiateDueAt) {
    return {
      deadline: complaint.negotiateDueAt,
      startedAt: resolveStartedAt(complaint.createdAt, complaint.updatedAt, complaint.negotiateDueAt),
      labelKey: 'sla.negotiate',
    }
  }
  if ((complaint.status === 'ESCALATED' || complaint.status === 'UNDER_REVIEW') && complaint.slaDueAt) {
    return {
      deadline: complaint.slaDueAt,
      startedAt: resolveStartedAt(complaint.createdAt, complaint.updatedAt, complaint.slaDueAt),
      labelKey: 'sla.cs',
    }
  }
  return null
}

export type ComplaintTimelineItem =
  | {
      id: string
      kind: 'status'
      at: string
      orderWeight: number
      sourceIndex: number
      entry: ComplaintStatusHistoryView
    }
  | {
      id: string
      kind: 'message'
      at: string
      orderWeight: number
      sourceIndex: number
      entry: ComplaintMessageView
    }
  | {
      id: string
      kind: 'evidence'
      at: string
      orderWeight: number
      sourceIndex: number
      entry: EvidenceView
    }

/**
 * Tổng hợp dòng thời gian bất biến theo đúng thứ tự phát sinh (tăng dần theo thời gian),
 * không đột biến mảng đầu vào và có tie-breaker ổn định khi các sự kiện có cùng timestamp.
 */
export function buildComplaintTimeline(
  detail: Pick<ComplaintDetailView, 'statusHistory' | 'messages' | 'evidences'>,
): ComplaintTimelineItem[] {
  const items: ComplaintTimelineItem[] = []

  const history = detail.statusHistory ?? []
  history.forEach((entry, index) => {
    const isInitialSubmit = !entry.fromStatus && entry.toStatus === 'SUBMITTED'
    items.push({
      id: `status-${entry.historyId}`,
      kind: 'status',
      at: entry.at,
      orderWeight: isInitialSubmit ? 0 : 2,
      sourceIndex: index,
      entry,
    })
  })

  const messages = detail.messages ?? []
  messages.forEach((entry, index) => {
    const isInitialBuyerMsg = index === 0 && entry.senderRole === 'BUYER'
    items.push({
      id: `message-${entry.messageId}`,
      kind: 'message',
      at: entry.createdAt,
      orderWeight: isInitialBuyerMsg ? 1 : 3,
      sourceIndex: index,
      entry,
    })
  })

  const evidences = detail.evidences ?? []
  evidences.forEach((entry, index) => {
    items.push({
      id: `evidence-${entry.evidenceId}`,
      kind: 'evidence',
      at: entry.uploadedAt,
      orderWeight: 4,
      sourceIndex: index,
      entry,
    })
  })

  return [...items].sort((a, b) => {
    const aMs = Date.parse(a.at)
    const bMs = Date.parse(b.at)
    const validA = Number.isFinite(aMs) ? aMs : 0
    const validB = Number.isFinite(bMs) ? bMs : 0
    if (validA !== validB) return validA - validB
    if (a.orderWeight !== b.orderWeight) return a.orderWeight - b.orderWeight
    return a.sourceIndex - b.sourceIndex
  })
}

/** Tìm đề xuất thương lượng mới nhất của Nhà bán trong danh sách trao đổi. */
export function findLatestSellerProposal(
  messages: readonly ComplaintMessageView[] | null | undefined,
): { message: ComplaintMessageView; proposal: ProposalPayload } | null {
  if (!messages || messages.length === 0) return null
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i]!
    if (msg.senderRole === 'SELLER' && msg.proposal?.resolution) {
      return { message: msg, proposal: msg.proposal }
    }
  }
  return null
}

/** Đếm số bằng chứng còn hiệu lực (chưa bị CSKH gỡ) theo vai trò tải lên. */
export function countActiveEvidenceByRole(
  evidences: readonly EvidenceView[] | null | undefined,
  role: 'BUYER' | 'SELLER',
): number {
  if (!evidences) return 0
  return evidences.filter((ev) => ev.uploaderRole === role && !ev.removedByCs).length
}

export function isSellerOrderComplaintEligible(status: string): boolean {
  return status === 'DELIVERED' || status === 'SHIPPING'
}

export function inferMimeFromFile(file: Pick<File, 'type' | 'name'>): string {
  const normalized = file.type.trim().toLowerCase()
  if (normalized) return normalized
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_MIME_MAP[ext] ?? ''
}

export type EvidenceValidationResult =
  | { ok: true; mimeType: string; isImage: boolean }
  | { ok: false; code: 'EMPTY' | 'INVALID_TYPE' | 'IMAGE_TOO_LARGE' | 'MEDIA_TOO_LARGE' }

export function validateEvidenceFile(file: Pick<File, 'size' | 'type' | 'name'>): EvidenceValidationResult {
  if (file.size <= 0) {
    return { ok: false, code: 'EMPTY' }
  }
  const mimeType = inferMimeFromFile(file)
  if (!(ACCEPTED_EVIDENCE_MIMES as readonly string[]).includes(mimeType)) {
    return { ok: false, code: 'INVALID_TYPE' }
  }
  const isImage = (ACCEPTED_IMAGE_MIMES as readonly string[]).includes(mimeType)
  if (isImage && file.size > MAX_IMAGE_BYTES) {
    return { ok: false, code: 'IMAGE_TOO_LARGE' }
  }
  if (!isImage && file.size > MAX_MEDIA_BYTES) {
    return { ok: false, code: 'MEDIA_TOO_LARGE' }
  }
  return { ok: true, mimeType, isImage }
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${formatNumber(Math.max(1, Math.ceil(bytes / 1024)))} KB`
}

export function isComplaintStatusFilter(value: string | null): value is ComplaintStatusFilter {
  return Boolean(value && (COMPLAINT_STATUS_FILTERS as readonly string[]).includes(value))
}

export function isComplaintTypeFilter(value: string | null): value is ComplaintType {
  return Boolean(value && (COMPLAINT_TYPES as readonly string[]).includes(value))
}

export function toDateBoundsIso(fromDate: string, toDate: string): {
  fromIso?: string
  toIso?: string
  invalidRange: boolean
} {
  const invalidRange = Boolean(fromDate && toDate && fromDate > toDate)
  if (invalidRange) {
    return { invalidRange: true }
  }
  return {
    invalidRange: false,
    fromIso: fromDate ? dayjs.tz(fromDate, APP_TIMEZONE).startOf('day').utc().format() : undefined,
    toIso: toDate ? dayjs.tz(toDate, APP_TIMEZONE).endOf('day').utc().format() : undefined,
  }
}

export function buildPageNumbers(current: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }
  const pages: (number | 'ellipsis')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(totalPages - 1, current + 1)
  if (start > 2) pages.push('ellipsis')
  for (let p = start; p <= end; p += 1) pages.push(p)
  if (end < totalPages - 1) pages.push('ellipsis')
  pages.push(totalPages)
  return pages
}

export function isRefundExceedsLimitError(error: unknown): error is ApiError {
  if (!(error instanceof ApiError) || error.status !== 422) return false
  if (error.code === 'REFUND_AMOUNT_EXCEEDS_PAID') return true
  return error.details.some(
    (detail) => detail.field === 'refundAmount' || detail.field === 'requestedRefundAmount',
  )
}
