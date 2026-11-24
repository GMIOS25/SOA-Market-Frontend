import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MapPin,
  Printer,
  RefreshCw,
  ShieldAlert,
  Store,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ApiError } from '@/api/errors'
import {
  AuditReasonDialog,
  CopyableId,
  ServiceFallbackBanner,
  ShopPackageCard,
  ShopPackageItem,
  ShopPackageSummary,
  SlaCountdownPill,
} from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { useAuthSession } from '@/lib/auth/session'
import { formatDateTime, formatVnd } from '@/lib/format'
import { PickupAddressAlert } from '../components/PickupAddressAlert'
import { SellerOrderHistoryTimeline } from '../components/SellerOrderHistoryTimeline'
import { SellerShipmentSection } from '../components/SellerShipmentSection'
import { ShippingLabelDialog } from '../components/ShippingLabelDialog'
import { fallbackShopName } from '../api'
import {
  apiCancelSellerOrder,
  apiConfirmSellerOrder,
  apiGetSellerOrderDetail,
  apiGetSellerShop,
  apiGetShipmentLabel,
  apiGetShipmentTracking,
  apiListShipmentsBySellerOrder,
  apiRejectSellerOrder,
  apiRetryShipment,
  canPrintShipmentLabel,
  canSellerCancelBeforePickup,
  hasValidPickupAddress,
  isPickupAddressMissingError,
  isShipmentPickedUp,
  pickActiveForwardShipment,
  resolveConfirmStartedAt,
  type SellerShipmentView,
  type ShipmentLabelResult,
} from '../seller-orders-api'

export type SellerOrderDetailPageProps = {
  /** Override mở URL nhãn vận chuyển phục vụ unit/integration test. */
  onOpenLabel?: (url: string) => void
}

function SellerOrderDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
      <div className="space-y-4 lg:col-span-8">
        <Skeleton className="h-56 w-full rounded-lg" />
        <Skeleton className="h-44 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
      <div className="space-y-4 lg:col-span-4">
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-36 w-full rounded-lg" />
      </div>
    </div>
  )
}

