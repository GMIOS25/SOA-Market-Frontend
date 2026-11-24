import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

export type CheckoutStepsProps = {
  currentStep: 1 | 2 | 3
  className?: string
}

/**
 * Hiển thị tiến trình 3 màn hình cốt lõi (NFR-USA-002):
 * 1. Giỏ hàng (/cart) → 2. Đặt hàng (/checkout) → 3. Thanh toán (Cổng thanh toán / /checkout/result).
 */
export function CheckoutSteps({ currentStep, className }: CheckoutStepsProps) {
  const { t } = useTranslation('checkout')

  const steps = [
    { step: 1 as const, label: t('steps.shortCart'), to: currentStep === 2 ? '/cart' : undefined },
    { step: 2 as const, label: t('steps.shortCheckout'), to: undefined },
    { step: 3 as const, label: t('steps.shortPayment'), to: undefined },
  ]

  return (
    <nav aria-label={t('steps.ariaLabel')} className={cn('min-w-0', className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs sm:gap-2 sm:text-sm">
        {steps.map((item, idx) => {
          const isCurrent = item.step === currentStep
          const isDone = item.step < currentStep
          const pillClass = cn(
            'inline-flex items-center rounded-full border px-2.5 py-1 font-medium whitespace-nowrap transition-colors',
            isCurrent && 'border-primary bg-primary-soft text-primary',
            isDone && 'border-status-success-border bg-status-success text-status-success-foreground hover:opacity-90',
            !isCurrent && !isDone && 'border-border bg-card text-muted-foreground',
          )

          return (
            <li key={item.step} className="flex items-center gap-1.5 sm:gap-2">
              {idx > 0 && <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />}
              {item.to ? (
                <Link
                  to={item.to}
                  className={cn(pillClass, 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none')}
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isCurrent ? 'step' : undefined} className={pillClass}>
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
