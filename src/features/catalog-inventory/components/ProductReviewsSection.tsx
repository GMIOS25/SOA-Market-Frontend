import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { ServiceFallbackBanner } from '@/components/shared'
import { apiGetProductReviews, catalogKeys, type Product } from '../api'
import { RatingStars } from './RatingStars'

/**
 * Khối đánh giá (D10). Điểm tổng hợp lấy từ SVC-PRD nên luôn hiển thị được. Danh sách đánh giá gọi bằng
 * MỘT query riêng: SVC-REV lỗi thì chỉ khối này hiện Fallback Banner, phần còn lại của trang vẫn chạy
 * (NFR-REL-005). Việc hiển thị danh sách đánh giá thuộc T2-11; ở đây chỉ xử lý trạng thái và giảm cấp.
 */
export function ProductReviewsSection({ product }: { product: Product }) {
  const { t } = useTranslation('catalog')
  const titleId = useId()
  const reviewsQuery = useQuery({
    queryKey: catalogKeys.reviews(product.productId),
    queryFn: () => apiGetProductReviews(product.productId),
    retry: false,
    staleTime: 60_000,
  })

  return (
    <section aria-labelledby={titleId} className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-6">
      <h2 id={titleId} className="text-xl font-semibold tracking-tight text-foreground">
        {t('detail.reviews.title')}
      </h2>
      <RatingStars average={product.ratingAvg} count={product.ratingCount} />
      {reviewsQuery.isError ? (
        <ServiceFallbackBanner
          message={t('detail.reviews.loadError')}
          onRetry={() => void reviewsQuery.refetch()}
          isRetrying={reviewsQuery.isFetching}
        />
      ) : reviewsQuery.isSuccess && product.ratingCount === 0 ? (
        <p className="text-sm text-muted-foreground">{t('detail.reviews.empty')}</p>
      ) : null}
    </section>
  )
}
