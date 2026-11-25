import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowRight, CheckCircle2, Clock, CreditCard, Package, RefreshCw, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { ApiError } from '@/api/errors'
import { CopyableId, ServiceFallbackBanner, SlaCountdownPill } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { DisclosurePanel } from '@/components/ui/disclosure-panel'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { apiGetOrder, type BuyerOrderDetailView } from '@/features/cart-checkout-order/api'
import { CheckoutSteps } from '@/features/cart-checkout-order/components/CheckoutSteps'
import { formatDateTime, formatVnd } from '@/lib/format'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'
import { getPayment, httpUrl, retryOrderPayment } from './api'

const ORDER_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

function resultState(order: BuyerOrderDetailView, expired: boolean) {
  if (order.status === 'CANCELLED') {
    if (order.history?.some((entry) => entry.cause === 'LATE_PAYMENT_REJECTED')) return 'late'
    if (order.payment?.status === 'SUCCEEDED' && order.sellerOrders?.every((pkg) => pkg.cancelCause === 'PAYMENT_EXPIRED')) {
      return 'reconciling'
    }
    return 'cancelled'
  }
  if (order.status !== 'PENDING_PAYMENT') return 'paid'
  if (order.payment?.status === 'SUCCEEDED') return 'reconciling'
  if (expired) return 'expired'
  return order.payment?.status === 'FAILED' || order.payment?.status === 'EXPIRED' ? 'failed' : 'pending'
}

