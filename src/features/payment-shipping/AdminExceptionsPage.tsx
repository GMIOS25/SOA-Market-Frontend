import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Tabs } from 'radix-ui'
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Percent,
  RefreshCw,
  ShieldAlert,
  Store,
  Truck,
  Wallet,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { ApiError } from '@/api/errors'
import { CopyableId, ServiceFallbackBanner } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { hasRole } from '@/lib/auth/roles'
import { useAuthSession } from '@/lib/auth/session'
import { formatDateTime, formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  compactId,
  formatAdminFailureReason,
  listAdminFailedShipments,
  listAdminPayables,
  listAdminRefunds,
  listAdminReviewPayments,
  markRefundManualSuccess,
  type AdminRefund,
  type MarkManualSuccessPayload,
} from './admin-exceptions-api'
import { ManualRefundDialog } from './ManualRefundDialog'

const PAGE_SIZE = 10

type MainTab = 'exceptions' | 'payables'
type ExceptionCategory = 'refundFailed' | 'refundReconciliation' | 'paymentReview' | 'shipmentCreateFailed' | 'stuckOrders'
type PayableStatusFilter = 'ALL' | 'NOT_ELIGIBLE' | 'ON_HOLD' | 'ELIGIBLE'

const EXCEPTION_CATEGORIES: readonly ExceptionCategory[] = [
  'refundFailed',
  'refundReconciliation',
  'paymentReview',
  'shipmentCreateFailed',
  'stuckOrders',
]

function canConfirmRefund(refund: AdminRefund) {
  if (refund.status === 'FAILED') return refund.nextRetryAt == null
  return refund.needsReconciliation && (refund.status === 'REQUESTED' || refund.status === 'PROCESSING')
}

const PAYABLE_STATUS_FILTERS: readonly PayableStatusFilter[] = [
  'ALL',
  'NOT_ELIGIBLE',
  'ON_HOLD',
  'ELIGIBLE',
]

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

function TableSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
    </div>
  )
}

