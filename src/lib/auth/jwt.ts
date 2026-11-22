import { isRole, type Role } from './roles'

export type AccessTokenClaims = {
  userId: string
  roles: Role[]
  /** Unix seconds. */
  expiresAt?: number
}

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(segment.length / 4) * 4, '=')
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/**
 * Đọc claim từ JWT RS256 để hiển thị UI (menu theo vai trò). KHÔNG xác minh chữ ký —
 * việc đó do gateway-auth + từng dịch vụ đảm nhận (SOA-R11). Không bao giờ dùng kết quả này để cấp quyền thật.
 */
export function decodeAccessToken(token: string): AccessTokenClaims | null {
  const payloadSegment = token.split('.')[1]
  if (!payloadSegment) return null
  try {
    const payload = JSON.parse(decodeBase64Url(payloadSegment)) as Record<string, unknown>
    if (typeof payload.sub !== 'string' || !Array.isArray(payload.roles)) return null
    return {
      userId: payload.sub,
      roles: payload.roles.filter(isRole),
      expiresAt: typeof payload.exp === 'number' ? payload.exp : undefined,
    }
  } catch {
    return null
  }
}
