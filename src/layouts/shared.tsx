import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

/** Link "Bỏ qua đến nội dung chính" cho người dùng bàn phím/trình đọc màn hình (WCAG 2.4.1). */
export function SkipToContent() {
  const { t } = useTranslation()
  return (
    <a
      href="#main"
      className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
    >
      {t('skipToContent')}
    </a>
  )
}

export function BrandLogo({ to, compact = false, className }: { to: string; compact?: boolean; className?: string }) {
  const { t } = useTranslation()
  return (
    <Link
      to={to}
      className={cn(
        'flex shrink-0 items-center gap-2 rounded-md font-bold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        className,
      )}
    >
      <img src="/favicon.svg" alt="" className="size-8" />
      <span className={cn('text-lg', compact && 'sr-only')}>{t('appName')}</span>
    </Link>
  )
}
