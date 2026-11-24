import { AlertTriangle, Clock, Loader2, Printer, RefreshCw, Settings, Truck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ApiError } from '@/api/errors'
import { CopyableId, ServiceFallbackBanner } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { ShipmentTrackingTimeline } from '@/features/payment-shipping/ShipmentTrackingTimeline'
import { formatShipmentFailureReason } from '@/features/payment-shipping/tracking'
import type { TrackingEvent } from '@/features/payment-shipping/api'
import { formatDate } from '@/lib/format'
import type { StatusTone } from '@/lib/status'
import {
  PICKUP_ADDRESS_SETTINGS_PATH,
  canPrintShipmentLabel,
  type SellerShipmentView,
} from '../seller-orders-api'

export type SellerShipmentSectionProps = {
  orderStatus: string
  orderCarrier?: string
  orderTrackingCode?: string
  shipment: SellerShipmentView | null
  isLoading: boolean
  error: Error | null
  isFetching: boolean
  onRefreshShipment: () => void
  onPrintLabel: (shipment: SellerShipmentView) => void
  isPrintingLabel: boolean
  onRetryShipment: (shipment: SellerShipmentView) => void
  isRetryingShipment: boolean
  trackingEvents?: TrackingEvent[]
  deliveryAttempts?: number
  deliveryAttemptLimit?: number
  isTrackingLoading?: boolean
  trackingError?: Error | null
  onRetryTracking?: () => void
}

const SHIPMENT_STATUS_TONES: Record<string, StatusTone> = {
  PENDING_CREATION: 'neutral',
  CREATE_FAILED: 'danger',
  CREATED: 'info',
  PICKED_UP: 'info',
  IN_TRANSIT: 'info',
  OUT_FOR_DELIVERY: 'info',
  DELIVERED: 'success',
  RETURNING: 'warning',
  RETURNED: 'danger',
  CANCELLED: 'danger',
}

function resolveShipmentStatusLabel(
  status: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const knownKey = `shipment.statuses.${status}`
  const translated = t(knownKey, { defaultValue: '' })
  return translated || status
}

/**
 * Khối quản lý vận đơn cho Seller (`FR-SHP-002..003`):
 * - `CREATE_FAILED` -> cảnh báo đỏ + nút "Tạo lại vận đơn" + link cấu hình địa chỉ lấy hàng
 * - `CREATED`+ -> nút "In nhãn vận chuyển" + hành trình vận chuyển
 * - Khi `SVC-SHP` tạm lỗi -> `<ServiceFallbackBanner />` cục bộ, không làm sập trang đơn hàng (`NFR-REL-005`).
 */
