import { History } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DisclosurePanel } from '@/components/ui/disclosure-panel'
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
    <DisclosurePanel
      title={t('history.title')}
      summary={t('history.count', { count: sorted.length })}
      icon={<History />}
    >
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
    </DisclosurePanel>
  )
}
