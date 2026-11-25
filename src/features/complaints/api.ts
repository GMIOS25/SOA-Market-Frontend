import { authFetch } from '@/api/auth-fetch'
import { createApiClient } from '@/api/client'
import { networkError, toApiError, unwrap } from '@/api/errors'
import type { SvcCpl } from '@/api/generated'
import { idempotencyHeaders } from '@/api/idempotency'
import { env } from '@/lib/env'

export type ComplaintSummaryView = SvcCpl.components['schemas']['ComplaintSummaryView']
export type ComplaintDetailView = SvcCpl.components['schemas']['ComplaintDetailView']
export type ComplaintListResult = SvcCpl.components['schemas']['ComplaintListResult']
export type ComplaintMessageView = SvcCpl.components['schemas']['ComplaintMessageView']
export type ComplaintStatusHistoryView = SvcCpl.components['schemas']['ComplaintStatusHistoryView']
export type EvidenceView = SvcCpl.components['schemas']['EvidenceView']
export type RelatedComplaintView = SvcCpl.components['schemas']['RelatedComplaintView']
export type ResolutionView = SvcCpl.components['schemas']['ResolutionView']
export type ProposalPayload = SvcCpl.components['schemas']['ProposalPayload']
export type CreateComplaintsInput = SvcCpl.components['schemas']['CreateComplaintsInput']
export type CreateComplaintsResult = SvcCpl.components['schemas']['CreateComplaintsResult']
export type RespondComplaintInput = SvcCpl.components['schemas']['RespondComplaintInput']
export type RespondComplaintResult = SvcCpl.components['schemas']['RespondComplaintResult']

export type ListComplaintsParams = NonNullable<
  SvcCpl.operations['list-complaints']['parameters']['query']
>

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