function MinimalPagination({
  page,
  totalPages,
  totalItems,
  isFetching,
  onPageChange,
  jumpInputId,
}: {
  page: number
  totalPages: number
  totalItems: number
  isFetching: boolean
  onPageChange: (nextPage: number) => void
  jumpInputId: string
}) {
  const { t } = useTranslation('adminExceptions')
  const [jumpValue, setJumpValue] = useState('')
  if (totalItems <= 0) return null
  const safeTotalPages = Math.max(1, totalPages)

  function handleJump(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = Number.parseInt(jumpValue, 10)
    if (Number.isFinite(target) && target >= 1) {
      onPageChange(Math.min(target, safeTotalPages))
      setJumpValue('')
    }
  }

  return (
    <nav
      aria-label={t('pagination.summary', { page, totalPages: safeTotalPages, total: formatNumber(totalItems) })}
      className="flex flex-col items-center justify-between gap-3 pt-2 text-sm sm:flex-row"
    >
      <span className="text-xs text-muted-foreground tabular-nums">
        {t('pagination.showingRange', {
          from: (page - 1) * PAGE_SIZE + 1,
          to: Math.min(page * PAGE_SIZE, totalItems),
          total: formatNumber(totalItems),
        })}
      </span>

      <div className="flex items-center gap-2">
        <div className="inline-flex items-center gap-1 tabular-nums">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={t('pagination.prev')}
            disabled={page <= 1 || isFetching}
            onClick={() => onPageChange(page - 1)}
            className="size-8 p-0"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          {buildPageNumbers(page, safeTotalPages).map((item, idx) =>
            item === 'ellipsis' ? (
              <span key={`ellipsis-${idx}`} aria-hidden="true" className="px-1.5 text-xs text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={item === page ? 'default' : 'ghost'}
                aria-current={item === page ? 'page' : undefined}
                disabled={isFetching}
                onClick={() => onPageChange(item)}
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
            disabled={page >= safeTotalPages || isFetching}
            onClick={() => onPageChange(page + 1)}
            className="size-8 p-0"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>

        <form onSubmit={handleJump} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <label htmlFor={jumpInputId}>{t('pagination.jumpToPage')}</label>
          <input
            id={jumpInputId}
            type="number"
            min={1}
            max={safeTotalPages}
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            placeholder={String(page)}
            className="h-8 w-14 rounded-md border border-input bg-card px-2 text-center text-xs text-foreground tabular-nums focus-visible:outline-2 focus-visible:outline-ring"
          />
        </form>
      </div>
    </nav>
  )
}

/**
 * Trang Quản trị Ngoại lệ, Hoàn tiền thủ công & Khoản phải trả (`/admin/exceptions`, T5-09).
 */
export function AdminExceptionsPage() {
  const { t } = useTranslation('adminExceptions')
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuthSession()
  const isAdmin = hasRole(user, 'ADMINISTRATOR')

  const mainTab: MainTab = isAdmin && searchParams.get('tab') === 'payables' ? 'payables' : 'exceptions'
  const rawCategory = searchParams.get('category') as ExceptionCategory | null
  const category: ExceptionCategory =
    rawCategory && EXCEPTION_CATEGORIES.includes(rawCategory) ? rawCategory : 'refundFailed'

  const [exceptionPage, setExceptionPage] = useState(1)
  const [payableStatus, setPayableStatus] = useState<PayableStatusFilter>('ALL')
  const [payableShopId, setPayableShopId] = useState('')
  const [payablePage, setPayablePage] = useState(1)
  const [selectedRefund, setSelectedRefund] = useState<AdminRefund | null>(null)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  const refundFailedQuery = useQuery({
    queryKey: ['admin', 'exceptions', 'refundFailed', category === 'refundFailed' ? exceptionPage : 1],
    queryFn: () =>
      listAdminRefunds({
        exhaustedOnly: 'true',
        page: category === 'refundFailed' ? exceptionPage : 1,
        pageSize: PAGE_SIZE,
      }),
    retry: false,
  })

  const refundReconQuery = useQuery({
    queryKey: ['admin', 'exceptions', 'refundReconciliation', category === 'refundReconciliation' ? exceptionPage : 1],
    queryFn: () =>
      listAdminRefunds({
        needsReconciliation: 'true',
        page: category === 'refundReconciliation' ? exceptionPage : 1,
        pageSize: PAGE_SIZE,
      }),
    retry: false,
  })

  const paymentReviewQuery = useQuery({
    queryKey: ['admin', 'exceptions', 'paymentReview', category === 'paymentReview' ? exceptionPage : 1],
    queryFn: () => listAdminReviewPayments(category === 'paymentReview' ? exceptionPage : 1, PAGE_SIZE),
    retry: false,
  })

  const shipmentFailedQuery = useQuery({
    queryKey: ['admin', 'exceptions', 'shipmentCreateFailed', category === 'shipmentCreateFailed' ? exceptionPage : 1],
    queryFn: () => listAdminFailedShipments(category === 'shipmentCreateFailed' ? exceptionPage : 1, PAGE_SIZE),
    retry: false,
  })

  const payablesQuery = useQuery({
    queryKey: ['admin', 'payables', { status: payableStatus, shopId: payableShopId, page: payablePage }],
    queryFn: () =>
      listAdminPayables({
        status: payableStatus === 'ALL' ? undefined : payableStatus,
        shopId: payableShopId || undefined,
        page: payablePage,
        pageSize: PAGE_SIZE,
      }),
    enabled: isAdmin && mainTab === 'payables',
    retry: false,
  })

  const manualMutation = useMutation({
    mutationFn: ({ refundId, payload }: { refundId: string; payload: MarkManualSuccessPayload }) =>
      markRefundManualSuccess(refundId, payload),
    onSuccess: (updated) => {
      setSuccessBanner(
        t('exceptions.manualSuccessBanner', {
          id: updated.refundId.slice(0, 8),
          ref: updated.manualBankRef ?? '',
        }),
      )
      void queryClient.invalidateQueries({ queryKey: ['admin', 'exceptions'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'payables'] })
    },
    onError: (error) => {
      if (error instanceof ApiError && (error.status === 404 || error.status === 409)) {
        void queryClient.invalidateQueries({ queryKey: ['admin', 'exceptions'] })
      }
    },
  })

  function setTab(nextTab: MainTab) {
    const next = new URLSearchParams(searchParams)
    if (nextTab === 'exceptions') next.delete('tab')
    else next.set('tab', nextTab)
    setSearchParams(next)
  }

  function setCategory(nextCategory: ExceptionCategory) {
    setExceptionPage(1)
    const next = new URLSearchParams(searchParams)
    next.delete('tab')
    if (nextCategory === 'refundFailed') next.delete('category')
    else next.set('category', nextCategory)
    setSearchParams(next)
  }

  function handleRefreshAll() {
    if (mainTab === 'payables') {
      void payablesQuery.refetch()
    } else {
      void refundFailedQuery.refetch()
      void refundReconQuery.refetch()
      void paymentReviewQuery.refetch()
      void shipmentFailedQuery.refetch()
    }
  }

  const isAnyFetching =
    mainTab === 'payables'
      ? payablesQuery.isFetching
      : refundFailedQuery.isFetching ||
        refundReconQuery.isFetching ||
        paymentReviewQuery.isFetching ||
        shipmentFailedQuery.isFetching

  const categoryCounts: Record<ExceptionCategory, number | undefined> = {
    refundFailed: refundFailedQuery.data?.pagination.totalItems,
    refundReconciliation: refundReconQuery.data?.pagination.totalItems,
    paymentReview: paymentReviewQuery.data?.pagination.totalItems,
    shipmentCreateFailed: shipmentFailedQuery.data?.pagination.totalItems,
    stuckOrders: undefined,
  }

  const activeRefundQuery = category === 'refundFailed' ? refundFailedQuery : refundReconQuery
  const payablesSummary = payablesQuery.data?.summary
  const ledgerEntries = payablesQuery.data?.data ?? []
  const exceptionPagination = {
    refundFailed: refundFailedQuery.data?.pagination,
    refundReconciliation: refundReconQuery.data?.pagination,
    paymentReview: paymentReviewQuery.data?.pagination,
    shipmentCreateFailed: shipmentFailedQuery.data?.pagination,
    stuckOrders: undefined,
  }[category]
  const lastExceptionPage = Math.max(1, exceptionPagination?.totalPages ?? 1)
  const lastPayablePage = Math.max(1, payablesQuery.data?.pagination.totalPages ?? 1)
  const exceptionPageUnavailable = exceptionPagination !== undefined && exceptionPage > lastExceptionPage
  const payablePageUnavailable = payablesQuery.data !== undefined && payablePage > lastPayablePage

  return (
    <Tabs.Root
      className="space-y-6"
      value={mainTab}
      onValueChange={(tab) => setTab(tab === 'payables' ? 'payables' : 'exceptions')}
    >
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={isAnyFetching} onClick={handleRefreshAll}>
          <RefreshCw aria-hidden="true" className={isAnyFetching ? 'animate-spin' : undefined} />
          {isAnyFetching ? t('refreshing') : t('refresh')}
        </Button>
      </header>

      <Tabs.List
        aria-label={t('tabs.ariaLabel')}
        className="inline-flex flex-wrap rounded-lg border border-border bg-muted/50 p-1"
      >
        <Tabs.Trigger
          value="exceptions"
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-sm font-medium transition-colors',
            mainTab === 'exceptions'
              ? 'bg-card text-primary shadow-xs'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <ShieldAlert aria-hidden="true" className="size-4" />
          {t('tabs.exceptions')}
        </Tabs.Trigger>
        {isAdmin && (
          <Tabs.Trigger
            value="payables"
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-sm font-medium transition-colors',
              mainTab === 'payables'
                ? 'bg-card text-primary shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Wallet aria-hidden="true" className="size-4" />
            {t('tabs.payables')}
          </Tabs.Trigger>
        )}
      </Tabs.List>

      {successBanner && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-status-success-border bg-status-success px-4 py-3 text-sm font-medium text-status-success-foreground"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
            {successBanner}
          </span>
          <button
            type="button"
            aria-label={t('manualDialog.cancel')}
            onClick={() => setSuccessBanner(null)}
            className="rounded p-1 hover:bg-card/50"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      )}

      {mainTab === 'exceptions' ? (
        <Tabs.Content value="exceptions" className="space-y-4">
          <div
            role="group"
            aria-label={t('exceptions.groupLabel')}
            className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5"
          >
            {EXCEPTION_CATEGORIES.map((item) => {
              const active = category === item
              const count = categoryCounts[item]
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(item)}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-left text-sm font-medium transition-colors',
                    active
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border bg-card text-foreground hover:bg-muted/50',
                  )}
                >
                  <span className="truncate">{t(`exceptions.categories.${item}`)}</span>
                  {count !== undefined && (
                    <span
                      className={cn(
                        'inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
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

          <p className="rounded-lg bg-primary-soft px-4 py-2.5 text-xs text-muted-foreground">
            {t(`exceptions.descriptions.${category}`)}
          </p>

          {exceptionPageUnavailable && (
            <Button variant="outline" onClick={() => setExceptionPage(lastExceptionPage)}>
              {t('pagination.returnToAvailablePage')}
            </Button>
          )}

          {!exceptionPageUnavailable && (category === 'refundFailed' || category === 'refundReconciliation') && (
            <>
              {activeRefundQuery.isLoading ? (
                <TableSkeleton />
              ) : activeRefundQuery.isError ? (
                <ServiceFallbackBanner
                  message={
                    activeRefundQuery.error instanceof ApiError
                      ? activeRefundQuery.error.message
                      : t('exceptions.loadError')
                  }
                  onRetry={() => void activeRefundQuery.refetch()}
                  isRetrying={activeRefundQuery.isFetching}
                />
              ) : (activeRefundQuery.data?.data.length ?? 0) === 0 ? (
                <EmptyState title={t('exceptions.emptyTitle')} description={t('exceptions.emptyDescription')} />
              ) : (
                <>
                  <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-xs">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase">
                        <tr>
                          <th className="px-3.5 py-3 whitespace-nowrap">{t('exceptions.columns.refundId')}</th>
                          <th className="px-3.5 py-3 whitespace-nowrap">{t('exceptions.columns.orderAndPackage')}</th>
                          <th className="px-3.5 py-3 whitespace-nowrap">{t('exceptions.columns.source')}</th>
                          <th className="px-3.5 py-3 text-right whitespace-nowrap">{t('exceptions.columns.amount')}</th>
                          <th className="min-w-64 px-4 py-3">{t('exceptions.columns.attemptsAndError')}</th>
                          <th className="px-3.5 py-3 whitespace-nowrap">{t('exceptions.columns.status')}</th>
                          <th className="px-3.5 py-3 text-right whitespace-nowrap">{t('exceptions.columns.action')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {activeRefundQuery.data!.data.map((refund) => (
                          <tr key={refund.refundId} className="align-middle hover:bg-muted/30">
                            <td className="px-3.5 py-3.5 whitespace-nowrap">
                              <CopyableId
                                value={refund.refundId}
                                display={compactId(refund.refundId)}
                                label={t('exceptions.columns.refundId')}
                              />
                              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                                {formatDateTime(refund.createdAt)}
                              </p>
                            </td>
                            <td className="space-y-1 px-3.5 py-3.5 text-xs whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="w-7 text-muted-foreground">{t('exceptions.columns.orderPrefix')}</span>
                                <CopyableId
                                  value={refund.orderId}
                                  display={compactId(refund.orderId)}
                                  label={t('manualDialog.orderId')}
                                />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-7 text-muted-foreground">{t('exceptions.columns.packagePrefix')}</span>
                                <CopyableId
                                  value={refund.sellerOrderId}
                                  display={compactId(refund.sellerOrderId)}
                                  label={t('exceptions.columns.orderAndPackage')}
                                />
                              </div>
                            </td>
                            <td className="px-3.5 py-3.5 text-xs font-medium whitespace-nowrap">
                              {t(`exceptions.sources.${refund.source}` as never, { defaultValue: refund.source })}
                            </td>
                            <td className="px-3.5 py-3.5 text-right font-semibold whitespace-nowrap text-price tabular-nums">
                              {formatVnd(refund.amount)}
                            </td>
                            <td className="min-w-64 max-w-md px-4 py-3.5">
                              <div className="space-y-1.5">
                                <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-foreground tabular-nums">
                                  {t('exceptions.attemptsLabel', { count: refund.attempts })}
                                </span>
                                {(refund.lastErrorMessage || refund.lastErrorCode) && (
                                  <p className="rounded-md border border-status-danger-border/60 bg-status-danger/60 px-2.5 py-1.5 text-xs leading-relaxed font-medium break-words text-status-danger-foreground sm:text-sm">
                                    {refund.lastErrorMessage || refund.lastErrorCode}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="px-3.5 py-3.5 whitespace-nowrap">
                              <div className="flex flex-col items-start gap-1.5">
                                <StatusBadge
                                  status={refund.status}
                                  label={t(`exceptions.refundStatuses.${refund.status}` as never, {
                                    defaultValue: refund.status,
                                  })}
                                />
                                {refund.needsReconciliation && (
                                  <StatusBadge
                                    status="ON_HOLD"
                                    tone="warning"
                                    label={t('exceptions.reconciliationBadge')}
                                  />
                                )}
                              </div>
                            </td>
                            <td className="px-3.5 py-3.5 text-right whitespace-nowrap">
                              {isAdmin && canConfirmRefund(refund) ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="cta"
                                  onClick={() => setSelectedRefund(refund)}
                                >
                                  {t('exceptions.manualConfirmAction')}
                                </Button>
                              ) : refund.manualBankRef ? (
                                <span className="text-xs font-medium text-status-success-foreground">
                                  {t('exceptions.manualConfirmedTag', { ref: refund.manualBankRef })}
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <MinimalPagination
                    page={exceptionPage}
                    totalPages={activeRefundQuery.data!.pagination.totalPages}
                    totalItems={activeRefundQuery.data!.pagination.totalItems}
                    isFetching={activeRefundQuery.isFetching}
                    onPageChange={setExceptionPage}
                    jumpInputId="admin-refund-jump"
                  />
                </>
              )}
            </>
          )}

          {!exceptionPageUnavailable && category === 'paymentReview' && (
            <>
              {paymentReviewQuery.isLoading ? (
                <TableSkeleton />
              ) : paymentReviewQuery.isError ? (
                <ServiceFallbackBanner
                  message={
                    paymentReviewQuery.error instanceof ApiError
                      ? paymentReviewQuery.error.message
                      : t('exceptions.loadError')
                  }
                  onRetry={() => void paymentReviewQuery.refetch()}
                  isRetrying={paymentReviewQuery.isFetching}
                />
              ) : (paymentReviewQuery.data?.data.length ?? 0) === 0 ? (
                <EmptyState title={t('exceptions.emptyTitle')} description={t('exceptions.emptyDescription')} />
              ) : (
                <>
                  <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-xs">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase">
                        <tr>
                          <th className="px-4 py-3">{t('exceptions.columns.paymentId')}</th>
                          <th className="px-4 py-3">{t('manualDialog.orderId')}</th>
                          <th className="px-4 py-3">{t('exceptions.columns.gateway')}</th>
                          <th className="px-4 py-3 text-right">{t('exceptions.columns.amount')}</th>
                          <th className="px-4 py-3">{t('exceptions.columns.status')}</th>
                          <th className="px-4 py-3">{t('exceptions.columns.createdAt')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {paymentReviewQuery.data!.data.map((payment) => (
                          <tr key={payment.paymentId} className="align-middle hover:bg-muted/30">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <CopyableId
                                value={payment.paymentId}
                                display={compactId(payment.paymentId)}
                                label={t('exceptions.columns.paymentId')}
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <CopyableId
                                value={payment.orderId}
                                display={compactId(payment.orderId)}
                                label={t('manualDialog.orderId')}
                              />
                            </td>
                            <td className="space-y-1 px-4 py-3 text-xs whitespace-nowrap">
                              <p className="flex items-center gap-1 font-medium text-foreground">
                                <CreditCard aria-hidden="true" className="size-3.5 text-muted-foreground" />
                                {payment.gateway}
                              </p>
                              <CopyableId
                                value={payment.gatewayRef}
                                display={compactId(payment.gatewayRef)}
                                label={t('exceptions.columns.gateway')}
                              />
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-price tabular-nums">
                              {formatVnd(payment.amount)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col items-start gap-1">
                                <StatusBadge status={payment.status} />
                                {payment.needsManualReview && (
                                  <StatusBadge
                                    status="ON_HOLD"
                                    tone="warning"
                                    label={t('exceptions.reconciliationBadge')}
                                  />
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                              {formatDateTime(payment.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <MinimalPagination
                    page={exceptionPage}
                    totalPages={paymentReviewQuery.data!.pagination.totalPages}
                    totalItems={paymentReviewQuery.data!.pagination.totalItems}
                    isFetching={paymentReviewQuery.isFetching}
                    onPageChange={setExceptionPage}
                    jumpInputId="admin-payment-jump"
                  />
                </>
              )}
            </>
          )}

          {!exceptionPageUnavailable && category === 'shipmentCreateFailed' && (
            <>
              {shipmentFailedQuery.isLoading ? (
                <TableSkeleton />
              ) : shipmentFailedQuery.isError ? (
                <ServiceFallbackBanner
                  message={t('exceptions.shipmentDegraded')}
                  onRetry={() => void shipmentFailedQuery.refetch()}
                  isRetrying={shipmentFailedQuery.isFetching}
                />
              ) : (shipmentFailedQuery.data?.shipments?.length ?? 0) === 0 ? (
                <EmptyState title={t('exceptions.emptyTitle')} description={t('exceptions.emptyDescription')} />
              ) : (
                <>
                  <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-xs">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase">
                        <tr>
                          <th className="px-4 py-3">{t('exceptions.columns.shipmentId')}</th>
                          <th className="px-4 py-3">{t('exceptions.columns.orderAndPackage')}</th>
                          <th className="px-4 py-3">{t('exceptions.columns.shopId')}</th>
                          <th className="px-4 py-3">{t('exceptions.columns.carrier')}</th>
                          <th className="px-4 py-3">{t('exceptions.columns.failureReason')}</th>
                          <th className="px-4 py-3">{t('exceptions.columns.status')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(shipmentFailedQuery.data?.shipments ?? []).map((shipment) => (
                          <tr key={shipment.shipmentId} className="align-middle hover:bg-muted/30">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <CopyableId
                                value={shipment.shipmentId}
                                display={compactId(shipment.shipmentId)}
                                label={t('exceptions.columns.shipmentId')}
                              />
                              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                                {formatDateTime(shipment.updatedAt)}
                              </p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <CopyableId
                                value={shipment.sellerOrderId}
                                display={compactId(shipment.sellerOrderId)}
                                label={t('exceptions.columns.orderAndPackage')}
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <CopyableId
                                value={shipment.shopId}
                                display={compactId(shipment.shopId)}
                                label={t('exceptions.columns.shopId')}
                              />
                            </td>
                            <td className="px-4 py-3 text-xs font-medium whitespace-nowrap">
                              <span className="inline-flex items-center gap-1">
                                <Truck aria-hidden="true" className="size-3.5 text-muted-foreground" />
                                {shipment.carrier}
                              </span>
                            </td>
                            <td className="min-w-64 max-w-md px-4 py-3">
                              <div className="space-y-1.5">
                                <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-foreground tabular-nums">
                                  {t('exceptions.attemptsLabel', { count: shipment.createAttempts })}
                                </span>
                                <p className="rounded-md border border-status-danger-border/60 bg-status-danger/60 px-2.5 py-1.5 text-xs leading-relaxed font-medium text-status-danger-foreground sm:text-sm">
                                  {formatAdminFailureReason(shipment.failureReason) ??
                                    t('exceptions.failureReasons.generic')}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={shipment.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <MinimalPagination
                    page={exceptionPage}
                    totalPages={shipmentFailedQuery.data!.pagination.totalPages}
                    totalItems={shipmentFailedQuery.data!.pagination.totalItems}
                    isFetching={shipmentFailedQuery.isFetching}
                    onPageChange={setExceptionPage}
                    jumpInputId="admin-shipment-jump"
                  />
                </>
              )}
            </>
          )}
        </Tabs.Content>
      ) : (
        <Tabs.Content value="payables" className="space-y-5">
          {payablePageUnavailable && (
            <Button variant="outline" onClick={() => setPayablePage(lastPayablePage)}>
              {t('pagination.returnToAvailablePage')}
            </Button>
          )}
          {payablesQuery.isLoading ? (
            <TableSkeleton />
          ) : payablesQuery.isError ? (
            <ServiceFallbackBanner
              message={
                payablesQuery.error instanceof ApiError ? payablesQuery.error.message : t('payables.loadError')
              }
              onRetry={() => void payablesQuery.refetch()}
              isRetrying={payablesQuery.isFetching}
            />
          ) : (
            <>
              {payablesSummary && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <KpiCard
                    icon={<Banknote className="size-4 text-primary" />}
                    label={t('payables.kpi.gross')}
                    value={formatVnd(payablesSummary.totalGrossAmount)}
                  />
                  <KpiCard
                    icon={<Percent className="size-4 text-primary" />}
                    label={t('payables.kpi.platformFee')}
                    value={formatVnd(payablesSummary.totalPlatformFee)}
                  />
                  <KpiCard
                    icon={<CheckCircle2 className="size-4 text-status-success-foreground" />}
                    label={t('payables.kpi.eligible')}
                    value={formatVnd(payablesSummary.eligibleNetPayable)}
                    highlight
                  />
                  <KpiCard
                    icon={<Clock className="size-4 text-status-warning-foreground" />}
                    label={t('payables.kpi.onHold')}
                    value={formatVnd(payablesSummary.onHoldNetAmount)}
                  />
                </div>
              )}

              {payablesSummary && payablesSummary.shopTotals.length > 0 && (
                <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-sm font-semibold">
                      <Store aria-hidden="true" className="size-4 text-primary" />
                      {t('payables.shopSummaryTitle')}
                    </h2>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t('payables.shopSummaryCount', { count: payablesSummary.shopTotals.length })}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
                    {payablesSummary.shopTotals.map((shop) => {
                      const active = payableShopId === shop.shopId
                      return (
                        <button
                          key={shop.shopId}
                          type="button"
                          onClick={() => {
                            setPayableShopId(active ? '' : shop.shopId)
                            setPayablePage(1)
                          }}
                          title={t('payables.filterByShop')}
                          className={cn(
                            'space-y-2 rounded-lg border p-3 text-left transition-colors tabular-nums',
                            active
                              ? 'border-primary bg-primary-soft'
                              : 'border-border bg-background/60 hover:border-primary/40 hover:bg-primary-soft/40',
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-mono text-xs font-semibold text-foreground">
                              #{shop.shopId.slice(0, 8)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {t('payables.entriesCount', { count: shop.entriesCount })}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between gap-2 text-xs">
                            <span className="text-muted-foreground">{t('payables.kpi.eligible')}</span>
                            <strong className="text-sm font-bold text-price">
                              {formatVnd(shop.eligibleNetPayable)}
                            </strong>
                          </div>
                          <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                            <span>{t('payables.kpi.onHold')}</span>
                            <span>{formatVnd(shop.onHoldNetAmount)}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div
                  role="group"
                  aria-label={t('payables.statusFilterLabel')}
                  className="flex flex-wrap items-center gap-1.5"
                >
                  {PAYABLE_STATUS_FILTERS.map((st) => {
                    const active = payableStatus === st
                    return (
                      <button
                        key={st}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setPayableStatus(st)
                          setPayablePage(1)
                        }}
                        className={cn(
                          'inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors',
                          active
                            ? 'border-primary bg-primary-soft text-primary'
                            : 'border-border bg-card text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {t(`payables.statuses.${st}`)}
                      </button>
                    )
                  })}
                </div>

                {payableShopId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPayableShopId('')
                      setPayablePage(1)
                    }}
                  >
                    <X aria-hidden="true" />
                    {t('payables.clearShopFilter', { shopId: `#${payableShopId.slice(0, 8)}` })}
                  </Button>
                )}
              </div>

              {payablePageUnavailable ? null : ledgerEntries.length === 0 ? (
                <EmptyState title={t('payables.emptyTitle')} description={t('payables.emptyDescription')} />
              ) : (
                <>
                  <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-xs">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase">
                        <tr>
                          <th className="px-4 py-3">{t('payables.columns.sellerOrder')}</th>
                          <th className="px-4 py-3">{t('payables.columns.shop')}</th>
                          <th className="px-4 py-3 text-right">{t('payables.columns.gross')}</th>
                          <th className="px-4 py-3 text-right">{t('payables.columns.platformFee')}</th>
                          <th className="px-4 py-3 text-right">{t('payables.columns.refunded')}</th>
                          <th className="px-4 py-3 text-right">{t('payables.columns.netAmount')}</th>
                          <th className="px-4 py-3">{t('payables.columns.status')}</th>
                          <th className="px-4 py-3">{t('payables.columns.updatedAt')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border tabular-nums">
                        {ledgerEntries.map((entry) => (
                          <tr key={entry.entryId} className="align-middle hover:bg-muted/30">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <CopyableId
                                value={entry.sellerOrderId}
                                display={compactId(entry.sellerOrderId)}
                                label={t('payables.columns.sellerOrder')}
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <CopyableId
                                value={entry.shopId}
                                display={compactId(entry.shopId)}
                                label={t('payables.columns.shop')}
                              />
                            </td>
                            <td className="px-4 py-3 text-right">{formatVnd(entry.grossAmount)}</td>
                            <td className="px-4 py-3 text-right text-muted-foreground">
                              − {formatVnd(entry.platformFee)}
                            </td>
                            <td className="px-4 py-3 text-right text-status-danger-foreground">
                              {entry.refundedAmount > 0 ? `− ${formatVnd(entry.refundedAmount)}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-foreground">
                              {formatVnd(entry.netAmount)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col items-start gap-1">
                                <StatusBadge
                                  status={entry.status}
                                  label={t(`payables.statuses.${entry.status}` as never, {
                                    defaultValue: entry.status,
                                  })}
                                />
                                {entry.openComplaintsCount > 0 && (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-status-warning-foreground">
                                    <AlertTriangle aria-hidden="true" className="size-3" />
                                    {t('payables.openComplaints', { count: entry.openComplaintsCount })}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              <p>{formatDateTime(entry.updatedAt)}</p>
                              {entry.eligibleAt && (
                                <p className="mt-0.5 text-[11px]">
                                  {t('payables.eligibleAt', { datetime: formatDateTime(entry.eligibleAt) })}
                                </p>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <MinimalPagination
                    page={payablePage}
                    totalPages={payablesQuery.data!.pagination.totalPages}
                    totalItems={payablesQuery.data!.pagination.totalItems}
                    isFetching={payablesQuery.isFetching}
                    onPageChange={setPayablePage}
                    jumpInputId="admin-payables-jump"
                  />
                </>
              )}
            </>
          )}
        </Tabs.Content>
      )}

      {isAdmin && selectedRefund && (
        <ManualRefundDialog
          key={selectedRefund.refundId}
          refund={selectedRefund}
          submitting={manualMutation.isPending}
          onOpenChange={(next) => {
            if (!next) setSelectedRefund(null)
          }}
          onSubmit={async (refundId, payload) => {
            await manualMutation.mutateAsync({ refundId, payload })
          }}
        />
      )}
    </Tabs.Root>
  )
}

function KpiCard({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'space-y-1.5 rounded-lg border p-4 tabular-nums',
        highlight ? 'border-primary/40 bg-primary-soft' : 'border-border bg-card',
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className={cn('text-xl font-bold', highlight ? 'text-price' : 'text-foreground')}>{value}</p>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <section className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-6 py-12 text-center shadow-xs">
      <CheckCircle2 aria-hidden="true" className="size-8 text-status-success-foreground" />
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
    </section>
  )
}
