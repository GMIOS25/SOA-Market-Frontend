import { Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatDateTime, type DateInput } from '@/lib/format'
import { formatDuration, getSlaState, type SlaTone } from '@/lib/sla'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'

export type SlaCountdownPillProps = {
  /** Hạn chót (ISO UTC), VD `confirmDueAt`, `paymentDueAt`, hạn phản hồi khiếu nại. */
  deadline: DateInput
  /** Mốc bắt đầu tính hạn để xác định ngưỡng cảnh báo 25%. Bỏ trống → chỉ có bình thường / quá hạn. */
  startedAt?: DateInput
  /** Nhãn ngắn phía trước, VD "Xác nhận" → "Xác nhận · Còn 3 giờ 5 phút". */
  label?: string
  className?: string
}

const TONE_CLASS: Record<SlaTone, string> = {
  normal: 'border-border bg-card text-sla-normal',
  warning: 'border-status-warning-border bg-status-warning text-sla-warning font-semibold',
  overdue: 'border-status-danger-border bg-status-danger text-sla-overdue font-semibold',
}

function toIso(input: DateInput): string {
  return new Date(typeof input === 'string' ? Date.parse(input) : input).toISOString()
}

/**
 * Đồng hồ đếm ngược hạn nghiệp vụ T_PAY / T_CONFIRM / T_CPL_SELLER / T_CPL_NEGOTIATE (Brief §4.2.4):
 * > 25% thời gian: xám · ≤ 25%: cam đậm · quá hạn: đỏ "Quá hạn 2 giờ". Luôn kèm chữ, không chỉ dùng màu.
 */
export function SlaCountdownPill({ deadline, startedAt, label, className }: SlaCountdownPillProps) {
  const { t } = useTranslation('shared')
  const now = useNow()
  const { tone, remainingMs } = getSlaState({ deadline, startedAt, now })

  const text = t(tone === 'overdue' ? 'sla.overdue' : 'sla.remaining', { duration: formatDuration(remainingMs) })
  const deadlineText = t('sla.deadline', { date: formatDateTime(deadline) })

  return (
    <span
      // role="timer" không tự đọc mỗi giây (aria-live mặc định off) — tránh làm phiền trình đọc màn hình.
      role="timer"
      aria-label={`${label ? `${label}: ` : ''}${text}. ${deadlineText}`}
      title={deadlineText}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs leading-5 whitespace-nowrap tabular-nums',
        TONE_CLASS[tone],
        className,
      )}
    >
      <Clock aria-hidden="true" className="size-3.5 shrink-0" />
      {label && <span className="font-medium">{label} ·</span>}
      <time dateTime={toIso(deadline)}>{text}</time>
    </span>
  )
}
