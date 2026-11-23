import { describe, expect, it } from 'vitest'
import { createIdempotencyKey, createIdempotencyTracker } from './idempotency'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('idempotency keys', () => {
  it('generates UUID v4', () => {
    expect(createIdempotencyKey()).toMatch(UUID_V4)
  })

  it('reuses the key for the same payload and rotates it when the payload changes', () => {
    const tracker = createIdempotencyTracker()
    const first = tracker.keyFor({ addressId: 'a1', items: ['x'] })

    expect(tracker.keyFor({ addressId: 'a1', items: ['x'] })).toBe(first)
    const changed = tracker.keyFor({ addressId: 'a2', items: ['x'] })
    expect(changed).not.toBe(first)

    tracker.reset()
    expect(tracker.keyFor({ addressId: 'a2', items: ['x'] })).not.toBe(changed)
  })
})
