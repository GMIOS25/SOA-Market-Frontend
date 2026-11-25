import { useQuery } from '@tanstack/react-query'
import { FolderTree, PackageSearch } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ApiError } from '@/api/errors'
import { ServiceFallbackBanner } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiListPublicCategories, apiSearchProducts, catalogKeys } from '../api'
import { CategoryShowcase } from '../components/CategoryTree'
import { ProductCard } from '../components/ProductCard'
import { ProductGrid, ProductGridSkeleton } from '../components/ProductGrid'
import { StorefrontMessage } from '../components/StorefrontState'
import { StorefrontSection } from '../components/StorefrontSection'
import { HOME_SECTION_SIZE } from '../storefront-helpers'

type HomeSort = 'newest' | 'popular'

/** Một khối sản phẩm ở Trang chủ, với query riêng để lỗi chỉ làm giảm cấp khối đó (D5). */
function HomeProductSection({ sort, title, viewAllTo }: { sort: HomeSort; title: string; viewAllTo: string }) {
  const { t } = useTranslation('catalog')
  const query = useQuery({
    queryKey: catalogKeys.search({ sort, page: 1, pageSize: HOME_SECTION_SIZE }),
    queryFn: () => apiSearchProducts({ sort, page: 1, pageSize: HOME_SECTION_SIZE }),
    staleTime: 60_000,
  })
  const items = query.data?.data ?? []
  const unavailable = query.error instanceof ApiError && query.error.isServiceUnavailable

  return (
    <StorefrontSection
      title={title}
      action={
        <Button asChild variant="ghost" size="sm">
          <Link to={viewAllTo}>{t('home.viewAll')}</Link>
        </Button>
      }
    >
      {query.isPending ? (
        <ProductGridSkeleton />
      ) : query.isError ? (
        <ServiceFallbackBanner
          message={unavailable ? t('search.unavailable') : t('home.sectionLoadError')}
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
      ) : items.length === 0 ? (
        <StorefrontMessage icon={<PackageSearch aria-hidden="true" />} title={t('common.noProducts')} />
      ) : (
        <ProductGrid>
          {items.map((item) => (
            <ProductCard key={item.productId} product={item} />
          ))}
        </ProductGrid>
      )}
    </StorefrontSection>
  )
}

/** Trang chủ của cổng người mua: cây danh mục 2 cấp + "Sản phẩm mới nhất" + "Bán chạy". */
export function HomePage() {
  const { t } = useTranslation('catalog')
  const categoriesQuery = useQuery({
    queryKey: catalogKeys.categories,
    queryFn: apiListPublicCategories,
    staleTime: 5 * 60_000,
  })
  const categories = categoriesQuery.data ?? []

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t('home.title')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">{t('home.subtitle')}</p>
      </header>

      <StorefrontSection title={t('home.categoriesTitle')}>
        {categoriesQuery.isPending ? (
          <div role="status">
            <span className="sr-only">{t('home.categoriesLoading')}</span>
            <div
              aria-hidden="true"
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
            >
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-28 rounded-lg" />
              ))}
            </div>
          </div>
        ) : categoriesQuery.isError ? (
          <ServiceFallbackBanner
            message={t('home.categoriesLoadError')}
            onRetry={() => void categoriesQuery.refetch()}
            isRetrying={categoriesQuery.isFetching}
          />
        ) : categories.length === 0 ? (
          <StorefrontMessage icon={<FolderTree aria-hidden="true" />} title={t('home.noCategories')} />
        ) : (
          <CategoryShowcase categories={categories} />
        )}
      </StorefrontSection>

      <HomeProductSection sort="newest" title={t('home.newestTitle')} viewAllTo="/products" />
      <HomeProductSection sort="popular" title={t('home.popularTitle')} viewAllTo="/products?sort=popular" />
    </div>
  )
}
