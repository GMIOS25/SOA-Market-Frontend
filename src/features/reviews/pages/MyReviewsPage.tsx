import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, PackageCheck, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { ServiceFallbackBanner } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { productImageUrl } from '@/features/catalog-inventory/media'
import { formatDateTime } from '@/lib/format'
import {
  apiGetBuyerOrder,
  apiListBuyerOrders,
  REVIEWABLE_SELLER_ORDER_STATUSES,
  reviewKeys,
  type BuyerSellerOrderDetailView,
  type OrderItemView,
} from '../api'
import { ReviewForm } from '../components/ReviewForm'

/**
 * B13 `/account/reviews` (FR-REV-001). Nhận link từ chi tiết đơn (T4-07):
 *  - `?orderId&orderItemId` → đánh giá đúng 1 món,
 *  - `?orderId&sellerOrderId` → đánh giá từng món của 1 gói,
 *  - không tham số → liệt kê các gói đã giao để chọn.
 * SVC-REV không có API "món chờ đánh giá" nên món hàng được lấy từ SVC-ORD (`GET /v1/orders/{id}`).
 */
export function MyReviewsPage() {
  const { t } = useTranslation('reviews')
  const [params] = useSearchParams()
  const orderId = params.get('orderId')

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('mine.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('mine.subtitle')}</p>
      </header>
      {orderId ? (
        <OrderItemsToReview
          orderId={orderId}
          sellerOrderId={params.get('sellerOrderId')}
          orderItemId={params.get('orderItemId')}
        />
      ) : (
        <ReviewablePackages />
      )}
    </div>
  )
}

function OrderItemsToReview({
  orderId,
  sellerOrderId,
  orderItemId,
}: {
  orderId: string
  sellerOrderId: string | null
  orderItemId: string | null
}) {
  const { t } = useTranslation('reviews')
  const query = useQuery({
    queryKey: reviewKeys.buyerOrder(orderId),
    queryFn: () => apiGetBuyerOrder(orderId),
    retry: false,
  })

  const backLinks = (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size="sm">
        <Link to={`/account/orders/${encodeURIComponent(orderId)}`}>
          <ArrowLeft aria-hidden="true" />
          {t('mine.backToOrder')}
        </Link>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <Link to="/account/reviews">{t('mine.backToList')}</Link>
      </Button>
    </div>
  )

  if (query.isPending) return <Skeleton className="h-40 w-full" />
  if (query.isError) {
    return (
      <ServiceFallbackBanner
        message={t('mine.orderLoadError')}
        onRetry={() => void query.refetch()}
        isRetrying={query.isFetching}
      />
    )
  }

  const packages = (query.data.sellerOrders ?? []).filter((so) => {
    if (orderItemId) return (so.items ?? []).some((item) => item.orderItemId === orderItemId)
    if (sellerOrderId) return so.sellerOrderId === sellerOrderId
    return REVIEWABLE_SELLER_ORDER_STATUSES.has(so.status)
  })

  if (packages.length === 0) {
    return (
      <>
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{t('mine.itemNotFound')}</p>
        {backLinks}
      </>
    )
  }

  return (
    <>
      {packages.map((so) => (
        <PackageReviewSection
          key={so.sellerOrderId}
          orderCode={query.data.orderCode}
          sellerOrder={so}
          items={(so.items ?? []).filter((item) => !orderItemId || item.orderItemId === orderItemId)}
        />
      ))}
      {backLinks}
    </>
  )
}

function PackageReviewSection({
  orderCode,
  sellerOrder,
  items,
}: {
  orderCode: string
  sellerOrder: BuyerSellerOrderDetailView
  items: OrderItemView[]
}) {
  const { t } = useTranslation('reviews')
  const reviewable = REVIEWABLE_SELLER_ORDER_STATUSES.has(sellerOrder.status)
  const headingId = `package-${sellerOrder.sellerOrderId}`

  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-border bg-card shadow-xs">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 id={headingId} className="truncate font-semibold">
            {sellerOrder.shopName || t('mine.packageCode', { code: sellerOrder.sellerOrderCode })}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('mine.orderCode', { code: orderCode })} · {t('mine.packageCode', { code: sellerOrder.sellerOrderCode })}
            {sellerOrder.deliveredAt && <> · {formatDateTime(sellerOrder.deliveredAt)}</>}
          </p>
        </div>
        <StatusBadge status={sellerOrder.status} />
      </header>

      {!reviewable ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">{t('mine.notReviewable')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.orderItemId} className="flex flex-col gap-4 p-4">
              <div className="flex items-center gap-3">
                <div className="size-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                  {productImageUrl(item.imageRef) && (
                    <img src={productImageUrl(item.imageRef)} alt="" className="size-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <Link to={`/products/${encodeURIComponent(item.productId)}`} className="line-clamp-2 font-medium hover:underline">
                    {item.productName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {item.variantLabel} · {t('mine.quantity', { count: item.quantity })}
                  </p>
                </div>
              </div>
              <ReviewForm orderItemId={item.orderItemId} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ReviewablePackages() {
  const { t } = useTranslation('reviews')
  const query = useQuery({
    queryKey: reviewKeys.buyerOrders,
    queryFn: () => apiListBuyerOrders(1, 20),
    retry: false,
  })

  if (query.isPending) return <Skeleton className="h-32 w-full" />
  if (query.isError) {
    return (
      <ServiceFallbackBanner
        message={t('mine.ordersLoadError')}
        onRetry={() => void query.refetch()}
        isRetrying={query.isFetching}
      />
    )
  }

  const packages = (query.data.items ?? []).flatMap((order) =>
    (order.sellerOrders ?? [])
      .filter((so) => REVIEWABLE_SELLER_ORDER_STATUSES.has(so.status))
      .map((so) => ({ order, so })),
  )

  return (
    <section aria-labelledby="reviewable-packages" className="flex flex-col gap-3">
      <div>
        <h2 id="reviewable-packages" className="text-lg font-semibold">
          {t('mine.pickTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('mine.pickDescription')}</p>
      </div>

      {packages.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          <PackageCheck aria-hidden="true" className="size-8" />
          {t('mine.noPackages')}
          <Button asChild variant="outline" size="sm">
            <Link to="/account/orders">{t('mine.toOrders')}</Link>
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {packages.map(({ order, so }) => (
            <li
              key={so.sellerOrderId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <p className="font-medium">{t('mine.packageCode', { code: so.sellerOrderCode })}</p>
                <p className="text-xs text-muted-foreground">
                  {t('mine.orderCode', { code: order.orderCode })} · {formatDateTime(order.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={so.status} />
                <Button asChild size="sm">
                  <Link
                    to={`/account/reviews?orderId=${encodeURIComponent(order.orderId)}&sellerOrderId=${encodeURIComponent(so.sellerOrderId)}`}
                  >
                    <Star aria-hidden="true" />
                    {t('mine.pickAction')}
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
