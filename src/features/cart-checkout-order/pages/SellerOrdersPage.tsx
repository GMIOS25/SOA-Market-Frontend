import {
  AlertTriangle,
  ClipboardList,
  ImageOff,
  RefreshCw,
  ShieldAlert,
  Store,
  Truck,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ApiError } from '@/api/errors'
import { CopyableId, ServiceFallbackBanner, SlaCountdownPill } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { useAuthSession } from '@/lib/auth/session'
import { APP_TIMEZONE, dayjs } from '@/lib/dayjs'
import { formatDateTime, formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PickupAddressAlert } from '../components/PickupAddressAlert'
import {
  apiGetSellerShop,
  apiListSellerOrders,
  hasValidPickupAddress,
  resolveConfirmStartedAt,
  type SellerOrderSummaryView,
} from '../seller-orders-api'

const STATUS_TABS = [
  'ALL',
  'AWAITING_CONFIRMATION',
  'CONFIRMED',
  'SHIPPING',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'DELIVERY_FAILED',
] as const

type StatusTab = (typeof STATUS_TABS)[number]

const PAGE_LIMIT = 20

function SellerOrdersSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-20 w-full rounded-lg" />
    </div>
  )
}

function summarizeOrderItems(
  items: SellerOrderSummaryView['items'],
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const list = items ?? []
  const first = list[0]
  if (!first) {
    return {
      first: null,
      extraCount: 0,
      firstLabel: t('list.table.noItems'),
    }
  }
  return {
    first,
    extraCount: Math.max(0, list.length - 1),
    firstLabel: first.productName || t('common.fallbackProductName', { shortId: first.variantId.slice(0, 8) }),
  }
}

