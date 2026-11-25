import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClockAlert,
  CreditCard,
  Inbox,
  PackageX,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/errors'
import { CopyableId, ServiceFallbackBanner, SyncTimestampBadge } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDateTime, formatNumber, formatVnd } from '@/lib/format'
import type { StatusTone } from '@/lib/status'
import { cn } from '@/lib/utils'
import {
  canManuallyConfirmRefund,
  listAdminPayments,
  listAdminRefunds,
  listFailedShipments,
  listRptExceptions,
  paymentShippingKeys,
  retryShipment,
  type AdminRefundFilter,
  type Refund,
  type RefundSource,
} from './api'
import { formatShipmentFailureReason } from './tracking'

export type ExceptionGroup = 'refunds' | 'shipments' | 'lateOrMismatch' | 'stuckOrReconcile'
type RefundPreset = 'FAILED' | 'NEEDS_RECONCILIATION' | 'EXHAUSTED' | 'SUCCEEDED' | 'ALL'
type LookupField = 'orderId' | 'sellerOrderId' | 'paymentId'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const REFUND_PRESETS: readonly RefundPreset[] = ['FAILED', 'NEEDS_RECONCILIATION', 'EXHAUSTED', 'SUCCEEDED', 'ALL']
const REFUND_SOURCES: readonly RefundSource[] = ['CANCELLATION', 'DELIVERY_FAILED', 'LATE_PAYMENT', 'COMPLAINT']
const PAGE_SIZE = 20

function refundTone(status: string): StatusTone {
  switch (status) {
    case 'SUCCEEDED':
      return 'success'
    case 'FAILED':
      return 'danger'
    case 'PROCESSING':
      return 'info'
    default:
      return 'warning'
  }
}

export type ExceptionsSectionProps = {
  isAdmin: boolean
  onSelectRefund: (refund: Refund) => void
}

/**
 * Hiển thị 4 nhóm ngoại lệ (03-App-Flow §4.6 / A10):
 * (1) Hoàn tiền thất bại & Cần đối soát, (2) Tạo vận đơn CREATE_FAILED,
 * (3) Thanh toán muộn & Lệch số tiền, (4) Đơn kẹt & Đối soát liên dịch vụ (SVC-RPT).
 */
