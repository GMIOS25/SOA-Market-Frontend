import type { Role } from './roles'

function base64Url(value: string): string {
  const bytes = new TextEncoder().encode(value)
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('')
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * JWT KHÔNG ký (alg "none") chỉ dùng cho unit test và nút "đăng nhập giả lập" ở môi trường dev
 * để xem layout Seller/Admin khi backend chưa chạy. Gateway sẽ từ chối token này với mọi API thật.
 */
export function createUnsignedDevToken(claims: { userId: string; roles: Role[]; ttlSeconds?: number }): string {
  const now = Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = base64Url(
    JSON.stringify({ sub: claims.userId, roles: claims.roles, iat: now, exp: now + (claims.ttlSeconds ?? 3600) }),
  )
  return `${header}.${payload}.`
}
