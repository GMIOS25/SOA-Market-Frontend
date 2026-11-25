import { Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export type RatingStarsProps = {
  /** Điểm trung bình 0–5. */
  average: number
  count: number
  className?: string
}

/** "★ 4.8 (124)" (Brief §4.1). Chưa có đánh giá thì hiện chữ thay vì "0.0 (0)". */
export function RatingStars({ average, count, className }: RatingStarsProps) {
  const { t } = useTranslation('catalog')
  if (count <= 0) {
    return <span className={cn('text-xs text-muted-foreground', className)}>{t('common.noRating')}</span>
  }
  const filled = Math.round(average)
  return (
    // Cho phép xuống dòng: ở 360 px thẻ chỉ rộng khoảng 134 px, số lượng đánh giá 4 chữ số sẽ tràn nếu giữ một dòng.
    <span
      role="img"
      aria-label={t('common.ratingAria', { average: average.toFixed(1), count })}
      className={cn('inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-muted-foreground', className)}
    >
      <span aria-hidden="true" className="inline-flex gap-0.5">
        {[0, 1, 2, 3, 4].map((index) => (
          <Star
            key={index}
            className={cn(
              'size-3 sm:size-3.5',
              index < filled ? 'fill-current text-primary' : 'text-muted-foreground/40',
            )}
          />
        ))}
      </span>
      <span aria-hidden="true" className="font-medium text-foreground tabular-nums">
        {average.toFixed(1)}
      </span>
      <span aria-hidden="true" className="tabular-nums">
        ({count})
      </span>
    </span>
  )
}
