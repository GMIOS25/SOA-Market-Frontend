import { Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

/** Số sao (1–5) của 1 đánh giá; có nhãn cho trình đọc màn hình (WCAG 1.1.1). */
export function ReviewStars({ stars, className }: { stars: number; className?: string }) {
  const { t } = useTranslation('reviews')
  return (
    <span role="img" aria-label={t('stars.aria', { count: stars })} className={cn('inline-flex gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          aria-hidden="true"
          className={cn('size-4', value <= stars ? 'fill-current text-primary' : 'text-muted-foreground/40')}
        />
      ))}
    </span>
  )
}
