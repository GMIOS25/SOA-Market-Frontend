import { useQuery } from '@tanstack/react-query'
import { PackageSearch, Store } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ApiError } from '@/api/errors'
import { ServiceFallbackBanner } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { apiGetPublicShop, apiGetSellerShop, fallbackShopName } from '@/features/cart-checkout-order/api'
import { hasRole } from '@/lib/auth/roles'
import { useAuthSession } from '@/lib/auth/session'
import { formatNumber } from '@/lib/format'
import { apiGetProduct, apiListPublicCategories, catalogKeys, type Category, type Product } from '../api'
import { ProductGallery } from '../components/ProductGallery'
import { ProductReviewsSection } from '../components/ProductReviewsSection'
import { PurchasePanel } from '../components/PurchasePanel'
import { RatingStars } from '../components/RatingStars'
import { StorefrontMessage, focusLinkClass } from '../components/StorefrontState'
import { productImageUrl } from '../media'
import { activeVariants, categoryHref, findCategoryPath } from '../storefront-helpers'

function ProductDetailSkeleton() {
  const { t } = useTranslation('catalog')
  return (
    // `role="status"` để trình đọc màn hình đọc được câu đang tải; `aria-label` trên một `div` sẽ bị bỏ qua.
    <div role="status">
      <span className="sr-only">{t('detail.loading')}</span>
      <div aria-hidden="true" className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Skeleton className="aspect-square w-full rounded-lg" />
        </div>
        <div className="space-y-4 lg:col-span-7">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-56" />
        </div>
      </div>
    </div>
  )
}

/** D9: người mua mở sản phẩm nháp/ẩn/đã xóa (backend trả 404). */
function ProductNotFound() {
  const { t } = useTranslation('catalog')
  return (
    <StorefrontMessage
      icon={<PackageSearch aria-hidden="true" />}
      title={t('detail.notFoundTitle')}
      description={t('detail.notFoundDescription')}
      action={
        <Button asChild>
          <Link to="/products">{t('detail.backToSearch')}</Link>
        </Button>
      }
    />
  )
}

type ProductViewProps = {
  product: Product
  categories: Category[]
  isLoggedIn: boolean
  isOwner: boolean
  /** Đang kiểm tra người xem có phải chủ gian hàng (xem PurchasePanel). */
  checkingOwnership: boolean
}

