import { describe, expect, it } from 'vitest'
import '@/lib/dayjs'
import {
  formatDate,
  formatDateTime,
  formatDateTimeFull,
  formatNumber,
  formatRelative,
  formatVnd,
} from './format'

/** Intl.NumberFormat vi-VN đặt khoảng trắng không ngắt dòng (U+00A0) trước ₫. */
const NBSP = ' '

describe('formatVnd', () => {
  it('uses dot thousands separator, no decimals and a space before ₫', () => {
    expect(formatVnd(1_250_000)).toBe(`1.250.000${NBSP}₫`)
    expect(formatVnd(150_000)).toBe(`150.000${NBSP}₫`)
    expect(formatVnd(0)).toBe(`0${NBSP}₫`)
  })

  it('formats negative amounts (refund lines)', () => {
    expect(formatVnd(-450_000)).toBe(`-450.000${NBSP}₫`)
  })
})

describe('formatNumber', () => {
  it('groups thousands with dots', () => {
    expect(formatNumber(50_000)).toBe('50.000')
  })
})

describe('date/time in UTC+7', () => {
  const iso = '2026-11-22T07:00:05Z'

  it('converts UTC to Asia/Ho_Chi_Minh', () => {
    expect(formatDateTime(iso)).toBe('22/11/2026 14:00')
    expect(formatDate(iso)).toBe('22/11/2026')
    expect(formatDateTimeFull(iso)).toBe('22/11/2026 14:00:05 +07:00')
  })

  it('rolls over to the next day across midnight UTC+7', () => {
    expect(formatDateTime('2026-11-22T17:30:00Z')).toBe('23/11/2026 00:30')
  })

  it('renders Vietnamese relative time', () => {
    expect(formatRelative('2026-11-22T06:45:00Z', iso)).toBe('15 phút trước')
  })
})
