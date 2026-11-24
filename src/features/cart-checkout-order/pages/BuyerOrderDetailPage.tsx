import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  History,
  Info,
  MapPin,
  MessageSquareWarning,
  PackageX,
  RefreshCw,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ApiError } from '@/api/errors'
import {
  CopyableId,
  PartialRefundBreakdown,
  ServiceFallbackBanner,
  ShopPackageCard,
  ShopPackageItem,
  ShopPackageSummary,
  SlaCountdownPill,
} from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDateTime, formatDateTimeFull, formatVnd } from '@/lib/format'
import {
  apiBuyerCancelSellerOrder,
  apiConfirmSellerOrderReceipt,
  apiGetOrder,
  apiGetPublicShop,
  fallbackShopName,
  type BuyerSellerOrderDetailView,
} from '../api'
import { CancelSellerOrderDialog } from '../components/CancelSellerOrderDialog'
import { ConfirmReceiptDialog } from '../components/ConfirmReceiptDialog'
import { OrderActionErrorAlert } from '../components/OrderActionErrorAlert'
import {
  ShipmentTrackingPanel,
  type ExternalTimelineRenderProps,
} from '../components/ShipmentTrackingPanel'
import {
  canBuyerCancelPackage,
  canBuyerConfirmReceipt,
  mapPartialRefundLines,
} from '../order-helpers'

export type BuyerOrderDetailPageProps = {
  /** Hook ghép `<ShipmentTrackingTimeline />` của T5-08 khi sẵn sàng. */
  renderExternalTimeline?: (props: ExternalTimelineRenderProps) => ReactNode
}

function OrderDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <Skeleton className="h-56 w-full rounded-lg" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
        <div className="space-y-4 lg:col-span-4">
          <Skeleton className="h-36 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

function formatCancelCause(
  cause: string | undefined,
  labels: Record<'BUYER_CANCELLED' | 'SELLER_REJECTED' | 'SELLER_TIMEOUT' | 'SELLER_CANCELLED' | 'PAYMENT_EXPIRED', string>,
): string | undefined {
  if (!cause) return undefined
  if (Object.hasOwn(labels, cause)) {
    return labels[cause as keyof typeof labels]
  }
  return cause
}

/**
 * Trang chi tiết đơn hàng của Buyer (`/account/orders/:id`, FR-ORD-007, FR-ORD-009, FR-ORD-010, NFR-REL-005).
 */
