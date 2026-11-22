/**
 * Điểm DUY NHẤT chứa giả định về hợp đồng xác thực của SVC-IDN (FR-ACC-002, 02-TRD §4.1, 03-App-Flow §3.2).
 *
 * ⚠ Tạm thời: svc-idn chưa xuất contracts/openapi/svc-idn.yaml (task T1-04). Khi có spec, chạy
 * `npm run sync-contracts` rồi thay các kiểu/đường dẫn bên dưới bằng type sinh tự động — phần còn lại
 * (auth-fetch, session-store, guards) không cần sửa.
 */

export const AUTH_PATHS = {
  login: '/v1/auth/login',
  refresh: '/v1/auth/token/refresh',
  logout: '/v1/auth/logout',
} as const

/** Đường dẫn xác thực công khai: không gắn Bearer, không kích hoạt silent refresh khi trả 401. */
export const PUBLIC_AUTH_PREFIX = '/v1/auth/'

/** Kết quả của login & refresh (Refresh Token Rotation: mỗi lần refresh nhận cặp token mới). */
export type TokenPair = {
  accessToken: string
  refreshToken: string
}

export function buildRefreshBody(refreshToken: string) {
  return { refreshToken }
}

export function buildLogoutBody(refreshToken: string, allDevices: boolean) {
  return { refreshToken, allDevices }
}

export function parseTokenPair(body: unknown): TokenPair | null {
  if (typeof body !== 'object' || body === null) return null
  const { accessToken, refreshToken } = body as Record<string, unknown>
  return typeof accessToken === 'string' && typeof refreshToken === 'string' ? { accessToken, refreshToken } : null
}

/** Mã lỗi (trường `code` trong Huma Error Model) mà FE xử lý đặc biệt. */
export const AUTH_ERROR_CODES = {
  /** Access token hết hạn → silent refresh rồi gửi lại request. */
  tokenExpired: 'TOKEN_EXPIRED',
  /** Admin khóa tài khoản (FR-ACC-006) → xóa phiên, về /login kèm banner đỏ. */
  accountLocked: 'ACCOUNT_LOCKED',
} as const
