import { APP_TIMEZONE, dayjs } from '@/lib/dayjs'

/**
 * Định dạng chuẩn Việt Nam (BR-GEN-03, ASM-06, 04-UI-UX-Design-Brief §3.3).
 * API: tiền là số nguyên VND, thời gian là ISO 8601 UTC. UI: "1.250.000 ₫", "DD/MM/YYYY HH:mm" (UTC+7).
 */

export type DateInput = string | number | Date

const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })

/** 1250000 → "1.250.000 ₫" (khoảng trắng không ngắt dòng trước ₫). */
export function formatVnd(amount: number): string {
  return vndFormatter.format(amount)
}

/** 1250 → "1.250" — số lượng, tồn kho, số đơn. */
export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

/** Quy đổi mọi mốc thời gian về múi giờ hiển thị Asia/Ho_Chi_Minh. */
export function toAppTime(input: DateInput) {
  return dayjs.utc(input).tz(APP_TIMEZONE)
}

/** "22/11/2026" */
export function formatDate(input: DateInput): string {
  return toAppTime(input).format('DD/MM/YYYY')
}

/** "22/11/2026 14:00" — định dạng mặc định cho mọi timestamp trên UI. */
export function formatDateTime(input: DateInput): string {
  return toAppTime(input).format('DD/MM/YYYY HH:mm')
}

/** "14:00:05" — SyncTimestampBadge, timeline trong ngày. */
export function formatTime(input: DateInput): string {
  return toAppTime(input).format('HH:mm:ss')
}

/** "22/11/2026 14:00:05 +07:00" — dùng cho tooltip của thời gian tương đối. */
export function formatDateTimeFull(input: DateInput): string {
  return toAppTime(input).format('DD/MM/YYYY HH:mm:ss Z')
}

/** "15 phút trước" / "trong 3 giờ" — dạng tương đối cho sự kiện mới. */
export function formatRelative(input: DateInput, now: DateInput = Date.now()): string {
  return dayjs.utc(input).from(dayjs.utc(now))
}