export function BuyerOrderDetailPage({ renderExternalTimeline }: BuyerOrderDetailPageProps) {
  const { t } = useTranslation('orders')
  const { id } = useParams()
  const queryClient = useQueryClient()

  const [cancellingPackage, setCancellingPackage] = useState<BuyerSellerOrderDetailView | null>(null)
  const [confirmingPackage, setConfirmingPackage] = useState<BuyerSellerOrderDetailView | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const orderQuery = useQuery({
    queryKey: ['order', 'buyer', id],
    queryFn: () => apiGetOrder(id!),
    enabled: Boolean(id),
    retry: false,
  })

  const order = orderQuery.data
  const sellerOrders = useMemo(() => order?.sellerOrders ?? [], [order])

  const missingShopIds = useMemo(
    () =>
      Array.from(
        new Set(
          sellerOrders
            .filter((so) => !so.shopName)
            .map((so) => so.shopId),
        ),
      ),
    [sellerOrders],
  )

  const shopQueries = useQueries({
    queries: missingShopIds.map((shopId) => ({
      queryKey: ['shop', 'public', shopId],
      queryFn: () => apiGetPublicShop(shopId),
      retry: false,
      staleTime: 5 * 60_000,
    })),
  })

  const shopNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const so of sellerOrders) {
      if (so.shopName) map.set(so.shopId, so.shopName)
    }
    missingShopIds.forEach((shopId, idx) => {
      if (!map.has(shopId)) {
        const fetchedName = shopQueries[idx]?.data?.name
        map.set(shopId, fetchedName || fallbackShopName(shopId))
      }
    })
    return map
  }, [sellerOrders, missingShopIds, shopQueries])

  function resolveShopName(so: BuyerSellerOrderDetailView): string {
    return so.shopName || shopNameMap.get(so.shopId) || fallbackShopName(so.shopId)
  }

  const cancelMutation = useMutation({
    mutationFn: ({ sellerOrderId, reason }: { sellerOrderId: string; reason: string }) =>
      apiBuyerCancelSellerOrder(sellerOrderId, reason ? { reason } : {}),
    onSuccess: (result) => {
      setActionSuccess(t('detail.actions.cancelSuccess', { code: result.sellerOrderCode }))
      void queryClient.invalidateQueries({ queryKey: ['order', 'buyer', id] })
      void queryClient.invalidateQueries({ queryKey: ['orders', 'buyer'] })
    },
  })

  const receiptMutation = useMutation({
    mutationFn: (sellerOrderId: string) => apiConfirmSellerOrderReceipt(sellerOrderId),
    onSuccess: (result) => {
      setActionSuccess(t('detail.actions.receiptSuccess', { code: result.sellerOrderCode }))
      void queryClient.invalidateQueries({ queryKey: ['order', 'buyer', id] })
      void queryClient.invalidateQueries({ queryKey: ['orders', 'buyer'] })
    },
  })

  const refundBreakdown = useMemo(
    () => mapPartialRefundLines(order?.partialRefundBreakdown, sellerOrders, shopNameMap),
    [order?.partialRefundBreakdown, sellerOrders, shopNameMap],
  )

  if (orderQuery.isLoading) {
    return <OrderDetailSkeleton />
  }

  if (orderQuery.isError) {
    const apiErr = orderQuery.error instanceof ApiError ? orderQuery.error : null
    if (apiErr?.status === 404 || apiErr?.status === 403) {
      return (
        <section className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-12 text-center shadow-xs">
          <PackageX aria-hidden="true" className="size-10 text-muted-foreground" />
          <h1 className="text-xl font-bold">{t('detail.notFoundTitle')}</h1>
          <p className="max-w-md text-sm text-muted-foreground">{t('detail.notFoundDescription')}</p>
          <Button asChild variant="outline" className="mt-1">
            <Link to="/account/orders">{t('detail.backToList')}</Link>
          </Button>
        </section>
      )
    }

    if (apiErr?.isServiceUnavailable) {
      return (
        <div className="space-y-4">
          <Link
            to="/account/orders"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            <span>{t('detail.backToList')}</span>
          </Link>
          <ServiceFallbackBanner
            message={apiErr.message || t('detail.loadError')}
            onRetry={() => void orderQuery.refetch()}
            isRetrying={orderQuery.isFetching}
          />
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <Link
          to="/account/orders"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          <span>{t('detail.backToList')}</span>
        </Link>
        <OrderActionErrorAlert
          error={orderQuery.error instanceof Error ? orderQuery.error : new Error(t('detail.loadError'))}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => void orderQuery.refetch()}>
          <RefreshCw aria-hidden="true" />
          {t('detail.refresh')}
        </Button>
      </div>
    )
  }

  if (!order) return null

  const isPaidOrder = order.status === 'PAID' || order.status === 'COMPLETED' || refundBreakdown.paidTotal > 0
  const historyList = order.history ?? []

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <Link
            to="/account/orders"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            <span>{t('detail.backToList')}</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">{t('detail.title')}</h1>
            <CopyableId
              value={order.orderCode}
              display={order.orderCode}
              label={t('detail.orderCodeLabel')}
              className="rounded border border-border bg-card px-2 py-0.5 text-sm font-semibold text-foreground"
            />
            <StatusBadge status={order.status} />
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {t('detail.createdAt', { datetime: formatDateTime(order.createdAt) })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {order.status === 'PENDING_PAYMENT' && order.paymentDueAt && (
            <SlaCountdownPill
              label={t('detail.paymentCountdownLabel')}
              startedAt={order.createdAt}
              deadline={order.paymentDueAt}
            />
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={orderQuery.isFetching}
            onClick={() => void orderQuery.refetch()}
          >
            <RefreshCw aria-hidden="true" className={orderQuery.isFetching ? 'animate-spin' : undefined} />
            {orderQuery.isFetching ? t('detail.refreshing') : t('detail.refresh')}
          </Button>
        </div>
      </header>

      {actionSuccess && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-status-success-border bg-status-success px-4 py-3 text-sm font-medium text-status-success-foreground"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
            {actionSuccess}
          </span>
          <button
            type="button"
            aria-label={t('cancelDialog.cancel')}
            onClick={() => setActionSuccess(null)}
            className="rounded p-1 hover:bg-card/50"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      )}

      {/* Bảng đối chiếu hoàn tiền một phần — tự ẩn khi refunds = [] (FR-ORD-009) */}
      <PartialRefundBreakdown paidTotal={refundBreakdown.paidTotal} refunds={refundBreakdown.refunds} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <div className="space-y-4 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {t('detail.packagesHeading', { count: sellerOrders.length })}
            </h2>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
              <span>{t('detail.snapshotNotice')}</span>
            </p>
          </div>

          {sellerOrders.map((so) => {
            const shopName = resolveShopName(so)
            const items = so.items ?? []
            const canCancel = canBuyerCancelPackage(so)
            const canReceipt = canBuyerConfirmReceipt(so)
            const cancelCauseText = formatCancelCause(so.cancelCause, {
              BUYER_CANCELLED: t('detail.cancelCauses.BUYER_CANCELLED'),
              SELLER_REJECTED: t('detail.cancelCauses.SELLER_REJECTED'),
              SELLER_TIMEOUT: t('detail.cancelCauses.SELLER_TIMEOUT'),
              SELLER_CANCELLED: t('detail.cancelCauses.SELLER_CANCELLED'),
              PAYMENT_EXPIRED: t('detail.cancelCauses.PAYMENT_EXPIRED'),
            })
            const isShippingLocked = so.status === 'CONFIRMED' || so.status === 'SHIPPING'

            const slaNode =
              so.status === 'DELIVERED' && so.completeDueAt && !so.hasOpenComplaint ? (
                <SlaCountdownPill
                  label={t('detail.completeCountdownLabel')}
                  startedAt={so.deliveredAt ?? so.updatedAt}
                  deadline={so.completeDueAt}
                />
              ) : so.status === 'DELIVERED' && so.hasOpenComplaint ? (
                <StatusBadge status="ON_HOLD" tone="warning" />
              ) : so.status === 'AWAITING_CONFIRMATION' && so.confirmDueAt ? (
                <SlaCountdownPill
                  label={t('detail.confirmCountdownLabel')}
                  startedAt={so.createdAt}
                  deadline={so.confirmDueAt}
                />
              ) : undefined

            return (
              <ShopPackageCard
                key={so.sellerOrderId}
                shop={{ id: so.shopId, name: shopName }}
                status={so.status}
                code={{ value: so.sellerOrderCode, display: so.sellerOrderCode }}
                sla={slaNode}
                notice={
                  <div className="space-y-3">
                    {so.status === 'DELIVERED' && so.hasOpenComplaint && (
                      <div
                        role="status"
                        className="flex items-start gap-2 rounded-md border border-status-warning-border bg-status-warning px-3 py-2 text-xs text-status-warning-foreground"
                      >
                        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                        <span>{t('detail.openComplaintHoldNotice')}</span>
                      </div>
                    )}

                    {so.status === 'DELIVERED' && !so.hasOpenComplaint && so.completeDueAt && (
                      <div
                        role="status"
                        className="flex items-start gap-2 rounded-md border border-status-info-border bg-status-info px-3 py-2 text-xs text-status-info-foreground"
                      >
                        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                        <span>
                          {t('detail.autoCompleteBanner', {
                            deadline: formatDateTime(so.completeDueAt),
                          })}
                        </span>
                      </div>
                    )}

                    {(so.status === 'CANCELLED' || so.status === 'DELIVERY_FAILED') &&
                      (cancelCauseText || so.cancelReason) && (
                        <div className="space-y-0.5 rounded-md border border-status-danger-border bg-status-danger px-3 py-2 text-xs text-status-danger-foreground">
                          {cancelCauseText && (
                            <p className="font-medium">
                              {t('detail.cancelCauseLabel')}: {cancelCauseText}
                            </p>
                          )}
                          {so.cancelReason && (
                            <p>
                              {t('detail.cancelReasonLabel')}: {so.cancelReason}
                            </p>
                          )}
                        </div>
                      )}

                    {isShippingLocked && (
                      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                        <span>{t('detail.actions.cannotCancelHint')}</span>
                      </p>
                    )}

                    <ShipmentTrackingPanel
                      sellerOrderId={so.sellerOrderId}
                      sellerOrderStatus={so.status}
                      carrier={so.carrier || undefined}
                      trackingCode={so.trackingCode || undefined}
                      shippingDegraded={order.shippingDegraded}
                      onRetryOrder={() => void orderQuery.refetch()}
                      isOrderFetching={orderQuery.isFetching}
                      renderExternalTimeline={renderExternalTimeline}
                    />
                  </div>
                }
                footer={
                  <ShopPackageSummary
                    itemsAmount={so.itemsAmount}
                    shippingFee={so.shippingFee}
                    carrier={so.carrier || undefined}
                  />
                }
                actions={
                  <>
                    {canCancel && (
                      <Button
                        type="button"
                        variant="destructive-outline"
                        size="sm"
                        onClick={() => setCancellingPackage(so)}
                      >
                        {t('detail.actions.cancelPackage')}
                      </Button>
                    )}

                    {so.status === 'DELIVERED' && (
                      <>
                        <Button
                          type="button"
                          variant="cta"
                          size="sm"
                          disabled={!canReceipt}
                          onClick={() => setConfirmingPackage(so)}
                        >
                          <CheckCircle2 aria-hidden="true" />
                          {t('detail.actions.confirmReceipt')}
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link
                            to={`/account/complaints?orderId=${encodeURIComponent(order.orderId)}&sellerOrderId=${encodeURIComponent(so.sellerOrderId)}`}
                          >
                            <MessageSquareWarning aria-hidden="true" />
                            {t('detail.actions.openComplaint')}
                          </Link>
                        </Button>
                      </>
                    )}

                    {isShippingLocked && (
                      <Button asChild variant="outline" size="sm">
                        <Link
                          to={`/account/complaints?orderId=${encodeURIComponent(order.orderId)}&sellerOrderId=${encodeURIComponent(so.sellerOrderId)}`}
                        >
                          <MessageSquareWarning aria-hidden="true" />
                          {t('detail.actions.openComplaint')}
                        </Link>
                      </Button>
                    )}

                    {so.status === 'COMPLETED' && (
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/account/reviews?sellerOrderId=${encodeURIComponent(so.sellerOrderId)}`}>
                          <Star aria-hidden="true" />
                          {t('detail.actions.reviewPackage')}
                        </Link>
                      </Button>
                    )}
                  </>
                }
              >
                {items.map((item) => (
                  <ShopPackageItem
                    key={item.orderItemId}
                    name={item.productName}
                    variantLabel={item.variantLabel}
                    imageUrl={item.imageRef}
                    quantity={item.quantity}
                    unitPrice={item.unitPrice}
                    href={item.productId ? `/products/${item.productId}` : undefined}
                    end={
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          {formatVnd(item.lineTotal)}
                        </span>
                        {(so.status === 'DELIVERED' || so.status === 'COMPLETED') && (
                          <Button asChild variant="ghost" size="xs">
                            <Link
                              to={`/account/reviews?orderItemId=${encodeURIComponent(item.orderItemId)}&productId=${encodeURIComponent(item.productId)}`}
                            >
                              <Star aria-hidden="true" />
                              {t('detail.actions.reviewItem')}
                            </Link>
                          </Button>
                        )}
                      </div>
                    }
                  />
                ))}
              </ShopPackageCard>
            )
          })}
        </div>

        {/* Cột phải: Địa chỉ nhận hàng (snapshot) + Thanh toán + Lịch sử trạng thái */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:col-span-4">
          <section
            aria-labelledby="order-address-heading"
            className="rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <h2 id="order-address-heading" className="flex items-center gap-2 text-base font-semibold">
                <MapPin aria-hidden="true" className="size-4 text-primary" />
                <span>{t('detail.sidebar.addressTitle')}</span>
              </h2>
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {t('detail.sidebar.addressSnapshotBadge')}
              </span>
            </div>
            <div className="mt-3 space-y-1 text-sm">
              <p className="font-semibold text-foreground">{order.deliveryAddress.contactName}</p>
              <p className="font-mono text-xs text-muted-foreground">{order.deliveryAddress.phone}</p>
              <p className="text-muted-foreground">
                {order.deliveryAddress.line}, {order.deliveryAddress.ward}, {order.deliveryAddress.district},{' '}
                {order.deliveryAddress.province}
              </p>
            </div>
          </section>

          <section
            aria-labelledby="order-payment-heading"
            className="rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5"
          >
            <h2 id="order-payment-heading" className="flex items-center gap-2 border-b border-border pb-3 text-base font-semibold">
              <CreditCard aria-hidden="true" className="size-4 text-primary" />
              <span>{t('detail.sidebar.paymentTitle')}</span>
            </h2>

            {order.paymentDegraded && (
              <div className="mt-3">
                <ServiceFallbackBanner
                  message={t('detail.tracking.paymentDegradedBanner')}
                  onRetry={() => void orderQuery.refetch()}
                  isRetrying={orderQuery.isFetching}
                />
              </div>
            )}

            <dl className="mt-3 space-y-2 text-sm tabular-nums">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t('detail.sidebar.itemsTotal')}</dt>
                <dd className="font-medium text-foreground">{formatVnd(order.itemsTotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t('detail.sidebar.shippingTotal')}</dt>
                <dd className="font-medium text-foreground">{formatVnd(order.shippingTotal)}</dd>
              </div>
              {order.payment && (
                <>
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">{t('detail.sidebar.paymentGateway')}</dt>
                    <dd className="font-mono text-xs font-medium text-foreground">
                      {order.payment.gateway}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">{t('detail.sidebar.paymentStatus')}</dt>
                    <dd>
                      <StatusBadge status={order.payment.status} />
                    </dd>
                  </div>
                  {order.payment.gatewayRef && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">{t('detail.sidebar.paymentRef')}</dt>
                      <dd>
                        <CopyableId
                          value={order.payment.gatewayRef}
                          label={t('detail.sidebar.paymentRef')}
                        />
                      </dd>
                    </div>
                  )}
                </>
              )}
              <Separator className="my-2" />
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-semibold text-foreground">{t('detail.sidebar.grandTotal')}</dt>
                <dd className="text-lg font-bold text-price">{formatVnd(order.grandTotal)}</dd>
              </div>
            </dl>

            {order.status === 'PENDING_PAYMENT' && order.payment?.paymentUrl && (
              <Button asChild variant="cta" size="cta" className="mt-4 w-full">
                <a href={order.payment.paymentUrl}>{t('detail.actions.payNow')}</a>
              </Button>
            )}
          </section>

          <section
            aria-labelledby="order-history-heading"
            className="rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5"
          >
            <h2 id="order-history-heading" className="flex items-center gap-2 border-b border-border pb-3 text-base font-semibold">
              <History aria-hidden="true" className="size-4 text-primary" />
              <span>{t('detail.sidebar.historyTitle')}</span>
            </h2>
            {historyList.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">{t('detail.sidebar.historyEmpty')}</p>
            ) : (
              <ol className="mt-3 space-y-2.5 border-l border-border pl-3.5 text-xs">
                {historyList.map((entry) => (
                  <li key={entry.historyId} className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={entry.toStatus} />
                      <time
                        dateTime={entry.at}
                        title={formatDateTimeFull(entry.at)}
                        className="text-muted-foreground tabular-nums"
                      >
                        {formatDateTime(entry.at)}
                      </time>
                    </div>
                    {entry.note && <p className="text-muted-foreground">{entry.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>

      <CancelSellerOrderDialog
        open={Boolean(cancellingPackage)}
        onOpenChange={(next) => {
          if (!next) setCancellingPackage(null)
        }}
        sellerOrder={cancellingPackage}
        shopName={cancellingPackage ? resolveShopName(cancellingPackage) : ''}
        isPaidOrder={isPaidOrder}
        onConfirm={async (sellerOrderId, reason) => {
          await cancelMutation.mutateAsync({ sellerOrderId, reason })
        }}
        onReloadOrder={() => void orderQuery.refetch()}
      />

      <ConfirmReceiptDialog
        open={Boolean(confirmingPackage)}
        onOpenChange={(next) => {
          if (!next) setConfirmingPackage(null)
        }}
        sellerOrder={confirmingPackage}
        shopName={confirmingPackage ? resolveShopName(confirmingPackage) : ''}
        onConfirm={async (sellerOrderId) => {
          await receiptMutation.mutateAsync(sellerOrderId)
        }}
        onReloadOrder={() => void orderQuery.refetch()}
      />
    </div>
  )
}
