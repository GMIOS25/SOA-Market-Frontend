import { CloudOff, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ServiceFallbackBannerProps = {
  /** Thông điệp thân thiện, VD "Tạm thời không thể tải danh sách đánh giá." */
  message?: string
  /** Gọi `refetch()` của RIÊNG query dịch vụ lỗi — không reload cả trang. */
  onRetry?: () => void
  /** Truyền `query.isFetching` để hiện trạng thái đang thử lại. */
  isRetrying?: boolean
  className?: string
}

/**
 * Giảm cấp có kiểm soát (NFR-REL-005, SOA-R09): khi SVC-REV / SVC-NTF / SVC-RPT / tracking SVC-SHP lỗi,
 * chỉ khối đó hiện banner gọn nhẹ — tuyệt đối không trắng trang hay lỗi 500 toàn trang.
 *
 * @example
 *   if (reviews.isError) return <ServiceFallbackBanner message="..." onRetry={reviews.refetch} isRetrying={reviews.isFetching} />
 */
export function ServiceFallbackBanner({ message, onRetry, isRetrying = false, className }: ServiceFallbackBannerProps) {
  const { t } = useTranslation('shared')

  return (
    <div
      role="status"
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-dashed border-fallback-border bg-fallback p-4 text-sm text-fallback-foreground sm:flex-row sm:items-center',
        className,
      )}
    >
      <div className="flex flex-1 items-start gap-2">
        <CloudOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p>{message ?? t('fallback.defaultMessage')}</p>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={isRetrying}
          className="self-start sm:self-auto"
        >
          <RotateCw aria-hidden="true" className={cn(isRetrying && 'animate-spin')} />
          {isRetrying ? t('fallback.retrying') : t('fallback.retry')}
        </Button>
      )}
    </div>
  )
}
