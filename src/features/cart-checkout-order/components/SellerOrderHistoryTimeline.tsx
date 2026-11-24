import { History } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDateTime } from '@/lib/format'
import type { OrderStatusHistoryView } from '../seller-orders-api'

export type SellerOrderHistoryTimelineProps = {
  history: OrderStatusHistoryView[]
}

/** Dòng thời gian bất biến các bước chuyển trạng thái của SellerOrder (`order_status_history`). */
export function SellerOrderHistoryTimeline({ history }: SellerOrderHistoryTimelineProps) {
  const { t } = useTranslation('sellerOrders')

  const sorted = useMemo(
    () => [...history].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)),
    [history],
  )

  return (
    <section
      aria-labelledby="seller-order-history-heading"
      className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5"
    >
      <div className="border-b border-border pb-3">
        <h2 id="seller-order-history-heading" className="flex items-center gap-2 text-lg font-semibold">
          <History aria-hidden="true" className="size-5 text-primary" />
          <span>{t('history.title')}</span>
        </h2>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('history.empty')}</p>
      ) : (
        <ol className="space-y-3 border-l-2 border-border pl-4">
          {sorted.map((entry) => {
            const causeLabel = t(`history.causes.${entry.cause}` as never, {
              defaultValue: entry.cause,
            }) as string

            return (
              <li key={entry.historyId} className="relative space-y-1 text-sm">
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-border bg-card"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={entry.toStatus} />
                    <span className="font-medium text-foreground">{causeLabel}</span>
                  </div>
                  <time dateTime={entry.at} className="text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(entry.at)}
                  </time>
                </div>
                {entry.note && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{t('history.notePrefix')}</span> {entry.note}
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
