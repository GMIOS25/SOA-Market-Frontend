import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'

export type SummaryRow = {
  label: string
  value: string
  muted?: boolean
}

export type DesktopOrderSummaryProps = {
  title: string
  rows: SummaryRow[]
  totalLabel: string
  totalAmount: number
  ctaLabel: string
  onAction: () => void
  disabled?: boolean
  isPending?: boolean
  pendingLabel?: string
  notice?: ReactNode
  footerNote?: ReactNode
  className?: string
}

/**
 * Khối tổng kết đơn hàng sticky bên phải trên Desktop (`lg:col-span-4`, 04-UI-UX-Design-Brief §5.1).
 */
export function DesktopOrderSummary({
  title,
  rows,
  totalLabel,
  totalAmount,
  ctaLabel,
  onAction,
  disabled = false,
  isPending = false,
  pendingLabel,
  notice,
  footerNote,
  className,
}: DesktopOrderSummaryProps) {
  return (
    <aside
      aria-label={title}
      className={cn('rounded-lg border border-border bg-card p-5 shadow-xs lg:sticky lg:top-24', className)}
    >
      <h2 className="text-lg font-semibold">{title}</h2>

      <dl className="mt-4 space-y-2.5 text-sm tabular-nums">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className={cn('text-right font-medium', row.muted && 'text-muted-foreground')}>{row.value}</dd>
          </div>
        ))}
      </dl>

      <Separator className="my-4" />

      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-foreground">{totalLabel}</span>
        <span className="text-xl font-bold text-price tabular-nums">{formatVnd(totalAmount)}</span>
      </div>

      {notice && <div className="mt-4">{notice}</div>}

      <Button
        type="button"
        variant="cta"
        size="cta"
        disabled={disabled || isPending}
        onClick={onAction}
        className="mt-5 w-full"
      >
        {isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
        {isPending && pendingLabel ? pendingLabel : ctaLabel}
      </Button>

      {footerNote && <div className="mt-3 text-xs text-muted-foreground">{footerNote}</div>}
    </aside>
  )
}

export type MobileStickyBottomBarProps = {
  totalLabel: string
  totalAmount: number
  ctaLabel: string
  onAction: () => void
  disabled?: boolean
  isPending?: boolean
  pendingLabel?: string
  /** Tiện ích bên trái trên mobile (VD: checkbox "Tất cả" ở Giỏ hàng). */
  leading?: ReactNode
  className?: string
}

/**
 * Sticky Bottom Checkout Bar cho thiết bị di động từ 360px trở lên (04-UI-UX-Design-Brief §5.1, NFR-CMP-002).
 * Tap target nút chính ≥ 44px (`h-11`), bố cục gọn tránh tràn ngang ở chiều rộng 360px.
 */
export function MobileStickyBottomBar({
  totalLabel,
  totalAmount,
  ctaLabel,
  onAction,
  disabled = false,
  isPending = false,
  pendingLabel,
  leading,
  className,
}: MobileStickyBottomBarProps) {
  return (
    <div
      data-testid="mobile-sticky-bar"
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden',
        className,
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2.5">
        {leading && <div className="shrink-0">{leading}</div>}

        <div className="min-w-0 flex-1 text-right">
          <p className="truncate text-xs text-muted-foreground">{totalLabel}</p>
          <p className="truncate text-base font-bold text-price tabular-nums">{formatVnd(totalAmount)}</p>
        </div>

        <Button
          type="button"
          variant="cta"
          disabled={disabled || isPending}
          onClick={onAction}
          className="h-11 shrink-0 px-3.5 text-sm font-semibold"
        >
          {isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
          {isPending && pendingLabel ? pendingLabel : ctaLabel}
        </Button>
      </div>
    </div>
  )
}
