import { env } from '@/lib/env'
import { sessionStore } from '@/lib/auth/session-store'
import {
  AUTH_ERROR_CODES,
  AUTH_PATHS,
  PUBLIC_AUTH_PREFIX,
  buildLogoutBody,
  buildRefreshBody,
  parseTokenPair,
} from './auth-contract'

const REFRESH_LOCK = 'soa-market.token-refresh'

/** Chỉ 1 lần refresh tại một thời điểm trong tab; các request 401 khác chờ chung promise này. */
let inflightRefresh: Promise<boolean> | null = null

function apiUrl(path: string): string {
  return `${env.apiBaseUrl}${path}`
}

function isPublicAuthRequest(request: Request): boolean {
  // Request.url luôn là URL tuyệt đối (trình duyệt đã resolve theo origin).
  return new URL(request.url).pathname.startsWith(PUBLIC_AUTH_PREFIX)
}

function withBearer(request: Request, accessToken: string | undefined): Request {
  if (!accessToken) return request
  const headers = new Headers(request.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  return new Request(request, { headers })
}

async function readErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.clone().json()) as { code?: unknown }
    return typeof body.code === 'string' ? body.code : undefined
  } catch {
    return undefined
  }
}

/** Chạy `task` dưới Web Lock dùng chung giữa các tab (nếu trình duyệt hỗ trợ). */
async function withCrossTabLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(REFRESH_LOCK, task)
  }
  return task()
}

async function performRefresh(): Promise<boolean> {
  const staleRefreshToken = sessionStore.getSession()?.refreshToken
  if (!staleRefreshToken) return false

  return withCrossTabLock(async () => {
    // Tab khác có thể vừa xoay vòng token trong lúc chờ khóa: dùng luôn cặp mới, KHÔNG gửi lại
    // refresh token cũ (SVC-IDN sẽ coi là reuse và thu hồi cả token family — FR-ACC-002 E4).
    sessionStore.syncFromStorage()
    const current = sessionStore.getSession()
    if (!current) return false
    if (current.refreshToken !== staleRefreshToken) return true

    let response: Response
    try {
      response = await fetch(apiUrl(AUTH_PATHS.refresh), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRefreshBody(current.refreshToken)),
      })
    } catch {
      return false // Lỗi mạng: giữ phiên, để người dùng thử lại.
    }

    if (response.status === 401 || response.status === 403) {
      const code = await readErrorCode(response)
      sessionStore.end(code === AUTH_ERROR_CODES.accountLocked ? 'locked' : 'expired')
      return false
    }
    if (!response.ok) return false // 5xx / 429: giữ phiên.

    const tokens = parseTokenPair(await response.json().catch(() => null))
    if (!tokens || !sessionStore.signIn(tokens)) {
      sessionStore.end('expired')
      return false
    }
    return true
  })
}

/** Silent refresh dùng chung (single-flight). Trả về true nếu đã có access token mới để thử lại. */
export function refreshSession(): Promise<boolean> {
  inflightRefresh ??= performRefresh().finally(() => {
    inflightRefresh = null
  })
  return inflightRefresh
}

/**
 * `fetch` cho openapi-fetch (và upload tệp): gắn Bearer, tự refresh 1 lần khi 401, xử lý khóa tài khoản.
 * (FR-ACC-002 silent refresh, FR-ACC-006 thu hồi phiên tức thì, 03-App-Flow §2 & §3.2)
 */
export async function authFetch(request: Request): Promise<Response> {
  if (isPublicAuthRequest(request)) return fetch(request)

  const usedToken = sessionStore.getSession()?.accessToken
  const retryable = usedToken ? request.clone() : null
  const response = await fetch(withBearer(request, usedToken))

  if (response.status !== 401 && response.status !== 403) return response

  const code = await readErrorCode(response)
  if (code === AUTH_ERROR_CODES.accountLocked) {
    if (sessionStore.getSession()) sessionStore.end('locked')
    return response
  }
  // 403 thường = thiếu quyền / IDOR — không phải vấn đề token.
  if (response.status !== 401 || !retryable) return response

  // Request khác đã refresh xong trong lúc request này chạy → chỉ cần gửi lại với token mới.
  const latestToken = sessionStore.getSession()?.accessToken
  const refreshed = latestToken && latestToken !== usedToken ? true : await refreshSession()
  if (!refreshed) return response

  return fetch(withBearer(retryable, sessionStore.getSession()?.accessToken))
}

/** Đăng xuất thiết bị này hoặc mọi thiết bị (`allDevices`) — luôn xóa phiên cục bộ kể cả khi API lỗi. */
export async function logout({ allDevices = false }: { allDevices?: boolean } = {}): Promise<void> {
  const session = sessionStore.getSession()
  if (session) {
    try {
      await fetch(apiUrl(AUTH_PATHS.logout), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify(buildLogoutBody(session.refreshToken, allDevices)),
      })
    } catch {
      // Bỏ qua: refresh token vẫn tự hết hạn theo T_REFRESH.
    }
  }
  sessionStore.end('logout')
}