/** Thân trang chi tiết: breadcrumb, ảnh, khối mua hàng, mô tả, thông tin, đánh giá. */
function ProductView({ product, categories, isLoggedIn, isOwner, checkingOwnership }: ProductViewProps) {
  const { t } = useTranslation('catalog')
  const descriptionId = useId()
  const detailsId = useId()

  // D11: tên gian hàng lấy từ SVC-SEL; lỗi thì dùng tên dự phòng, không ảnh hưởng phần còn lại.
  const shopQuery = useQuery({
    queryKey: ['shop', 'public', product.shopId],
    queryFn: () => apiGetPublicShop(product.shopId),
    retry: false,
    staleTime: 5 * 60_000,
  })

  // D14: breadcrumb qua cây danh mục công khai; danh mục đang ẩn thì bỏ vế đó.
  const categoryPath = findCategoryPath(categories, product.categoryId)
  // D12: `imageRef` là object key → ghép thành URL; thiếu thì gallery vẽ nền thay thế.
  const imageUrls = (product.images ?? [])
    .map(productImageUrl)
    .filter((url): url is string => url !== undefined)
  const weights = activeVariants(product.variants ?? []).map((variant) => variant.weightGram)
  const minWeight = weights.length > 0 ? Math.min(...weights) : 0
  const maxWeight = weights.length > 0 ? Math.max(...weights) : 0
  const isPreview = product.status !== 'ACTIVE'
  const shopName = shopQuery.data?.name || fallbackShopName(product.shopId)

  return (
    <article className="space-y-8">
      <nav aria-label={t('detail.breadcrumbLabel')}>
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <li>
            <Link to="/" className={focusLinkClass}>
              {t('detail.home')}
            </Link>
          </li>
          {categoryPath.map((node) => (
            <li key={node.categoryId} className="flex items-center gap-1">
              <span aria-hidden="true">/</span>
              <Link to={categoryHref(node.categoryId)} className={focusLinkClass}>
                {node.name}
              </Link>
            </li>
          ))}
          <li aria-current="page" className="flex min-w-0 items-center gap-1 font-medium text-foreground">
            <span aria-hidden="true">/</span>
            <span className="truncate">{product.name}</span>
          </li>
        </ol>
      </nav>

      {/* D9: backend chỉ trả sản phẩm không ACTIVE cho chủ gian hàng. */}
      {isPreview && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-md border border-status-warning-border bg-status-warning px-3 py-2 text-sm text-status-warning-foreground"
        >
          <span>{t('detail.previewBanner')}</span>
          <StatusBadge status={product.status} />
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <ProductGallery images={imageUrls} productName={product.name} />
        </div>
        <div className="min-w-0 space-y-5 lg:col-span-7">
          <header className="space-y-2">
            {product.brand && <p className="text-sm font-medium text-primary">{product.brand}</p>}
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{product.name}</h1>
            <RatingStars average={product.ratingAvg} count={product.ratingCount} />
          </header>

          <PurchasePanel
            product={product}
            isLoggedIn={isLoggedIn}
            isOwner={isOwner}
            isPreview={isPreview}
            checkingOwnership={checkingOwnership}
          />

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t('detail.shopLabel')}</p>
              <p className="truncate font-medium text-foreground">{shopName}</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to={`/shops/${product.shopId}`}>
                <Store aria-hidden="true" />
                {t('detail.viewShop')}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <section aria-labelledby={descriptionId} className="rounded-lg border border-border bg-card p-4 sm:p-6">
        <h2 id={descriptionId} className="mb-3 text-xl font-semibold tracking-tight text-foreground">
          {t('detail.descriptionTitle')}
        </h2>
        {product.description ? (
          <p className="text-sm leading-7 whitespace-pre-line text-foreground">{product.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{t('detail.noDescription')}</p>
        )}
      </section>

      {(product.brand || weights.length > 0) && (
        <section aria-labelledby={detailsId} className="rounded-lg border border-border bg-card p-4 sm:p-6">
          <h2 id={detailsId} className="mb-3 text-xl font-semibold tracking-tight text-foreground">
            {t('detail.detailsTitle')}
          </h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            {product.brand && (
              <div className="contents">
                <dt className="text-muted-foreground">{t('detail.brandLabel')}</dt>
                <dd className="text-foreground">{product.brand}</dd>
              </div>
            )}
            {weights.length > 0 && (
              <div className="contents">
                <dt className="text-muted-foreground">{t('detail.weight')}</dt>
                <dd className="tabular-nums text-foreground">
                  {minWeight === maxWeight
                    ? t('detail.weightValue', { weight: formatNumber(minWeight) })
                    : t('detail.weightRange', { min: formatNumber(minWeight), max: formatNumber(maxWeight) })}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      <ProductReviewsSection product={product} />
    </article>
  )
}

/** Chi tiết sản phẩm (FR-PRD-004): người mua chỉ nhận sản phẩm hiển thị được, chủ gian hàng xem trước được sản phẩm nháp/ẩn. */
export function ProductDetailPage() {
  const { t } = useTranslation('catalog')
  const { id: productId = '' } = useParams()
  const { accessToken, user } = useAuthSession()
  const isSeller = hasRole(user, 'SELLER')

  const productQuery = useQuery({
    queryKey: catalogKeys.product(productId),
    queryFn: () => apiGetProduct(productId),
    enabled: productId !== '',
  })
  const categoriesQuery = useQuery({
    queryKey: catalogKeys.categories,
    queryFn: apiListPublicCategories,
    staleTime: 5 * 60_000,
  })
  // D8: so `shopId` với gian hàng của người xem (cùng query key với trang đơn nhà bán).
  const myShopQuery = useQuery({
    queryKey: ['seller', 'shop'],
    queryFn: apiGetSellerShop,
    enabled: isSeller && productQuery.data !== undefined,
    retry: false,
    staleTime: 5 * 60_000,
  })

  const product = productQuery.data
  if (!product) {
    if (productQuery.error instanceof ApiError && productQuery.error.status === 404) return <ProductNotFound />
    if (productQuery.error) {
      return (
        <ServiceFallbackBanner
          message={
            productQuery.error instanceof ApiError && productQuery.error.isServiceUnavailable
              ? t('detail.unavailable')
              : t('detail.loadError')
          }
          onRetry={() => void productQuery.refetch()}
          isRetrying={productQuery.isFetching}
        />
      )
    }
    return <ProductDetailSkeleton />
  }

  // Backend chỉ trả sản phẩm không ACTIVE cho chủ gian hàng, nên xem trước đồng nghĩa là chủ shop.
  const isOwner = product.status !== 'ACTIVE' || myShopQuery.data?.shopId === product.shopId
  // Chưa biết người xem có phải chủ shop thì chặn tạm nút mua; backend vẫn tự chặn 403 nếu bị vượt qua.
  const checkingOwnership = isSeller && myShopQuery.isPending

  return (
    <ProductView
      product={product}
      categories={categoriesQuery.data ?? []}
      isLoggedIn={Boolean(accessToken)}
      isOwner={isOwner}
      checkingOwnership={checkingOwnership}
    />
  )
}
