import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ServiceFallbackBanner } from '@/components/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { apiGetShopReviewSummary, RatingSummary, reviewKeys } from '@/features/reviews'

type ShopReviewsSummarySectionProps = {
  shopId: string
  fallbackAvg: number
  fallbackCount: number
}

/**
 * Khối tóm tắt đánh giá gian hàng gọi độc lập tới `SVC-REV` (`GET /v1/shops/{id}/reviews/summary`, kiểu sinh từ
 * `svc-rev.yaml`). SVC-REV gián đoạn thì chỉ khối này hiện `<ServiceFallbackBanner />` (NFR-REL-005, TC-SEL-05).
 * Điểm sao gian hàng là tổng hợp từ đánh giá sản phẩm của shop — không có đánh giá riêng cho gian hàng.
 */
export function ShopReviewsSummarySection({ shopId, fallbackAvg, fallbackCount }: ShopReviewsSummarySectionProps) {
  const { t } = useTranslation('sellerShop')

  const query = useQuery({
    queryKey: reviewKeys.shopSummary(shopId),
    queryFn: () => apiGetShopReviewSummary(shopId),
    retry: false,
  })
  const data = query.data

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
        <RatingSummary
          avgStars={data.avgStars ?? fallbackAvg}
          totalCount={data.totalCount ?? fallbackCount}
          starCounts={data.starCounts ?? {}}
        />
      )}
    </section>
  )
}
