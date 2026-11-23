import type { SvcIdn } from '@/api/generated'
import { env } from '@/lib/env'
import { clearAuthSession, getAuthSession, lockoutAuthSession, setAuthSession } from '@/lib/auth/session'
import { createIdempotencyKey } from './idempotency'

/*
 * `fetch` dùng chung cho mọi client openapi-fetch (createApiClient) — T2-03:
 *  - gắn `Authorization: Bearer` + `X-Correlation-Id` (SOA-R10),
 *  - 401 → silent refresh đúng 1 lần (single-flight trong tab + Web Lock giữa các tab) rồi gửi lại request (FR-ACC-002),
 *  - ACCOUNT_LOCKED / TOKEN_REVOKED → thu hồi phiên ngay, layout đưa về /login kèm banner (FR-ACC-006).
 */

type ApiErrorBody = Partial<SvcIdn.components['schemas']['APIError']>

const REFRESH_PATH = '/v1/auth/token/refresh'
const REFRESH_LOCK_NAME = 'soa-market.token-refresh'
const DEFAULT_LOCK_MESSAGE = 'Tài khoản của bạn đã bị khóa bởi quản trị viên.'

/** Đường dẫn công khai của SVC-IDN: không gắn Bearer, không kích hoạt refresh khi trả 401 (sai mật khẩu ≠ hết phiên). */
const PUBLIC_AUTH_PATHS = [
  '/v1/auth/register',
  '/v1/auth/otp/',
  '/v1/auth/login',
  '/v1/auth/token/refresh',
  '/v1/auth/password/forgot',
  '/v1/auth/password/reset',
  '/v1/auth/keys',
]

function pathOf(request: Request): string {
  return new URL(request.url, 'http://localhost').pathname
}

export function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_AUTH_PATHS.some((p) => pathname.startsWith(p))
}

async function readErrorBody(response: Response): Promise<ApiErrorBody | null> {
  try {
    return (await response.clone().json()) as ApiErrorBody
  } catch {
    return null
  }
}

function prepare(request: Request, accessToken: string | null): Request {
  const headers = new Headers(request.headers)
  if (!headers.has('X-Correlation-Id')) headers.set('X-Correlation-Id', createIdempotencyKey())
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  return new Request(request, { headers })
}

async function withCrossTabLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(REFRESH_LOCK_NAME, task)
  }
  return task()
}

async function performRefresh(staleRefreshToken: string): Promise<string | null> {
  return withCrossTabLock(async () => {
    // Tab khác có thể vừa xoay vòng token trong lúc chờ khóa → dùng luôn cặp mới, KHÔNG gửi lại refresh token cũ
    // (SVC-IDN coi là reuse và thu hồi cả token family — FR-ACC-002 E4).
    const current = getAuthSession()
    if (!current.refreshToken) return null
    if (current.refreshToken !== staleRefreshToken) return current.accessToken

    let res: Response
    try {
      res = await fetch(`${env.apiBaseUrl}${REFRESH_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': createIdempotencyKey() },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      })
    } catch {
      return null // Lỗi mạng: giữ phiên để người dùng thử lại.
    }

    if (res.status === 401 || res.status === 403) {
      const body = await readErrorBody(res)
      if (res.status === 403 || body?.code === 'ACCOUNT_LOCKED') {
        lockoutAuthSession(body?.message || DEFAULT_LOCK_MESSAGE)
      } else {
        clearAuthSession() // Refresh token hết hạn / bị thu hồi / reuse detected → đăng nhập lại.
      }
      return null
    }
    if (!res.ok) return null // 429 / 5xx: giữ phiên.

    const data = (await res.json().catch(() => null)) as SvcIdn.components['schemas']['AuthTokensResult'] | null
    if (!data?.accessToken || !data.refreshToken) {
      clearAuthSession()
      return null
    }
    setAuthSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user })
    return data.accessToken
  })
}

let refreshInFlight: Promise<string | null> | null = null

/** Silent refresh dùng chung (single-flight). Trả về access token mới, hoặc null nếu không refresh được. */
export function refreshAccessToken(): Promise<string | null> {
  const stale = getAuthSession().refreshToken
  if (!stale) return Promise.resolve(null)
  refreshInFlight ??= performRefresh(stale).finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

/**
 * Đăng xuất: báo SVC-IDN thu hồi refresh token (1 thiết bị hoặc mọi thiết bị) rồi LUÔN xóa phiên cục bộ,
 * kể cả khi mạng lỗi — người dùng bấm đăng xuất thì phải ra khỏi phiên.
 */
export async function logout({ allDevices = false }: { allDevices?: boolean } = {}): Promise<void> {
  const { accessToken, refreshToken } = getAuthSession()
  try {
    if (accessToken) {
      await authFetch(
        new Request(`${env.apiBaseUrl}/v1/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: refreshToken ?? undefined, allDevices }),
        }),
      )
    }
  } catch {
    // bỏ qua — vẫn xóa phiên bên dưới
  } finally {
    clearAuthSession()
  }
}

export async function authFetch(input: Request): Promise<Response> {
  const pathname = pathOf(input)
  if (isPublicAuthPath(pathname)) return fetch(prepare(input, null))

  const usedToken = getAuthSession().accessToken
  // Clone TRƯỚC khi gửi: body của request chỉ đọc được 1 lần, bản clone dùng để gửi lại sau refresh.
  const retryable = usedToken ? input.clone() : null
  const response = await fetch(prepare(input, usedToken))

  if (response.status !== 401 && response.status !== 403) return response

  const body = await readErrorBody(response)
  if (body?.code === 'ACCOUNT_LOCKED' || body?.code === 'TOKEN_REVOKED') {
    if (getAuthSession().accessToken) {
      lockoutAuthSession(
        body.message || (body.code === 'ACCOUNT_LOCKED' ? DEFAULT_LOCK_MESSAGE : 'Phiên đăng nhập đã bị thu hồi.'),
      )
    }
    return response
  }
  // 403 thường = thiếu quyền / IDOR — không phải vấn đề token.
  if (response.status !== 401 || !retryable) return response

  // Request khác đã refresh xong trong lúc request này đang chạy → chỉ cần gửi lại với token mới.
  const latest = getAuthSession().accessToken
  const fresh = latest && latest !== usedToken ? latest : await refreshAccessToken()
  if (!fresh) return response
  return fetch(prepare(retryable, fresh))
}
