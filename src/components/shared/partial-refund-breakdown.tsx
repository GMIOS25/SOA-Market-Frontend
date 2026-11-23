import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatVnd } from '@/lib/format'
import { computeRefundBreakdown, type RefundLine } from '@/lib/refund'
import type { StatusTone } from '@/lib/status'
import { cn } from '@/lib/utils'

export type PartialRefundBreakdownProps = {
  /** `PaymentTransaction.amount` = `Order.grandTotal` đã thanh toán 1 lần (VND). */
  paidTotal: number
  /** Các gói SellerOrder đã hủy/hoàn. Mảng rỗng → không render gì. */
  refunds: readonly RefundLine[]
  className?: string
}

const REFUND_TONE: Record<RefundLine['status'], StatusTone> = {
  SUCCEEDED: 'success',
  PENDING: 'warning',
  PROCESSING: 'warning',
  FAILED: 'danger',
}

/**
 * Bảng đối chiếu hoàn tiền một phần ngay dưới header đơn tổng (FR-ORD-009, Brief §4.2.2):
 * Tổng đã thanh toán − Hoàn từng gói = Giá trị đơn thực tế còn lại. Tự ẩn khi chưa có gói nào hoàn.
 */
export function PartialRefundBreakdown({ paidTotal, refunds, className }: PartialRefundBreakdownProps) {
  const { t } = useTranslation('shared')
  const titleId = useId()
  if (refunds.length === 0) return null
  const { remaining } = computeRefundBreakdown(paidTotal, refunds)

  return (
    <section
      aria-labelledby={titleId}
      className={cn('rounded-lg border-l-4 border-primary bg-primary-soft p-4 tabular-nums', className)}
    >
      <h2 id={titleId} className="mb-2 text-sm font-semibold text-foreground">
        {t('refund.title')}
      </h2>
      <dl className="flex flex-col gap-1.5 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground">{t('refund.paidTotal')}</dt>
          <dd className="font-medium text-foreground">{formatVnd(paidTotal)}</dd>
        </div>
        {refunds.map((refund) => (
          <div key={refund.sellerOrderId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <dt className="flex flex-wrap items-center gap-2 text-muted-foreground">
              {t('refund.refundLine', { code: refund.sellerOrderCode, shop: refund.shopName })}
              <StatusBadge
                status={refund.status}
                tone={REFUND_TONE[refund.status]}
                label={t(`refund.status.${refund.status}`)}
              />
            </dt>
            <dd className="font-medium text-status-danger-foreground">- {formatVnd(refund.amount)}</dd>
          </div>
        ))}
        <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-status-info-border pt-2">
          <dt className="font-semibold text-foreground">{t('refund.remaining')}</dt>
          <dd className="text-base font-bold text-foreground">{formatVnd(remaining)}</dd>
        </div>
      </dl>
    </section>
  )
}
