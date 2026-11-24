import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown, ChevronUp, MapPin, Truck } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyableId, ServiceFallbackBanner } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDate, formatDateTime, formatDateTimeFull } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  apiGetSellerOrderTracking,
  type ShipmentSummary,
  type ShipmentTrackingEvent,
} from '../api'
import { shouldFetchShipmentTracking, sortTrackingEvents } from '../order-helpers'

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
  /** Hook ghép component `<ShipmentTrackingTimeline />` từ T5-08 khi sẵn sàng. */
  renderExternalTimeline?: (props: ExternalTimelineRenderProps) => ReactNode
}

const COLLAPSED_EVENT_LIMIT = 3

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
  renderExternalTimeline,
}: ShipmentTrackingPanelProps) {
  const { t } = useTranslation('orders')
  const [expanded, setExpanded] = useState(false)

  const shouldFetch = shouldFetchShipmentTracking(
    { status: sellerOrderStatus, trackingCode },
    shippingDegraded,
  )

  const trackingQuery = useQuery({
    queryKey: ['shipments', 'tracking', sellerOrderId],
    queryFn: () => apiGetSellerOrderTracking(sellerOrderId),
    enabled: shouldFetch,
    retry: false,
  })

  const shipment = trackingQuery.data?.shipment ?? null
  const displayCarrier = shipment?.carrier || carrier
  const displayTrackingCode = shipment?.trackingCode || trackingCode
  const sortedEvents = sortTrackingEvents(trackingQuery.data?.events ?? [])
  const visibleEvents =
    expanded || sortedEvents.length <= COLLAPSED_EVENT_LIMIT
      ? sortedEvents
      : sortedEvents.slice(0, COLLAPSED_EVENT_LIMIT)

  function handleRetry() {
    if (shippingDegraded) {
      onRetryOrder?.()
    }
    if (shouldFetch) {
      void trackingQuery.refetch()
    }
  }

  return (
    <div
      data-testid={`tracking-panel-${sellerOrderId}`}
      className="space-y-2.5 rounded-md border border-border bg-background/70 p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-foreground">
          <Truck aria-hidden="true" className="size-4 text-primary" />
          <span>{t('detail.tracking.title')}</span>
          {displayCarrier && (
            <span className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
              {displayCarrier}
            </span>
          )}
          {shipment?.status && <StatusBadge status={shipment.status} />}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {displayTrackingCode && (
            <CopyableId value={displayTrackingCode} label={t('detail.tracking.trackingCode')} />
          )}
          {shipment?.etaAt && (
            <span className="tabular-nums">{t('detail.tracking.eta', { date: formatDate(shipment.etaAt) })}</span>
          )}
        </div>
      </div>

      {shippingDegraded || trackingQuery.isError ? (
        <ServiceFallbackBanner
          message={t('detail.tracking.degradedBanner')}
          onRetry={handleRetry}
          isRetrying={trackingQuery.isFetching || isOrderFetching}
        />
      ) : !shouldFetch ? (
        <p className="text-xs text-muted-foreground">{t('detail.tracking.notCreatedYet')}</p>
      ) : trackingQuery.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-44" />
        </div>
      ) : shipment?.status === 'CREATE_FAILED' ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-status-warning-border bg-status-warning px-3 py-2 text-xs text-status-warning-foreground"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-medium">{t('detail.tracking.createFailedNotice')}</p>
            {shipment.failureReason && <p>{shipment.failureReason}</p>}
          </div>
        </div>
      ) : renderExternalTimeline ? (
        <>{renderExternalTimeline({ sellerOrderId, shipment, events: sortedEvents })}</>
      ) : sortedEvents.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('detail.tracking.noEventsYet')}</p>
      ) : (
        <div className="space-y-2">
          {shipment?.deliveryAttempts !== undefined && shipment.deliveryAttempts > 0 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {t('detail.tracking.deliveryAttempts', { count: shipment.deliveryAttempts })}
            </p>
          )}
          <ol className="relative space-y-2.5 border-l border-border pl-4">
            {visibleEvents.map((ev, index) => {
              const isLatest = index === 0
              return (
                <li key={ev.eventId} className="relative space-y-0.5 text-xs">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-card',
                      isLatest ? 'bg-primary' : 'bg-muted-foreground/40',
                    )}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={ev.status} />
                    <time
                      dateTime={ev.occurredAt}
                      title={formatDateTimeFull(ev.occurredAt)}
                      className="text-muted-foreground tabular-nums"
                    >
                      {formatDateTime(ev.occurredAt)}
                    </time>
                  </div>
                  {(ev.note || ev.location) && (
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-foreground">
                      {ev.note && <span>{ev.note}</span>}
                      {ev.location && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <MapPin aria-hidden="true" className="size-3 shrink-0" />
                          {ev.location}
                        </span>
                      )}
                    </p>
                  )}
                </li>
              )
            })}
          </ol>

          {sortedEvents.length > COLLAPSED_EVENT_LIMIT && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setExpanded((prev) => !prev)}
            >
              {expanded ? (
                <>
                  <ChevronUp aria-hidden="true" />
                  {t('detail.tracking.collapse')}
                </>
              ) : (
                <>
                  <ChevronDown aria-hidden="true" />
                  {t('detail.tracking.expand', { count: sortedEvents.length })}
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
