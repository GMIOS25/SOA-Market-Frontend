import { ChevronDown, ChevronUp, MapPin } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDateTime, formatDateTimeFull } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TrackingEvent } from './api'
import { sortTrackingEvents } from './tracking'

type TimelineEvent = Omit<TrackingEvent, 'applied' | 'receivedAt'> & Partial<Pick<TrackingEvent, 'applied' | 'receivedAt'>>

export function ShipmentTrackingTimeline({ events, attempts, attemptLimit, showAll = false }: {
  events: readonly TimelineEvent[]
  attempts?: number
  attemptLimit?: number
  showAll?: boolean
}) {
  const { t } = useTranslation('paymentShipping')
  const { t: orderText } = useTranslation('orders')
  const [expanded, setExpanded] = useState(false)
  const eventsId = useId()
  const sorted = sortTrackingEvents(events)
  const latestApplied = sorted.find((event) => event.applied !== false)
  const preview = latestApplied ?? sorted[0]
  if (!preview) return <p className="text-xs text-muted-foreground">{orderText('detail.tracking.noEventsYet')}</p>
  const visible = showAll || expanded ? sorted : [preview]

  return (
    <div className="space-y-3">
      {Boolean(attempts) && (showAll || expanded || sorted.length === 1) && (
        <p className="text-xs text-muted-foreground tabular-nums">
          {attemptLimit ? t('tracking.attempts', { count: attempts, limit: attemptLimit }) : orderText('detail.tracking.deliveryAttempts', { count: attempts })}
        </p>
      )}
      <ol id={eventsId} className="ml-1.5 space-y-3 border-l border-border pl-4">
        {visible.map((event) => (
          <li key={event.eventId} className="relative space-y-1 text-xs">
            <span aria-hidden="true" className={cn('absolute top-1.5 -left-[21px] size-2.5 rounded-full ring-2 ring-card', event === latestApplied ? 'bg-primary' : 'bg-muted-foreground/40')} />
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={event.status} />
              <time dateTime={event.occurredAt} title={formatDateTimeFull(event.occurredAt)} className="tabular-nums text-muted-foreground">{formatDateTime(event.occurredAt)}</time>
              {event.applied === false && <span className="text-muted-foreground">{t('tracking.historyOnly')}</span>}
            </div>
            {event.note && <p className="break-words">{event.note}</p>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
              {event.location && <span className="inline-flex items-center gap-1"><MapPin aria-hidden="true" className="size-3 shrink-0" />{event.location}</span>}
              {event.attemptNo != null && <span>{t('tracking.attempt', { count: event.attemptNo })}</span>}
            </div>
          </li>
        ))}
      </ol>
      {!showAll && sorted.length > 1 && (
        <Button type="button" variant="ghost" size="sm" aria-expanded={expanded} aria-controls={eventsId} onClick={() => setExpanded((value) => !value)}>
          {expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          {expanded ? orderText('detail.tracking.collapse') : orderText('detail.tracking.expand', { count: sorted.length })}
        </Button>
      )}
    </div>
  )
}
