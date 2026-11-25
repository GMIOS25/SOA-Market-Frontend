import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Package, Star } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ServiceFallbackBanner } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber, formatVnd } from '@/lib/format'
import { apiListShopProducts, sellerShopKeys, type ProductSummary, type ShopProductSort } from '../api'
import { resolveProductImageUrl } from '../file-utils'

const PAGE_SIZE = 20
const SORT_OPTIONS: ShopProductSort[] = ['newest', 'popular', 'price_asc', 'price_desc']

type ShopProductsSectionProps = {
  shopId: string
}

/** Danh sách sản phẩm công khai của gian hàng (`GET /v1/products?shopId=...`, SVC-PRD) với Fallback Banner khi SVC-PRD lỗi. */
export function ShopProductsSection({ shopId }: ShopProductsSectionProps) {
  const { t } = useTranslation('sellerShop')
  const [sort, setSort] = useState<ShopProductSort>('newest')
  const [page, setPage] = useState(1)

  const queryParams = { sort, page, pageSize: PAGE_SIZE }
  const query = useQuery({
    queryKey: sellerShopKeys.publicShopProducts(shopId, queryParams),
    queryFn: () => apiListShopProducts({ shopId, ...queryParams }),
    placeholderData: keepPreviousData,
    retry: false,
  })

  const products = query.data?.data ?? []
  const pagination = query.data?.pagination
  const hasError = query.isError && !query.data

  return (
    <section aria-labelledby="shop-products-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-2">
          <h2 id="shop-products-heading" className="text-lg font-semibold">
            {t('publicShop.products.title')}
          </h2>
          {pagination && (
            <span className="text-sm text-muted-foreground tabular-nums">
              ({t('publicShop.products.count', { count: pagination.totalItems })})
            </span>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t('publicShop.products.sortLabel')}</span>
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as ShopProductSort)
              setPage(1)
            }}
            className="h-9 rounded-md border border-input bg-card px-2.5 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t(`publicShop.products.sort.${option}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {query.isPending && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      )}

      {hasError && (
        <ServiceFallbackBanner
          message={t('publicShop.products.loadError')}
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
      )}

      {query.data && products.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card py-12 text-center text-sm text-muted-foreground">
          <Package aria-hidden="true" className="size-8" />
          {t('publicShop.products.empty')}
        </div>
      )}

      {products.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((product) => (
            <ProductCard key={product.productId} product={product} />
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-sm" aria-label={t('publicShop.products.pagination.summary', pagination)}>
          <span className="text-muted-foreground tabular-nums">{t('publicShop.products.pagination.summary', pagination)}</span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft aria-hidden="true" />
              {t('publicShop.products.pagination.prev')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages || query.isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('publicShop.products.pagination.next')}
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}
    </section>
  )
}

function ProductCard({ product }: { product: ProductSummary }) {
  const { t } = useTranslation('sellerShop')
  const [imgFailed, setImgFailed] = useState(false)
  const imageUrl = !imgFailed ? resolveProductImageUrl(product.images?.[0]) : null

  return (
    <Link
      to={`/products/${product.productId}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="size-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <Package aria-hidden="true" className="size-8" />
          </div>
        )}
        {!product.inStock && (
          <span className="absolute top-2 left-2 rounded-full border border-status-danger-border bg-status-danger px-2 py-0.5 text-xs font-medium text-status-danger-foreground">
            {t('publicShop.products.outOfStock')}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-medium group-hover:text-primary">{product.name}</h3>
        <p className="mt-auto text-base font-bold text-price tabular-nums">
          {product.maxPrice > product.minPrice
            ? `${formatVnd(product.minPrice)} – ${formatVnd(product.maxPrice)}`
            : formatVnd(product.minPrice)}
        </p>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
          <span className="inline-flex items-center gap-1">
            <Star aria-hidden="true" className="size-3.5 text-status-warning-foreground" />
            {product.ratingAvg.toFixed(1)} ({product.ratingCount})
          </span>
          <span>{t('publicShop.products.soldCount', { count: formatNumber(product.soldCount) })}</span>
        </div>
      </div>
    </Link>
  )
}