export function SellerShipmentSection({
  orderStatus,
  orderCarrier,
  orderTrackingCode,
  shipment,
  isLoading,
  error,
  isFetching,
  onRefreshShipment,
  onPrintLabel,
  isPrintingLabel,
  onRetryShipment,
  isRetryingShipment,
  trackingEvents = [],
  deliveryAttempts,
  deliveryAttemptLimit,
  isTrackingLoading = false,
  trackingError = null,
  onRetryTracking,
}: SellerShipmentSectionProps) {
  const { t } = useTranslation('sellerOrders')
  const isBeforeConfirm = orderStatus === 'PENDING_PAYMENT' || orderStatus === 'AWAITING_CONFIRMATION'
  const effectiveCarrier = shipment?.carrier || orderCarrier
  const effectiveTrackingCode = shipment?.trackingCode || orderTrackingCode

  return (
    <section
      aria-labelledby="seller-shipment-heading"
      className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <h2 id="seller-shipment-heading" className="flex items-center gap-2 text-lg font-semibold">
          <Truck aria-hidden="true" className="size-5 text-primary" />
          <span>{t('shipment.sectionTitle')}</span>
        </h2>
        {!isBeforeConfirm && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={onRefreshShipment}
          >
            <RefreshCw aria-hidden="true" className={isFetching ? 'animate-spin' : undefined} />
            {t('shipment.refresh')}
          </Button>
        )}
      </div>

      {isBeforeConfirm ? (
        <p className="rounded-md border border-border bg-background px-3.5 py-3 text-sm text-muted-foreground">
          {t('shipment.awaitingConfirmNote')}
        </p>
      ) : isLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-16 w-full rounded-md" />
        </div>
      ) : error ? (
        <div className="space-y-3">
          {(effectiveCarrier || effectiveTrackingCode) && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-border bg-background px-3.5 py-2.5 text-sm">
              {effectiveCarrier && (
                <span>
                  <span className="text-muted-foreground">{t('shipment.carrierLabel')}: </span>
                  <span className="font-medium">{effectiveCarrier}</span>
                </span>
              )}
              {effectiveTrackingCode && (
                <span className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">{t('shipment.trackingCodeLabel')}:</span>
                  <CopyableId value={effectiveTrackingCode} label={t('common.trackingCodeLabel')} />
                </span>
              )}
            </div>
          )}
          <ServiceFallbackBanner
            message={error instanceof ApiError ? error.message : t('shipment.loadError')}
            onRetry={onRefreshShipment}
            isRetrying={isFetching}
          />
        </div>
      ) : !shipment || shipment.status === 'PENDING_CREATION' ? (
        <div className="space-y-3 rounded-md border border-status-info-border bg-status-info p-4 text-sm text-status-info-foreground">
          <div className="flex items-start gap-2.5">
            <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold">{t('shipment.pendingCreationTitle')}</p>
              <p className="text-xs">{t('shipment.pendingCreationDesc')}</p>
            </div>
          </div>
          {effectiveTrackingCode && (
            <p className="flex items-center gap-1.5 text-xs">
              <span>{t('shipment.trackingCodeLabel')}:</span>
              <CopyableId value={effectiveTrackingCode} label={t('common.trackingCodeLabel')} />
            </p>
          )}
        </div>
      ) : shipment.status === 'CREATE_FAILED' ? (
        <div
          role="alert"
          className="space-y-3 rounded-lg border border-status-danger-border bg-status-danger p-4 text-sm text-status-danger-foreground"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
              <span>{t('shipment.createFailedTitle')}</span>
            </div>
            <StatusBadge
              status="CREATE_FAILED"
              tone="danger"
              label={resolveShipmentStatusLabel('CREATE_FAILED', t as never)}
            />
          </div>
          <p>{formatShipmentFailureReason(shipment.failureReason) || t('shipment.createFailedDefaultReason')}</p>
          <p className="text-xs">
            {t('shipment.carrierLabel')}: <span className="font-semibold">{shipment.carrier}</span>
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              disabled={isRetryingShipment}
              onClick={() => onRetryShipment(shipment)}
            >
              {isRetryingShipment ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <RefreshCw aria-hidden="true" />
              )}
              {isRetryingShipment ? t('shipment.retryingButton') : t('shipment.retryButton')}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={PICKUP_ADDRESS_SETTINGS_PATH}>
                <Settings aria-hidden="true" />
                {t('pickupAlert.configureLink')}
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  status={shipment.status}
                  tone={SHIPMENT_STATUS_TONES[shipment.status] ?? 'neutral'}
                  label={resolveShipmentStatusLabel(shipment.status, t as never)}
                />
                {effectiveCarrier && (
                  <span className="text-sm font-medium text-foreground">{effectiveCarrier}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span>{t('shipment.trackingCodeLabel')}:</span>
                  {effectiveTrackingCode ? (
                    <CopyableId value={effectiveTrackingCode} label={t('common.trackingCodeLabel')} />
                  ) : (
                    <span>{t('shipment.noTrackingCode')}</span>
                  )}
                </span>
                {shipment.etaAt && (
                  <span className="tabular-nums">
                    {t('shipment.etaLabel')}: {formatDate(shipment.etaAt)}
                  </span>
                )}
              </div>
            </div>

            {canPrintShipmentLabel(shipment) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPrintingLabel}
                onClick={() => onPrintLabel(shipment)}
                className="self-start sm:self-center"
              >
                {isPrintingLabel ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : (
                  <Printer aria-hidden="true" />
                )}
                {isPrintingLabel ? t('shipment.printingLabelButton') : t('shipment.printLabelButton')}
              </Button>
            )}
          </div>

          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-foreground">{t('shipment.tracking.title')}</h3>
            {isTrackingLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : trackingError ? (
              <ServiceFallbackBanner
                message={trackingError instanceof ApiError ? trackingError.message : t('shipment.tracking.loadError')}
                onRetry={onRetryTracking}
              />
            ) : (
              <ShipmentTrackingTimeline events={trackingEvents} attempts={deliveryAttempts} attemptLimit={deliveryAttemptLimit} />
            )}
          </div>
        </div>
      )}
    </section>
  )
}
