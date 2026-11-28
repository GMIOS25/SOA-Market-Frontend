import { useQuery } from '@tanstack/react-query'
import {
  CircleDollarSign,
  ClipboardList,
  ClockAlert,
  Package,
  RotateCcw,
  ShoppingBag,
  Star,
  Store,
  TrendingDown,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ApiError } from '@/api/errors'
import { ServiceFallbackBanner, SyncTimestampBadge } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatNumber, formatVnd } from '@/lib/format'
import { adminReportsKeys, defaultReportDateRange, formatPercent, getSellerPerformance } from './api'
import { DailyTrendChart, DateRangeFilter, KpiCard } from './components'

/**
 * S1 `/seller` — Tổng quan gian hàng & Báo cáo hiệu suất riêng của Nhà bán (FR-RPT-002, BR-GEN-05).
 */
export function SellerDashboardPage() {
  const { t } = useTranslation('adminReports')
  const [range, setRange] = useState(() => defaultReportDateRange(30))
  const rangeValid = !range.from || !range.to || range.from <= range.to

  const perfQuery = useQuery({
    queryKey: adminReportsKeys.sellerOwn(range),
    queryFn: ({ signal }) => getSellerPerformance({ from: range.from, to: range.to }, signal),
    enabled: rangeValid,
    retry: false,
  })

  const isNotFound = perfQuery.isError && perfQuery.error instanceof ApiError && perfQuery.error.status === 404
  const data = perfQuery.data
  const summary = data?.summary

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {data?.shopName ? `${data.shopName} — ${t('seller.title')}` : t('seller.title')}
            </h1>
            {data?.shopStatus && <StatusBadge status={data.shopStatus} />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('seller.subtitle')}</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <SyncTimestampBadge
            syncedAt={data?.syncedAt ?? null}
            onRefresh={() => void perfQuery.refetch()}
            isRefreshing={perfQuery.isFetching}
          />
          <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        </div>
      </header>

      {isNotFound ? (
        <section className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <Store aria-hidden="true" className="size-9 text-muted-foreground" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">{t('seller.noShopTitle')}</h2>
            <p className="max-w-md text-xs text-muted-foreground">{t('seller.noShopHint')}</p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/seller/shop">{t('seller.goToShopBtn')}</Link>
          </Button>
        </section>
      ) : perfQuery.isError ? (
        <ServiceFallbackBanner
          message={t('seller.loadError')}
          onRetry={() => void perfQuery.refetch()}
          isRetrying={perfQuery.isFetching}
        />
      ) : perfQuery.isPending ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-5">
          {(summary?.awaitingConfirmationCount ?? 0) > 0 && (
            <div
              role="status"
              className="flex flex-col gap-3 rounded-xl border border-status-warning-border bg-status-warning p-4 text-sm text-status-warning-foreground sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-2.5">
                <ClockAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                <p className="font-medium">
                  {t('seller.awaitingBanner', { count: summary?.awaitingConfirmationCount ?? 0 })}
                </p>
              </div>
              <Button asChild size="sm" variant="outline" className="self-start sm:self-auto">
                <Link to="/seller/orders">{t('seller.goToOrdersBtn')}</Link>
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              label={t('seller.kpis.gmv')}
              value={formatVnd(summary?.periodGmvTotal ?? 0)}
              tone="primary"
              icon={<CircleDollarSign aria-hidden="true" className="size-4" />}
            />
            <KpiCard
              label={t('seller.kpis.awaiting')}
              value={formatNumber(summary?.awaitingConfirmationCount ?? 0)}
              tone={(summary?.awaitingConfirmationCount ?? 0) > 0 ? 'warning' : 'default'}
              icon={<ClockAlert aria-hidden="true" className="size-4" />}
              footer={
                <Link to="/seller/orders" className="text-xs font-medium text-primary hover:underline">
                  {t('seller.goToOrdersBtn')}
                </Link>
              }
            />
            <KpiCard
              label={t('seller.kpis.periodOrders')}
              value={formatNumber(summary?.periodOrdersCount ?? 0)}
              icon={<ShoppingBag aria-hidden="true" className="size-4" />}
            />
            <KpiCard
              label={t('seller.kpis.refunds')}
              value={formatVnd(summary?.periodRefundTotal ?? 0)}
              icon={<RotateCcw aria-hidden="true" className="size-4" />}
            />
            <KpiCard
              label={t('seller.kpis.rating')}
              value={(summary?.ratingAvg ?? 0).toFixed(2)}
              tone="success"
              icon={<Star aria-hidden="true" className="size-4" />}
            />
            <KpiCard
              label={t('seller.kpis.cancelRate')}
              value={formatPercent(summary?.cancelRate ?? 0)}
              tone={(summary?.cancelRate ?? 0) >= 0.2 ? 'danger' : 'default'}
              icon={<TrendingDown aria-hidden="true" className="size-4" />}
            />
          </div>

          <section className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-foreground">{t('seller.stats.heading')}</h2>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{t('seller.stats.totalOrders')}</p>
                <p className="mt-1 text-lg font-bold tabular-nums">{formatNumber(summary?.totalOrders ?? 0)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{t('seller.stats.delivered')}</p>
                <p className="mt-1 text-lg font-bold tabular-nums">{formatNumber(summary?.deliveredCount ?? 0)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{t('seller.stats.deliveryFailed')}</p>
                <p className="mt-1 text-lg font-bold tabular-nums">{formatNumber(summary?.deliveryFailedCount ?? 0)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{t('seller.stats.timeout')}</p>
                <p className="mt-1 text-lg font-bold tabular-nums">{formatNumber(summary?.sellerTimeoutCount ?? 0)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{t('seller.stats.rejected')}</p>
                <p className="mt-1 text-lg font-bold tabular-nums">{formatNumber(summary?.sellerRejectedCount ?? 0)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{t('seller.stats.complaints')}</p>
                <p className="mt-1 text-lg font-bold tabular-nums">
                  {formatNumber(summary?.complaintsCount ?? 0)}{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({formatNumber(summary?.complaintsNoResponseCount ?? 0)})
                  </span>
                </p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <DailyTrendChart
              title={t('seller.chartTitle')}
              data={data?.daily ?? []}
              variant="revenue"
              emptyMessage={t('dashboard.emptyChart')}
            />
            <DailyTrendChart
              title={t('dashboard.charts.ordersTitle')}
              data={data?.daily ?? []}
              variant="orders"
              emptyMessage={t('dashboard.emptyChart')}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/seller/orders">
                <ClipboardList aria-hidden="true" />
                {t('seller.quickLinks.orders')}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/seller/products">
                <Package aria-hidden="true" />
                {t('seller.quickLinks.products')}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/seller/complaints">
                <ClockAlert aria-hidden="true" />
                {t('seller.quickLinks.complaints')}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
