import { cva } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { getStatusTone, isKnownStatus, type StatusTone } from '@/lib/status'
import { cn } from '@/lib/utils'

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs leading-5 font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-status-neutral-border bg-status-neutral text-status-neutral-foreground',
        info: 'border-status-info-border bg-status-info text-status-info-foreground',
        warning: 'border-status-warning-border bg-status-warning text-status-warning-foreground',
        success: 'border-status-success-border bg-status-success text-status-success-foreground',
        danger: 'border-status-danger-border bg-status-danger text-status-danger-foreground',
      } satisfies Record<StatusTone, string>,
    },
  },
)

type StatusBadgeProps = Omit<ComponentProps<'span'>, 'children'> & {
  /** Mã trạng thái từ API, VD `AWAITING_CONFIRMATION`. */
  status: string
  /** Ghi đè tông màu khi cùng 1 mã mang nghĩa khác theo ngữ cảnh. */
  tone?: StatusTone
}

/** Pill badge trạng thái: nền nhạt + chữ đậm + chấm tròn + nhãn tiếng Việt (Brief §2.2). */
export function StatusBadge({ status, tone, className, ...props }: StatusBadgeProps) {
  const { t } = useTranslation('status')
  const label = isKnownStatus(status) ? t(status) : status

  return (
    <span
      data-slot="status-badge"
      className={cn(statusBadgeVariants({ tone: tone ?? getStatusTone(status) }), className)}
      {...props}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      {label}
    </span>
  )
}
