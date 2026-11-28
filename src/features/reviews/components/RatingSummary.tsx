import { Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/lib/format'

const STARS = [5, 4, 3, 2, 1] as const

type RatingSummaryProps = {
  avgStars: number
  totalCount: number
  /** Phân bố số sao, khóa "1".."5" (RatingSummaryDTO / ShopRatingSummaryDTO). */
  starCounts?: Record<string, number>
}

/** Điểm trung bình + thanh phân bố 5→1 sao — dùng chung cho trang sản phẩm và trang gian hàng (FR-REV-002). */
export function RatingSummary({ avgStars, totalCount, starCounts = {} }: RatingSummaryProps) {
  const { t } = useTranslation('reviews')

  return (
    <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
      <div className="flex flex-col items-center rounded-lg border border-border bg-background px-6 py-4 text-center">
        <p className="sr-only">{t('summary.average')}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold tabular-nums">{avgStars.toFixed(1)}</span>
          <Star aria-hidden="true" className="size-5 fill-current text-primary" />
        </div>
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          {t('summary.totalCount', { count: totalCount, formatted: formatNumber(totalCount) })}
        </p>
      </div>

      <ul className="flex flex-col gap-1.5 text-xs">
        {STARS.map((star) => {
          const count = starCounts[String(star)] ?? 0
          const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0
          return (
            <li key={star} className="flex items-center gap-3">
              <span className="w-12 shrink-0 text-muted-foreground tabular-nums">{t('summary.starLabel', { star })}</span>
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label={t('summary.starLabel', { star })}
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right text-muted-foreground tabular-nums">{formatNumber(count)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
