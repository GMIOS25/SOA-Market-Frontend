import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CircleDollarSign,
  RotateCcw,
  Search,
  ShoppingBag,
  Star,
  TrendingDown,
  UserPlus,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CopyableId, ServiceFallbackBanner, SyncTimestampBadge } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatNumber, formatVnd } from '@/lib/format'
import {
  adminReportsKeys,
  defaultReportDateRange,
  formatPercent,
  getAdminOverviewReport,
  listAdminSellersReport,
} from './api'
import { DailyTrendChart, DateRangeFilter, KpiCard, PaginationBar } from './components'

const PAGE_SIZE = 20
const SORT_KEYS = ['anomalies', 'orders', 'cancel_rate', 'complaints', 'rating_asc'] as const
type SortKey = (typeof SORT_KEYS)[number]

/**
 * A1 `/admin` — Bảng điều khiển toàn sàn, biểu đồ GMV/đơn hàng & cảnh báo nhà bán bất thường (FR-RPT-001, FR-RPT-002).
 */
export function AdminDashboardPage() {
  const { t } = useTranslation('adminReports')
  const [range, setRange] = useState(() => defaultReportDateRange(30))
  const [searchInput, setSearchInput] = useState('')
  const [queryText, setQueryText] = useState('')
  const [anomalyOnly, setAnomalyOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>('anomalies')
  const [page, setPage] = useState(1)

  const rangeValid = !range.from || !range.to || range.from <= range.to

  const overviewQuery = useQuery({
    queryKey: adminReportsKeys.overview(range),
    queryFn: ({ signal }) => getAdminOverviewReport({ from: range.from, to: range.to }, signal),
    enabled: rangeValid,
    retry: false,
  })

  const sellersFilter = {
    anomalyOnly: anomalyOnly || undefined,
    q: queryText || undefined,
    sort,
    page,
    pageSize: PAGE_SIZE,
  }
  const sellersQuery = useQuery({
    queryKey: adminReportsKeys.sellersReport(sellersFilter),
    queryFn: ({ signal }) => listAdminSellersReport(sellersFilter, signal),
    placeholderData: keepPreviousData,
    retry: false,
  })

  const summary = overviewQuery.data?.summary
  const daily = overviewQuery.data?.daily ?? []
  const sellers = sellersQuery.data?.data ?? []

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setQueryText(searchInput.trim())
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('dashboard.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <SyncTimestampBadge
            syncedAt={overviewQuery.data?.syncedAt ?? sellersQuery.data?.syncedAt ?? null}
            onRefresh={() => {
              void overviewQuery.refetch()
              void sellersQuery.refetch()
            }}
            isRefreshing={overviewQuery.isFetching || sellersQuery.isFetching}
          />
          <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        </div>
      </header>

      {/* Khối tổng quan KPI & biểu đồ */}
      {overviewQuery.isError ? (
        <ServiceFallbackBanner
          message={t('dashboard.loadError')}
          onRetry={() => void overviewQuery.refetch()}
          isRetrying={overviewQuery.isFetching}
        />
      ) : overviewQuery.isPending ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              label={t('dashboard.kpis.gmv')}
              value={formatVnd(summary?.gmvTotal ?? 0)}
              tone="primary"
              icon={<CircleDollarSign aria-hidden="true" className="size-4" />}
            />
            <KpiCard
              label={t('dashboard.kpis.orders')}
              value={formatNumber(summary?.ordersCount ?? 0)}
              icon={<ShoppingBag aria-hidden="true" className="size-4" />}
            />
            <KpiCard
              label={t('dashboard.kpis.cancelRate')}
              value={formatPercent(summary?.cancelRate ?? 0)}
              hint={t('dashboard.kpis.cancelledCount', { count: summary?.cancelledCount ?? 0 })}
              tone={(summary?.cancelRate ?? 0) >= 0.15 ? 'warning' : 'default'}
              icon={<TrendingDown aria-hidden="true" className="size-4" />}
            />
            <KpiCard
              label={t('dashboard.kpis.refunds')}
              value={formatVnd(summary?.refundTotal ?? 0)}
              icon={<RotateCcw aria-hidden="true" className="size-4" />}
            />
            <KpiCard
              label={t('dashboard.kpis.growth')}
              value={formatNumber((summary?.newUsersCount ?? 0) + (summary?.newSellersCount ?? 0))}
              hint={t('dashboard.kpis.growthHint', {
                users: summary?.newUsersCount ?? 0,
                sellers: summary?.newSellersCount ?? 0,
              })}
              tone="success"
              icon={<UserPlus aria-hidden="true" className="size-4" />}
            />
            <KpiCard
              label={t('dashboard.kpis.openExceptions')}
              value={formatNumber(summary?.openExceptionsCount ?? 0)}
              tone={(summary?.openExceptionsCount ?? 0) > 0 ? 'danger' : 'default'}
              icon={<AlertTriangle aria-hidden="true" className="size-4" />}
              footer={
                <Link to="/admin/exceptions" className="text-xs font-medium text-primary hover:underline">
                  {t('dashboard.kpis.viewExceptions')}
                </Link>
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <DailyTrendChart
              title={t('dashboard.charts.revenueTitle')}
              data={daily}
              variant="revenue"
              emptyMessage={t('dashboard.emptyChart')}
            />
            <DailyTrendChart
              title={t('dashboard.charts.ordersTitle')}
              data={daily}
              variant="orders"
              emptyMessage={t('dashboard.emptyChart')}
            />
          </div>
        </div>
      )}

      {/* Khối báo cáo hiệu suất & cảnh báo nhà bán */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">{t('dashboard.sellers.title')}</h2>
            <p className="text-xs text-muted-foreground">{t('dashboard.sellers.subtitle')}</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={anomalyOnly}
              onChange={(event) => {
                setAnomalyOnly(event.target.checked)
                setPage(1)
              }}
              className="size-4 rounded border-input"
            />
            {t('dashboard.sellers.anomalyOnly')}
          </label>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <form onSubmit={handleSearchSubmit} className="flex flex-1 gap-2">
            <div className="relative flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                aria-label={t('dashboard.sellers.searchPlaceholder')}
                placeholder={t('dashboard.sellers.searchPlaceholder')}
                className="h-9 w-full rounded-md border border-input bg-background pr-3 pl-9 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              />
            </div>
            <Button type="submit" size="sm" variant="outline">
              {t('common.applyFilter')}
            </Button>
          </form>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{t('dashboard.sellers.sortLabel')}</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as SortKey)
                setPage(1)
              }}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground"
            >
              {SORT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(`dashboard.sellers.sorts.${key}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {sellersQuery.isError ? (
          <ServiceFallbackBanner
            message={t('dashboard.sellers.loadError')}
            onRetry={() => void sellersQuery.refetch()}
            isRetrying={sellersQuery.isFetching}
          />
        ) : sellersQuery.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : sellers.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('dashboard.sellers.empty')}</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">{t('dashboard.sellers.cols.shop')}</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{t('dashboard.sellers.cols.orders')}</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{t('dashboard.sellers.cols.cancelRate')}</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{t('dashboard.sellers.cols.deliveryFailed')}</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{t('dashboard.sellers.cols.complaints')}</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{t('dashboard.sellers.cols.rating')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('dashboard.sellers.cols.alert')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sellers.map((seller) => (
                    <tr key={seller.shopId} className="hover:bg-muted/30">
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium text-foreground">{seller.shopName || t('common.none')}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={seller.shopStatus} />
                          <CopyableId value={seller.shopId} label={seller.shopName || seller.shopId} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right align-top tabular-nums">
                        <p className="font-semibold">{formatNumber(seller.totalOrders)}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('dashboard.sellers.deliveredDetail', { count: seller.deliveredCount })}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right align-top tabular-nums">
                        <p className="font-medium">{formatPercent(seller.cancelRate)}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('dashboard.sellers.timeoutDetail', {
                            rate: formatPercent(seller.timeoutRate),
                            count: seller.sellerTimeoutCount,
                          })}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right align-top tabular-nums">
                        <p>{formatPercent(seller.deliveryFailedRate)}</p>
                        <p className="text-xs text-muted-foreground">{formatNumber(seller.deliveryFailedCount)}</p>
                      </td>
                      <td className="px-4 py-3 text-right align-top tabular-nums">
                        <p>{formatNumber(seller.complaintsCount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('dashboard.sellers.noRespDetail', { count: seller.complaintsNoResponseCount })}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right align-top tabular-nums">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Star aria-hidden="true" className="size-3.5 text-status-warning-foreground" />
                          {seller.ratingAvg.toFixed(2)}
                        </span>
                      </td>
                      <td className="max-w-xs px-4 py-3 align-top">
                        {seller.isAnomalous ? (
                          <div className="space-y-1">
                            <StatusBadge
                              status="ANOMALOUS"
                              tone="danger"
                              label={t('dashboard.sellers.anomalousBadge')}
                            />
                            <ul className="list-disc space-y-0.5 pl-4 text-xs text-status-danger-foreground">
                              {(seller.anomalyReasons ?? []).map((reason) => (
                                <li key={reason}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <StatusBadge status="ACTIVE" tone="success" label={t('dashboard.sellers.normalBadge')} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {sellers.map((seller) => (
                <article key={seller.shopId} className="space-y-2 rounded-lg border border-border p-3.5 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{seller.shopName || t('common.none')}</p>
                      <CopyableId value={seller.shopId} label={seller.shopName || seller.shopId} />
                    </div>
                    <StatusBadge
                      status={seller.isAnomalous ? 'ANOMALOUS' : 'ACTIVE'}
                      tone={seller.isAnomalous ? 'danger' : 'success'}
                      label={
                        seller.isAnomalous
                          ? t('dashboard.sellers.anomalousBadge')
                          : t('dashboard.sellers.normalBadge')
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground tabular-nums">
                    <span>
                      {t('dashboard.sellers.cols.orders')}: <strong className="text-foreground">{formatNumber(seller.totalOrders)}</strong>
                    </span>
                    <span>
                      {t('dashboard.sellers.cols.cancelRate')}: <strong className="text-foreground">{formatPercent(seller.cancelRate)}</strong>
                    </span>
                    <span>
                      {t('dashboard.sellers.cols.deliveryFailed')}: <strong className="text-foreground">{formatPercent(seller.deliveryFailedRate)}</strong>
                    </span>
                    <span>
                      {t('dashboard.sellers.cols.rating')}: <strong className="text-foreground">{seller.ratingAvg.toFixed(2)}</strong>
                    </span>
                  </div>
                  {seller.isAnomalous && (seller.anomalyReasons ?? []).length > 0 && (
                    <ul className="list-disc space-y-0.5 pl-4 text-xs text-status-danger-foreground">
                      {(seller.anomalyReasons ?? []).map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          </>
        )}

        <PaginationBar pagination={sellersQuery.data?.pagination} onPageChange={setPage} />
      </section>
    </div>
  )
}
