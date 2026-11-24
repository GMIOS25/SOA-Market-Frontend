import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Truck } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyableId, ServiceFallbackBanner } from '@/components/shared'
import { DisclosurePanel } from '@/components/ui/disclosure-panel'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { ShipmentTrackingTimeline } from '@/features/payment-shipping/ShipmentTrackingTimeline'
import { formatShipmentFailureReason, sortTrackingEvents } from '@/features/payment-shipping/tracking'
import { formatDate } from '@/lib/format'
import {
  apiGetSellerOrderTracking,
  type ShipmentSummary,
  type ShipmentTrackingEvent,
} from '../api'
import { shouldFetchShipmentTracking } from '../order-helpers'

export type ExternalTimelineRenderProps = {
  sellerOrderId: string
  shipment: ShipmentSummary | null
  events: ShipmentTrackingEvent[]
}

export type ShipmentTrackingPanelProps = {
  sellerOrderId: string
  sellerOrderStatus: string
  carrier?: string
  trackingCode?: string
  shippingDegraded?: boolean
  onRetryOrder?: () => void
  isOrderFetching?: boolean
  showCancelPolicy?: boolean
  /** Hook ghép component `<ShipmentTrackingTimeline />` từ T5-08 khi sẵn sàng. */
  renderExternalTimeline?: (props: ExternalTimelineRenderProps) => ReactNode
}

/**
 * Khối hành trình vận chuyển cho từng gói `SellerOrder` (FR-SHP-005, NFR-REL-005).
 * Khi `SVC-SHP` lỗi hoặc `shippingDegraded = true`, chỉ hiển thị `<ServiceFallbackBanner />` tại khối này
 * để Buyer vẫn xem đầy đủ thông tin đơn hàng và thao tác bình thường.
 */
export function ShipmentTrackingPanel({
  sellerOrderId,
  sellerOrderStatus,
  carrier,
  trackingCode,
  shippingDegraded = false,
  onRetryOrder,
  isOrderFetching = false,
  showCancelPolicy = false,
  renderExternalTimeline,
}: ShipmentTrackingPanelProps) {
  const { t } = useTranslation('orders')
  const trackable = shouldFetchShipmentTracking({ status: sellerOrderStatus, trackingCode }, false)
  const shouldFetch = trackable && !shippingDegraded

  const trackingQuery = useQuery({
    queryKey: ['shipments', 'tracking', sellerOrderId],
    queryFn: () => apiGetSellerOrderTracking(sellerOrderId),
    enabled: shouldFetch,
    retry: false,
  })

  if (!trackable) return null

  const shipment = trackingQuery.data?.shipment ?? null
  const displayCarrier = shipment?.carrier || carrier
  const displayTrackingCode = shipment?.trackingCode || trackingCode
  const events = sortTrackingEvents(trackingQuery.data?.events ?? [])
  const latestEvent = events.find((event) => event.applied !== false)
  const latestNote = latestEvent?.note?.trim()
  const unavailable = shippingDegraded || trackingQuery.isError
  const separateStatus = shipment?.status && shipment.status !== latestEvent?.status ? shipment.status : undefined
  const eta = shipment?.etaAt && ['CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(shipment.status)
    ? t('detail.tracking.eta', { date: formatDate(shipment.etaAt) })
    : undefined
  const summary = unavailable ? t('detail.tracking.unavailableSummary')
    : shipment?.status === 'CREATE_FAILED' ? t('detail.tracking.createFailedNotice')
    : latestNote || eta

  function handleRetry() {
    if (shippingDegraded) onRetryOrder?.()
    if (shouldFetch) void trackingQuery.refetch()
  }

  return (
    <div data-testid={`tracking-panel-${sellerOrderId}`}>
      <DisclosurePanel title={t('detail.tracking.title')} summary={summary} icon={<Truck />} variant="plain">
        <div className="space-y-3">
          {(displayCarrier || displayTrackingCode || eta || separateStatus) && (
            <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              {separateStatus && (
                <div>
                  <dt className="sr-only">{t('detail.tracking.statusLabel')}</dt>
                  <dd><StatusBadge status={separateStatus} /></dd>
                </div>
              )}
              {displayCarrier && (
                <div className="flex min-w-0 items-center gap-1">
                  <dt>{t('detail.tracking.carrier')}</dt>
                  <dd className="break-all font-medium text-foreground">{displayCarrier}</dd>
                </div>
              )}
              {displayTrackingCode && (
                <div className="flex min-w-0 items-center gap-1">
                  <dt className="sr-only">{t('detail.tracking.trackingCode')}</dt>
                  <dd className="min-w-0"><CopyableId value={displayTrackingCode} label={t('detail.tracking.trackingCode')} /></dd>
                </div>
              )}
              {eta && <div><dt className="sr-only">{t('detail.tracking.etaLabel')}</dt><dd>{eta}</dd></div>}
            </dl>
          )}

          {unavailable ? (
            <ServiceFallbackBanner
              message={t('detail.tracking.degradedBanner')}
              onRetry={handleRetry}
              isRetrying={trackingQuery.isFetching || isOrderFetching}
            />
          ) : trackingQuery.isLoading ? (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : shipment?.status === 'CREATE_FAILED' ? (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-md border border-status-warning-border bg-status-warning px-3 py-2.5 text-xs text-status-warning-foreground sm:text-sm"
            >
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">{t('detail.tracking.createFailedNotice')}</p>
                {formatShipmentFailureReason(shipment.failureReason) && (
                  <p className="text-xs opacity-90">{formatShipmentFailureReason(shipment.failureReason)}</p>
                )}
              </div>
            </div>
          ) : renderExternalTimeline ? (
            renderExternalTimeline({ sellerOrderId, shipment, events })
          ) : !shipment ? (
            <p className="text-sm text-muted-foreground">{t('detail.tracking.notCreatedYet')}</p>
          ) : (
            <ShipmentTrackingTimeline
              events={events}
              attempts={shipment.deliveryAttempts}
              attemptLimit={shipment.deliveryAttemptLimit}
              showAll
            />
          )}

          {showCancelPolicy && (
            <p className="text-xs leading-relaxed text-muted-foreground">{t('detail.actions.cannotCancelHint')}</p>
          )}
        </div>
      </DisclosurePanel>
    </div>
  )
}
