import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  MessageSquareWarning,
  RefreshCw,
  ShieldAlert,
  Store,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ApiError } from '@/api/errors'
import { CopyableId, ServiceFallbackBanner, SlaCountdownPill } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { apiGetSellerShop } from '@/features/cart-checkout-order/seller-orders-api'
import { useAuthSession } from '@/lib/auth/session'
import { formatDateTime, formatNumber, formatVnd } from '@/lib/format'
import { apiListComplaints, complaintKeys } from '../api'
import { ComplaintFilterBar } from '../components/ComplaintFilterBar'
import {
  buildPageNumbers,
  resolveComplaintSla,
  toDateBoundsIso,
  type ComplaintStatusFilter,
  type ComplaintType,
} from '../helpers'

const PAGE_LIMIT = 10

function SellerComplaintsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-20 w-full rounded-lg" />
    </div>
  )
}

/**
 * Trang quản lý khiếu nại dành cho Seller (`/seller/complaints`, FR-CPL-004, FR-CPL-009).
 */
export function SellerComplaintsPage() {
  const { t } = useTranslation('complaints')
  const session = useAuthSession()

  const [statusFilter, setStatusFilter] = useState<ComplaintStatusFilter>('ALL')
  const [typeFilter, setTypeFilter] = useState<ComplaintType | ''>('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [jumpPageInput, setJumpPageInput] = useState('')

  const dateBounds = useMemo(() => toDateBoundsIso(fromDate, toDate), [fromDate, toDate])
  const hasActiveFilters =
    statusFilter !== 'ALL' || Boolean(typeFilter) || overdueOnly || Boolean(fromDate) || Boolean(toDate)

  const shopQuery = useQuery({
    queryKey: ['seller', 'shop'],
    queryFn: apiGetSellerShop,
    enabled: Boolean(session.accessToken),
    retry: false,
    staleTime: 5 * 60_000,
  })

  const myShop = shopQuery.data
  const myShopId = myShop?.shopId

  const queryParams = useMemo(
    () => ({
      scope: 'SELLER' as const,
      shopId: myShopId,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      type: typeFilter || undefined,
      overdue: overdueOnly || undefined,
      from: dateBounds.fromIso,
      to: dateBounds.toIso,
      page,
      limit: PAGE_LIMIT,
    }),
    [myShopId, statusFilter, typeFilter, overdueOnly, dateBounds.fromIso, dateBounds.toIso, page],
  )

  const complaintsQuery = useQuery({
    queryKey: complaintKeys.list('SELLER', queryParams),
    queryFn: () => apiListComplaints(queryParams),
    enabled: Boolean(session.accessToken) && !dateBounds.invalidRange,
  })

  const isForbidden = complaintsQuery.error instanceof ApiError && complaintsQuery.error.status === 403
  const rawItems = complaintsQuery.data?.items

  // Cô lập nhiều lớp: chỉ hiển thị khiếu nại thuộc đúng shopId của Seller hiện tại.
  const visibleComplaints = useMemo(() => {
    const items = rawItems ?? []
    if (!myShopId) return items
    return items.filter((item) => item.shopId === myShopId)
  }, [rawItems, myShopId])

  const totalItems = complaintsQuery.data?.total ?? 0
  const totalPages = Math.max(1, complaintsQuery.data?.totalPages ?? 1)

  function handlePageChange(nextPage: number) {
    const clamped = Math.min(Math.max(1, nextPage), totalPages)
    setPage(clamped)
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function handleJumpPageSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = Number.parseInt(jumpPageInput, 10)
    if (Number.isFinite(target) && target >= 1) {
      handlePageChange(target)
      setJumpPageInput('')
    }
  }

  function handleClearFilters() {
    setStatusFilter('ALL')
    setTypeFilter('')
    setOverdueOnly(false)
    setFromDate('')
    setToDate('')
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{t('sellerList.title')}</h1>
            {myShop?.name && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                <Store aria-hidden="true" className="size-3.5 text-primary" />
                {t('common.shopBadge', { name: myShop.name })}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{t('sellerList.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!complaintsQuery.isLoading && !complaintsQuery.isError && (
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {t('sellerList.totalCount', { count: totalItems })}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={complaintsQuery.isFetching || dateBounds.invalidRange}
            onClick={() => void complaintsQuery.refetch()}
          >
            <RefreshCw aria-hidden="true" className={complaintsQuery.isFetching ? 'animate-spin' : undefined} />
            {complaintsQuery.isFetching ? t('common.refreshing') : t('common.refresh')}
          </Button>
        </div>
      </header>

      <ComplaintFilterBar
        status={statusFilter}
        type={typeFilter}
        fromDate={fromDate}
        toDate={toDate}
        overdueOnly={overdueOnly}
        showOverdueFilter
        invalidDateRange={dateBounds.invalidRange}
        onStatusChange={(next) => {
          setStatusFilter(next)
          setPage(1)
        }}
        onTypeChange={(next) => {
          setTypeFilter(next)
          setPage(1)
        }}
        onFromDateChange={(val) => {
          setFromDate(val)
          setPage(1)
        }}
        onToDateChange={(val) => {
          setToDate(val)
          setPage(1)
        }}
        onOverdueChange={(val) => {
          setOverdueOnly(val)
          setPage(1)
        }}
        onClearFilters={handleClearFilters}
      />

      {isForbidden ? (
        <section
          role="alert"
          className="flex flex-col items-center gap-3 rounded-lg border border-status-danger-border bg-status-danger p-8 text-center text-status-danger-foreground"
        >
          <ShieldAlert aria-hidden="true" className="size-10" />
          <h2 className="text-lg font-semibold">{t('common.forbiddenTitle')}</h2>
          <p className="max-w-md text-sm">{t('common.forbiddenDescription')}</p>
        </section>
      ) : dateBounds.invalidRange ? null : complaintsQuery.isLoading ? (
        <SellerComplaintsSkeleton />
      ) : complaintsQuery.isError ? (
        <ServiceFallbackBanner
          message={complaintsQuery.error instanceof ApiError ? complaintsQuery.error.message : t('sellerList.loadError')}
          onRetry={() => void complaintsQuery.refetch()}
          isRetrying={complaintsQuery.isFetching}
        />
      ) : visibleComplaints.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-12 text-center shadow-xs">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <MessageSquareWarning aria-hidden="true" className="size-7" />
          </div>
          <h2 className="text-lg font-semibold">{t('sellerList.emptyTitle')}</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {hasActiveFilters ? t('sellerList.emptyFilteredDescription') : t('sellerList.emptyDescription')}
          </p>
          {hasActiveFilters && (
            <Button type="button" variant="outline" size="sm" onClick={handleClearFilters}>
              {t('filters.clearFilters')}
            </Button>
          )}
        </section>
      ) : (
        <>
          {/* Bảng mật độ cao cho Desktop */}
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-card shadow-xs md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">{t('sellerList.table.complaint')}</th>
                  <th className="px-4 py-3">{t('sellerList.table.issue')}</th>
                  <th className="px-4 py-3">{t('sellerList.table.statusSla')}</th>
                  <th className="px-4 py-3">{t('sellerList.table.description')}</th>
                  <th className="px-4 py-3 text-right">{t('sellerList.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleComplaints.map((cpl) => {
                  const sla = resolveComplaintSla(cpl)
                  const needsAction = cpl.status === 'AWAITING_SELLER' || cpl.status === 'NEGOTIATING'

                  return (
                    <tr key={cpl.complaintId} className="align-top hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <CopyableId
                            value={cpl.complaintCode}
                            display={cpl.complaintCode}
                            label={t('common.complaintCodeLabel')}
                          />
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {formatDateTime(cpl.createdAt)}
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="space-y-1 text-xs">
                          <p className="font-medium text-foreground">
                            {t(`types.${cpl.type}` as never, { defaultValue: cpl.type }) as string}
                          </p>
                          <p className="text-muted-foreground">
                            {t(`resolutions.${cpl.requestedResolution}` as never, {
                              defaultValue: cpl.requestedResolution,
                            }) as string}
                          </p>
                          {cpl.requestedRefundAmount !== undefined && cpl.requestedRefundAmount > 0 && (
                            <p className="font-semibold text-price tabular-nums">
                              {formatVnd(cpl.requestedRefundAmount)}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1.5">
                          <StatusBadge status={cpl.status} />
                          {sla && (
                            <SlaCountdownPill
                              label={t(sla.labelKey)}
                              startedAt={sla.startedAt}
                              deadline={sla.deadline}
                            />
                          )}
                          {cpl.unverifiedFlag && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-status-warning-border bg-status-warning px-2 py-0.5 text-[11px] font-medium text-status-warning-foreground">
                              <AlertTriangle aria-hidden="true" className="size-3" />
                              {t('common.unverifiedBadge')}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="max-w-xs px-4 py-3">
                        <p className="line-clamp-2 text-xs text-muted-foreground">{cpl.description}</p>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Button asChild size="sm" variant={needsAction ? 'default' : 'outline'}>
                          <Link to={`/seller/complaints/${cpl.complaintId}`}>
                            {needsAction
                              ? t('sellerList.table.respondAction')
                              : t('sellerList.table.viewAction')}
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Stacked Cards cho Mobile */}
          <div className="space-y-3 md:hidden">
            {visibleComplaints.map((cpl) => {
              const sla = resolveComplaintSla(cpl)
              const needsAction = cpl.status === 'AWAITING_SELLER' || cpl.status === 'NEGOTIATING'

              return (
                <article
                  key={cpl.complaintId}
                  className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <CopyableId
                        value={cpl.complaintCode}
                        display={cpl.complaintCode}
                        label={t('common.complaintCodeLabel')}
                      />
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatDateTime(cpl.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={cpl.status} />
                  </div>

                  {sla && (
                    <div>
                      <SlaCountdownPill
                        label={t(sla.labelKey)}
                        startedAt={sla.startedAt}
                        deadline={sla.deadline}
                      />
                    </div>
                  )}

                  <div className="space-y-1 border-t border-border pt-2.5 text-xs">
                    <p className="font-medium text-foreground">
                      {t(`types.${cpl.type}` as never, { defaultValue: cpl.type }) as string} ·{' '}
                      {t(`resolutions.${cpl.requestedResolution}` as never, {
                        defaultValue: cpl.requestedResolution,
                      }) as string}
                    </p>
                    <p className="line-clamp-2 text-muted-foreground">{cpl.description}</p>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5">
                    {cpl.requestedRefundAmount !== undefined && cpl.requestedRefundAmount > 0 ? (
                      <span className="text-sm font-semibold text-price tabular-nums">
                        {formatVnd(cpl.requestedRefundAmount)}
                      </span>
                    ) : (
                      <span />
                    )}
                    <Button asChild size="sm" variant={needsAction ? 'default' : 'outline'}>
                      <Link to={`/seller/complaints/${cpl.complaintId}`}>
                        {needsAction
                          ? t('sellerList.table.respondAction')
                          : t('sellerList.table.viewAction')}
                      </Link>
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>

          {totalItems > 0 && (
            <nav
              aria-label={t('pagination.summary', {
                page,
                totalPages,
                total: formatNumber(totalItems),
              })}
              className="flex flex-col items-center justify-between gap-3 pt-2 text-sm sm:flex-row"
            >
              <span className="text-xs text-muted-foreground tabular-nums">
                {t('pagination.showingRange', {
                  from: (page - 1) * PAGE_LIMIT + 1,
                  to: Math.min(page * PAGE_LIMIT, totalItems),
                  total: formatNumber(totalItems),
                })}
              </span>

              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1 tabular-nums">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={t('pagination.prev')}
                    disabled={page <= 1 || complaintsQuery.isFetching}
                    onClick={() => handlePageChange(page - 1)}
                    className="size-8 p-0"
                  >
                    <ChevronLeft aria-hidden="true" />
                  </Button>

                  {buildPageNumbers(page, totalPages).map((item, idx) =>
                    item === 'ellipsis' ? (
                      <span
                        key={`ellipsis-${idx}`}
                        aria-hidden="true"
                        className="px-1.5 text-xs text-muted-foreground select-none"
                      >
                        …
                      </span>
                    ) : (
                      <Button
                        key={item}
                        type="button"
                        size="sm"
                        variant={item === page ? 'default' : 'ghost'}
                        aria-current={item === page ? 'page' : undefined}
                        disabled={complaintsQuery.isFetching}
                        onClick={() => handlePageChange(item)}
                        className="size-8 p-0"
                      >
                        {item}
                      </Button>
                    ),
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={t('pagination.next')}
                    disabled={page >= totalPages || complaintsQuery.isFetching}
                    onClick={() => handlePageChange(page + 1)}
                    className="size-8 p-0"
                  >
                    <ChevronRight aria-hidden="true" />
                  </Button>
                </div>

                <form
                  onSubmit={handleJumpPageSubmit}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <label htmlFor="seller-complaints-jump-page">{t('pagination.jumpToPage')}</label>
                  <input
                    id="seller-complaints-jump-page"
                    type="number"
                    min={1}
                    max={totalPages}
                    value={jumpPageInput}
                    onChange={(event) => setJumpPageInput(event.target.value)}
                    placeholder={String(page)}
                    className="h-8 w-14 rounded-md border border-input bg-card px-2 text-center text-xs text-foreground tabular-nums focus-visible:outline-2 focus-visible:outline-ring"
                  />
                </form>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
