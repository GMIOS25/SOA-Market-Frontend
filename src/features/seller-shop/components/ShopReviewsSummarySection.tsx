import { useQuery } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ServiceFallbackBanner } from '@/components/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/format'
import { apiGetPublicShopReviewsSummary, sellerShopKeys } from '../api'

const STARS = [5, 4, 3, 2, 1] as const

type ShopReviewsSummarySectionProps = {
  shopId: string
  fallbackAvg: number
  fallbackCount: number
}

/**
 * Khối tóm tắt đánh giá gian hàng gọi độc lập tới `SVC-REV` (`GET /v1/shops/{id}/reviews/summary`).
 * Khi `SVC-REV` chưa triển khai hoặc tạm gián đoạn, chỉ khối này hiện `<ServiceFallbackBanner />` (NFR-REL-005, TC-SEL-05).
 */
export function ShopReviewsSummarySection({ shopId, fallbackAvg, fallbackCount }: ShopReviewsSummarySectionProps) {
  const { t } = useTranslation('sellerShop')

  const query = useQuery({
    queryKey: sellerShopKeys.publicShopReviewsSummary(shopId),
    queryFn: () => apiGetPublicShopReviewsSummary(shopId),
    retry: false,
  })

  const data = query.data
  const avg = data?.avgStars ?? data?.ratingAvg ?? fallbackAvg
  const totalCount = data?.totalCount ?? data?.ratingCount ?? fallbackCount
  const starCounts = data?.starCounts ?? {}

  return (
    <section
      aria-labelledby="shop-reviews-heading"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-xs"
    >
      <h2 id="shop-reviews-heading" className="text-lg font-semibold">
        {t('publicShop.reviews.title')}
      </h2>

      {query.isPending && <Skeleton className="h-24 w-full" />}

      {query.isError && (
        <ServiceFallbackBanner
          message={t('publicShop.reviews.fallback')}
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
      )}

      {data && (
        <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex flex-col items-center rounded-lg border border-border bg-background px-6 py-4 text-center">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums">{avg.toFixed(1)}</span>
              <Star aria-hidden="true" className="size-5 text-status-warning-foreground" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {t('publicShop.reviews.totalCount', { count: formatNumber(totalCount) })}
            </p>
          </div>

          <ul className="flex flex-col gap-1.5 text-xs">
            {STARS.map((star) => {
              const count = starCounts[String(star)] ?? 0
              const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0
              return (
                <li key={star} className="flex items-center gap-3">
                  <span className="w-12 shrink-0 text-muted-foreground tabular-nums">
                    {t('publicShop.reviews.starLabel', { star })}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-right text-muted-foreground tabular-nums">
                    {formatNumber(count)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
