import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, RefreshCw, ShieldAlert, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router'
import { ApiError } from '@/api/errors'
import { CopyableId, ServiceFallbackBanner, SlaCountdownPill } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { hasRole } from '@/lib/auth/roles'
import { useAuthSession } from '@/lib/auth/session'
import {
  apiClaimComplaint,
  apiDecideComplaint,
  apiGetComplaintDetail,
  complaintsKeys,
  resolveSlaStartedAt,
  type ComplaintDetailView,
  type CSDecisionInput,
} from '../api'
import { ComplaintDecisionColumn } from '../components/ComplaintDecisionColumn'
import { ComplaintDossierColumn } from '../components/ComplaintDossierColumn'
import { ComplaintTimelineEvidenceColumn } from '../components/ComplaintTimelineEvidenceColumn'
import { PriorityBadge, UnverifiedFlagBadge } from '../components/PriorityBadge'

const TERMINAL_STATUSES = new Set(['CLOSED', 'REJECTED', 'WITHDRAWN'])

type WorkspaceLocationState = {
  claimedJustNow?: boolean
} | null

type WorkspaceNotice = {
  complaintId: string
  message: string
  warning?: string
}

type WorkspaceErrorState = {
  complaintId: string
  error: ApiError | Error
}

function WorkspaceSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-4">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-44 w-full rounded-lg" />
      </div>
      <div className="space-y-4 lg:col-span-4">
        <Skeleton className="h-72 w-full rounded-lg" />
        <Skeleton className="h-52 w-full rounded-lg" />
      </div>
      <div className="space-y-4 lg:col-span-4">
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    </div>
  )
}

/**
 * A8 `/admin/complaints/:id` — Workspace phân xử khiếu nại 3 cột (FR-CPL-006..009):
 * Cột 1: Hồ sơ tổng hợp đa dịch vụ + tab cùng `orderId`
 * Cột 2: Dòng thời gian bất biến & Bằng chứng SHA-256
 * Cột 3: Tiếp nhận (Claim) & Form ra quyết định kèm lý do bắt buộc
 */
