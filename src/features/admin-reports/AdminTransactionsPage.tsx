import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Inbox, Search, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyableId, ServiceFallbackBanner, SyncTimestampBadge } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDateTime, formatVnd } from '@/lib/format'
import { adminReportsKeys, listAdminTransactions, UUID_RE, type AdminTransactionsFilter } from './api'
import { PaginationBar } from './components'

const TX_STATUSES = ['INITIATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED'] as const
const PAGE_SIZE = 20

/**
 * A9 `/admin/transactions` — Giám sát giao dịch thanh toán toàn sàn (Read Model SVC-RPT, ADMINISTRATOR | CS).
 */
export function AdminTransactionsPage() {
  const { t } = useTranslation('adminReports')
  const { t: tStatus } = useTranslation('status')

  const [status, setStatus] = useState('')
  const [gatewayRefInput, setGatewayRefInput] = useState('')
  const [appliedGatewayRef, setAppliedGatewayRef] = useState('')
  const [orderIdInput, setOrderIdInput] = useState('')
  const [appliedOrderId, setAppliedOrderId] = useState('')
  const [uuidError, setUuidError] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const rangeValid = !from || !to || from <= to

  const filter: AdminTransactionsFilter = {
    status: status || undefined,
    gatewayRef: appliedGatewayRef || undefined,
    orderId: appliedOrderId || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize: PAGE_SIZE,
  }

  const txQuery = useQuery({
    queryKey: adminReportsKeys.transactions(filter),
    queryFn: ({ signal }) => listAdminTransactions(filter, signal),
    enabled: rangeValid,
    placeholderData: keepPreviousData,
    retry: false,
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedOrderId = orderIdInput.trim()
    if (trimmedOrderId && !UUID_RE.test(trimmedOrderId)) {
      setUuidError(t('common.invalidUuid'))
      return
    }
    setUuidError(null)
    setAppliedGatewayRef(gatewayRefInput.trim())
    setAppliedOrderId(trimmedOrderId)
    setPage(1)
  }

  function handleReset() {
    setStatus('')
    setGatewayRefInput('')
    setAppliedGatewayRef('')
    setOrderIdInput('')
    setAppliedOrderId('')
    setUuidError(null)
    setFrom('')
    setTo('')
    setPage(1)
  }

  const transactions = txQuery.data?.data ?? []

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('transactions.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('transactions.subtitle')}</p>
        </div>
        <SyncTimestampBadge
          syncedAt={txQuery.data?.syncedAt ?? null}
          onRefresh={() => void txQuery.refetch()}
          isRefreshing={txQuery.isFetching}
        />
      </header>

      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                value={gatewayRefInput}
                onChange={(event) => setGatewayRefInput(event.target.value)}
                aria-label={t('transactions.filters.gatewayRef')}
                placeholder={t('transactions.filters.gatewayRef')}
                className="h-9 w-full rounded-md border border-input bg-background pr-3 pl-9 font-mono text-xs"
              />
            </div>

            <select
              aria-label={t('transactions.filters.statusLabel')}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{`${t('transactions.filters.statusLabel')}: ${t('common.all')}`}</option>
              {TX_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {tStatus(st)}
                </option>
              ))}
            </select>

            <input
              type="search"
              value={orderIdInput}
              onChange={(event) => {
                setOrderIdInput(event.target.value)
                if (uuidError) setUuidError(null)
              }}
              aria-label={t('transactions.filters.orderId')}
              placeholder={t('transactions.filters.orderId')}
              className="h-9 rounded-md border border-input bg-background px-3 font-mono text-xs"
            />

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
              <Button type="button" size="sm" variant="ghost" onClick={handleReset}>
                <X aria-hidden="true" />
                {t('common.clearFilter')}
              </Button>
            </div>
          </div>

          {uuidError && <p className="text-xs text-status-danger-foreground">{uuidError}</p>}
          {!rangeValid && <p className="text-xs text-status-danger-foreground">{t('common.invalidDateRange')}</p>}
        </form>

        {txQuery.isError ? (
          <ServiceFallbackBanner
            message={t('transactions.loadError')}
            onRetry={() => void txQuery.refetch()}
            isRetrying={txQuery.isFetching}
          />
        ) : txQuery.isPending ? (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <Inbox aria-hidden="true" className="size-8" />
            <p className="font-medium text-foreground">{t('transactions.emptyTitle')}</p>
            <p className="text-xs">{t('transactions.emptyHint')}</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">{t('transactions.cols.payment')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('transactions.cols.gatewayRef')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('transactions.cols.status')}</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{t('transactions.cols.amount')}</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{t('transactions.cols.refunded')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('transactions.cols.timestamps')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((tx) => (
                    <tr key={tx.paymentId} className="hover:bg-muted/30">
                      <td className="px-4 py-3 align-top">
                        <div className="space-y-1">
                          <CopyableId value={tx.paymentId} label={tx.paymentId} />
                          <CopyableId value={tx.orderId} label={tx.orderId} />
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-xs text-foreground">
                        {tx.gatewayRef || t('common.none')}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <StatusBadge status={tx.status} />
                      </td>
                      <td className="px-4 py-3 text-right align-top font-semibold tabular-nums">
                        {formatVnd(tx.amount)}
                      </td>
                      <td className="px-4 py-3 text-right align-top tabular-nums">
                        {formatVnd(tx.refundedTotal)}
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-muted-foreground tabular-nums">
                        <p>{t('transactions.createdAt', { time: formatDateTime(tx.createdAt) })}</p>
                        {tx.completedAt && (
                          <p>{t('transactions.completedAt', { time: formatDateTime(tx.completedAt) })}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {transactions.map((tx) => (
                <article key={tx.paymentId} className="space-y-2 rounded-lg border border-border p-3.5 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-semibold">{tx.gatewayRef || t('common.none')}</span>
                    <StatusBadge status={tx.status} />
                  </div>
                  <CopyableId value={tx.paymentId} label={tx.paymentId} />
                  <div className="flex items-center justify-between text-xs tabular-nums">
                    <span className="text-muted-foreground">{formatDateTime(tx.createdAt)}</span>
                    <span className="font-semibold text-foreground">{formatVnd(tx.amount)}</span>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        <PaginationBar pagination={txQuery.data?.pagination} onPageChange={setPage} />
      </section>
    </div>
  )
}
