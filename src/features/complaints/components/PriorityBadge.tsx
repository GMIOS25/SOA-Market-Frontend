import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { StatusBadge } from '@/components/ui/status-badge'
import type { StatusTone } from '@/lib/status'
import { cn } from '@/lib/utils'

const PRIORITY_TONE: Record<number, StatusTone> = {
  1: 'danger',
  2: 'warning',
  3: 'info',
  4: 'neutral',
}

export type PriorityBadgeProps = {
  priority: number
  className?: string
}

/** Hiển thị mức độ ưu tiên P1..P4 của khiếu nại kèm nhãn tiếng Việt (WCAG AA). */
export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const { t } = useTranslation('complaints')
  const tone = PRIORITY_TONE[priority] ?? 'neutral'
  const label = t(`common.priorities.${priority}` as never, {
    defaultValue: `P${priority}`,
  }) as string

  return (
    <StatusBadge
      status={`PRIORITY_${priority}`}
      tone={tone}
      label={label}
      className={className}
    />
  )
}

export type UnverifiedFlagBadgeProps = {
  className?: string
}

/** Cờ cảnh báo khiếu nại được mở lúc dịch vụ phụ gặp gián đoạn (`unverified_flag = true`). */
export function UnverifiedFlagBadge({ className }: UnverifiedFlagBadgeProps) {
  const { t } = useTranslation('complaints')

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-status-warning-border bg-status-warning px-2.5 py-0.5 text-xs leading-5 font-medium whitespace-nowrap text-status-warning-foreground',
        className,
      )}
    >
      <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />
      <span>{t('common.unverifiedBadge')}</span>
    </span>
  )
}
