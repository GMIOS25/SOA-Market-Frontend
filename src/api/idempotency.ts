import { useState } from 'react'

export const IDEMPOTENCY_HEADER = 'Idempotency-Key'

/** UUID v4. `crypto.randomUUID` chỉ có trong secure context (https/localhost) → có fallback cho http LAN khi demo. */
export function createIdempotencyKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function idempotencyHeaders(key: string): Record<typeof IDEMPOTENCY_HEADER, string> {
  return { [IDEMPOTENCY_HEADER]: key }
}

/**
 * Giữ NGUYÊN key khi gửi lại cùng payload (retry do mạng lag → BE trả kết quả cũ, không tạo đơn trùng),
 * sinh key MỚI khi payload đổi (người dùng sửa giỏ/địa chỉ) — 03-App-Flow §4.2 bước 2.
 */
export function createIdempotencyTracker() {
  let last: { fingerprint: string; key: string } | null = null
  return {
    keyFor(payload: unknown): string {
      const fingerprint = JSON.stringify(payload)
      if (last?.fingerprint !== fingerprint) last = { fingerprint, key: createIdempotencyKey() }
      return last.key
    },
    /** Gọi sau khi thao tác thành công để lần bấm kế tiếp là một thao tác mới. */
    reset() {
      last = null
    },
  }
}

/**
 * Hook cho form ghi quan trọng (checkout, khiếu nại...). Gọi `keyFor(payload)` trong event handler submit.
 * @example
 *   const idem = useIdempotencyKey()
 *   onSubmit = (body) => ord.POST('/v1/checkout', { body, headers: idempotencyHeaders(idem.keyFor(body)) })
 */
export function useIdempotencyKey() {
  const [tracker] = useState(createIdempotencyTracker)
  return tracker
}