export function SellerOrdersPage() {
  const { t } = useTranslation('sellerOrders')
  const session = useAuthSession()

  const [statusTab, setStatusTab] = useState<StatusTab>('ALL')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)

  const hasInvalidDateRange = Boolean(fromDate && toDate && fromDate > toDate)
  const hasActiveFilters = statusTab !== 'ALL' || Boolean(fromDate) || Boolean(toDate)

  const fromIso = useMemo(() => {
    if (!fromDate || hasInvalidDateRange) return undefined
    return dayjs.tz(fromDate, APP_TIMEZONE).startOf('day').utc().format()
  }, [fromDate, hasInvalidDateRange])

  const toIso = useMemo(() => {
    if (!toDate || hasInvalidDateRange) return undefined
    return dayjs.tz(toDate, APP_TIMEZONE).endOf('day').utc().format()
  }, [toDate, hasInvalidDateRange])

  const shopQuery = useQuery({
    queryKey: ['seller', 'shop'],
    queryFn: apiGetSellerShop,
    enabled: Boolean(session.accessToken),
    retry: false,
    staleTime: 5 * 60_000,
  })

  const myShop = shopQuery.data
  const myShopId = myShop?.shopId

  const ordersQuery = useQuery({
    queryKey: ['seller-orders', 'list', { status: statusTab, fromIso, toIso, page, limit: PAGE_LIMIT }],
    queryFn: () =>
      apiListSellerOrders({
        status: statusTab === 'ALL' ? undefined : statusTab,
        from: fromIso,
        to: toIso,
        page,
        limit: PAGE_LIMIT,
      }),
    enabled: Boolean(session.accessToken) && !hasInvalidDateRange,
  })

  const isForbiddenShop = ordersQuery.error instanceof ApiError && ordersQuery.error.status === 403
  const rawOrderItems = ordersQuery.data?.items

  // Cô lập phòng vệ nhiều lớp: chỉ giữ các SellerOrder thuộc đúng shopId của Seller hiện tại.
  const visibleOrders = useMemo(() => {
    const items = rawOrderItems ?? []
    if (!myShopId) return items
    return items.filter((item) => item.shopId === myShopId)
  }, [rawOrderItems, myShopId])

  const totalItems = ordersQuery.data?.total ?? 0
  const totalPages = ordersQuery.data?.totalPages ?? 0

  function handleClearFilters() {
    setStatusTab('ALL')
    setFromDate('')
    setToDate('')
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{t('list.title')}</h1>
            {myShop?.name && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                <Store aria-hidden="true" className="size-3.5 text-primary" />
                {t('common.shopBadge', { name: myShop.name })}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{t('list.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!ordersQuery.isLoading && !ordersQuery.isError && (
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {t('list.totalCount', { count: totalItems })}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={ordersQuery.isFetching || hasInvalidDateRange}
            onClick={() => void ordersQuery.refetch()}
          >
            <RefreshCw aria-hidden="true" className={ordersQuery.isFetching ? 'animate-spin' : undefined} />
            {ordersQuery.isFetching ? t('common.refreshing') : t('common.refresh')}
          </Button>
        </div>
      </header>

      <PickupAddressAlert
        proactiveMissing={Boolean(myShop && !hasValidPickupAddress(myShop.pickupAddress))}
      />

      {/* Bộ lọc trạng thái & khoảng thời gian */}
      <section
        aria-label={t('list.filters.statusGroupLabel')}
        className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-xs"
      >
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('list.filters.statusGroupLabel')}>
          {STATUS_TABS.map((tab) => {
            const active = statusTab === tab
            return (
              <button
                key={tab}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setStatusTab(tab)
                  setPage(1)
                }}
                className={cn(
                  'inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  active
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground',
                )}
              >
                {t(`list.filters.statuses.${tab}`)}
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="seller-orders-from" className="text-xs">
                {t('list.filters.fromDate')}
              </Label>
              <input
                id="seller-orders-from"
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value)
                  setPage(1)
                }}
                className="block h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="seller-orders-to" className="text-xs">
                {t('list.filters.toDate')}
              </Label>
              <input
                id="seller-orders-to"
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value)
                  setPage(1)
                }}
                className="block h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <Button type="button" variant="outline" size="sm" onClick={handleClearFilters}>
              {t('list.filters.clearFilters')}
            </Button>
          )}
        </div>

        {hasInvalidDateRange && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-md border border-status-danger-border bg-status-danger px-3 py-2 text-xs font-medium text-status-danger-foreground"
          >
            <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
            <span>{t('list.filters.invalidDateRange')}</span>
          </p>
        )}
      </section>

      {isForbiddenShop ? (
        <section
          role="alert"
          className="flex flex-col items-center gap-3 rounded-lg border border-status-danger-border bg-status-danger p-8 text-center text-status-danger-foreground"
        >
          <ShieldAlert aria-hidden="true" className="size-10" />
          <h2 className="text-lg font-semibold">{t('common.forbiddenTitle')}</h2>
          <p className="max-w-md text-sm">{t('common.forbiddenDescription')}</p>
        </section>
      ) : ordersQuery.isLoading ? (
        <SellerOrdersSkeleton />
      ) : ordersQuery.isError ? (
        <ServiceFallbackBanner
          message={ordersQuery.error instanceof ApiError ? ordersQuery.error.message : t('list.loadError')}
          onRetry={() => void ordersQuery.refetch()}
          isRetrying={ordersQuery.isFetching}
        />
      ) : visibleOrders.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-12 text-center shadow-xs">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ClipboardList aria-hidden="true" className="size-7" />
          </div>
          <h2 className="text-lg font-semibold">{t('list.emptyTitle')}</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {hasActiveFilters ? t('list.emptyFilteredDescription') : t('list.emptyDescription')}
          </p>
          {hasActiveFilters && (
            <Button type="button" variant="outline" size="sm" onClick={handleClearFilters}>
              {t('list.filters.clearFilters')}
            </Button>
          )}
        </section>
      ) : (
        <>
          {/* Bảng mật độ cao cho Desktop (≥ 768px) */}
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-card shadow-xs md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">{t('list.table.order')}</th>
                  <th className="px-4 py-3">{t('list.table.items')}</th>
                  <th className="px-4 py-3">{t('list.table.status')}</th>
                  <th className="px-4 py-3">{t('list.table.shipment')}</th>
                  <th className="px-4 py-3 text-right">{t('list.table.total')}</th>
                  <th className="px-4 py-3 text-right">{t('list.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleOrders.map((so) => {
                  const summary = summarizeOrderItems(so.items, t as never)
                  const isAwaiting = so.status === 'AWAITING_CONFIRMATION'

                  return (
                    <tr key={so.sellerOrderId} className="align-top hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <CopyableId
                            value={so.sellerOrderId}
                            display={so.sellerOrderCode}
                            label={t('common.sellerOrderCodeLabel')}
                          />
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {formatDateTime(so.createdAt)}
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {summary.first ? (
                          <div className="flex items-start gap-2.5">
                            <div className="size-10 shrink-0 overflow-hidden rounded border border-border bg-muted">
                              {summary.first.imageRef ? (
                                <img
                                  src={summary.first.imageRef}
                                  alt={summary.firstLabel}
                                  loading="lazy"
                                  className="size-full object-cover"
                                />
                              ) : (
                                <ImageOff aria-hidden="true" className="size-full p-2.5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 space-y-0.5">
                              <p className="line-clamp-1 font-medium text-foreground">{summary.firstLabel}</p>
                              <p className="text-xs text-muted-foreground">
                                {summary.first.variantLabel} · ×{summary.first.quantity}
                              </p>
                              {summary.extraCount > 0 && (
                                <p className="text-xs font-medium text-primary">
                                  {t('list.table.moreItems', { count: summary.extraCount })}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{summary.firstLabel}</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1.5">
                          <StatusBadge status={so.status} />
                          {isAwaiting && so.confirmDueAt && (
                            <SlaCountdownPill
                              label={t('common.confirmSlaShort')}
                              startedAt={resolveConfirmStartedAt(so.createdAt, so.updatedAt, so.confirmDueAt)}
                              deadline={so.confirmDueAt}
                            />
                          )}
                          {so.hasOpenComplaint && (
                            <StatusBadge
                              status="ESCALATED"
                              tone="warning"
                              label={t('common.openComplaintBadge')}
                            />
                          )}
                          {so.refundStatus !== 'NONE' && (
                            <StatusBadge
                              status={so.refundStatus}
                              tone={so.refundStatus === 'FULL' ? 'info' : 'warning'}
                              label={t(`common.refundStatus.${so.refundStatus}` as never, {
                                defaultValue: so.refundStatus,
                              }) as string}
                            />
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs">
                        {so.carrier || so.trackingCode ? (
                          <div className="space-y-1">
                            {so.carrier && (
                              <p className="flex items-center gap-1 font-medium text-foreground">
                                <Truck aria-hidden="true" className="size-3.5 text-muted-foreground" />
                                <span>{so.carrier}</span>
                              </p>
                            )}
                            {so.trackingCode && (
                              <CopyableId value={so.trackingCode} label={t('common.trackingCodeLabel')} />
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">{t('list.table.noTrackingYet')}</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right tabular-nums">
                        <p className="font-semibold text-foreground">{formatVnd(so.totalAmount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('list.table.shippingFeeCaption', { fee: formatVnd(so.shippingFee) })}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Button
                          asChild
                          size="sm"
                          variant={isAwaiting ? 'default' : 'outline'}
                        >
                          <Link to={`/seller/orders/${so.sellerOrderId}`}>
                            {isAwaiting ? t('list.table.processAction') : t('list.table.viewDetailAction')}
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Stacked Card List cho Mobile (360px – 767px) */}
          <div className="space-y-3 md:hidden">
            {visibleOrders.map((so) => {
              const summary = summarizeOrderItems(so.items, t as never)
              const isAwaiting = so.status === 'AWAITING_CONFIRMATION'

              return (
                <article
                  key={so.sellerOrderId}
                  className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <CopyableId
                        value={so.sellerOrderId}
                        display={so.sellerOrderCode}
                        label={t('common.sellerOrderCodeLabel')}
                      />
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatDateTime(so.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={so.status} />
                  </div>

                  {isAwaiting && so.confirmDueAt && (
                    <div>
                      <SlaCountdownPill
                        label={t('common.confirmSlaShort')}
                        startedAt={resolveConfirmStartedAt(so.createdAt, so.updatedAt, so.confirmDueAt)}
                        deadline={so.confirmDueAt}
                      />
                    </div>
                  )}

                  {summary.first && (
                    <div className="flex items-start gap-2.5 border-t border-border pt-3">
                      <div className="size-12 shrink-0 overflow-hidden rounded border border-border bg-muted">
                        {summary.first.imageRef ? (
                          <img
                            src={summary.first.imageRef}
                            alt={summary.firstLabel}
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        ) : (
                          <ImageOff aria-hidden="true" className="size-full p-3 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="line-clamp-2 text-sm font-medium">{summary.firstLabel}</p>
                        <p className="text-xs text-muted-foreground">
                          {summary.first.variantLabel} · ×{summary.first.quantity}
                        </p>
                        {summary.extraCount > 0 && (
                          <p className="text-xs font-medium text-primary">
                            {t('list.table.moreItems', { count: summary.extraCount })}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <div className="tabular-nums">
                      <p className="text-sm font-semibold text-foreground">{formatVnd(so.totalAmount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('list.table.shippingFeeCaption', { fee: formatVnd(so.shippingFee) })}
                      </p>
                    </div>
                    <Button asChild size="sm" variant={isAwaiting ? 'default' : 'outline'}>
                      <Link to={`/seller/orders/${so.sellerOrderId}`}>
                        {isAwaiting ? t('list.table.processAction') : t('list.table.viewDetailAction')}
                      </Link>
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {t('list.pagination.summary', {
                  page,
                  totalPages,
                  total: formatNumber(totalItems),
                })}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t('list.pagination.prev')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('list.pagination.next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
