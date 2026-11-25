import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  MapPin,
  MessageSquareWarning,
  Plus,
  RefreshCw,
  Search,
  User,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { ApiError } from '@/api/errors'
import { CopyableId, ServiceFallbackBanner, SlaCountdownPill } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { apiGetPublicShop, fallbackShopName } from '@/features/cart-checkout-order/api'
import { formatDateTime, formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { apiListComplaints, complaintKeys } from '../api'
import { ComplaintActionErrorAlert } from '../components/ComplaintActionErrorAlert'
import { ComplaintFilterBar } from '../components/ComplaintFilterBar'
import { CreateComplaintDialog } from '../components/CreateComplaintDialog'
import {
  buildPageNumbers,
  isComplaintStatusFilter,
  isComplaintTypeFilter,
  resolveComplaintSla,
  toDateBoundsIso,
  type ComplaintStatusFilter,
  type ComplaintType,
} from '../helpers'

const PAGE_LIMIT = 10

function navPillClass(active: boolean) {
  return cn(
    'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
    active ? 'border-primary bg-primary-soft text-primary' : 'border-input bg-card text-foreground hover:bg-muted',
  )
}

function BuyerComplaintsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      {[1, 2, 3].map((item) => (
        <div key={item} className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-9 w-40" />
        </div>
      ))}
    </div>
  )
}

/**
 * Trang danh sách & tạo khiếu nại dành cho Buyer (`/account/complaints`, FR-CPL-001, FR-CPL-009).
 */
