import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Inbox, Search, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyableId, ServiceFallbackBanner, SyncTimestampBadge } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDateTime, formatVnd } from '@/lib/format'
import { adminReportsKeys, listAdminOrders, UUID_RE, type AdminOrdersFilter } from './api'
import { PaginationBar } from './components'

const ORDER_STATUSES = ['PENDING_PAYMENT', 'PAID', 'COMPLETED', 'CANCELLED'] as const
type LookupField = 'orderId' | 'buyerId'
const PAGE_SIZE = 20

/**
 * A9 `/admin/orders` — Giám sát danh sách đơn hàng toàn sàn (Read Model SVC-RPT, ADMINISTRATOR | CS).
 */
export function AdminOrdersPage() {
  const { t } = useTranslation('adminReports')
  const { t: tStatus } = useTranslation('status')

  const [status, setStatus] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [appliedQ, setAppliedQ] = useState('')
  const [lookupField, setLookupField] = useState<LookupField>('orderId')
  const [uuidInput, setUuidInput] = useState('')
  const [appliedUuid, setAppliedUuid] = useState<{ field: LookupField; value: string } | null>(null)
  const [uuidError, setUuidError] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const rangeValid = !from || !to || from <= to

  const filter: AdminOrdersFilter = {
    status: status || undefined,
    q: appliedQ || undefined,
    ...(appliedUuid ? { [appliedUuid.field]: appliedUuid.value } : {}),
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize: PAGE_SIZE,
  }

  const ordersQuery = useQuery({
    queryKey: adminReportsKeys.orders(filter),
    queryFn: ({ signal }) => listAdminOrders(filter, signal),
    enabled: rangeValid,
    placeholderData: keepPreviousData,
    retry: false,
  })

  function handleSubmitFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedUuid = uuidInput.trim()
    if (trimmedUuid && !UUID_RE.test(trimmedUuid)) {
      setUuidError(t('common.invalidUuid'))
      return
    }
    setUuidError(null)
    setAppliedQ(searchInput.trim())
    setAppliedUuid(trimmedUuid ? { field: lookupField, value: trimmedUuid } : null)
    setPage(1)
  }

  function handleResetFilters() {
    setStatus('')
    setSearchInput('')
    setAppliedQ('')
    setUuidInput('')
    setAppliedUuid(null)
    setUuidError(null)
    setFrom('')
    setTo('')
    setPage(1)
  }

  const orders = ordersQuery.data?.data ?? []

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('orders.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('orders.subtitle')}</p>
        </div>
        <SyncTimestampBadge
          syncedAt={ordersQuery.data?.syncedAt ?? null}
          onRefresh={() => void ordersQuery.refetch()}
          isRefreshing={ordersQuery.isFetching}
        />
      </header>

      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <form onSubmit={handleSubmitFilters} className="space-y-3">
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                aria-label={t('orders.filters.searchCode')}
                placeholder={t('orders.filters.searchCode')}
                className="h-9 w-full rounded-md border border-input bg-background pr-3 pl-9 text-sm"
              />
            </div>

            <select
              aria-label={t('orders.filters.statusLabel')}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{`${t('orders.filters.statusLabel')}: ${t('common.all')}`}</option>
              {ORDER_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {tStatus(st)}
                </option>
              ))}
            </select>

            <div className="flex gap-1.5">
              <select
                aria-label={t('orders.filters.lookupType')}
                value={lookupField}
                onChange={(event) => setLookupField(event.target.value as LookupField)}
                className="h-9 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="orderId">{t('orders.filters.orderId')}</option>
                <option value="buyerId">{t('orders.filters.buyerId')}</option>
              </select>
              <input
                type="search"
                value={uuidInput}
                onChange={(event) => {
                  setUuidInput(event.target.value)
                  if (uuidError) setUuidError(null)
                }}
                aria-label={t('orders.filters.lookupPlaceholder')}
                placeholder={t('orders.filters.lookupPlaceholder')}
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 font-mono text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="date"
                aria-label={t('common.fromDate')}
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value)
                  setPage(1)
                }}
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"
              />
              <input
                type="date"
                aria-label={t('common.toDate')}
                value={to}
                onChange={(event) => {
                  setTo(event.target.value)
                  setPage(1)
                }}
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"
              />
              <Button type="submit" size="sm" variant="default">
                {t('common.applyFilter')}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={handleResetFilters}>
                <X aria-hidden="true" />
                {t('common.clearFilter')}
              </Button>
            </div>
          </div>

          {uuidError && <p className="text-xs text-status-danger-foreground">{uuidError}</p>}
          {!rangeValid && <p className="text-xs text-status-danger-foreground">{t('common.invalidDateRange')}</p>}
        </form>

        {ordersQuery.isError ? (
          <ServiceFallbackBanner
            message={t('orders.loadError')}
            onRetry={() => void ordersQuery.refetch()}
            isRetrying={ordersQuery.isFetching}
          />
        ) : ordersQuery.isPending ? (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <Inbox aria-hidden="true" className="size-8" />
            <p className="font-medium text-foreground">{t('orders.emptyTitle')}</p>
            <p className="text-xs">{t('orders.emptyHint')}</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">{t('orders.cols.order')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('orders.cols.buyer')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('orders.cols.status')}</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{t('orders.cols.grandTotal')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('orders.cols.sellerOrders')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('orders.cols.timestamps')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((order) => (
                    <tr key={order.orderId} className="hover:bg-muted/30">
                      <td className="px-4 py-3 align-top">
                        <p className="font-mono font-semibold text-foreground">{order.orderCode || t('common.none')}</p>
                        <CopyableId value={order.orderId} label={order.orderCode || order.orderId} />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <CopyableId value={order.buyerId} label={order.buyerId} />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3 text-right align-top font-semibold tabular-nums">
                        {formatVnd(order.grandTotal)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          {(order.sellerOrders ?? []).map((so) => (
                            <span
                              key={so.sellerOrderId}
                              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs"
                            >
                              <span className="font-mono">{so.sellerOrderId.slice(0, 8)}</span>
                              {so.status && <StatusBadge status={so.status} />}
                              {typeof so.totalAmount === 'number' && so.totalAmount > 0 && (
                                <span className="font-medium tabular-nums">{formatVnd(so.totalAmount)}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-muted-foreground tabular-nums">
                        <p>{t('orders.createdAt', { time: formatDateTime(order.createdAt) })}</p>
                        {order.paidAt && <p>{t('orders.paidAt', { time: formatDateTime(order.paidAt) })}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {orders.map((order) => (
                <article key={order.orderId} className="space-y-2 rounded-lg border border-border p-3.5 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono font-semibold text-foreground">{order.orderCode || t('common.none')}</p>
                      <CopyableId value={order.orderId} label={order.orderId} />
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{formatDateTime(order.createdAt)}</span>
                    <span className="font-semibold tabular-nums">{formatVnd(order.grandTotal)}</span>
                  </div>
                  {(order.sellerOrders ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {(order.sellerOrders ?? []).map((so) => (
                        <span
                          key={so.sellerOrderId}
                          className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-xs"
                        >
                          <span className="font-mono">{so.sellerOrderId.slice(0, 8)}</span>
                          {so.status && <StatusBadge status={so.status} />}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </>
        )}

        <PaginationBar pagination={ordersQuery.data?.pagination} onPageChange={setPage} />
      </section>
    </div>
  )
}
