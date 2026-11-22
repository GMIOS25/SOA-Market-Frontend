import type { DateInput } from './format'

/**
 * Trạng thái đếm ngược hạn nghiệp vụ T_PAY / T_CONFIRM / T_CPL_SELLER / T_CPL_NEGOTIATE (Brief §4.2.4):
 *  - normal  : còn > 25% thời gian
 *  - warning : còn ≤ 25% thời gian
 *  - overdue : đã quá hạn
 */
export type SlaTone = 'normal' | 'warning' | 'overdue'

export const SLA_WARNING_RATIO = 0.25

export type SlaState = {
  tone: SlaTone
  /** Âm khi đã quá hạn. */
  remainingMs: number
}

function toMs(input: DateInput): number {
  return input instanceof Date ? input.getTime() : typeof input === 'number' ? input : Date.parse(input)
}

/**
 * @param startedAt mốc bắt đầu tính hạn (VD `paidAt` cho T_CONFIRM). Thiếu → không có mức cảnh báo 25%.
 */
export function getSlaState({
  deadline,
  startedAt,
  now = Date.now(),
}: {
  deadline: DateInput
  startedAt?: DateInput
  now?: DateInput
}): SlaState {
  const end = toMs(deadline)
  const current = toMs(now)
  const remainingMs = end - current
  if (remainingMs <= 0) return { tone: 'overdue', remainingMs }
  if (startedAt !== undefined) {
    const total = end - toMs(startedAt)
    if (total > 0 && remainingMs <= total * SLA_WARNING_RATIO) return { tone: 'warning', remainingMs }
  }
  return { tone: 'normal', remainingMs }
}

const UNITS = [
  { ms: 86_400_000, label: 'ngày' },
  { ms: 3_600_000, label: 'giờ' },
  { ms: 60_000, label: 'phút' },
  { ms: 1_000, label: 'giây' },
] as const

/** Đơn vị lớn nhất + đơn vị liền kề (bỏ nếu = 0), VD "23 giờ 15 phút", "12 phút 30 giây", "1 ngày". */
export function formatDuration(ms: number): string {
  const total = Math.abs(ms)
  const index = UNITS.findIndex((unit) => total >= unit.ms)
  if (index === -1) return '0 giây'

  const major = UNITS[index]!
  const majorValue = Math.floor(total / major.ms)
  const parts = [`${majorValue} ${major.label}`]
  const minor = UNITS[index + 1]
  if (minor) {
    const minorValue = Math.floor((total - majorValue * major.ms) / minor.ms)
    if (minorValue > 0) parts.push(`${minorValue} ${minor.label}`)
  }
  return parts.join(' ')
}
