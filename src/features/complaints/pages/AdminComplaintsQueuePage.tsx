import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '@/api/errors'
import { CopyableId, ServiceFallbackBanner, SlaCountdownPill } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { hasRole } from '@/lib/auth/roles'
import { useAuthSession } from '@/lib/auth/session'
import { formatDateTime, formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  apiClaimComplaint,
  apiListComplaints,
  apiListCsQueue,
  COMPLAINT_TYPES,
  complaintsKeys,
  PRIORITIES,
  resolveSlaStartedAt,
  sortBySlaRemainingAsc,
  type ComplaintSummaryView,
} from '../api'
import { PriorityBadge, UnverifiedFlagBadge } from '../components/PriorityBadge'

type QueueTab = 'queue' | 'all'

const ALL_STATUS_FILTERS = [
  'SUBMITTED',
  'AWAITING_SELLER',
  'NEGOTIATING',
  'ESCALATED',
  'UNDER_REVIEW',
  'EXECUTING',
  'CLOSED',
  'REJECTED',
  'WITHDRAWN',
] as const

const PAGE_LIMIT = 20

type QueueNotice =
  | { kind: 'conflict'; message: string; correlationId?: string }
  | { kind: 'error'; message: string; correlationId?: string }

function QueueSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  )
}

/** A8 `/admin/complaints/queue` — Hàng chờ SLA khiếu nại & Claim lạc quan cho CSKH (FR-CPL-006, FR-ADM-001). */
export function AdminComplaintsQueuePage() {
  const { t } = useTranslation('complaints')
  const { t: tStatus } = useTranslation('status')
  const session = useAuthSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const isCs = hasRole(session.user, 'CS')
  const [tab, setTab] = useState<QueueTab>('queue')
  const activeTab: QueueTab = isCs ? tab : 'all'

  const [priorityFilter, setPriorityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [unverifiedOnly, setUnverifiedOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState<QueueNotice | null>(null)

  const queueParams = useMemo(
    () => ({
      ...(priorityFilter ? { priority: priorityFilter } : {}),
      ...(typeFilter ? { type: typeFilter } : {}),
      ...(unverifiedOnly ? { unverifiedOnly: true } : {}),
      ...(overdueOnly ? { overdue: true } : {}),
      page,
      limit: PAGE_LIMIT,
    }),
    [priorityFilter, typeFilter, unverifiedOnly, overdueOnly, page],
  )

  const allParams = useMemo(
    () => ({
      scope: 'ALL',
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(typeFilter ? { type: typeFilter } : {}),
      ...(overdueOnly ? { overdue: true } : {}),
      page,
      limit: PAGE_LIMIT,
    }),
    [statusFilter, typeFilter, overdueOnly, page],
  )

  const queueQuery = useQuery({
    queryKey: complaintsKeys.csQueueList(queueParams),
    queryFn: () => apiListCsQueue(queueParams),
    enabled: Boolean(session.accessToken) && isCs && activeTab === 'queue',
    placeholderData: keepPreviousData,
  })

  const allQuery = useQuery({
    queryKey: complaintsKeys.list(allParams),
    queryFn: () => apiListComplaints(allParams),
    enabled: Boolean(session.accessToken) && activeTab === 'all',
    placeholderData: keepPreviousData,
  })

  const activeQuery = activeTab === 'queue' ? queueQuery : allQuery

  const items: ComplaintSummaryView[] = useMemo(() => {
    if (activeTab === 'queue') {
      return sortBySlaRemainingAsc(queueQuery.data?.items ?? [])
    }
    const rawItems = allQuery.data?.items ?? []
    return rawItems.some((item) => Boolean(item.slaDueAt))
      ? sortBySlaRemainingAsc(rawItems)
      : rawItems
  }, [activeTab, queueQuery.data?.items, allQuery.data?.items])

  const total = activeQuery.data?.total ?? 0
  const totalPages = activeQuery.data?.totalPages ?? 0

  const hasActiveFilters =
    activeTab === 'queue'
      ? Boolean(priorityFilter || typeFilter || overdueOnly || unverifiedOnly)
      : Boolean(statusFilter || typeFilter || overdueOnly)

  const claimMutation = useMutation({
    mutationFn: (item: ComplaintSummaryView) => apiClaimComplaint(item.complaintId, item.version),
    onMutate: () => {
      setNotice(null)
    },
    onSuccess: (_updated, item) => {
      void queryClient.invalidateQueries({ queryKey: complaintsKeys.all })
      void navigate(`/admin/complaints/${item.complaintId}`, {
        state: { claimedJustNow: true },
      })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setNotice({
          kind: 'conflict',
          message: error.message || t('queue.claimConflict'),
          correlationId: error.correlationId,
        })
        void queryClient.invalidateQueries({ queryKey: complaintsKeys.csQueue })
        void queryClient.invalidateQueries({ queryKey: complaintsKeys.all })
        return
      }
      setNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : t('queue.loadError'),
        correlationId: error instanceof ApiError ? error.correlationId : undefined,
      })
    },
  })

  function switchTab(nextTab: QueueTab) {
    setTab(nextTab)
    setPage(1)
    setNotice(null)
  }

  function clearFilters() {
    setPriorityFilter('')
    setStatusFilter('')
    setTypeFilter('')
    setOverdueOnly(false)
    setUnverifiedOnly(false)
    setPage(1)
  }

  const listError = activeQuery.isError && !activeQuery.data

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('queue.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('queue.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeQuery.data && (
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {t('queue.totalCount', { count: total })}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={activeQuery.isFetching}
            onClick={() => void activeQuery.refetch()}
          >
            <RefreshCw aria-hidden="true" className={activeQuery.isFetching ? 'animate-spin' : undefined} />
            {activeQuery.isFetching ? t('common.refreshing') : t('common.refresh')}
          </Button>
        </div>
      </header>

      {!isCs && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg border border-status-info-border bg-status-info p-3.5 text-sm text-status-info-foreground"
        >
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>{t('queue.adminReadOnlyNotice')}</p>
        </div>
      )}

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={cn(
            'flex items-start gap-3 rounded-lg border p-3.5 text-sm',
            notice.kind === 'conflict'
              ? 'border-status-warning-border bg-status-warning text-status-warning-foreground'
              : 'border-status-danger-border bg-status-danger text-status-danger-foreground',
          )}
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{notice.message}</span>
              {notice.kind === 'conflict' && (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={activeQuery.isFetching}
                  onClick={() => void activeQuery.refetch()}
                >
                  <RotateCcw aria-hidden="true" className={activeQuery.isFetching ? 'animate-spin' : undefined} />
                  {t('queue.reloadQueue')}
                </Button>
              )}
            </div>
            {notice.correlationId && (
              <p className="flex items-center gap-1.5 text-xs">
                <span>{t('common.correlationId')}:</span>
                <CopyableId value={notice.correlationId} label={t('common.correlationId')} />
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t('common.dismiss')}
            onClick={() => setNotice(null)}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      )}

      {isCs && (
        <div
          role="tablist"
          aria-label={t('queue.tabs.label')}
          className="flex gap-1 overflow-x-auto border-b border-border"
        >
          {(['queue', 'all'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={activeTab === value}
              onClick={() => switchTab(value)}
              className={cn(
                '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                activeTab === value
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {value === 'queue' ? t('queue.tabs.slaQueue') : t('queue.tabs.allComplaints')}
            </button>
          ))}
        </div>
      )}

      <section
        aria-label={t('queue.filters.label')}
        className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3.5 shadow-xs"
      >
        {activeTab === 'queue' ? (
          <select
            aria-label={t('queue.filters.priorityLabel')}
            value={priorityFilter}
            onChange={(event) => {
              setPriorityFilter(event.target.value)
              setPage(1)
            }}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t('queue.filters.allPriorities')}</option>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={String(priority)}>
                {t(`common.priorities.${priority}`)}
              </option>
            ))}
          </select>
        ) : (
          <select
            aria-label={t('queue.filters.statusLabel')}
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value)
              setPage(1)
            }}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t('queue.filters.allStatuses')}</option>
            {ALL_STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {tStatus(status)}
              </option>
            ))}
          </select>
        )}

        <select
          aria-label={t('queue.filters.typeLabel')}
          value={typeFilter}
          onChange={(event) => {
            setTypeFilter(event.target.value)
            setPage(1)
          }}
          className="h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">{t('queue.filters.allTypes')}</option>
          {COMPLAINT_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`common.types.${type}`)}
            </option>
          ))}
        </select>

        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 text-sm">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(event) => {
              setOverdueOnly(event.target.checked)
              setPage(1)
            }}
            className="size-4 rounded border-input"
          />
          <span>{t('queue.filters.overdue')}</span>
        </label>

        {activeTab === 'queue' && (
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 text-sm">
            <input
              type="checkbox"
              checked={unverifiedOnly}
              onChange={(event) => {
                setUnverifiedOnly(event.target.checked)
                setPage(1)
              }}
              className="size-4 rounded border-input"
            />
            <span>{t('queue.filters.unverifiedOnly')}</span>
          </label>
        )}

        {hasActiveFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            {t('queue.filters.clearFilters')}
          </Button>
        )}
      </section>

      <section aria-busy={activeQuery.isFetching} className="flex flex-col gap-4">
        {activeQuery.isPending && <QueueSkeleton />}

        {listError && (
          <ServiceFallbackBanner
            message={activeQuery.error instanceof ApiError ? activeQuery.error.message : t('queue.loadError')}
            onRetry={() => void activeQuery.refetch()}
            isRetrying={activeQuery.isFetching}
          />
        )}

        {activeQuery.data && items.length === 0 && (
          <div className="flex flex-col items-center gap-2.5 rounded-lg border border-dashed border-border bg-card py-12 text-center">
            <Inbox aria-hidden="true" className="size-8 text-muted-foreground" />
            <h2 className="text-base font-semibold">{t('queue.emptyTitle')}</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {hasActiveFilters ? t('queue.emptyFiltered') : t('queue.emptyDefault')}
            </p>
            {hasActiveFilters && (
              <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                {t('queue.filters.clearFilters')}
              </Button>
            )}
          </div>
        )}

        {items.length > 0 && (
          <>
            {/* ≥ 768px: bảng dữ liệu mật độ cao; < 768px: stacked card list (Brief §5.2). */}
            <div className="hidden overflow-x-auto rounded-lg border border-border bg-card shadow-xs md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t('queue.columns.complaint')}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t('queue.columns.typeAndRequest')}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t('queue.columns.priority')}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t('queue.columns.sla')}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t('queue.columns.status')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      {t('queue.columns.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item) => {
                    const isClaimingRow =
                      claimMutation.isPending && claimMutation.variables?.complaintId === item.complaintId
                    const canClaim = isCs && item.status === 'ESCALATED'

                    return (
                      <tr key={item.complaintId} className="align-top hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <CopyableId
                              value={item.complaintId}
                              display={item.complaintCode}
                              label={t('common.complaintCodeLabel')}
                            />
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span>Order:</span>
                              <CopyableId
                                value={item.orderId}
                                display={item.orderId.slice(0, 8)}
                                label={t('common.orderIdLabel')}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {formatDateTime(item.createdAt)}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-foreground">
                              {t(`common.types.${item.type}` as never, { defaultValue: item.type }) as string}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {
                                t(`common.resolutions.${item.requestedResolution}` as never, {
                                  defaultValue: item.requestedResolution,
                                }) as string
                              }
                            </span>
                            {item.requestedRefundAmount !== undefined && item.requestedRefundAmount > 0 && (
                              <span className="text-xs font-medium text-foreground tabular-nums">
                                {t('queue.requestedRefundCaption', {
                                  amount: formatVnd(item.requestedRefundAmount),
                                })}
                              </span>
                            )}
                            {item.unverifiedFlag && <UnverifiedFlagBadge className="self-start" />}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <PriorityBadge priority={item.priority} />
                        </td>

                        <td className="px-4 py-3">
                          {item.slaDueAt ? (
                            <SlaCountdownPill
                              deadline={item.slaDueAt}
                              startedAt={resolveSlaStartedAt(item.slaDueAt, item.priority)}
                              label={t('queue.slaLabel')}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">{t('queue.slaNotSet')}</span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <StatusBadge status={item.status} />
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            {canClaim && (
                              <Button
                                type="button"
                                size="sm"
                                disabled={claimMutation.isPending}
                                onClick={() => claimMutation.mutate(item)}
                              >
                                {isClaimingRow && <Loader2 aria-hidden="true" className="animate-spin" />}
                                {isClaimingRow ? t('queue.claimingButton') : t('queue.claimButton')}
                                <span className="sr-only">: {item.complaintCode}</span>
                              </Button>
                            )}
                            <Button asChild type="button" variant="outline" size="sm">
                              <Link to={`/admin/complaints/${item.complaintId}`}>
                                {t('queue.viewButton')}
                                <span className="sr-only">: {item.complaintCode}</span>
                              </Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <ul className="flex flex-col gap-3 md:hidden">
              {items.map((item) => {
                const isClaimingRow =
                  claimMutation.isPending && claimMutation.variables?.complaintId === item.complaintId
                const canClaim = isCs && item.status === 'ESCALATED'

                return (
                  <li
                    key={item.complaintId}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-col gap-0.5">
                        <CopyableId
                          value={item.complaintId}
                          display={item.complaintCode}
                          label={t('common.complaintCodeLabel')}
                        />
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatDateTime(item.createdAt)}
                        </span>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={item.priority} />
                      {item.slaDueAt && (
                        <SlaCountdownPill
                          deadline={item.slaDueAt}
                          startedAt={resolveSlaStartedAt(item.slaDueAt, item.priority)}
                          label={t('queue.slaLabel')}
                        />
                      )}
                      {item.unverifiedFlag && <UnverifiedFlagBadge />}
                    </div>

                    <div className="text-sm">
                      <p className="font-medium">
                        {t(`common.types.${item.type}` as never, { defaultValue: item.type }) as string}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {
                          t(`common.resolutions.${item.requestedResolution}` as never, {
                            defaultValue: item.requestedResolution,
                          }) as string
                        }
                        {item.requestedRefundAmount !== undefined && item.requestedRefundAmount > 0
                          ? ` · ${formatVnd(item.requestedRefundAmount)}`
                          : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      {canClaim && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={claimMutation.isPending}
                          onClick={() => claimMutation.mutate(item)}
                        >
                          {isClaimingRow && <Loader2 aria-hidden="true" className="animate-spin" />}
                          {isClaimingRow ? t('queue.claimingButton') : t('queue.claimButton')}
                          <span className="sr-only">: {item.complaintCode}</span>
                        </Button>
                      )}
                      <Button asChild type="button" variant="outline" size="sm">
                        <Link to={`/admin/complaints/${item.complaintId}`}>
                          {t('queue.viewButton')}
                          <span className="sr-only">: {item.complaintCode}</span>
                        </Link>
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {totalPages > 1 && (
          <nav
            aria-label={t('queue.pagination.summary', {
              page,
              totalPages,
              total: formatNumber(total),
            })}
            className="flex flex-wrap items-center justify-between gap-3 text-sm"
          >
            <span className="text-muted-foreground tabular-nums">
              {t('queue.pagination.summary', {
                page,
                totalPages,
                total: formatNumber(total),
              })}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || activeQuery.isFetching}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                <ChevronLeft aria-hidden="true" />
                {t('queue.pagination.prev')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages || activeQuery.isFetching}
                onClick={() => setPage((prev) => prev + 1)}
              >
                {t('queue.pagination.next')}
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </nav>
        )}
      </section>
    </div>
  )
}
