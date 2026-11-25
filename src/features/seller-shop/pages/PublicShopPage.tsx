import { useQuery } from '@tanstack/react-query'
import { CalendarDays, FileText, Star, Store } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ApiError } from '@/api/errors'
import { ServiceFallbackBanner } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { DisclosurePanel } from '@/components/ui/disclosure-panel'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDate, formatNumber } from '@/lib/format'
import { apiGetPublicShop, sellerShopKeys } from '../api'
import { ShopProductsSection } from '../components/ShopProductsSection'
import { ShopReviewsSummarySection } from '../components/ShopReviewsSummarySection'

/** B4 `/shops/:id` — Trang gian hàng công khai kết hợp SVC-SEL + SVC-PRD + SVC-REV giảm cấp (FR-SEL-005, TC-SEL-05). */
export function PublicShopPage() {
  const { t } = useTranslation('sellerShop')
  const { id = '' } = useParams()

  const query = useQuery({
    queryKey: sellerShopKeys.publicShop(id),
    queryFn: () => apiGetPublicShop(id),
    enabled: Boolean(id),
    retry: false,
  })

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return (
        <section className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center shadow-xs">
          <Store aria-hidden="true" className="size-10 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold">{t('publicShop.unavailable.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('publicShop.unavailable.description')}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="outline">
              <Link to="/">{t('publicShop.unavailable.goHome')}</Link>
            </Button>
            <Button asChild>
              <Link to="/products">{t('publicShop.unavailable.browseProducts')}</Link>
            </Button>
          </div>
        </section>
      )
    }

    return (
      <ServiceFallbackBanner
        message={t('publicShop.loadError')}
        onRetry={() => void query.refetch()}
        isRetrying={query.isFetching}
      />
    )
  }

  const shop = query.data
  if (!shop) return null

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="public-shop-name"
        className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-xs"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
            {shop.logoUrl ? (
              <img src={shop.logoUrl} alt={shop.name} className="size-full object-cover" />
            ) : (
              <Store aria-hidden="true" className="size-8 text-muted-foreground" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 id="public-shop-name" className="text-2xl font-bold tracking-tight">
                {shop.name}
              </h1>
              <StatusBadge status="ACTIVE" />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Star aria-hidden="true" className="size-4 text-status-warning-foreground" />
                {shop.ratingCount > 0
                  ? t('publicShop.hero.rating', {
                      avg: shop.ratingAvg.toFixed(1),
                      count: formatNumber(shop.ratingCount),
                    })
                  : t('publicShop.hero.noRating')}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays aria-hidden="true" className="size-4" />
                {t('publicShop.hero.joinedAt', { date: formatDate(shop.createdAt) })}
              </span>
            </div>

            {shop.description && <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{shop.description}</p>}
          </div>
        </div>

        {shop.policy && (
          <DisclosurePanel
            title={t('publicShop.hero.policyTitle')}
            icon={<FileText aria-hidden="true" />}
            variant="plain"
          >
            <p className="whitespace-pre-line text-sm text-muted-foreground">{shop.policy}</p>
          </DisclosurePanel>
        )}
      </section>

      <ShopReviewsSummarySection
        shopId={shop.shopId}
        fallbackAvg={shop.ratingAvg}
        fallbackCount={shop.ratingCount}
      />

      <ShopProductsSection shopId={shop.shopId} />
    </div>
  )
}
