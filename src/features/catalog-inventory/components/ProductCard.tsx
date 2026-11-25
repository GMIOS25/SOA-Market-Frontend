import { ImageOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ProductSummary } from '../api'
import { productImageUrl } from '../media'
import { RatingStars } from './RatingStars'

export type ProductCardProps = {
  product: ProductSummary
  className?: string
}

/** Thẻ sản phẩm của cổng người mua (Brief §4.1): ảnh 1:1, tên tối đa 2 dòng, giá VND, sao đánh giá, lượt bán. */
export function ProductCard({ product, className }: ProductCardProps) {
  const { t } = useTranslation('catalog')
  const imageUrl = productImageUrl(product.images?.[0])
  const price =
    product.minPrice === product.maxPrice
      ? formatVnd(product.minPrice)
      : t('common.priceRange', { min: formatVnd(product.minPrice), max: formatVnd(product.maxPrice) })

  return (
    <li className={cn('min-w-0', className)}>
      <Link
        to={`/products/${product.productId}`}
        className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xs transition-colors hover:border-input focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          {imageUrl ? (
            <img src={imageUrl} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageOff aria-hidden="true" className="size-10" />
            </div>
          )}
          {!product.inStock && (
            <span className="absolute inset-x-0 bottom-0 bg-foreground/70 px-2 py-1 text-center text-xs font-medium text-background">
              {t('common.outOfStock')}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-3">
          {product.brand && <p className="truncate text-xs text-muted-foreground">{product.brand}</p>}
          <h3 className="line-clamp-2 min-h-10 text-sm font-medium leading-5 text-foreground">{product.name}</h3>
          <p className="text-base font-semibold text-foreground tabular-nums">{price}</p>
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <RatingStars average={product.ratingAvg} count={product.ratingCount} />
            {product.soldCount > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {t('common.sold', { count: formatNumber(product.soldCount) })}
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  )
}