export function AdminComplaintWorkspacePage() {
  const { t } = useTranslation('complaints')
  const { id: complaintId = '' } = useParams()
  const location = useLocation()
  const session = useAuthSession()
  const queryClient = useQueryClient()

  const isCs = hasRole(session.user, 'CS')
  const locationState = location.state as WorkspaceLocationState

  const [noticeState, setNoticeState] = useState<WorkspaceNotice | null>(null)
  const [dismissedClaimedId, setDismissedClaimedId] = useState<string | null>(null)
  const [actionErrorState, setActionErrorState] = useState<WorkspaceErrorState | null>(null)

  const detailQuery = useQuery({
    queryKey: complaintsKeys.detail(complaintId),
    queryFn: () => apiGetComplaintDetail(complaintId),
    enabled: Boolean(session.accessToken) && Boolean(complaintId),
    retry: false,
  })

  const detail = detailQuery.data

  const claimMutation = useMutation({
    mutationFn: () => apiClaimComplaint(complaintId, detail?.complaint.version),
    onMutate: () => {
      setActionErrorState(null)
    },
    onSuccess: (updated) => {
      setNoticeState({
        complaintId,
        message: t('workspace.claimedBanner', { code: updated.complaintCode }),
      })
      void queryClient.invalidateQueries({ queryKey: complaintsKeys.all })
      void detailQuery.refetch()
    },
    onError: (err) => {
      const normalized = err instanceof Error ? err : new Error(t('workspace.loadError'))
      setActionErrorState({ complaintId, error: normalized })
      if (err instanceof ApiError && err.status === 409) {
        void queryClient.invalidateQueries({ queryKey: complaintsKeys.detail(complaintId) })
        void queryClient.invalidateQueries({ queryKey: complaintsKeys.csQueue })
      }
    },
  })

  const decideMutation = useMutation({
    mutationFn: (input: CSDecisionInput) => apiDecideComplaint(complaintId, input),
    onMutate: () => {
      setActionErrorState(null)
    },
    onSuccess: (result) => {
      queryClient.setQueryData<ComplaintDetailView>(complaintsKeys.detail(complaintId), (prev) =>
        prev
          ? {
              ...prev,
              complaint: result.complaint,
              resolution: result.resolution,
              availableActions: [],
            }
          : prev,
      )
      setNoticeState({
        complaintId,
        message: t('workspace.decidedBanner', { code: result.complaint.complaintCode }),
        warning: result.warning,
      })
      void queryClient.invalidateQueries({ queryKey: complaintsKeys.all })
      void detailQuery.refetch()
    },
    onError: (err) => {
      const normalized = err instanceof Error ? err : new Error(t('workspace.loadError'))
      setActionErrorState({ complaintId, error: normalized })
      if (err instanceof ApiError && err.status === 409) {
        void queryClient.invalidateQueries({ queryKey: complaintsKeys.detail(complaintId) })
        void queryClient.invalidateQueries({ queryKey: complaintsKeys.all })
      }
    },
  })

  const isForbidden = detailQuery.error instanceof ApiError && detailQuery.error.status === 403
  const isNotFound = detailQuery.error instanceof ApiError && detailQuery.error.status === 404

  const activeNotice: WorkspaceNotice | null =
    noticeState && noticeState.complaintId === complaintId
      ? noticeState
      : detail && locationState?.claimedJustNow && dismissedClaimedId !== complaintId
        ? {
            complaintId,
            message: t('workspace.claimedBanner', { code: detail.complaint.complaintCode }),
          }
        : null

  const activeActionError =
    actionErrorState && actionErrorState.complaintId === complaintId ? actionErrorState.error : null

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <Link
            to="/admin/complaints/queue"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            <span>{t('common.backToQueue')}</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {detail
                ? t('workspace.title', { code: detail.complaint.complaintCode })
                : t('workspace.loadingTitle')}
            </h1>
            {detail && (
              <>
                <CopyableId
                  value={detail.complaint.complaintId}
                  display={detail.complaint.complaintCode}
                  label={t('common.complaintCodeLabel')}
                />
                <StatusBadge status={detail.complaint.status} />
                <PriorityBadge priority={detail.complaint.priority} />
                {detail.complaint.unverifiedFlag && <UnverifiedFlagBadge />}
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {detail?.complaint.slaDueAt && !TERMINAL_STATUSES.has(detail.complaint.status) && (
            <SlaCountdownPill
              deadline={detail.complaint.slaDueAt}
              startedAt={resolveSlaStartedAt(detail.complaint.slaDueAt, detail.complaint.priority)}
              label={t('workspace.slaLabel')}
            />
          )}
          {!isForbidden && !isNotFound && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={detailQuery.isFetching}
              onClick={() => void detailQuery.refetch()}
            >
              <RefreshCw aria-hidden="true" className={detailQuery.isFetching ? 'animate-spin' : undefined} />
              {detailQuery.isFetching ? t('common.refreshing') : t('common.refresh')}
            </Button>
          )}
        </div>
      </header>

      {activeNotice && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-status-success-border bg-status-success p-3.5 text-sm text-status-success-foreground"
        >
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-1 flex-col gap-1">
            <p className="font-medium">{activeNotice.message}</p>
            {activeNotice.warning && (
              <p className="text-xs">{t('workspace.decisionWarning', { warning: activeNotice.warning })}</p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t('common.dismiss')}
            onClick={() => {
              setNoticeState(null)
              setDismissedClaimedId(complaintId)
            }}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      )}

      {isForbidden ? (
        <section
          role="alert"
          className="flex flex-col items-center gap-3 rounded-lg border border-status-danger-border bg-status-danger p-8 text-center text-status-danger-foreground"
        >
          <ShieldAlert aria-hidden="true" className="size-10" />
          <h2 className="text-lg font-semibold">{t('workspace.forbiddenTitle')}</h2>
          <p className="max-w-md text-sm">{t('workspace.forbiddenDescription')}</p>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/complaints/queue">{t('common.backToQueue')}</Link>
          </Button>
        </section>
      ) : isNotFound ? (
        <section className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-8 text-center shadow-xs">
          <h2 className="text-lg font-semibold">{t('workspace.notFoundTitle')}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{t('workspace.notFoundDescription')}</p>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/complaints/queue">{t('common.backToQueue')}</Link>
          </Button>
        </section>
      ) : detailQuery.isPending ? (
        <WorkspaceSkeleton />
      ) : detailQuery.isError || !detail ? (
        <ServiceFallbackBanner
          message={detailQuery.error instanceof ApiError ? detailQuery.error.message : t('workspace.loadError')}
          onRetry={() => void detailQuery.refetch()}
          isRetrying={detailQuery.isFetching}
        />
      ) : (
        /* Bố cục Workspace phân xử 3 cột trên desktop (4-4-4) và xếp chồng trên mobile */
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-4">
            <ComplaintDossierColumn
              complaint={detail.complaint}
              relatedComplaints={detail.relatedComplaints ?? []}
              dossier={detail.dossier}
              isRefetching={detailQuery.isFetching}
              onRetryDossier={() => void detailQuery.refetch()}
            />
          </div>

          <div className="min-w-0 lg:col-span-4">
            <ComplaintTimelineEvidenceColumn
              complaintId={detail.complaint.complaintId}
              statusHistory={detail.statusHistory ?? []}
              messages={detail.messages ?? []}
              evidences={detail.evidences ?? []}
            />
          </div>

          <div className="min-w-0 lg:col-span-4">
            <ComplaintDecisionColumn
              detail={detail}
              currentUserId={session.user?.userId}
              isCs={isCs}
              onClaim={async () => {
                await claimMutation.mutateAsync()
              }}
              isClaiming={claimMutation.isPending}
              onDecide={(input) => decideMutation.mutateAsync(input)}
              isDeciding={decideMutation.isPending}
              actionError={activeActionError}
              onReload={() => void detailQuery.refetch()}
              isReloading={detailQuery.isFetching}
            />
          </div>
        </div>
      )}
    </div>
  )
}