export function BuyerComplaintsPage() {
  const { t } = useTranslation('complaints')
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const rawStatus = searchParams.get('status')
  const status: ComplaintStatusFilter = isComplaintStatusFilter(rawStatus) ? rawStatus : 'ALL'

  const rawType = searchParams.get('type')
  const typeFilter: ComplaintType | '' = isComplaintTypeFilter(rawType) ? rawType : ''

  const fromDate = searchParams.get('from') ?? ''
  const toDate = searchParams.get('to') ?? ''

  const parsedPage = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1

  const queryOrderId = searchParams.get('orderId') ?? undefined
  const querySellerOrderId = searchParams.get('sellerOrderId') ?? undefined
  const queryCreate = searchParams.get('create') === '1'

  const [manualCreateOpen, setManualCreateOpen] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [jumpPageInput, setJumpPageInput] = useState('')

  const createDialogOpen = manualCreateOpen || Boolean(queryOrderId) || queryCreate

  const dateBounds = useMemo(() => toDateBoundsIso(fromDate, toDate), [fromDate, toDate])

  const queryParams = useMemo(
    () => ({
      scope: 'BUYER' as const,
      status: status === 'ALL' ? undefined : status,
      type: typeFilter || undefined,
      from: dateBounds.fromIso,
      to: dateBounds.toIso,
      page,
      limit: PAGE_LIMIT,
    }),
    [status, typeFilter, dateBounds.fromIso, dateBounds.toIso, page],
  )

  const complaintsQuery = useQuery({
    queryKey: complaintKeys.list('BUYER', queryParams),
    queryFn: () => apiListComplaints(queryParams),
    enabled: !dateBounds.invalidRange,
  })

  const rawItems = useMemo(() => complaintsQuery.data?.items ?? [], [complaintsQuery.data])
  const total = complaintsQuery.data?.total ?? 0
  const totalPages = Math.max(1, complaintsQuery.data?.totalPages ?? 1)

  const shopIds = useMemo(
    () => Array.from(new Set(rawItems.map((item) => item.shopId))),
    [rawItems],
  )
  const shopQueries = useQueries({
    queries: shopIds.map((shopId) => ({
      queryKey: ['shop', 'public', shopId],
      queryFn: () => apiGetPublicShop(shopId),
      retry: false,
      staleTime: 5 * 60_000,
    })),
  })

  const shopNameMap = useMemo(() => {
    const map = new Map<string, string>()
    shopIds.forEach((shopId, idx) => {
      map.set(shopId, shopQueries[idx]?.data?.name || fallbackShopName(shopId))
    })
    return map
  }, [shopIds, shopQueries])

  const normalizedKeyword = searchKeyword.trim().toLowerCase()
  const items = useMemo(() => {
    if (!normalizedKeyword) return rawItems
    return rawItems.filter((item) => {
      const shopName = (shopNameMap.get(item.shopId) ?? fallbackShopName(item.shopId)).toLowerCase()
      return (
        item.complaintCode.toLowerCase().includes(normalizedKeyword) ||
        item.description.toLowerCase().includes(normalizedKeyword) ||
        shopName.includes(normalizedKeyword)
      )
    })
  }, [rawItems, normalizedKeyword, shopNameMap])

  function updateParams(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams)
    mutate(next)
    setSearchParams(next)
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    setManualCreateOpen(nextOpen)
    if (!nextOpen && (queryOrderId || querySellerOrderId || queryCreate)) {
      updateParams((next) => {
        next.delete('orderId')
        next.delete('sellerOrderId')
        next.delete('create')
      })
    }
  }

  function handleClearFilters() {
    setSearchKeyword('')
    setSearchParams(new URLSearchParams())
  }

  function handlePageChange(nextPage: number) {
    const clamped = Math.min(Math.max(1, nextPage), totalPages)
    updateParams((next) => {
      if (clamped <= 1) next.delete('page')
      else next.set('page', String(clamped))
    })
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

  const hasFilters =
    status !== 'ALL' ||
    Boolean(typeFilter) ||
    Boolean(fromDate) ||
    Boolean(toDate) ||
    Boolean(normalizedKeyword)

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('buyerList.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('buyerList.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label={t('nav.ariaLabel')} className="flex flex-wrap items-center gap-2">
            <Link to="/account/profile" className={navPillClass(false)}>
              <User className="size-4" aria-hidden="true" />
              <span>{t('nav.profile')}</span>
            </Link>
            <Link to="/account/addresses" className={navPillClass(false)}>
              <MapPin className="size-4" aria-hidden="true" />
              <span>{t('nav.addresses')}</span>
            </Link>
            <Link to="/account/orders" className={navPillClass(false)}>
              <ClipboardList className="size-4" aria-hidden="true" />
              <span>{t('nav.orders')}</span>
            </Link>
            <Link to="/account/complaints" aria-current="page" className={navPillClass(true)}>
              <MessageSquareWarning className="size-4" aria-hidden="true" />
              <span>{t('nav.complaints')}</span>
            </Link>
          </nav>

          <Button type="button" variant="cta" size="sm" onClick={() => setManualCreateOpen(true)}>
            <Plus aria-hidden="true" />
            {t('buyerList.createButton')}
          </Button>
        </div>
      </header>

      <ComplaintFilterBar
        status={status}
        type={typeFilter}
        fromDate={fromDate}
        toDate={toDate}
        invalidDateRange={dateBounds.invalidRange}
        onStatusChange={(nextStatus) =>
          updateParams((next) => {
            if (nextStatus === 'ALL') next.delete('status')
            else next.set('status', nextStatus)
            next.delete('page')
          })
        }
        onTypeChange={(nextType) =>
          updateParams((next) => {
            if (!nextType) next.delete('type')
            else next.set('type', nextType)
            next.delete('page')
          })
        }
        onFromDateChange={(val) =>
          updateParams((next) => {
            if (val) next.set('from', val)
            else next.delete('from')
            next.delete('page')
          })
        }
        onToDateChange={(val) =>
          updateParams((next) => {
            if (val) next.set('to', val)
            else next.delete('to')
            next.delete('page')
          })
        }
        onClearFilters={handleClearFilters}
      />

      <div className="relative max-w-md">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
          placeholder={t('buyerList.searchPlaceholder')}
          aria-label={t('buyerList.searchPlaceholder')}
          className="h-9 w-full rounded-md border border-input bg-card pr-8 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
        />
        {searchKeyword && (
          <button
            type="button"
            aria-label={t('buyerList.clearSearch')}
            onClick={() => setSearchKeyword('')}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        )}
      </div>

      {dateBounds.invalidRange ? null : complaintsQuery.isLoading ? (
        <BuyerComplaintsSkeleton />
      ) : complaintsQuery.isError ? (
        complaintsQuery.error instanceof ApiError && complaintsQuery.error.isServiceUnavailable ? (
          <ServiceFallbackBanner
            message={complaintsQuery.error.message || t('buyerList.loadError')}
            onRetry={() => void complaintsQuery.refetch()}
            isRetrying={complaintsQuery.isFetching}
          />
        ) : (
          <div className="space-y-3">
            <ComplaintActionErrorAlert
              error={
                complaintsQuery.error instanceof Error
                  ? complaintsQuery.error
                  : new Error(t('buyerList.loadError'))
              }
            />
            <Button type="button" variant="outline" size="sm" onClick={() => void complaintsQuery.refetch()}>
              <RefreshCw aria-hidden="true" />
              {t('common.refresh')}
            </Button>
          </div>
        )
      ) : items.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-12 text-center shadow-xs">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <MessageSquareWarning aria-hidden="true" className="size-7" />
          </div>
          <h2 className="text-lg font-semibold">
            {hasFilters ? t('buyerList.filteredEmptyTitle') : t('buyerList.emptyTitle')}
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {hasFilters ? t('buyerList.filteredEmptyDescription') : t('buyerList.emptyDescription')}
          </p>
          {hasFilters ? (
            <Button type="button" variant="outline" className="mt-1" onClick={handleClearFilters}>
              {t('filters.clearFilters')}
            </Button>
          ) : (
            <Button type="button" variant="cta" className="mt-1" onClick={() => setManualCreateOpen(true)}>
              <Plus aria-hidden="true" />
              {t('buyerList.createButton')}
            </Button>
          )}
        </section>
      ) : (
        <div className="space-y-4">
          {items.map((cpl) => {
            const sla = resolveComplaintSla(cpl)
            const shopName = shopNameMap.get(cpl.shopId) ?? fallbackShopName(cpl.shopId)

            return (
              <article
                key={cpl.complaintId}
                data-testid={`buyer-complaint-card-${cpl.complaintId}`}
                className="overflow-hidden rounded-lg border border-border bg-card shadow-xs transition-all hover:border-primary/40 hover:shadow-sm"
              >
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <CopyableId
                      value={cpl.complaintCode}
                      display={cpl.complaintCode}
                      label={t('common.complaintCodeLabel')}
                      className="text-sm font-semibold text-foreground"
                    />
                    <span className="text-xs font-medium text-foreground">{shopName}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t('buyerList.createdAt', { datetime: formatDateTime(cpl.createdAt) })}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {cpl.unverifiedFlag && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-status-warning-border bg-status-warning px-2 py-0.5 text-[11px] font-medium text-status-warning-foreground">
                        <AlertTriangle aria-hidden="true" className="size-3" />
                        {t('common.unverifiedBadge')}
                      </span>
                    )}
                    {sla && (
                      <SlaCountdownPill
                        label={t(sla.labelKey)}
                        startedAt={sla.startedAt}
                        deadline={sla.deadline}
                      />
                    )}
                    <StatusBadge status={cpl.status} />
                  </div>
                </header>

                <div className="space-y-2 px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {t('buyerList.typeLabel')}:{' '}
                      <strong className="text-foreground">
                        {t(`types.${cpl.type}` as never, { defaultValue: cpl.type }) as string}
                      </strong>
                    </span>
                    <span>
                      {t('buyerList.resolutionLabel')}:{' '}
                      <strong className="text-foreground">
                        {t(`resolutions.${cpl.requestedResolution}` as never, {
                          defaultValue: cpl.requestedResolution,
                        }) as string}
                      </strong>
                    </span>
                    {cpl.requestedRefundAmount !== undefined && cpl.requestedRefundAmount > 0 && (
                      <span className="tabular-nums">
                        {t('buyerList.requestedAmountLabel')}:{' '}
                        <strong className="text-foreground">{formatVnd(cpl.requestedRefundAmount)}</strong>
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-sm text-foreground">{cpl.description}</p>
                </div>

                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/60 px-4 py-3 sm:px-5">
                  <span className="text-xs text-muted-foreground">
                    {t('common.priorityLabel', { priority: cpl.priority })}
                  </span>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/account/complaints/${cpl.complaintId}`}>
                      {t('buyerList.viewDetail')}
                    </Link>
                  </Button>
                </footer>
              </article>
            )
          })}

          {total > 0 && (
            <nav
              aria-label={t('pagination.summary', {
                page,
                totalPages,
                total: formatNumber(total),
              })}
              className="flex flex-col items-center justify-between gap-3 pt-2 text-sm sm:flex-row"
            >
              <span className="text-xs text-muted-foreground tabular-nums">
                {t('pagination.showingRange', {
                  from: (page - 1) * PAGE_LIMIT + 1,
                  to: Math.min(page * PAGE_LIMIT, total),
                  total: formatNumber(total),
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
                  <label htmlFor="buyer-complaints-jump-page">{t('pagination.jumpToPage')}</label>
                  <input
                    id="buyer-complaints-jump-page"
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
        </div>
      )}

      <CreateComplaintDialog
        open={createDialogOpen}
        onOpenChange={handleDialogOpenChange}
        initialOrderId={queryOrderId}
        initialSellerOrderId={querySellerOrderId}
        onCreated={() => {
          void queryClient.invalidateQueries({ queryKey: complaintKeys.lists() })
        }}
      />
    </div>
  )
}