export function ExceptionsSection({ isAdmin, onSelectRefund }: ExceptionsSectionProps) {
  const { t } = useTranslation('paymentShipping')
  const { t: tStatus } = useTranslation('status')
  const queryClient = useQueryClient()

  const [group, setGroup] = useState<ExceptionGroup>('refunds')
  const [preset, setPreset] = useState<RefundPreset>('FAILED')
  const [sourceFilter, setSourceFilter] = useState<RefundSource | ''>('')
  const [lookupField, setLookupField] = useState<LookupField>('orderId')
  const [lookupInput, setLookupInput] = useState('')
  const [lookupValue, setLookupValue] = useState('')
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [refundPage, setRefundPage] = useState(1)
  const [shipmentPage, setShipmentPage] = useState(1)
  const [shipmentNotice, setShipmentNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const refundFilter: AdminRefundFilter = {
    ...(preset === 'FAILED' ? { status: 'FAILED' } : {}),
    ...(preset === 'NEEDS_RECONCILIATION' ? { needsReconciliation: 'true' } : {}),
    ...(preset === 'EXHAUSTED' ? { exhaustedOnly: 'true' } : {}),
    ...(preset === 'SUCCEEDED' ? { status: 'SUCCEEDED' } : {}),
    ...(sourceFilter ? { source: sourceFilter } : {}),
    ...(lookupValue ? { [lookupField]: lookupValue } : {}),
    page: refundPage,
    pageSize: PAGE_SIZE,
  }

  // Luôn đọc tổng số lượng để hiển thị badge đếm từng nhóm ngoại lệ.
  const failedBadgeQuery = useQuery({
    queryKey: paymentShippingKeys.refunds({ status: 'FAILED', page: 1, pageSize: 1 }),
    queryFn: ({ signal }) => listAdminRefunds({ status: 'FAILED', page: 1, pageSize: 1 }, signal),
    retry: false,
  })
  const reconcileBadgeQuery = useQuery({
    queryKey: paymentShippingKeys.refunds({ needsReconciliation: 'true', page: 1, pageSize: 1 }),
    queryFn: ({ signal }) => listAdminRefunds({ needsReconciliation: 'true', page: 1, pageSize: 1 }, signal),
    retry: false,
  })

  const refundsQuery = useQuery({
    queryKey: paymentShippingKeys.refunds(refundFilter),
    queryFn: ({ signal }) => listAdminRefunds(refundFilter, signal),
    enabled: group === 'refunds',
    placeholderData: keepPreviousData,
  })

  const shipmentsQuery = useQuery({
    queryKey: paymentShippingKeys.failedShipments({ page: shipmentPage, pageSize: PAGE_SIZE }),
    queryFn: ({ signal }) => listFailedShipments({ page: shipmentPage, pageSize: PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
    retry: false,
  })

  const manualPaymentsQuery = useQuery({
    queryKey: paymentShippingKeys.payments({ needsManualReview: 'true', page: 1, pageSize: 20 }),
    queryFn: ({ signal }) => listAdminPayments({ needsManualReview: 'true', page: 1, pageSize: 20 }, signal),
    retry: false,
  })

  const lateRefundsQuery = useQuery({
    queryKey: paymentShippingKeys.refunds({ source: 'LATE_PAYMENT', page: 1, pageSize: 20 }),
    queryFn: ({ signal }) => listAdminRefunds({ source: 'LATE_PAYMENT', page: 1, pageSize: 20 }, signal),
    enabled: group === 'lateOrMismatch',
    retry: false,
  })

  const rptQuery = useQuery({
    queryKey: paymentShippingKeys.rptExceptions(),
    queryFn: ({ signal }) => listRptExceptions(signal),
    enabled: group === 'stuckOrReconcile',
    retry: false,
  })

  const retryShipmentMutation = useMutation({
    mutationFn: (shipmentId: string) => retryShipment(shipmentId),
    onMutate: () => setShipmentNotice(null),
    onSuccess: (updated) => {
      setShipmentNotice({
        kind: 'success',
        text: t('exceptions.shipments.retrySuccess', { sellerOrderId: updated.sellerOrderId }),
      })
      void queryClient.invalidateQueries({ queryKey: paymentShippingKeys.all })
    },
    onError: (error) => {
      const msg = error instanceof ApiError ? error.message : String(error)
      setShipmentNotice({
        kind: 'error',
        text: t('exceptions.shipments.retryError', { message: msg }),
      })
    },
  })

  function submitLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = lookupInput.trim()
    if (!trimmed) {
      setLookupError(null)
      setLookupValue('')
      setRefundPage(1)
      return
    }
    if (!UUID_RE.test(trimmed)) {
      setLookupError(t('exceptions.filters.lookupPlaceholder'))
      return
    }
    setLookupError(null)
    setLookupValue(trimmed)
    setRefundPage(1)
  }

  function renderRefundStatusBadge(status: string) {
    const label =
      status === 'REQUESTED' || status === 'PROCESSING' || status === 'SUCCEEDED' || status === 'FAILED'
        ? t(`exceptions.refundStatuses.${status}`)
        : status
    return <StatusBadge status={status} tone={refundTone(status)} label={label} />
  }

  function renderRefundCardActions(refund: Refund) {
    if (refund.status === 'SUCCEEDED') return null
    if (!isAdmin) {
      return <span className="text-xs text-muted-foreground">{t('exceptions.refunds.adminOnlyHint')}</span>
    }
    if (!canManuallyConfirmRefund(refund)) {
      return <span className="text-xs text-muted-foreground">{t('exceptions.refunds.workerInProgress')}</span>
    }
    return (
      <Button type="button" size="xs" variant="default" onClick={() => onSelectRefund(refund)}>
        {t('exceptions.refunds.markManualBtn')}
      </Button>
    )
  }

  const failedRefundCount =
    (failedBadgeQuery.data?.pagination?.totalItems ?? 0) + (reconcileBadgeQuery.data?.pagination?.totalItems ?? 0)
  const failedShipmentsCount = shipmentsQuery.data?.pagination?.totalItems ?? 0
  const manualPaymentsCount = manualPaymentsQuery.data?.pagination?.totalItems ?? 0

  const groupTabs: readonly {
    id: ExceptionGroup
    icon: typeof CreditCard
    count?: number
  }[] = [
    { id: 'refunds', icon: RotateCcw, count: failedRefundCount },
    { id: 'shipments', icon: PackageX, count: failedShipmentsCount },
    { id: 'lateOrMismatch', icon: CreditCard, count: manualPaymentsCount },
    { id: 'stuckOrReconcile', icon: ClockAlert, count: rptQuery.data?.data.length },
  ]

  const refunds = refundsQuery.data?.data ?? []
  const refundPagination = refundsQuery.data?.pagination
  const shipments = shipmentsQuery.data?.shipments ?? []
  const shipmentPagination = shipmentsQuery.data?.pagination

  return (
    <div className="space-y-5">
      {/* 4 nhóm ngoại lệ */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4" role="tablist" aria-label={t('exceptions.tabs.exceptions')}>
        {groupTabs.map(({ id, icon: Icon, count }) => {
          const active = group === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setGroup(id)}
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                active
                  ? 'border-primary bg-primary-soft text-foreground shadow-xs'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Icon aria-hidden="true" className={cn('size-4 shrink-0', active && 'text-primary')} />
                <span className="truncate text-sm font-medium">{t(`exceptions.groups.${id}`)}</span>
              </span>
              {typeof count === 'number' && (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                    count > 0
                      ? 'bg-status-danger text-status-danger-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {formatNumber(count)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Nhóm 1: Hoàn tiền thất bại & cần đối soát */}
      {group === 'refunds' && (
        <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {REFUND_PRESETS.map((item) => (
                <Button
                  key={item}
                  type="button"
                  size="xs"
                  variant={preset === item ? 'default' : 'outline'}
                  onClick={() => {
                    setPreset(item)
                    setRefundPage(1)
                  }}
                >
                  {t(`exceptions.refundPresets.${item}`)}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => void refundsQuery.refetch()}
              disabled={refundsQuery.isFetching}
            >
              <RefreshCw aria-hidden="true" className={cn(refundsQuery.isFetching && 'animate-spin')} />
              {t('exceptions.filters.refresh')}
            </Button>
          </div>

          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
            <form onSubmit={submitLookup} className="flex flex-1 flex-wrap gap-2">
              <select
                aria-label={t('exceptions.filters.lookupTypeOrder')}
                value={lookupField}
                onChange={(event) => setLookupField(event.target.value as LookupField)}
                className="h-9 rounded-md border border-input bg-background px-2.5 text-xs"
              >
                <option value="orderId">{t('exceptions.filters.lookupTypeOrder')}</option>
                <option value="sellerOrderId">{t('exceptions.filters.lookupTypeSellerOrder')}</option>
                <option value="paymentId">{t('exceptions.filters.lookupTypePayment')}</option>
              </select>
              <div className="relative min-w-52 flex-1">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="search"
                  value={lookupInput}
                  onChange={(event) => {
                    setLookupInput(event.target.value)
                    if (lookupError) setLookupError(null)
                  }}
                  aria-label={t('exceptions.filters.lookupPlaceholder')}
                  placeholder={t('exceptions.filters.lookupPlaceholder')}
                  className="h-9 w-full rounded-md border border-input bg-background pr-3 pl-9 font-mono text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                />
              </div>
              <Button type="submit" size="sm" variant="outline">
                {t('exceptions.filters.apply')}
              </Button>
              {lookupValue && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setLookupInput('')
                    setLookupValue('')
                    setLookupError(null)
                    setRefundPage(1)
                  }}
                >
                  <X aria-hidden="true" />
                  {t('exceptions.filters.clear')}
                </Button>
              )}
            </form>

            <select
              aria-label={t('exceptions.filters.allSources')}
              value={sourceFilter}
              onChange={(event) => {
                setSourceFilter(event.target.value as RefundSource | '')
                setRefundPage(1)
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t('exceptions.filters.allSources')}</option>
              {REFUND_SOURCES.map((src) => (
                <option key={src} value={src}>
                  {t(`exceptions.sources.${src}`)}
                </option>
              ))}
            </select>
          </div>

          {lookupError && <p className="text-xs text-status-danger-foreground">{lookupError}</p>}

          {refundsQuery.isError ? (
            <ServiceFallbackBanner
              message={t('exceptions.refunds.loadError')}
              onRetry={() => void refundsQuery.refetch()}
              isRetrying={refundsQuery.isFetching}
            />
          ) : refundsQuery.isPending ? (
            <div className="space-y-2.5">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : refunds.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              <Inbox aria-hidden="true" className="size-8" />
              <p className="font-medium text-foreground">{t('exceptions.refunds.emptyTitle')}</p>
              <p className="max-w-md text-xs">{t('exceptions.refunds.emptyHint')}</p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase">
                    <tr>
                      <th scope="col" className="px-4 py-2.5">{t('exceptions.refunds.refundId')}</th>
                      <th scope="col" className="px-4 py-2.5">{t('exceptions.refunds.orderId')}</th>
                      <th scope="col" className="px-4 py-2.5">{t('exceptions.refunds.source')}</th>
                      <th scope="col" className="px-4 py-2.5 text-right">{t('exceptions.refunds.amount')}</th>
                      <th scope="col" className="px-4 py-2.5">{t('exceptions.refunds.attempts')}</th>
                      <th scope="col" className="px-4 py-2.5">{t('exceptions.refunds.errorDetail')}</th>
                      <th scope="col" className="px-4 py-2.5 text-right" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {refunds.map((refund) => (
                      <tr key={refund.refundId} className="hover:bg-muted/30">
                        <td className="px-4 py-3 align-top">
                          <CopyableId value={refund.refundId} label={t('exceptions.refunds.refundId')} />
                          <div className="mt-1 flex flex-wrap gap-1">
                            {renderRefundStatusBadge(refund.status)}
                            {refund.needsReconciliation && (
                              <StatusBadge
                                status="NEEDS_RECONCILIATION"
                                tone="warning"
                                label={t('exceptions.refunds.needsReconcileBadge')}
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="space-y-1">
                            <CopyableId value={refund.orderId} label={t('exceptions.refunds.orderId')} />
                            <CopyableId value={refund.sellerOrderId} label={t('exceptions.refunds.sellerOrderId')} />
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-xs">
                          <p className="font-medium text-foreground">
                            {t(`exceptions.sources.${refund.source as RefundSource}`, { defaultValue: refund.source })}
                          </p>
                          <p className="mt-0.5 text-muted-foreground tabular-nums">{formatDateTime(refund.updatedAt)}</p>
                        </td>
                        <td className="px-4 py-3 text-right align-top font-semibold tabular-nums">
                          {formatVnd(refund.amount)}
                        </td>
                        <td className="px-4 py-3 align-top text-xs">
                          <p className="font-medium tabular-nums">{refund.attempts}</p>
                          <p className="text-muted-foreground">
                            {refund.nextRetryAt
                              ? t('exceptions.refunds.nextRetry', { time: formatDateTime(refund.nextRetryAt) })
                              : refund.status === 'FAILED'
                                ? t('exceptions.refunds.exhausted')
                                : null}
                          </p>
                        </td>
                        <td className="max-w-xs px-4 py-3 align-top text-xs">
                          {refund.manualBankRef ? (
                            <p className="font-mono text-status-success-foreground">
                              {t('exceptions.refunds.manualRef', { ref: refund.manualBankRef })}
                            </p>
                          ) : refund.lastErrorMessage ? (
                            <p className="line-clamp-2 text-muted-foreground">{refund.lastErrorMessage}</p>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right align-top">{renderRefundCardActions(refund)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {refunds.map((refund) => (
                  <article key={refund.refundId} className="space-y-2.5 rounded-lg border border-border p-3.5 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <CopyableId value={refund.refundId} label={t('exceptions.refunds.refundId')} />
                      {renderRefundStatusBadge(refund.status)}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {t(`exceptions.sources.${refund.source as RefundSource}`, { defaultValue: refund.source })}
                      </span>
                      <span className="font-semibold tabular-nums">{formatVnd(refund.amount)}</span>
                    </div>
                    {refund.needsReconciliation && (
                      <StatusBadge
                        status="NEEDS_RECONCILIATION"
                        tone="warning"
                        label={t('exceptions.refunds.needsReconcileBadge')}
                      />
                    )}
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p className="flex items-center gap-1">
                        {t('exceptions.refunds.orderId')}: <CopyableId value={refund.orderId} label={t('exceptions.refunds.orderId')} />
                      </p>
                      {refund.lastErrorMessage && <p>{refund.lastErrorMessage}</p>}
                      {refund.manualBankRef && (
                        <p className="font-mono text-status-success-foreground">
                          {t('exceptions.refunds.manualRef', { ref: refund.manualBankRef })}
                        </p>
                      )}
                    </div>
                    <div className="pt-1">{renderRefundCardActions(refund)}</div>
                  </article>
                ))}
              </div>
            </>
          )}

          {refundPagination && refundPagination.totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
              <span>
                {t('exceptions.pagination.summary', {
                  page: refundPagination.page,
                  totalPages: refundPagination.totalPages,
                  total: formatNumber(refundPagination.totalItems),
                })}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={refundPagination.page <= 1}
                  onClick={() => setRefundPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft aria-hidden="true" />
                  {t('exceptions.pagination.prev')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={refundPagination.page >= refundPagination.totalPages}
                  onClick={() => setRefundPage((p) => p + 1)}
                >
                  {t('exceptions.pagination.next')}
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Nhóm 2: Tạo vận đơn CREATE_FAILED */}
      {group === 'shipments' && (
        <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{t('exceptions.shipments.heading')}</h2>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => void shipmentsQuery.refetch()}
              disabled={shipmentsQuery.isFetching}
            >
              <RefreshCw aria-hidden="true" className={cn(shipmentsQuery.isFetching && 'animate-spin')} />
              {t('exceptions.filters.refresh')}
            </Button>
          </div>

          {shipmentNotice && (
            <div
              role={shipmentNotice.kind === 'error' ? 'alert' : 'status'}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                shipmentNotice.kind === 'success'
                  ? 'border-status-success-border bg-status-success text-status-success-foreground'
                  : 'border-status-danger-border bg-status-danger text-status-danger-foreground',
              )}
            >
              {shipmentNotice.kind === 'success' ? (
                <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
              ) : (
                <ShieldAlert aria-hidden="true" className="size-4 shrink-0" />
              )}
              <span>{shipmentNotice.text}</span>
            </div>
          )}

          {shipmentsQuery.isError ? (
            <ServiceFallbackBanner
              message={t('exceptions.shipments.loadError')}
              onRetry={() => void shipmentsQuery.refetch()}
              isRetrying={shipmentsQuery.isFetching}
            />
          ) : shipmentsQuery.isPending ? (
            <Skeleton className="h-32 w-full rounded-lg" />
          ) : shipments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('exceptions.shipments.empty')}</p>
          ) : (
            <div className="space-y-3">
              {shipments.map((shipment) => (
                <article
                  key={shipment.shipmentId}
                  className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1.5 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={shipment.status} />
                      <span className="font-mono text-xs text-muted-foreground">{shipment.carrier}</span>
                      <CopyableId value={shipment.shipmentId} label={t('exceptions.shipments.shipmentId')} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        {t('exceptions.shipments.sellerOrderId')}: <CopyableId value={shipment.sellerOrderId} label={t('exceptions.shipments.sellerOrderId')} />
                      </span>
                      <span className="inline-flex items-center gap-1">
                        {t('exceptions.shipments.shopId')}: <CopyableId value={shipment.shopId} label={t('exceptions.shipments.shopId')} />
                      </span>
                    </div>
                    <p className="text-xs text-status-danger-foreground">
                      {t('exceptions.shipments.reason')}:{' '}
                      {formatShipmentFailureReason(shipment.failureReason) ?? tStatus('CREATE_FAILED')}
                    </p>
                  </div>
                  {isAdmin && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={retryShipmentMutation.isPending}
                      onClick={() => retryShipmentMutation.mutate(shipment.shipmentId)}
                    >
                      {retryShipmentMutation.isPending
                        ? t('exceptions.shipments.retrying')
                        : t('exceptions.shipments.retryBtn')}
                    </Button>
                  )}
                </article>
              ))}
            </div>
          )}

          {shipmentPagination && shipmentPagination.totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {t('exceptions.pagination.summary', {
                  page: shipmentPagination.page,
                  totalPages: shipmentPagination.totalPages,
                  total: formatNumber(shipmentPagination.totalItems),
                })}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={shipmentPagination.page <= 1}
                  onClick={() => setShipmentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft aria-hidden="true" />
                  {t('exceptions.pagination.prev')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={shipmentPagination.page >= shipmentPagination.totalPages}
                  onClick={() => setShipmentPage((p) => p + 1)}
                >
                  {t('exceptions.pagination.next')}
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Nhóm 3: Thanh toán muộn & lệch số tiền */}
      {group === 'lateOrMismatch' && (
        <div className="space-y-5">
          <section className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5">
            <h2 className="text-base font-semibold">{t('exceptions.lateOrMismatch.manualReviewTitle')}</h2>
            {manualPaymentsQuery.isError ? (
              <ServiceFallbackBanner
                message={t('exceptions.lateOrMismatch.manualReviewError')}
                onRetry={() => void manualPaymentsQuery.refetch()}
                isRetrying={manualPaymentsQuery.isFetching}
              />
            ) : manualPaymentsQuery.isPending ? (
              <Skeleton className="h-24 w-full rounded-lg" />
            ) : (manualPaymentsQuery.data?.data ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t('exceptions.lateOrMismatch.manualReviewEmpty')}
              </p>
            ) : (
              <div className="space-y-2.5">
                {(manualPaymentsQuery.data?.data ?? []).map((payment) => (
                  <article key={payment.paymentId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3.5 text-sm">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={payment.status} />
                        <StatusBadge
                          status="NEEDS_MANUAL_REVIEW"
                          tone="warning"
                          label={t('exceptions.lateOrMismatch.manualReviewBadge')}
                        />
                        <CopyableId value={payment.paymentId} label={t('exceptions.lateOrMismatch.paymentId')} />
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          {t('exceptions.refunds.orderId')}: <CopyableId value={payment.orderId} label={t('exceptions.refunds.orderId')} />
                        </span>
                        <span>{t('exceptions.lateOrMismatch.gateway')}: {payment.gateway}</span>
                        <span className="font-mono">{payment.gatewayRef}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{formatVnd(payment.amount)}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{formatDateTime(payment.createdAt)}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5">
            <h2 className="text-base font-semibold">{t('exceptions.lateOrMismatch.lateRefundsTitle')}</h2>
            {lateRefundsQuery.isError ? (
              <ServiceFallbackBanner
                message={t('exceptions.lateOrMismatch.lateRefundsError')}
                onRetry={() => void lateRefundsQuery.refetch()}
                isRetrying={lateRefundsQuery.isFetching}
              />
            ) : lateRefundsQuery.isPending ? (
              <Skeleton className="h-24 w-full rounded-lg" />
            ) : (lateRefundsQuery.data?.data ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t('exceptions.lateOrMismatch.lateRefundsEmpty')}
              </p>
            ) : (
              <div className="space-y-2.5">
                {(lateRefundsQuery.data?.data ?? []).map((refund) => (
                  <article key={refund.refundId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3.5 text-sm">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {renderRefundStatusBadge(refund.status)}
                        <CopyableId value={refund.refundId} label={t('exceptions.refunds.refundId')} />
                      </div>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        {t('exceptions.refunds.orderId')}: <CopyableId value={refund.orderId} label={t('exceptions.refunds.orderId')} />
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold tabular-nums">{formatVnd(refund.amount)}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{formatDateTime(refund.updatedAt)}</p>
                      </div>
                      {renderRefundCardActions(refund)}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Nhóm 4: Đơn kẹt & Đối soát từ SVC-RPT */}
      {group === 'stuckOrReconcile' && (
        <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{t('exceptions.stuckOrReconcile.heading')}</h2>
            <SyncTimestampBadge
              syncedAt={rptQuery.data?.syncedAt ?? null}
              onRefresh={() => void rptQuery.refetch()}
              isRefreshing={rptQuery.isFetching}
            />
          </div>

          {rptQuery.isError ? (
            <ServiceFallbackBanner
              message={t('exceptions.stuckOrReconcile.fallback')}
              onRetry={() => void rptQuery.refetch()}
              isRetrying={rptQuery.isFetching}
            />
          ) : rptQuery.isPending ? (
            <Skeleton className="h-28 w-full rounded-lg" />
          ) : (rptQuery.data?.data ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('exceptions.stuckOrReconcile.empty')}</p>
          ) : (
            <div className="space-y-2.5">
              {(rptQuery.data?.data ?? []).map((item) => (
                <article key={item.exceptionId} className="space-y-1.5 rounded-lg border border-border p-3.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{item.type}</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(item.createdAt)}</span>
                  </div>
                  <p>{item.summary}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    {item.entityType}: <CopyableId value={item.entityId} label={item.entityType} />
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