export function CheckoutResultPage() {
  const { t } = useTranslation('paymentShipping')
  const [params] = useSearchParams()
  const orderId = params.get('orderId') ?? ''
  const validOrder = ORDER_ID.test(orderId)
  const now = useNow()
  const query = useQuery({
    queryKey: ['checkout', 'result', orderId],
    queryFn: () => apiGetOrder(orderId),
    enabled: validOrder,
    staleTime: 0,
    retry: false,
    refetchInterval: ({ state }) => {
      if (state.dataUpdateCount + state.errorUpdateCount > 5) return false
      const order = state.data
      if (!order || order.status === 'PENDING_PAYMENT') return 2000
      if (order.status === 'CANCELLED' && !order.history?.some((entry) => entry.cause === 'LATE_PAYMENT_REJECTED')) {
        return 2000
      }
      return false
    },
  })
  const order = query.data
  const paymentId = order?.payment?.paymentId
  const paymentQuery = useQuery({
    queryKey: ['payments', 'detail', paymentId, order?.payment?.status, order?.updatedAt],
    queryFn: ({ signal }) => getPayment(paymentId!, signal),
    enabled: Boolean(paymentId),
    retry: false,
  })
  const mutation = useMutation({
    mutationFn: async (previousPaymentId: string) => {
      const payment = await retryOrderPayment(orderId, previousPaymentId)
      if (payment.status === 'SUCCEEDED') {
        await query.refetch()
        return
      }
      const target = payment.paymentUrl && httpUrl(payment.paymentUrl)
      if (!target) throw new Error(t('result.missingLink'))
      window.location.assign(target)
    },
    onError: () => void query.refetch(),
  })
  const ordersLink = <Button asChild variant="outline"><Link to="/account/orders">{t('result.orders')}</Link></Button>

  if (!validOrder || !order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
        <section className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold">{t('result.heading')}</h1>
          {validOrder && query.isPending ? (
            <div className="space-y-3" aria-busy="true" aria-label={t('result.loading')}>
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <ServiceFallbackBanner
              message={!validOrder ? t('result.invalidOrder') : query.error instanceof ApiError && [403, 404].includes(query.error.status) ? t('result.orderUnavailable') : t('result.loadError')}
              onRetry={validOrder ? () => void query.refetch() : undefined}
              isRetrying={query.isFetching}
            />
          )}
          {ordersLink}
        </section>
      </div>
    )
  }

  const expired = Date.parse(order.paymentDueAt) <= now
  const state = resultState(order, expired)
  const paid = state === 'paid'
  const needsReview = paymentQuery.data?.needsManualReview === true
  const canPay = (state === 'pending' || state === 'failed') && !order.paymentDegraded && !needsReview
  const Icon = paid ? CheckCircle2 : state === 'late' || state === 'cancelled' ? ShieldAlert : Clock

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6 sm:py-14">
      <CheckoutSteps currentStep={3} />
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className={cn('border-b border-border px-5 py-7 sm:px-8 sm:py-9', paid ? 'bg-status-success' : 'bg-muted/50')}>
          <div className={cn('mb-4 flex size-12 items-center justify-center rounded-2xl bg-card shadow-sm', paid ? 'text-status-success-foreground' : 'text-primary')}>
            <Icon aria-hidden="true" className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl" aria-live="polite">{t(`result.states.${state}.title`)}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t(`result.states.${state}.description`)}</p>
          {order.status === 'PENDING_PAYMENT' && (
            <SlaCountdownPill className="mt-4" deadline={order.paymentDueAt} startedAt={order.createdAt} label={t('result.deadline')} />
          )}
        </div>
        <div className="space-y-4 p-5 sm:p-8">
          {(query.isError || order.paymentDegraded || needsReview) && (
            <ServiceFallbackBanner
              message={needsReview ? t('result.review') : order.paymentDegraded ? t('result.paymentUnavailable') : t('result.loadError')}
              onRetry={() => { void query.refetch(); if (paymentId) void paymentQuery.refetch() }}
              isRetrying={query.isFetching}
            />
          )}
          {mutation.isError && <p role="alert" className="text-sm text-status-danger-foreground">{mutation.error.message}</p>}
          <div className="flex flex-wrap gap-2.5">
            {canPay && paymentId && (
              <Button variant="cta" onClick={() => mutation.mutate(paymentId)} disabled={mutation.isPending}>
                <CreditCard aria-hidden="true" />
                {mutation.isPending ? t('result.openingPayment') : state === 'failed' ? t('result.retryPayment') : t('result.resumePayment')}
              </Button>
            )}
            {!paid && (
              <Button variant="outline" onClick={() => { void query.refetch(); if (paymentId) void paymentQuery.refetch() }} disabled={query.isFetching}>
                <RefreshCw aria-hidden="true" className={query.isFetching ? 'motion-safe:animate-spin' : undefined} />{t('result.refresh')}
              </Button>
            )}
            <Button asChild variant={paid ? 'default' : 'outline'}>
              <Link to={`/account/orders/${order.orderId}`}>{t('result.detail')}<ArrowRight aria-hidden="true" /></Link>
            </Button>
          </div>
        </div>
      </section>
      <div className="grid items-start gap-5 md:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-semibold"><CreditCard aria-hidden="true" className="size-4 text-primary" />{t('result.summary')}</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><dt>{t('result.orderCode')}</dt><dd><CopyableId value={order.orderCode} label={t('result.orderCode')} /></dd></div>
            <div className="flex items-center justify-between gap-2"><dt>{t('result.state')}</dt><dd><StatusBadge status={order.status} /></dd></div>
            <div className="flex items-center justify-between gap-2 border-t border-border pt-3 font-semibold"><dt>{t('result.total')}</dt><dd className="text-lg text-price tabular-nums">{formatVnd(order.grandTotal)}</dd></div>
          </dl>
          {order.payment && (
            <DisclosurePanel title={t('result.transactionDetails')}>
              <dl className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt>{t('result.gateway')}</dt><dd className="font-medium">{order.payment.gateway}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt>{t('result.transactionState')}</dt><dd><StatusBadge status={order.payment.status} /></dd>
                </div>
                {order.payment.gatewayRef && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <dt>{t('result.reference')}</dt>
                    <dd><CopyableId value={order.payment.gatewayRef} label={t('result.reference')} /></dd>
                  </div>
                )}
                {paymentQuery.data?.completedAt && (
                  <div className="flex items-center justify-between gap-2">
                    <dt>{t('result.completedAt')}</dt><dd>{formatDateTime(paymentQuery.data.completedAt)}</dd>
                  </div>
                )}
              </dl>
            </DisclosurePanel>
          )}
        </section>
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-semibold"><Package aria-hidden="true" className="size-4 text-primary" />{t('result.packages', { count: order.sellerOrders?.length ?? 0 })}</h2>
          <ul className="mt-2 divide-y divide-border">
            {order.sellerOrders?.map((pkg) => (
              <li key={pkg.sellerOrderId} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div className="space-y-1"><p className="font-medium">{pkg.shopName || pkg.sellerOrderCode}</p>{pkg.shopName && <p className="font-mono text-xs text-muted-foreground">{pkg.sellerOrderCode}</p>}</div>
                <StatusBadge status={pkg.status} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
