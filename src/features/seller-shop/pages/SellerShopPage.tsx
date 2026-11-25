import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, LockKeyhole, Star, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CopyableId, ServiceFallbackBanner } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { apiGetMyShop, sellerShopKeys, type ShopDTO } from '../api'
import { PickupAddressForm } from '../components/PickupAddressForm'
import { ShopProfileForm } from '../components/ShopProfileForm'
import { ShopStatusControls } from '../components/ShopStatusControls'

/** S2 `/seller/shop` — Quản lý thông tin gian hàng, địa chỉ lấy hàng & trạng thái (FR-SEL-003..004, T2-07). */
export function SellerShopPage() {
  const { t } = useTranslation('sellerShop')
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: sellerShopKeys.myShop,
    queryFn: apiGetMyShop,
    retry: false,
  })

  function handleUpdated(updated: ShopDTO) {
    queryClient.setQueryData(sellerShopKeys.myShop, updated)
  }

  const shop = query.data

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('sellerShop.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('sellerShop.subtitle')}</p>
        </div>
        {shop && (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={shop.status} />
            <CopyableId
              value={shop.shopId}
              display={shop.shopId.slice(0, 8).toUpperCase()}
              label={t('sellerShop.shopCode')}
            />
            {shop.status === 'ACTIVE' && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/shops/${shop.shopId}`}>
                  <ExternalLink aria-hidden="true" />
                  {t('sellerShop.viewPublic')}
                </Link>
              </Button>
            )}
          </div>
        )}
      </header>

      {query.isPending && (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {query.isError && (
        <ServiceFallbackBanner
          message={t('sellerShop.loadError')}
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
      )}

      {shop && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{shop.name}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Star aria-hidden="true" className="size-4 text-status-warning-foreground" />
              {t('sellerShop.ratingSummary', {
                avg: shop.ratingAvg.toFixed(1),
                count: shop.ratingCount,
              })}
            </span>
          </div>

          {shop.status === 'LOCKED' && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-status-danger-border bg-status-danger p-4 text-sm text-status-danger-foreground"
            >
              <LockKeyhole aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              <div className="flex flex-col gap-1">
                <p className="font-semibold">{t('sellerShop.alerts.lockedTitle')}</p>
                <p>{t('sellerShop.alerts.lockedDescription')}</p>
                {shop.statusReason && (
                  <p className="mt-1 font-medium">
                    {t('sellerShop.alerts.reasonPrefix')} {shop.statusReason}
                  </p>
                )}
              </div>
            </div>
          )}

          {shop.status === 'SUSPENDED' && (
            <div
              role="status"
              className="flex items-start gap-3 rounded-lg border border-status-warning-border bg-status-warning p-4 text-sm text-status-warning-foreground"
            >
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              <div className="flex flex-col gap-1">
                <p className="font-semibold">
                  {shop.statusChangedBy === 'ADMIN'
                    ? t('sellerShop.alerts.suspendedByAdminTitle')
                    : t('sellerShop.alerts.suspendedBySellerTitle')}
                </p>
                <p>
                  {shop.statusChangedBy === 'ADMIN'
                    ? t('sellerShop.alerts.suspendedByAdminDescription')
                    : t('sellerShop.alerts.suspendedBySellerDescription')}
                </p>
                {shop.statusReason && (
                  <p className="mt-1 font-medium">
                    {t('sellerShop.alerts.reasonPrefix')} {shop.statusReason}
                  </p>
                )}
              </div>
            </div>
          )}

          {!shop.pickupAddress && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-lg border border-status-danger-border bg-status-danger p-4 text-sm text-status-danger-foreground sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                <div className="flex flex-col gap-1">
                  <p className="font-semibold">{t('sellerShop.alerts.missingPickupTitle')}</p>
                  <p>{t('sellerShop.alerts.missingPickupDescription')}</p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="self-start sm:self-auto">
                <a href="#pickup-address-section">{t('sellerShop.alerts.goToPickup')}</a>
              </Button>
            </div>
          )}

          <ShopProfileForm shop={shop} onUpdated={handleUpdated} />
          <PickupAddressForm shop={shop} onUpdated={handleUpdated} />
          <ShopStatusControls shop={shop} onUpdated={handleUpdated} />
        </>
      )}
    </div>
  )
}
