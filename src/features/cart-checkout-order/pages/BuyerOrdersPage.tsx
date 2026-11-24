import { useQueries, useQuery } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  MapPin,
  Package,
  RefreshCw,
  Search,
  ShoppingBag,
  User,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { ApiError } from '@/api/errors'
import { CopyableId, ServiceFallbackBanner, SlaCountdownPill } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { DisclosurePanel } from '@/components/ui/disclosure-panel'
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
const PACKAGE_PREVIEW_COUNT = 2

function buildPageNumbers(current: number, totalPages: number): (number | 'ellipsis')[] {
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

  const [searchKeyword, setSearchKeyword] = useState('')
  const [jumpPageInput, setJumpPageInput] = useState('')

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

  const rawOrders = useMemo(() => ordersQuery.data?.items ?? [], [ordersQuery.data])
  const total = ordersQuery.data?.total ?? 0
  const totalPages = Math.max(1, ordersQuery.data?.totalPages ?? 1)

  const shopIds = useMemo(() => getOrderSellerIds(rawOrders), [rawOrders])
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

  const normalizedKeyword = searchKeyword.trim().toLowerCase()
  const orders = useMemo(() => {
    if (!normalizedKeyword) return rawOrders
    return rawOrders.filter((order) => {
      if (order.orderCode.toLowerCase().includes(normalizedKeyword)) return true
      return (order.sellerOrders ?? []).some((so) => {
        const shopName = (shopNameMap.get(so.shopId) ?? fallbackShopName(so.shopId)).toLowerCase()
        return shopName.includes(normalizedKeyword)
      })
    })
  }, [rawOrders, normalizedKeyword, shopNameMap])

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
    setSearchKeyword('')
    setSearchParams(new URLSearchParams())
  }

  function handleJumpPageSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = Number.parseInt(jumpPageInput, 10)
    if (Number.isFinite(target) && target >= 1) {
      handlePageChange(target)
      setJumpPageInput('')
    }
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

  const hasFilters =
    status !== 'ALL' ||
    timePreset !== 'ALL' ||
    Boolean(customFrom) ||
    Boolean(customTo) ||
    Boolean(normalizedKeyword)

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

      <div className="relative max-w-md">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
          placeholder={t('list.searchPlaceholder')}
          aria-label={t('list.searchPlaceholder')}
          className="h-9 w-full rounded-md border border-input bg-card pr-8 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
        />
        {searchKeyword && (
          <button
            type="button"
            aria-label={t('list.clearSearch')}
            onClick={() => setSearchKeyword('')}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        )}
      </div>

      {dateRange.invalidRange ? null : ordersQuery.isLoading ? (
        <OrdersListSkeleton />
      ) : ordersQuery.isError ? (
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
            const packageRows = sellerOrders.map((so) => (
              <li
                key={so.sellerOrderId}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">
                    {shopNameMap.get(so.shopId) ?? fallbackShopName(so.shopId)}
                  </span>
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
            ))

            return (
              <article
                key={order.orderId}
                data-testid={`order-card-${order.orderId}`}
                className="overflow-hidden rounded-lg border border-border bg-card shadow-xs transition-all hover:border-primary/40 hover:shadow-sm"
              >
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:px-5">
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
                  {packageRows.slice(0, PACKAGE_PREVIEW_COUNT)}
                </ul>
                {packageRows.length > PACKAGE_PREVIEW_COUNT && (
                  <DisclosurePanel
                    title={t('list.morePackages', { count: packageRows.length - PACKAGE_PREVIEW_COUNT })}
                    className="mx-4 mb-3 sm:mx-5"
                  >
                    <ul className="max-h-60 divide-y divide-border overflow-y-auto pr-1">
                      {packageRows.slice(PACKAGE_PREVIEW_COUNT)}
                    </ul>
                  </DisclosurePanel>
                )}

                <footer className="flex flex-col gap-3 border-t border-border bg-background/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground">
                    {t('list.grandTotal')}
                    <strong className="text-lg font-bold text-price tabular-nums">{formatVnd(order.grandTotal)}</strong>
                  </p>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {order.status === 'PENDING_PAYMENT' && (
                      <Button asChild variant="cta" size="sm">
                        <Link to={`/checkout/result?orderId=${encodeURIComponent(order.orderId)}`}>
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

          {total > 0 && (
            <nav
              aria-label={t('list.pagination', { page, totalPages, total })}
              className="flex flex-col items-center justify-between gap-3 pt-2 text-sm sm:flex-row"
            >
              <span className="text-xs text-muted-foreground tabular-nums">
                {t('list.showingRange', {
                  from: (page - 1) * PAGE_LIMIT + 1,
                  to: Math.min(page * PAGE_LIMIT, total),
                  total,
                })}
              </span>

              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1 tabular-nums">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={t('list.prevPage')}
                    disabled={page <= 1 || ordersQuery.isFetching}
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
                        disabled={ordersQuery.isFetching}
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
                    aria-label={t('list.nextPage')}
                    disabled={page >= totalPages || ordersQuery.isFetching}
                    onClick={() => handlePageChange(page + 1)}
                    className="size-8 p-0"
                  >
                    <ChevronRight aria-hidden="true" />
                  </Button>
                </div>

                <form onSubmit={handleJumpPageSubmit} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <label htmlFor="orders-jump-page">{t('list.jumpToPage')}</label>
                  <input
                    id="orders-jump-page"
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
    </div>
  )
}
