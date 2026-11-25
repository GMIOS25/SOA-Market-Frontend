import { authFetch } from '@/api/auth-fetch'
import { createApiClient } from '@/api/client'
import { networkError, toApiError, unwrap } from '@/api/errors'
import type { SvcCpl } from '@/api/generated'
import { idempotencyHeaders } from '@/api/idempotency'
import { env } from '@/lib/env'

export { COMPLAINT_TYPES, formatFileSize, type ComplaintType } from './helpers'

export type ComplaintSummaryView = SvcCpl.components['schemas']['ComplaintSummaryView']
export type CSQueueItemView = SvcCpl.components['schemas']['CSQueueItemView']
export type CSQueueResult = SvcCpl.components['schemas']['CSQueueResult']
export type ComplaintListResult = SvcCpl.components['schemas']['ComplaintListResult']
export type ComplaintDetailView = SvcCpl.components['schemas']['ComplaintDetailView']
export type CrossServiceDossierView = SvcCpl.components['schemas']['CrossServiceDossierView']
export type RelatedComplaintView = SvcCpl.components['schemas']['RelatedComplaintView']
export type EvidenceView = SvcCpl.components['schemas']['EvidenceView']
export type ComplaintMessageView = SvcCpl.components['schemas']['ComplaintMessageView']
export type ComplaintStatusHistoryView = SvcCpl.components['schemas']['ComplaintStatusHistoryView']
export type ResolutionView = SvcCpl.components['schemas']['ResolutionView']
export type ProposalPayload = SvcCpl.components['schemas']['ProposalPayload']
export type CreateComplaintsInput = SvcCpl.components['schemas']['CreateComplaintsInput']
export type CreateComplaintsResult = SvcCpl.components['schemas']['CreateComplaintsResult']
export type RespondComplaintInput = SvcCpl.components['schemas']['RespondComplaintInput']
export type RespondComplaintResult = SvcCpl.components['schemas']['RespondComplaintResult']
export type CSDecisionInput = SvcCpl.components['schemas']['CSDecisionInput']
export type CSDecisionResult = SvcCpl.components['schemas']['CSDecisionResult']

export type ListCsQueueParams = NonNullable<
  SvcCpl.operations['list-cs-complaints-queue']['parameters']['query']
>
export type ListComplaintsParams = NonNullable<
  SvcCpl.operations['list-complaints']['parameters']['query']
>

export const DECISION_OUTCOMES = [
  'FULL_REFUND',
  'PARTIAL_REFUND',
  'RETURN_REFUND',
  'EXCHANGE',
  'REJECTED',
] as const
export type DecisionOutcome = (typeof DECISION_OUTCOMES)[number]

export const REFUND_OUTCOMES: ReadonlySet<string> = new Set([
  'FULL_REFUND',
  'PARTIAL_REFUND',
  'RETURN_REFUND',
])

export const RESPONSIBLE_PARTIES = ['SELLER', 'CARRIER', 'PLATFORM', 'NONE'] as const
export type ResponsibleParty = (typeof RESPONSIBLE_PARTIES)[number]

export const PRIORITIES = [1, 2, 3, 4] as const
export type ComplaintPriority = (typeof PRIORITIES)[number]

export const cplClient = createApiClient<SvcCpl.paths>()

export const complaintKeys = {
  all: ['complaints'] as const,
  lists: () => ['complaints', 'list'] as const,
  list: (scope: 'BUYER' | 'SELLER', params: ListComplaintsParams) =>
    ['complaints', 'list', scope, params] as const,
  details: () => ['complaints', 'detail'] as const,
  detail: (complaintId: string) => ['complaints', 'detail', complaintId] as const,
  evidenceBlob: (complaintId: string, evidenceId: string) =>
    ['complaints', 'evidence', complaintId, evidenceId] as const,
}

export const complaintsKeys = {
  all: ['complaints'] as const,
  csQueue: ['complaints', 'cs-queue'] as const,
  csQueueList: (params: ListCsQueueParams) => ['complaints', 'cs-queue', params] as const,
  list: (params: ListComplaintsParams) => ['complaints', 'list', params] as const,
  detail: (id: string) => ['complaints', 'detail', id] as const,
  evidenceBlob: (complaintId: string, evidenceId: string) =>
    ['complaints', 'evidence', complaintId, evidenceId] as const,
}

export function apiListCsQueue(params: ListCsQueueParams): Promise<CSQueueResult> {
  return unwrap(cplClient.GET('/v1/cs/complaints/queue', { params: { query: params } }))
}

export function apiListComplaints(params: ListComplaintsParams = {}): Promise<ComplaintListResult> {
  return unwrap(
    cplClient.GET('/v1/complaints', {
      params: {
        query: {
          scope: params.scope || undefined,
          shopId: params.shopId || undefined,
          status: params.status || undefined,
          type: params.type || undefined,
          orderId: params.orderId || undefined,
          sellerOrderId: params.sellerOrderId || undefined,
          overdue: params.overdue || undefined,
          from: params.from || undefined,
          to: params.to || undefined,
          page: params.page,
          limit: params.limit,
        },
      },
    }),
  )
}

export function apiGetComplaintDetail(complaintId: string): Promise<ComplaintDetailView> {
  return unwrap(
    cplClient.GET('/v1/complaints/{id}', {
      params: { path: { id: complaintId } },
    }),
  )
}

