import { useQueries, useQuery } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  MapPin,
  Package,
  RefreshCw,
  ShoppingBag,
  User,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { ApiError } from '@/api/errors'
import { CopyableId, ServiceFallbackBanner, SlaCountdownPill } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDateTime, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  apiGetPublicShop,
  apiListOrders,
  fallbackShopName,
  type BuyerOrderSummaryView,
} from '../api'
import { OrderActionErrorAlert } from '../components/OrderActionErrorAlert'
import { OrderFilterBar } from '../components/OrderFilterBar'
import {
  isOrderStatusFilter,
  isOrderTimePreset,
  toDateRangeQuery,
  type OrderStatusFilter,
  type OrderTimePreset,
} from '../order-helpers'

const PAGE_LIMIT = 10

function navPillClass(active: boolean) {
  return cn(
    'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
    active ? 'border-primary bg-primary-soft text-primary' : 'border-input bg-card text-foreground hover:bg-muted',
  )
}

function OrdersListSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      {[1, 2, 3].map((item) => (
        <div key={item} className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-10 w-64" />
        </div>
      ))}
    </div>
  )
}

function getOrderSellerIds(orders: readonly BuyerOrderSummaryView[]): string[] {
  const ids = new Set<string>()
  for (const order of orders) {
    for (const so of order.sellerOrders ?? []) {
      ids.add(so.shopId)
    }
  }
  return Array.from(ids)
}

/**
 * Trang danh sách đơn hàng của Buyer (`/account/orders`, FR-ORD-009).
 */
