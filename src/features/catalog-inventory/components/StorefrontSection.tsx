import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type StorefrontSectionProps = {
  title: string
  /** Nút hoặc link ở đầu khối, VD "Xem tất cả". */
  action?: ReactNode
  children: ReactNode
  className?: string
}

/** Khối nội dung của cổng người mua: tiêu đề H2 + nút hành động bên phải. */
export function StorefrontSection({ title, action, children, className }: StorefrontSectionProps) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}