export function apiCreateComplaints(
  body: CreateComplaintsInput,
  idempotencyKey: string,
): Promise<CreateComplaintsResult> {
  return unwrap(
    cplClient.POST('/v1/complaints', {
      body,
      headers: idempotencyHeaders(idempotencyKey),
    }),
  )
}

export function apiRespondToComplaint(
  complaintId: string,
  body: RespondComplaintInput,
): Promise<RespondComplaintResult> {
  return unwrap(
    cplClient.POST('/v1/complaints/{id}/responses', {
      params: { path: { id: complaintId } },
      body,
    }),
  )
}

export function apiWithdrawComplaint(
  complaintId: string,
  reason?: string,
): Promise<ComplaintSummaryView> {
  const trimmed = reason?.trim()
  return unwrap(
    cplClient.POST('/v1/complaints/{id}/withdraw', {
      params: { path: { id: complaintId } },
      body: trimmed ? { reason: trimmed } : {},
    }),
  )
}

export function apiEscalateComplaint(
  complaintId: string,
  reason?: string,
): Promise<ComplaintSummaryView> {
  const trimmed = reason?.trim()
  return unwrap(
    cplClient.POST('/v1/complaints/{id}/escalate', {
      params: { path: { id: complaintId } },
      body: trimmed ? { reason: trimmed } : {},
    }),
  )
}

export function apiClaimComplaint(id: string, version?: number): Promise<ComplaintSummaryView> {
  return unwrap(
    cplClient.POST('/v1/cs/complaints/{id}/claim', {
      params: { path: { id } },
      body: version !== undefined ? { version } : {},
    }),
  )
}

export function apiDecideComplaint(id: string, input: CSDecisionInput): Promise<CSDecisionResult> {
  return unwrap(
    cplClient.POST('/v1/cs/complaints/{id}/decision', {
      params: { path: { id } },
      body: input,
    }),
  )
}

/**
 * Tải lên tệp bằng chứng (multipart/form-data) qua `authFetch` để trình duyệt tự đặt boundary.
 */
export async function apiUploadComplaintEvidence(
  complaintId: string,
  file: File,
): Promise<EvidenceView> {
  const form = new FormData()
  form.set('file', file, file.name)

  let response: Response
  try {
    response = await authFetch(
      new Request(`${env.apiBaseUrl}/v1/complaints/${encodeURIComponent(complaintId)}/evidence`, {
        method: 'POST',
        body: form,
      }),
    )
  } catch {
    throw networkError()
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw toApiError(body, response)
  return body as EvidenceView
}

/**
 * Tải tệp bằng chứng riêng tư qua proxy có kiểm tra RBAC/IDOR (NFR-SEC-011).
 */
export async function apiDownloadComplaintEvidence(
  complaintId: string,
  evidenceId: string,
): Promise<Blob> {
  const url = `${env.apiBaseUrl}/v1/complaints/${encodeURIComponent(complaintId)}/evidence/${encodeURIComponent(evidenceId)}`
  let response: Response
  try {
    response = await authFetch(new Request(url, { method: 'GET', cache: 'no-store' }))
  } catch {
    throw networkError()
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    throw toApiError(body, response)
  }
  return response.blob()
}

/** Khớp `domain.ComputeSLADuration` trong SVC-CPL: P1 = 12h, P2 = 24h, P3/P4 = 48h. */
export function slaDurationHoursForPriority(priority: number): number {
  if (priority === 1) return 12
  if (priority === 2) return 24
  return 48
}

export function resolveSlaStartedAt(slaDueAt: string | undefined, priority: number): string | undefined {
  if (!slaDueAt) return undefined
  const dueMs = Date.parse(slaDueAt)
  if (!Number.isFinite(dueMs)) return undefined
  return new Date(dueMs - slaDurationHoursForPriority(priority) * 3_600_000).toISOString()
}

function resolveSortableSlaMs(
  item: { slaDueAt?: string; slaRemainingSeconds?: number; slaBreached?: boolean },
  nowMs: number,
): number {
  if (item.slaDueAt) {
    const dueMs = Date.parse(item.slaDueAt)
    if (Number.isFinite(dueMs)) return dueMs - nowMs
  }
  if (typeof item.slaRemainingSeconds === 'number' && (item.slaRemainingSeconds !== 0 || item.slaBreached)) {
    return item.slaRemainingSeconds * 1000
  }
  return Number.POSITIVE_INFINITY
}

/** Sắp xếp tăng dần theo thời hạn SLA còn lại (quá hạn / sắp hết hạn lên đầu). */
export function sortBySlaRemainingAsc<
  T extends { slaDueAt?: string; slaRemainingSeconds?: number; slaBreached?: boolean; createdAt: string },
>(items: readonly T[]): T[] {
  const nowMs = Date.now()
  return [...items].sort((a, b) => {
    const diff = resolveSortableSlaMs(a, nowMs) - resolveSortableSlaMs(b, nowMs)
    if (diff !== 0) return diff
    return Date.parse(a.createdAt) - Date.parse(b.createdAt)
  })
}

export function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Không đọc được tệp bằng chứng'))
    reader.readAsDataURL(blob)
  })
}

export function openEvidenceBlob(blob: Blob, downloadFileName?: string): void {
  const url = URL.createObjectURL(blob)
  if (downloadFileName) {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = downloadFileName
    anchor.rel = 'noopener noreferrer'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
