import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDateTimeFull, formatTime, type DateInput } from '@/lib/format'
import { cn } from '@/lib/utils'

export type SyncTimestampBadgeProps = {
  /** Thời điểm read model của SVC-RPT được cập nhật (ISO UTC). Bỏ trống → "Chưa đồng bộ". */
  syncedAt?: DateInput | null
  /** Làm mới query đọc từ SVC-RPT. */
  onRefresh?: () => void
  isRefreshing?: boolean
  className?: string
}

/**
 * Chip nhất quán cuối cùng ở thanh tiêu đề các màn hình đọc từ SVC-RPT (FR-ADM-001 E1, FR-RPT-001):
 * chấm xanh + "Đồng bộ sự kiện lúc 10:42:15" + nút làm mới.
 */
export function SyncTimestampBadge({ syncedAt, onRefresh, isRefreshing = false, className }: SyncTimestampBadgeProps) {
  const { t } = useTranslation('shared')
  const hasSync = syncedAt !== undefined && syncedAt !== null

  return (
    <span
      className={cn(
        'inline-flex h-8 items-center gap-2 rounded-full border border-border bg-card pr-1 pl-3 text-xs text-muted-foreground tabular-nums',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('size-2 rounded-full', hasSync ? 'bg-status-success-foreground' : 'bg-input')}
      />
      {hasSync ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              {t('sync.syncedAt', { time: formatTime(syncedAt) })}
            </span>
          </TooltipTrigger>
          <TooltipContent>{t('sync.eventual', { datetime: formatDateTimeFull(syncedAt) })}</TooltipContent>
        </Tooltip>
      ) : (
        <span>{t('sync.never')}</span>
      )}
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label={t('sync.refresh')}
          className="inline-flex size-6 items-center justify-center rounded-full hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
        >
          <RefreshCw aria-hidden="true" className={cn('size-3.5', isRefreshing && 'animate-spin')} />
        </button>
      )}
    </span>
  )
}