export function SellerOrderDetailPage({ onOpenLabel }: SellerOrderDetailPageProps) {
  const { t } = useTranslation('sellerOrders')
  const { id: sellerOrderId = '' } = useParams()
  const session = useAuthSession()
  const queryClient = useQueryClient()

  const [pickup422Error, setPickup422Error] = useState<ApiError | null>(null)
  const [actionError, setActionError] = useState<ApiError | Error | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [reasonDialogMode, setReasonDialogMode] = useState<'reject' | 'cancel' | null>(null)
  const [labelPreview, setLabelPreview] = useState<ShipmentLabelResult | null>(null)

  const shopQuery = useQuery({
    queryKey: ['seller', 'shop'],
    queryFn: apiGetSellerShop,
    enabled: Boolean(session.accessToken),
    retry: false,
    staleTime: 5 * 60_000,
  })

  const myShop = shopQuery.data

  const detailQuery = useQuery({
    queryKey: ['seller-orders', 'detail', sellerOrderId],
    queryFn: () => apiGetSellerOrderDetail(sellerOrderId),
    enabled: Boolean(session.accessToken) && Boolean(sellerOrderId),
    retry: false,
  })

  const detail = detailQuery.data

  const isForbiddenShop =
    (detailQuery.error instanceof ApiError && detailQuery.error.status === 403) ||
    Boolean(detail && myShop?.shopId && detail.shopId !== myShop.shopId)

  const isNotFound = detailQuery.error instanceof ApiError && detailQuery.error.status === 404

  const shipmentsQuery = useQuery({
    queryKey: ['seller-orders', 'shipments', sellerOrderId],
    queryFn: () => apiListShipmentsBySellerOrder(sellerOrderId),
    enabled:
      Boolean(session.accessToken) &&
      Boolean(detail) &&
      !isForbiddenShop &&
      detail?.status !== 'PENDING_PAYMENT' &&
      detail?.status !== 'AWAITING_CONFIRMATION',
    retry: false,
  })

  const shipmentsData = shipmentsQuery.data
  const shipment = useMemo(
    () => pickActiveForwardShipment(shipmentsData ?? []),
    [shipmentsData],
  )

  const trackingQuery = useQuery({
    queryKey: ['shipments', 'tracking', shipment?.shipmentId],
    queryFn: () => apiGetShipmentTracking(shipment!.shipmentId),
    enabled:
      Boolean(session.accessToken) &&
      Boolean(shipment?.shipmentId) &&
      shipment?.status !== 'PENDING_CREATION' &&
      shipment?.status !== 'CREATE_FAILED',
    retry: false,
  })

  function invalidateOrderAndShipments() {
    void queryClient.invalidateQueries({ queryKey: ['seller-orders'] })
    void queryClient.invalidateQueries({ queryKey: ['shipments', 'tracking'] })
  }

  const confirmMutation = useMutation({
    mutationFn: () => apiConfirmSellerOrder(sellerOrderId),
    onMutate: () => {
      setPickup422Error(null)
      setActionError(null)
      setActionSuccess(null)
    },
    onSuccess: () => {
      setActionSuccess(t('detail.feedback.confirmSuccess'))
      invalidateOrderAndShipments()
    },
    onError: (err) => {
      if (isPickupAddressMissingError(err, 'shipment_action')) {
        setPickup422Error(err)
        return
      }
      setActionError(err instanceof Error ? err : new Error(t('detail.feedback.actionErrorFallback')))
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => apiRejectSellerOrder(sellerOrderId, reason),
    onMutate: () => {
      setPickup422Error(null)
      setActionError(null)
      setActionSuccess(null)
    },
    onSuccess: () => {
      setActionSuccess(t('detail.feedback.rejectSuccess'))
      invalidateOrderAndShipments()
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => apiCancelSellerOrder(sellerOrderId, reason),
    onMutate: () => {
      setPickup422Error(null)
      setActionError(null)
      setActionSuccess(null)
    },
    onSuccess: () => {
      setActionSuccess(t('detail.feedback.cancelSuccess'))
      invalidateOrderAndShipments()
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        invalidateOrderAndShipments()
      }
    },
  })

  const printLabelMutation = useMutation({
    mutationFn: (target: SellerShipmentView) => apiGetShipmentLabel(target.shipmentId),
    onMutate: () => {
      setActionError(null)
    },
    onSuccess: (result) => {
      setLabelPreview(result)
      if (result.labelUrl && onOpenLabel) {
        onOpenLabel(result.labelUrl)
      }
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err : new Error(t('detail.feedback.actionErrorFallback')))
    },
  })

  const retryShipmentMutation = useMutation({
    mutationFn: (target: SellerShipmentView) => apiRetryShipment(target.shipmentId),
    onMutate: () => {
      setPickup422Error(null)
      setActionError(null)
      setActionSuccess(null)
    },
    onSuccess: () => {
      setActionSuccess(t('detail.feedback.retryShipmentSuccess'))
      invalidateOrderAndShipments()
    },
    onError: (err) => {
      if (isPickupAddressMissingError(err, 'shipment_action')) {
        setPickup422Error(err)
        return
      }
      setActionError(err instanceof Error ? err : new Error(t('detail.feedback.actionErrorFallback')))
    },
  })

  const isAwaitingConfirm = detail?.status === 'AWAITING_CONFIRMATION'
  const isConfirmed = detail?.status === 'CONFIRMED'
  const canConfirm =
    isAwaitingConfirm && (detail?.availableActions == null || detail.availableActions.includes('CONFIRM'))
  const canReject =
    isAwaitingConfirm && (detail?.availableActions == null || detail.availableActions.includes('REJECT'))
  const canCancelBeforePickup =
    detail != null &&
    canSellerCancelBeforePickup(detail.status, detail.availableActions, shipment?.status)
  const pickedUpLock = isConfirmed && isShipmentPickedUp(shipment?.status)

  const shopDisplayName =
    myShop?.name || (detail ? fallbackShopName(detail.shopId) : '')

  const canShowQuickRetry = shipment?.status === 'CREATE_FAILED'
  const canShowQuickPrint = canPrintShipmentLabel(shipment)

  const isMutating =
    confirmMutation.isPending ||
    rejectMutation.isPending ||
    cancelMutation.isPending ||
    retryShipmentMutation.isPending

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <Link
            to="/seller/orders"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            <span>{t('detail.backToList')}</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">
              {detail && !isForbiddenShop
                ? t('detail.title', { code: detail.sellerOrderCode })
                : t('detail.loadingTitle')}
            </h1>
            {detail && !isForbiddenShop && <StatusBadge status={detail.status} />}
          </div>
          {detail && !isForbiddenShop && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span>{t('detail.parentOrderLabel')}:</span>
                <CopyableId
                  value={detail.orderId}
                  display={detail.orderCode}
                  label={t('common.orderCodeLabel')}
                />
              </span>
              <span className="tabular-nums">
                {t('detail.createdAtLabel', { datetime: formatDateTime(detail.createdAt) })}
              </span>
              {detail.deliveredAt && (
                <span className="tabular-nums">
                  {t('detail.deliveredAtLabel', { datetime: formatDateTime(detail.deliveredAt) })}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {detail && !isForbiddenShop && isAwaitingConfirm && detail.confirmDueAt && (
            <SlaCountdownPill
              label={t('common.confirmSlaLabel')}
              startedAt={resolveConfirmStartedAt(detail.createdAt, detail.updatedAt, detail.confirmDueAt)}
              deadline={detail.confirmDueAt}
            />
          )}
          {detail && !isForbiddenShop && detail.status === 'DELIVERED' && detail.completeDueAt && (
            <SlaCountdownPill
              label={t('common.completeSlaLabel')}
              startedAt={detail.deliveredAt ?? detail.updatedAt}
              deadline={detail.completeDueAt}
            />
          )}
          {!isForbiddenShop && !isNotFound && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={detailQuery.isFetching}
              onClick={() => void detailQuery.refetch()}
            >
              <RefreshCw aria-hidden="true" className={detailQuery.isFetching ? 'animate-spin' : undefined} />
              {detailQuery.isFetching ? t('common.refreshing') : t('common.refresh')}
            </Button>
          )}
        </div>
      </header>

      {isForbiddenShop ? (
        <section
          role="alert"
          className="flex flex-col items-center gap-3 rounded-lg border border-status-danger-border bg-status-danger p-8 text-center text-status-danger-foreground"
        >
          <ShieldAlert aria-hidden="true" className="size-10" />
          <h2 className="text-lg font-semibold">{t('common.forbiddenTitle')}</h2>
          <p className="max-w-md text-sm">{t('common.forbiddenDescription')}</p>
          <Button asChild variant="outline" size="sm" className="mt-1">
            <Link to="/seller/orders">{t('common.backToList')}</Link>
          </Button>
        </section>
      ) : detailQuery.isLoading ? (
        <SellerOrderDetailSkeleton />
      ) : isNotFound ? (
        <section className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-8 text-center shadow-xs">
          <h2 className="text-lg font-semibold">{t('detail.notFoundTitle')}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{t('detail.notFoundDescription')}</p>
          <Button asChild variant="outline" size="sm" className="mt-1">
            <Link to="/seller/orders">{t('common.backToList')}</Link>
          </Button>
        </section>
      ) : detailQuery.isError || !detail ? (
        <ServiceFallbackBanner
          message={detailQuery.error instanceof ApiError ? detailQuery.error.message : t('detail.loadError')}
          onRetry={() => void detailQuery.refetch()}
          isRetrying={detailQuery.isFetching}
        />
      ) : (
        <>
          <PickupAddressAlert
            apiError={pickup422Error}
            proactiveMissing={Boolean(myShop && !hasValidPickupAddress(myShop.pickupAddress))}
            onDismissError={() => setPickup422Error(null)}
          />

          {actionSuccess && (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-lg border border-status-success-border bg-status-success p-4 text-sm text-status-success-foreground"
            >
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <p className="font-medium">{actionSuccess}</p>
            </div>
          )}

          {actionError && (
            <div
              role="alert"
              className="space-y-1.5 rounded-lg border border-status-danger-border bg-status-danger p-4 text-sm text-status-danger-foreground"
            >
              <p className="flex items-start gap-2 font-medium">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>{actionError.message}</span>
              </p>
              {actionError instanceof ApiError && actionError.correlationId && (
                <p className="flex items-center gap-1 text-xs">
                  <span>{t('common.correlationId')}:</span>
                  <CopyableId value={actionError.correlationId} label={t('common.correlationId')} />
                </p>
              )}
            </div>
          )}

          {detail.hasOpenComplaint && (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-lg border border-status-warning-border bg-status-warning p-4 text-sm text-status-warning-foreground"
            >
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <p>{t('detail.openComplaintAlert')}</p>
            </div>
          )}

          {detail.cancelCause && (
            <div
              role="status"
              className="space-y-1 rounded-lg border border-status-danger-border bg-status-danger p-4 text-sm text-status-danger-foreground"
            >
              <p className="font-semibold">
                {t('detail.cancelNotice.title', {
                  cause: t(`detail.cancelNotice.causes.${detail.cancelCause}` as never, {
                    defaultValue: detail.cancelCause,
                  }),
                })}
              </p>
              {detail.cancelReason && (
                <p className="text-xs">
                  {t('detail.cancelNotice.reasonLabel', { reason: detail.cancelReason })}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
            <div className="space-y-6 lg:col-span-8">
              <ShopPackageCard
                shop={{ id: detail.shopId, name: shopDisplayName }}
                shopHref={null}
                status={detail.status}
                code={{ value: detail.sellerOrderId, display: detail.sellerOrderCode }}
                sla={
                  isAwaitingConfirm && detail.confirmDueAt ? (
                    <SlaCountdownPill
                      label={t('common.confirmSlaShort')}
                      startedAt={resolveConfirmStartedAt(detail.createdAt, detail.updatedAt, detail.confirmDueAt)}
                      deadline={detail.confirmDueAt}
                    />
                  ) : undefined
                }
                footer={
                  <ShopPackageSummary
                    itemsAmount={detail.itemsAmount}
                    shippingFee={detail.shippingFee}
                    carrier={shipment?.carrier || detail.carrier || undefined}
                    etaAt={shipment?.etaAt ?? undefined}
                  />
                }
              >
                {(detail.items ?? []).map((item) => (
                  <ShopPackageItem
                    key={item.orderItemId}
                    name={item.productName}
                    variantLabel={item.variantLabel}
                    imageUrl={item.imageRef}
                    quantity={item.quantity}
                    unitPrice={item.unitPrice}
                    end={
                      <span className="text-sm font-semibold text-foreground tabular-nums">
                        {formatVnd(item.lineTotal)}
                      </span>
                    }
                  />
                ))}
              </ShopPackageCard>

              <SellerShipmentSection
                orderStatus={detail.status}
                orderCarrier={detail.carrier}
                orderTrackingCode={detail.trackingCode}
                shipment={shipment}
                isLoading={shipmentsQuery.isLoading}
                error={shipmentsQuery.error}
                isFetching={shipmentsQuery.isFetching}
                onRefreshShipment={() => void shipmentsQuery.refetch()}
                onPrintLabel={(target) => printLabelMutation.mutate(target)}
                isPrintingLabel={printLabelMutation.isPending}
                onRetryShipment={(target) => retryShipmentMutation.mutate(target)}
                isRetryingShipment={retryShipmentMutation.isPending}
                trackingEvents={trackingQuery.data}
                isTrackingLoading={trackingQuery.isLoading}
                trackingError={trackingQuery.error}
                onRetryTracking={() => void trackingQuery.refetch()}
              />

              <SellerOrderHistoryTimeline history={detail.history ?? []} />
            </div>

            <aside className="space-y-5 lg:sticky lg:top-20 lg:col-span-4">
              {/* Khối thao tác nghiệp vụ chính */}
              <section
                aria-labelledby="seller-actions-heading"
                className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5"
              >
                <div className="border-b border-border pb-3">
                  <h2 id="seller-actions-heading" className="flex items-center gap-2 text-base font-semibold">
                    <Store aria-hidden="true" className="size-4 text-primary" />
                    <span>{t('detail.actions.sectionTitle')}</span>
                  </h2>
                </div>

                {isAwaitingConfirm ? (
                  <div className="space-y-3">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {t('detail.actions.confirmHint')}
                    </p>
                    <div className="flex flex-col gap-2">
                      {canConfirm && (
                        <Button
                          type="button"
                          disabled={isMutating}
                          onClick={() => confirmMutation.mutate()}
                          className="w-full"
                        >
                          {confirmMutation.isPending && (
                            <Loader2 aria-hidden="true" className="animate-spin" />
                          )}
                          {confirmMutation.isPending
                            ? t('detail.actions.confirmingButton')
                            : t('detail.actions.confirmButton')}
                        </Button>
                      )}
                      {canReject && (
                        <Button
                          type="button"
                          variant="destructive-outline"
                          disabled={isMutating}
                          onClick={() => setReasonDialogMode('reject')}
                          className="w-full"
                        >
                          <XCircle aria-hidden="true" />
                          {t('detail.actions.rejectButton')}
                        </Button>
                      )}
                    </div>
                  </div>
                ) : isConfirmed ? (
                  <div className="space-y-3">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {t('detail.actions.confirmedHint')}
                    </p>
                    <div className="flex flex-col gap-2">
                      {canShowQuickPrint && shipment && (
                        <Button
                          type="button"
                          disabled={printLabelMutation.isPending}
                          onClick={() => printLabelMutation.mutate(shipment)}
                          className="w-full"
                        >
                          {printLabelMutation.isPending ? (
                            <Loader2 aria-hidden="true" className="animate-spin" />
                          ) : (
                            <Printer aria-hidden="true" />
                          )}
                          {printLabelMutation.isPending
                            ? t('shipment.printingLabelButton')
                            : t('shipment.printLabelButton')}
                        </Button>
                      )}

                      {canShowQuickRetry && shipment && (
                        <Button
                          type="button"
                          disabled={isMutating}
                          onClick={() => retryShipmentMutation.mutate(shipment)}
                          className="w-full"
                        >
                          {retryShipmentMutation.isPending ? (
                            <Loader2 aria-hidden="true" className="animate-spin" />
                          ) : (
                            <RefreshCw aria-hidden="true" />
                          )}
                          {retryShipmentMutation.isPending
                            ? t('shipment.retryingButton')
                            : t('shipment.retryButton')}
                        </Button>
                      )}

                      <Button
                        type="button"
                        variant="destructive-outline"
                        disabled={!canCancelBeforePickup || isMutating}
                        onClick={() => setReasonDialogMode('cancel')}
                        className="w-full"
                      >
                        <XCircle aria-hidden="true" />
                        {t('detail.actions.cancelBeforePickupButton')}
                      </Button>

                      {pickedUpLock && (
                        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                          {t('detail.actions.cancelLockedByPickup')}
                        </p>
                      )}
                    </div>
                  </div>
                ) : canShowQuickPrint && shipment ? (
                  <div className="space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={printLabelMutation.isPending}
                      onClick={() => printLabelMutation.mutate(shipment)}
                      className="w-full"
                    >
                      {printLabelMutation.isPending ? (
                        <Loader2 aria-hidden="true" className="animate-spin" />
                      ) : (
                        <Printer aria-hidden="true" />
                      )}
                      {printLabelMutation.isPending
                        ? t('shipment.printingLabelButton')
                        : t('shipment.printLabelButton')}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('detail.actions.noPendingActions')}</p>
                )}
              </section>

              {/* Địa chỉ giao hàng đã chụp */}
              <section
                aria-labelledby="seller-delivery-address-heading"
                className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5"
              >
                <div className="border-b border-border pb-2.5">
                  <h2 id="seller-delivery-address-heading" className="flex items-center gap-2 text-base font-semibold">
                    <MapPin aria-hidden="true" className="size-4 text-primary" />
                    <span>{t('detail.deliveryAddress.title')}</span>
                  </h2>
                </div>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">{t('detail.deliveryAddress.recipient')}</dt>
                    <dd className="font-medium text-foreground">{detail.deliveryAddress.contactName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t('detail.deliveryAddress.phone')}</dt>
                    <dd className="font-mono text-xs text-foreground">{detail.deliveryAddress.phone}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t('detail.deliveryAddress.address')}</dt>
                    <dd className="text-xs leading-relaxed text-muted-foreground">
                      {[
                        detail.deliveryAddress.line,
                        detail.deliveryAddress.ward,
                        detail.deliveryAddress.district,
                        detail.deliveryAddress.province,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </dd>
                  </div>
                </dl>
              </section>

              {/* Tổng kết tài chính gói hàng */}
              <section
                aria-labelledby="seller-summary-heading"
                className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5"
              >
                <div className="border-b border-border pb-2.5">
                  <h2 id="seller-summary-heading" className="text-base font-semibold">
                    {t('detail.summary.title')}
                  </h2>
                </div>
                <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm tabular-nums">
                  <dt className="text-muted-foreground">{t('detail.summary.itemsAmount')}</dt>
                  <dd className="text-right font-medium">{formatVnd(detail.itemsAmount)}</dd>
                  <dt className="text-muted-foreground">{t('detail.summary.shippingFee')}</dt>
                  <dd className="text-right font-medium">{formatVnd(detail.shippingFee)}</dd>
                  {detail.discountAmount > 0 && (
                    <>
                      <dt className="text-muted-foreground">{t('detail.summary.discountAmount')}</dt>
                      <dd className="text-right font-medium">- {formatVnd(detail.discountAmount)}</dd>
                    </>
                  )}
                  <dt className="border-t border-border pt-2 font-semibold">{t('detail.summary.totalAmount')}</dt>
                  <dd className="border-t border-border pt-2 text-right font-bold text-foreground">
                    {formatVnd(detail.totalAmount)}
                  </dd>
                  <dt className="text-xs text-muted-foreground">{t('detail.summary.refundStatus')}</dt>
                  <dd className="text-right text-xs font-medium">
                    {t(`detail.summary.refundValues.${detail.refundStatus}` as never, {
                      defaultValue: detail.refundStatus,
                    })}
                  </dd>
                </dl>
              </section>
            </aside>
          </div>

          <AuditReasonDialog
            open={reasonDialogMode !== null}
            onOpenChange={(next) => {
              if (!next) setReasonDialogMode(null)
            }}
            title={
              reasonDialogMode === 'reject'
                ? t('detail.rejectDialog.title', { code: detail.sellerOrderCode })
                : t('detail.cancelDialog.title', { code: detail.sellerOrderCode })
            }
            description={
              reasonDialogMode === 'reject'
                ? t('detail.rejectDialog.description')
                : t('detail.cancelDialog.description')
            }
            confirmLabel={
              reasonDialogMode === 'reject'
                ? t('detail.rejectDialog.confirm')
                : t('detail.cancelDialog.confirm')
            }
            variant="destructive"
            minLength={1}
            onConfirm={async (reason) => {
              if (reasonDialogMode === 'reject') {
                await rejectMutation.mutateAsync(reason)
                return
              }
              await cancelMutation.mutateAsync(reason)
            }}
          />

          <ShippingLabelDialog
            open={labelPreview !== null}
            onOpenChange={(next) => {
              if (!next) setLabelPreview(null)
            }}
            label={labelPreview}
            sellerOrderCode={detail.sellerOrderCode}
            carrier={shipment?.carrier || detail.carrier}
            trackingCode={shipment?.trackingCode || detail.trackingCode}
            deliveryAddress={detail.deliveryAddress}
            onOpenExternal={onOpenLabel}
          />
        </>
      )}
    </div>
  )
}
