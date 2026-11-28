import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { ProductReviewsPanel } from '@/features/reviews'
import type { Product } from '../api'
import { RatingStars } from './RatingStars'

/**
 * Khối đánh giá (D10). Điểm tổng hợp lấy từ SVC-PRD nên luôn hiển thị được. Danh sách đánh giá (T2-11) gọi
 * SVC-REV bằng MỘT query riêng trong `ProductReviewsPanel`: SVC-REV lỗi thì chỉ khối này hiện Fallback Banner,
 * phần còn lại của trang vẫn chạy (NFR-REL-005).
 */
export function ProductReviewsSection({ product }: { product: Product }) {
  const { t } = useTranslation('catalog')
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-6">
      <h2 id={titleId} className="text-xl font-semibold tracking-tight text-foreground">
        {t('detail.reviews.title')}
      </h2>
      <RatingStars average={product.ratingAvg} count={product.ratingCount} />
      <ProductReviewsPanel productId={product.productId} />
    </section>
  )
}
