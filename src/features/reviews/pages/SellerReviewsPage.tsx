import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { ServiceFallbackBanner } from '@/components/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { apiListSellerReviewProducts, reviewKeys } from '../api'
import { ProductReviewsPanel } from '../components/ProductReviewsPanel'

/**
 * S6 `/seller/reviews` (FR-REV-003, FR-REV-004): theo 03-App-Flow, nhà bán xem đánh giá THEO TỪNG SẢN PHẨM
 * (`GET /v1/products/{id}/reviews`), phản hồi 1 lần và báo cáo đánh giá vi phạm. Sản phẩm đang chọn nằm trên URL
 * (`?productId=`) để tải lại trang / chia sẻ link vẫn giữ lựa chọn.
 */
export function SellerReviewsPage() {
  const { t } = useTranslation('reviews')
  const selectId = useId()
  const [params, setParams] = useSearchParams()
  const productId = params.get('productId') ?? ''

  const productsQuery = useQuery({
    queryKey: reviewKeys.sellerProducts,
    queryFn: apiListSellerReviewProducts,
    retry: false,
  })
  const products = productsQuery.data ?? []

  return (
    <div className="flex flex-col gap-5">
      <header className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('seller.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('seller.subtitle')}</p>
      </header>

      {productsQuery.isPending && <Skeleton className="h-10 w-full max-w-md" />}

      {productsQuery.isError && (
        <ServiceFallbackBanner
          message={t('seller.productsLoadError')}
          onRetry={() => void productsQuery.refetch()}
          isRetrying={productsQuery.isFetching}
        />
      )}

      {productsQuery.isSuccess && products.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('seller.noProducts')}</p>
      )}

      {products.length > 0 && (
        <div className="flex max-w-md flex-col gap-1.5">
          <label htmlFor={selectId} className="text-sm font-medium">
            {t('seller.productLabel')}
          </label>
          <select
            id={selectId}
            value={productId}
            onChange={(event) =>
              setParams(event.target.value ? { productId: event.target.value } : {}, { replace: true })
            }
            className="h-10 rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <option value="">{t('seller.productPlaceholder')}</option>
            {products.map((product) => (
              <option key={product.productId} value={product.productId}>
                {product.productName}
              </option>
            ))}
          </select>
        </div>
      )}

      {productId ? (
        <section className="rounded-lg border border-border bg-card p-4 sm:p-6">
          {/* key: đổi sản phẩm → bộ lọc & trang về mặc định. */}
          <ProductReviewsPanel key={productId} productId={productId} mode="seller" />
        </section>
      ) : (
        products.length > 0 && <p className="text-sm text-muted-foreground">{t('seller.pickProduct')}</p>
      )}
    </div>
  )
}
