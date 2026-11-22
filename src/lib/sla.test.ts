import { describe, expect, it } from 'vitest'
import { computeRefundBreakdown } from './refund'
import { formatDuration, getSlaState } from './sla'

const H = 3_600_000

describe('getSlaState (T_CONFIRM = 24h)', () => {
  const startedAt = '2026-11-22T00:00:00Z'
  const deadline = '2026-11-23T00:00:00Z'
  const at = (hoursElapsed: number) => Date.parse(startedAt) + hoursElapsed * H

  it('is normal while more than 25% of the time remains', () => {
    expect(getSlaState({ deadline, startedAt, now: at(17) }).tone).toBe('normal')
  })

  it('turns warning at ≤ 25% remaining (6h of 24h)', () => {
    expect(getSlaState({ deadline, startedAt, now: at(18) }).tone).toBe('warning')
  })

  it('is overdue at and after the deadline with negative remaining time', () => {
    expect(getSlaState({ deadline, startedAt, now: at(24) }).tone).toBe('overdue')
    expect(getSlaState({ deadline, startedAt, now: at(26) }).remainingMs).toBe(-2 * H)
  })

  it('without startedAt there is no warning band', () => {
    expect(getSlaState({ deadline, now: at(23.9) }).tone).toBe('normal')
  })
})

describe('formatDuration', () => {
  it.each([
    [2 * H, '2 giờ'],
    [23 * H + 15 * 60_000, '23 giờ 15 phút'],
    [12 * 60_000 + 30_000, '12 phút 30 giây'],
    [2 * 24 * H + 3 * H + 59 * 60_000, '2 ngày 3 giờ'],
    [24 * H + 5 * 60_000, '1 ngày'],
    [45_000, '45 giây'],
    [500, '0 giây'],
    [-2 * H, '2 giờ'],
  ])('%d ms → %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected)
  })
})

describe('computeRefundBreakdown (FR-ORD-009)', () => {
  it('subtracts every refunded package from the paid total', () => {
    const result = computeRefundBreakdown(1_500_000, [
      { sellerOrderId: '2', sellerOrderCode: 'SO-002', shopName: 'Shop B', amount: 450_000, status: 'SUCCEEDED' },
    ])
    expect(result).toEqual({ refundedTotal: 450_000, remaining: 1_050_000 })
  })

  it('never goes below zero', () => {
    const result = computeRefundBreakdown(100, [
      { sellerOrderId: '1', sellerOrderCode: 'SO-1', shopName: 'A', amount: 150, status: 'PROCESSING' },
    ])
    expect(result.remaining).toBe(0)
  })
})
