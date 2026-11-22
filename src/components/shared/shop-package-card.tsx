import { ImageOff, Store } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDate, formatVnd, type DateInput } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CopyableId } from './copyable-id'

/*
 * <ShopPackageCard /> — minh bạch đa nhà bán (NFR-USA-005, Brief §4.2.1). Ghép từ 3 phần để dùng chung cho
 * Giỏ hàng (checkbox), Checkout (phí ship/ETA), Chi tiết đơn Buyer (hành trình) và Đơn của Seller:
 *
 *   <ShopPackageCard shop={...} status="AWAITING_CONFIRMATION" code={...} sla={<SlaCountdownPill .../>}
 *                    footer={<ShopPackageSummary .../>} actions={<Button>Hủy gói hàng này</Button>}>
 *     {items.map((item) => <ShopPackageItem key={item.id} {...item} />)}
 *   </ShopPackageCard>
 */

export type ShopPackageCardProps = {
  shop: { id: string; name: string }
  /** Trạng thái riêng của SellerOrder. Bỏ trống ở Giỏ hàng/Checkout (chưa có đơn). */
  status?: string
  /** Mã SellerOrder: `value` để copy (UUID), `display` để hiển thị gọn. */
  code?: { value: string; display?: string }
  /** VD <SlaCountdownPill /> cho T_CONFIRM / T_COMPLETE. */
  sla?: ReactNode
  /** Phần tử đặt trước icon gian hàng — VD checkbox "chọn cả shop" ở Giỏ hàng. */
  headerStart?: ReactNode
  /** Cảnh báo cấp gói, VD "Nhà bán không hỗ trợ giao tới địa chỉ này" hoặc <ServiceFallbackBanner />. */
  notice?: ReactNode
  /** Danh sách <ShopPackageItem />. */
  children: ReactNode
  /** Thường là <ShopPackageSummary />. */
  footer?: ReactNode
  /** Hành động riêng của gói: Hủy gói / Đã nhận hàng / In nhãn / Theo dõi hành trình. */
  actions?: ReactNode
  /** Đường dẫn trang gian hàng; mặc định `/shops/:id`. `null` = không link (VD trong cổng Seller). */
  shopHref?: string | null
  className?: string
}

export function ShopPackageCard({
  shop,
  status,
  code,
  sla,
  headerStart,
  notice,
  children,
  footer,
  actions,
  shopHref,
  className,
}: ShopPackageCardProps) {
  const { t } = useTranslation('shared')
  const titleId = useId()
  const href = shopHref === undefined ? `/shops/${shop.id}` : shopHref

  return (
    <article
      aria-labelledby={titleId}
      className={cn('overflow-hidden rounded-lg border border-border bg-card shadow-xs', className)}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3">
        {headerStart}
        <Store aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        <h2 id={titleId} className="min-w-0 text-base font-semibold">
          <span className="sr-only">{t('package.shopIcon')}: </span>
          {href ? (
            <Link
              to={href}
              className="truncate rounded hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {shop.name}
            </Link>
          ) : (
            <span className="truncate">{shop.name}</span>
          )}
        </h2>
        {status && <StatusBadge status={status} />}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {code && <CopyableId value={code.value} display={code.display} label={t('package.code')} />}
          {sla}
        </div>
      </header>

      {notice && <div className="border-b border-border px-4 py-3">{notice}</div>}

      <ul aria-label={t('package.items')} className="divide-y divide-border">
        {children}
      </ul>

      {(footer || actions) && (
        <footer className="flex flex-col gap-3 border-t border-border bg-background/60 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">{footer}</div>
          {actions && <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div>}
        </footer>
      )}
    </article>
  )
}

export type ShopPackageItemProps = {
  /** Tên sản phẩm — với đơn hàng là bản chụp bất biến lúc đặt (BR-ORD-02). */
  name: string
  /** Nhãn biến thể, VD "Màu Đen / Size M". */
  variantLabel?: string
  imageUrl?: string
  quantity: number
  /** Đơn giá VND (đơn hàng: `unitPrice` đã chụp). */
  unitPrice: number
  href?: string
  /** Phần tử trước ảnh — VD checkbox chọn dòng ở Giỏ hàng. */
  start?: ReactNode
  /** Badge/cảnh báo của dòng: "Giá đã thay đổi", "Hết hàng"... */
  badges?: ReactNode
  /** Hành động bên phải dòng: stepper số lượng, nút xóa, nút "Đánh giá sản phẩm"... */
  end?: ReactNode
  /** Làm mờ dòng (hết hàng / bị ẩn / shop tạm ngưng — FR-CRT-003). */
  dimmed?: boolean
}

export function ShopPackageItem({
  name,
  variantLabel,
  imageUrl,
  quantity,
  unitPrice,
  href,
  start,
  badges,
  end,
  dimmed = false,
}: ShopPackageItemProps) {
  const { t } = useTranslation('shared')

  return (
    <li className={cn('flex items-start gap-3 px-4 py-3', dimmed && 'opacity-60')}>
      {start}
      <div className="size-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
        {imageUrl ? (
          <img src={imageUrl} alt={name} loading="lazy" className="size-full object-cover" />
        ) : (
          <ImageOff aria-hidden="true" className="m-auto size-full p-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {href ? (
          <Link to={href} className="line-clamp-2 text-sm font-medium hover:text-primary hover:underline">
            {name}
          </Link>
        ) : (
          <p className="line-clamp-2 text-sm font-medium">{name}</p>
        )}
        {variantLabel && <p className="text-xs text-muted-foreground">{variantLabel}</p>}
        {badges && <div className="flex flex-wrap gap-1.5">{badges}</div>}
        <p className="text-sm text-muted-foreground tabular-nums">
          {t('package.quantityTimesPrice', { quantity, price: formatVnd(unitPrice) })}
        </p>
      </div>
      {end && <div className="shrink-0">{end}</div>}
    </li>
  )
}

export type ShopPackageSummaryProps = {
  itemsAmount: number
  shippingFee?: number
  /** Đơn vị vận chuyển, VD "GHN". */
  carrier?: string
  etaAt?: DateInput
  /** SVC-SHP dùng bảng phí dự phòng (ASM-12) → nhãn "Phí ước tính". */
  isEstimatedFee?: boolean
}

/** Tách bạch Tiền hàng | Phí vận chuyển (ĐVVC + ETA) | Tổng gói hàng. */
export function ShopPackageSummary({ itemsAmount, shippingFee, carrier, etaAt, isEstimatedFee }: ShopPackageSummaryProps) {
  const { t } = useTranslation('shared')
  const total = itemsAmount + (shippingFee ?? 0)

  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm tabular-nums sm:max-w-sm">
      <dt className="text-muted-foreground">{t('package.itemsAmount')}</dt>
      <dd className="text-right">{formatVnd(itemsAmount)}</dd>
      {shippingFee !== undefined && (
        <>
          <dt className="text-muted-foreground">
            {isEstimatedFee ? t('package.estimatedFee') : t('package.shippingFee')}
            {carrier && <span className="ml-1 text-xs">({carrier})</span>}
            {etaAt && (
              <span className="block text-xs">{t('package.eta', { date: formatDate(etaAt) })}</span>
            )}
          </dt>
          <dd className="text-right">{formatVnd(shippingFee)}</dd>
        </>
      )}
      <dt className="font-semibold">{t('package.packageTotal')}</dt>
      <dd className="text-right font-semibold">{formatVnd(total)}</dd>
    </dl>
  )
}