export function BuyerOrdersPage() {
  const { t } = useTranslation('orders')
  const [searchParams, setSearchParams] = useSearchParams()

  const rawStatus = searchParams.get('status')
  const status: OrderStatusFilter = isOrderStatusFilter(rawStatus) ? rawStatus : 'ALL'

  const rawRange = searchParams.get('range')
  const timePreset: OrderTimePreset = isOrderTimePreset(rawRange) ? rawRange : 'ALL'

  const customFrom = searchParams.get('from') ?? ''
  const customTo = searchParams.get('to') ?? ''

  const parsedPage = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1

  const dateRange = useMemo(
    () => toDateRangeQuery(timePreset, customFrom, customTo),
    [timePreset, customFrom, customTo],
  )

  const queryParams = useMemo(
    () => ({
      status: status === 'ALL' ? undefined : status,
      from: dateRange.from,
      to: dateRange.to,
      page,
      limit: PAGE_LIMIT,
    }),
    [status, dateRange.from, dateRange.to, page],
  )

  const ordersQuery = useQuery({
    queryKey: ['orders', 'buyer', queryParams],
    queryFn: () => apiListOrders(queryParams),
    enabled: !dateRange.invalidRange,
  })

  const orders = useMemo(() => ordersQuery.data?.items ?? [], [ordersQuery.data])
  const total = ordersQuery.data?.total ?? 0
  const totalPages = Math.max(1, ordersQuery.data?.totalPages ?? 1)

  const shopIds = useMemo(() => getOrderSellerIds(orders), [orders])
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
      const name = shopQueries[idx]?.data?.name
      map.set(shopId, name || fallbackShopName(shopId))
    })
    return map
  }, [shopIds, shopQueries])

  function updateParams(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams)
    mutate(next)
    setSearchParams(next)
  }

  function handleStatusChange(nextStatus: OrderStatusFilter) {
    updateParams((next) => {
      if (nextStatus === 'ALL') next.delete('status')
      else next.set('status', nextStatus)
      next.delete('page')
    })
  }

  function handleTimePresetChange(nextPreset: OrderTimePreset) {
    updateParams((next) => {
      if (nextPreset === 'ALL') {
        next.delete('range')
        next.delete('from')
        next.delete('to')
      } else {
        next.set('range', nextPreset)
        if (nextPreset !== 'CUSTOM') {
          next.delete('from')
          next.delete('to')
        }
      }
      next.delete('page')
    })
  }

  function handleCustomDateChange(field: 'from' | 'to', value: string) {
    updateParams((next) => {
      next.set('range', 'CUSTOM')
      if (value) next.set(field, value)
      else next.delete(field)
      next.delete('page')
    })
  }

  function handleClearFilters() {
    setSearchParams(new URLSearchParams())
  }

  function handlePageChange(nextPage: number) {
    updateParams((next) => {
      if (nextPage <= 1) next.delete('page')
      else next.set('page', String(nextPage))
    })
  }

  const hasFilters = status !== 'ALL' || timePreset !== 'ALL' || Boolean(customFrom) || Boolean(customTo)

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('list.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('list.subtitle')}</p>
        </div>

        <nav aria-label={t('nav.ariaLabel')} className="flex flex-wrap items-center gap-2">
          <Link to="/account/profile" className={navPillClass(false)}>
            <User className="size-4" aria-hidden="true" />
            <span>{t('nav.profile')}</span>
          </Link>
          <Link to="/account/addresses" className={navPillClass(false)}>
            <MapPin className="size-4" aria-hidden="true" />
            <span>{t('nav.addresses')}</span>
          </Link>
          <Link to="/account/orders" aria-current="page" className={navPillClass(true)}>
            <ClipboardList className="size-4" aria-hidden="true" />
            <span>{t('nav.orders')}</span>
          </Link>
        </nav>
      </header>

      <OrderFilterBar
        status={status}
        timePreset={timePreset}
        customFrom={customFrom}
        customTo={customTo}
        invalidDateRange={dateRange.invalidRange}
        onStatusChange={handleStatusChange}
        onTimePresetChange={handleTimePresetChange}
        onCustomDateChange={handleCustomDateChange}
        onClearFilters={handleClearFilters}
      />

      {!dateRange.invalidRange && ordersQuery.isLoading ? (
        <OrdersListSkeleton />
      ) : !dateRange.invalidRange && ordersQuery.isError ? (
        ordersQuery.error instanceof ApiError && ordersQuery.error.isServiceUnavailable ? (
          <ServiceFallbackBanner
            message={ordersQuery.error.message || t('list.loadError')}
            onRetry={() => void ordersQuery.refetch()}
            isRetrying={ordersQuery.isFetching}
          />
        ) : (
          <div className="space-y-3">
            <OrderActionErrorAlert
              error={ordersQuery.error instanceof Error ? ordersQuery.error : new Error(t('list.loadError'))}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => void ordersQuery.refetch()}>
              <RefreshCw aria-hidden="true" />
              {t('list.refresh')}
            </Button>
          </div>
        )
      ) : orders.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-12 text-center shadow-xs">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ShoppingBag aria-hidden="true" className="size-7" />
          </div>
          <h2 className="text-lg font-semibold">
            {hasFilters ? t('list.filteredEmptyTitle') : t('list.emptyTitle')}
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {hasFilters ? t('list.filteredEmptyDescription') : t('list.emptyDescription')}
          </p>
          {hasFilters ? (
            <Button type="button" variant="outline" className="mt-1" onClick={handleClearFilters}>
              {t('list.clearFilters')}
            </Button>
          ) : (
            <Button asChild variant="cta" size="cta" className="mt-1">
              <Link to="/products">{t('list.emptyAction')}</Link>
            </Button>
          )}
        </section>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const sellerOrders = order.sellerOrders ?? []
            const packageCount = order.sellerOrderCount || sellerOrders.length

            return (
              <article
                key={order.orderId}
                data-testid={`order-card-${order.orderId}`}
                className="overflow-hidden rounded-lg border border-border bg-card shadow-xs"
              >
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <CopyableId
                      value={order.orderCode}
                      display={order.orderCode}
                      label={t('list.orderCode')}
                      className="text-sm font-semibold text-foreground"
                    />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t('list.createdAt', { datetime: formatDateTime(order.createdAt) })}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <Package aria-hidden="true" className="size-3.5" />
                      {t('list.packageCount', { count: packageCount })}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {order.status === 'PENDING_PAYMENT' && order.paymentDueAt && (
                      <SlaCountdownPill
                        label={t('list.paymentCountdown')}
                        startedAt={order.createdAt}
                        deadline={order.paymentDueAt}
                      />
                    )}
                    <StatusBadge status={order.status} />
                  </div>
                </header>

                <ul className="divide-y divide-border px-4 sm:px-5">
                  {sellerOrders.map((so) => (
                    <li
                      key={so.sellerOrderId}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">
                          {shopNameMap.get(so.shopId) ?? fallbackShopName(so.shopId)}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">{so.sellerOrderCode}</span>
                        <StatusBadge status={so.status} />
                        {so.refundStatus && so.refundStatus !== 'NONE' && (
                          <StatusBadge
                            status={so.refundStatus === 'FULL' ? 'SUCCEEDED' : 'PROCESSING'}
                            tone={so.refundStatus === 'FULL' ? 'success' : 'warning'}
                            label={
                              so.refundStatus === 'FULL' ? t('list.refundedTag') : t('list.refundingTag')
                            }
                          />
                        )}
                      </div>
                      <span className="font-medium text-foreground tabular-nums">
                        {formatVnd(so.totalAmount)}
                      </span>
                    </li>
                  ))}
                </ul>

                <footer className="flex flex-col gap-3 border-t border-border bg-background/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
                    <span>
                      {t('list.itemsTotal')}:{' '}
                      <strong className="font-medium text-foreground">{formatVnd(order.itemsTotal)}</strong>
                    </span>
                    <span>
                      {t('list.shippingTotal')}:{' '}
                      <strong className="font-medium text-foreground">{formatVnd(order.shippingTotal)}</strong>
                    </span>
                    <span className="text-sm">
                      {t('list.grandTotal')}:{' '}
                      <strong className="text-base font-bold text-price">{formatVnd(order.grandTotal)}</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {order.status === 'PENDING_PAYMENT' && (
                      <Button asChild variant="cta" size="sm">
                        <Link to={`/account/orders/${order.orderId}`}>
                          <CreditCard aria-hidden="true" />
                          {t('list.payNow')}
                        </Link>
                      </Button>
                    )}
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/account/orders/${order.orderId}`}>{t('list.viewDetail')}</Link>
                    </Button>
                  </div>
                </footer>
              </article>
            )
          })}

          {totalPages > 1 && (
            <nav
              aria-label={t('list.pagination', { page, totalPages, total })}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm"
            >
              <span className="text-xs text-muted-foreground tabular-nums">
                {t('list.pagination', { page, totalPages, total })}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || ordersQuery.isFetching}
                  onClick={() => handlePageChange(page - 1)}
                >
                  <ChevronLeft aria-hidden="true" />
                  {t('list.prevPage')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || ordersQuery.isFetching}
                  onClick={() => handlePageChange(page + 1)}
                >
                  {t('list.nextPage')}
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </nav>
          )}
        </div>
      )}
    </div>
  )
}
