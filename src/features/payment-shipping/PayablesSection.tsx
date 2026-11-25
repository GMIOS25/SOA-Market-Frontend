import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Inbox, RefreshCw, Search, Store, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyableId, ServiceFallbackBanner } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDateTime, formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  listAdminPayables,
  paymentShippingKeys,
  type AdminPayablesFilter,
  type PayableStatus,
} from './api'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PAYABLE_STATUSES: readonly PayableStatus[] = ['ELIGIBLE', 'ON_HOLD', 'NOT_ELIGIBLE']
const PAGE_SIZE = 20

/** Tab Khoản phải trả nhà bán — đọc `GET /v1/admin/payables` của SVC-PAY (FR-PAY-006). */
export function PayablesSection() {
  const { t } = useTranslation('paymentShipping')
  const { t: tStatus } = useTranslation('status')

  const [shopInput, setShopInput] = useState('')
  const [shopId, setShopId] = useState('')
  const [shopError, setShopError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<PayableStatus | ''>('')
  const [page, setPage] = useState(1)

  const queryFilter: AdminPayablesFilter = {
    ...(shopId ? { shopId } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    page,
    pageSize: PAGE_SIZE,
  }

  const payablesQuery = useQuery({
    queryKey: paymentShippingKeys.payables(queryFilter),
    queryFn: ({ signal }) => listAdminPayables(queryFilter, signal),
    placeholderData: keepPreviousData,
  })

  function submitShopFilter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = shopInput.trim()
    if (!trimmed) {
      setShopError(null)
      setShopId('')
      setPage(1)
      return
    }
    if (!UUID_RE.test(trimmed)) {
      setShopError(t('exceptions.payables.invalidShopUuid'))
      return
    }
    setShopError(null)
    setShopId(trimmed)
    setPage(1)
  }

  function selectShop(nextShopId: string) {
    setShopError(null)
    setShopInput(nextShopId)
    setShopId(nextShopId)
    setPage(1)
  }

  function clearShopFilter() {
    setShopError(null)
    setShopInput('')
    setShopId('')
    setPage(1)
  }

  if (payablesQuery.isError) {
    return (
      <ServiceFallbackBanner
        message={t('exceptions.payables.loadError')}
        onRetry={() => void payablesQuery.refetch()}
        isRetrying={payablesQuery.isFetching}
      />
    )
  }

  const summary = payablesQuery.data?.summary
  const shopTotals = summary?.shopTotals ?? []
  const entries = payablesQuery.data?.data ?? []
  const pagination = payablesQuery.data?.pagination

  return (
    <div className="space-y-6">
      {/* KPI tổng hợp toàn sàn */}
      {payablesQuery.isPending ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t('exceptions.payables.summary.gross')}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatVnd(summary.totalGrossAmount)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t('exceptions.payables.summary.refunded')}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatVnd(summary.totalRefundedAmount)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t('exceptions.payables.summary.fee')}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatVnd(summary.totalPlatformFee)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t('exceptions.payables.summary.net')}</p>
            <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">{formatVnd(summary.totalNetPayable)}</p>
          </div>
          <div className="rounded-xl border border-status-success-border bg-status-success p-4 text-status-success-foreground">
            <p className="text-xs">{t('exceptions.payables.summary.eligible')}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatVnd(summary.eligibleNetPayable)}</p>
          </div>
          <div className="rounded-xl border border-status-warning-border bg-status-warning p-4 text-status-warning-foreground">
            <p className="text-xs">{t('exceptions.payables.summary.onHold')}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatVnd(summary.onHoldNetAmount)}</p>
          </div>
        </div>
      ) : null}

      {/* Tổng hợp theo từng Gian hàng */}
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Store aria-hidden="true" className="size-4 text-primary" />
            {t('exceptions.payables.shopTotalsTitle')}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void payablesQuery.refetch()}
            disabled={payablesQuery.isFetching}
          >
            <RefreshCw aria-hidden="true" className={cn(payablesQuery.isFetching && 'animate-spin')} />
            {t('exceptions.filters.refresh')}
          </Button>
        </div>

        {payablesQuery.isPending ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : shopTotals.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('exceptions.payables.shopTotalsEmpty')}</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">{t('exceptions.payables.shopId')}</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{t('exceptions.payables.entriesCount')}</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{t('exceptions.payables.summary.gross')}</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{t('exceptions.payables.summary.refunded')}</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{t('exceptions.payables.summary.fee')}</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{t('exceptions.payables.summary.eligible')}</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{t('exceptions.payables.summary.onHold')}</th>
                    <th scope="col" className="px-4 py-2.5 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shopTotals.map((shop) => {
                    const active = shop.shopId.toLowerCase() === shopId.toLowerCase()
                    return (
                      <tr key={shop.shopId} className={cn('hover:bg-muted/30', active && 'bg-primary-soft/50')}>
                        <td className="px-4 py-2.5">
                          <CopyableId value={shop.shopId} label={t('exceptions.payables.shopId')} />
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(shop.entriesCount)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatVnd(shop.totalGrossAmount)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatVnd(shop.totalRefundedAmount)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatVnd(shop.totalPlatformFee)}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-status-success-foreground tabular-nums">
                          {formatVnd(shop.eligibleNetPayable)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-status-warning-foreground tabular-nums">
                          {formatVnd(shop.onHoldNetAmount)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            type="button"
                            size="xs"
                            variant={active ? 'secondary' : 'outline'}
                            onClick={() => (active ? clearShopFilter() : selectShop(shop.shopId))}
                          >
                            {active ? t('exceptions.payables.clearShopFilter') : t('exceptions.payables.filterByShop')}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {shopTotals.map((shop) => {
                const active = shop.shopId.toLowerCase() === shopId.toLowerCase()
                return (
                  <article key={shop.shopId} className="rounded-lg border border-border p-3.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <CopyableId value={shop.shopId} label={t('exceptions.payables.shopId')} />
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatNumber(shop.entriesCount)} {t('exceptions.payables.entriesCount').toLowerCase()}
                      </span>
                    </div>
                    <dl className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">{t('exceptions.payables.summary.eligible')}</dt>
                        <dd className="font-semibold text-status-success-foreground tabular-nums">
                          {formatVnd(shop.eligibleNetPayable)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{t('exceptions.payables.summary.onHold')}</dt>
                        <dd className="font-semibold text-status-warning-foreground tabular-nums">
                          {formatVnd(shop.onHoldNetAmount)}
                        </dd>
                      </div>
                    </dl>
                    <Button
                      type="button"
                      size="xs"
                      variant={active ? 'secondary' : 'outline'}
                      className="mt-3 w-full"
                      onClick={() => (active ? clearShopFilter() : selectShop(shop.shopId))}
                    >
                      {active ? t('exceptions.payables.clearShopFilter') : t('exceptions.payables.filterByShop')}
                    </Button>
                  </article>
                )
              })}
            </div>
          </>
        )}
      </section>

      {/* Bảng chi tiết từng SellerLedgerEntry */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-base font-semibold">{t('exceptions.payables.ledgerTitle')}</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <form onSubmit={submitShopFilter} className="flex gap-2">
              <div className="relative flex-1 sm:w-72">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="search"
                  value={shopInput}
                  onChange={(event) => {
                    setShopInput(event.target.value)
                    if (shopError) setShopError(null)
                  }}
                  aria-label={t('exceptions.payables.shopIdPlaceholder')}
                  placeholder={t('exceptions.payables.shopIdPlaceholder')}
                  className="h-9 w-full rounded-md border border-input bg-background pr-3 pl-9 font-mono text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                />
              </div>
              <Button type="submit" size="sm" variant="outline">
                {t('exceptions.filters.apply')}
              </Button>
            </form>

            <select
              aria-label={t('exceptions.payables.allStatuses')}
              value={statusFilter}
              onChange={(event) => {
                setPage(1)
                setStatusFilter(event.target.value as PayableStatus | '')
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t('exceptions.payables.allStatuses')}</option>
              {PAYABLE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {tStatus(status)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {shopError && <p className="text-xs text-status-danger-foreground">{shopError}</p>}

        {shopId && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
            <span>{t('exceptions.payables.filteredShop', { shopId })}</span>
            <button
              type="button"
              onClick={clearShopFilter}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <X aria-hidden="true" className="size-3.5" />
              {t('exceptions.payables.clearShopFilter')}
            </button>
          </div>
        )}

        {payablesQuery.isPending ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <Inbox aria-hidden="true" className="size-8" />
            <p>{t('exceptions.payables.ledgerEmpty')}</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">{t('exceptions.payables.sellerOrderId')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('exceptions.payables.shopId')}</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{t('exceptions.payables.itemsAmount')}</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{t('exceptions.payables.summary.refunded')}</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{t('exceptions.payables.summary.fee')}</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{t('exceptions.payables.netAmount')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('exceptions.payables.condition')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('exceptions.refunds.updatedAt')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((entry) => (
                    <tr key={entry.entryId} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <CopyableId value={entry.sellerOrderId} label={t('exceptions.payables.sellerOrderId')} />
                      </td>
                      <td className="px-4 py-2.5">
                        <CopyableId value={entry.shopId} label={t('exceptions.payables.shopId')} />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        <p>{formatVnd(entry.itemsAmount)}</p>
                        <p className="text-xs text-muted-foreground">{formatVnd(entry.grossAmount)}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatVnd(entry.refundedAmount)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        <p>{formatVnd(entry.platformFee)}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('exceptions.payables.feeRate', { rate: Math.round(entry.platformFeeRate * 100) })}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                        {formatVnd(entry.netAmount)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={entry.status} />
                          <span className="text-xs text-muted-foreground">
                            {entry.openComplaintsCount > 0
                              ? t('exceptions.payables.openComplaints', { count: entry.openComplaintsCount })
                              : entry.orderCompleted
                                ? t('exceptions.payables.completed')
                                : t('exceptions.payables.notCompleted')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
                        {formatDateTime(entry.eligibleAt ?? entry.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {entries.map((entry) => (
                <article key={entry.entryId} className="space-y-2 rounded-lg border border-border p-3.5 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CopyableId value={entry.sellerOrderId} label={t('exceptions.payables.sellerOrderId')} />
                      <CopyableId value={entry.shopId} label={t('exceptions.payables.shopId')} />
                    </div>
                    <StatusBadge status={entry.status} />
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">{t('exceptions.payables.netAmount')}</dt>
                      <dd className="font-semibold tabular-nums">{formatVnd(entry.netAmount)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t('exceptions.payables.summary.fee')}</dt>
                      <dd className="tabular-nums">{formatVnd(entry.platformFee)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t('exceptions.payables.summary.refunded')}</dt>
                      <dd className="tabular-nums">{formatVnd(entry.refundedAmount)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t('exceptions.payables.condition')}</dt>
                      <dd className="text-muted-foreground">
                        {entry.openComplaintsCount > 0
                          ? t('exceptions.payables.openComplaints', { count: entry.openComplaintsCount })
                          : entry.orderCompleted
                            ? t('exceptions.payables.completed')
                            : t('exceptions.payables.notCompleted')}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
            <span>
              {t('exceptions.pagination.summary', {
                page: pagination.page,
                totalPages: pagination.totalPages,
                total: formatNumber(pagination.totalItems),
              })}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft aria-hidden="true" />
                {t('exceptions.pagination.prev')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('exceptions.pagination.next')}
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
