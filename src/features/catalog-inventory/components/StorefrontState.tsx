import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Lớp dùng chung cho link chữ (breadcrumb, link trong thông báo). */
export const focusLinkClass =
  'rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

export type StorefrontMessageProps = {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

/** Trạng thái rỗng hoặc không có kết quả: icon tròn + tiêu đề + mô tả + nút hành động. */
export function StorefrontMessage({ icon, title, description, action, className }: StorefrontMessageProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-12 text-center',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground [&>svg]:size-7"
      >
        {icon}
      </div>
      <p className="text-lg font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  )
}
