import createClient, { type Middleware } from 'openapi-fetch'
import type { SvcIdn } from '@/api/generated'
import { env } from '@/lib/env'
import {
  clearAuthSession,
  getAuthSession,
  lockoutAuthSession,
  setAuthSession,
} from './session'

export type ParsedApiError = {
  status: number
  code: string
  message: string
  details: Array<{ field: string; reason: string }>
  correlationId?: string
  retryAfterSeconds?: number
}

export function parseApiError(error: unknown, response?: Response): ParsedApiError {
  const status = response?.status ?? 500
  const retryRaw = response?.headers.get('Retry-After')
  const retryParsed = retryRaw ? Number.parseInt(retryRaw, 10) : Number.NaN
  const retryAfterSeconds = Number.isFinite(retryParsed) && retryParsed > 0 ? retryParsed : undefined

  if (error && typeof error === 'object') {
    const rec = error as Partial<SvcIdn.components['schemas']['APIError']>
    return {
      status,
      code: typeof rec.code === 'string' && rec.code ? rec.code : 'UNKNOWN_ERROR',
      message: typeof rec.message === 'string' && rec.message ? rec.message : 'Đã xảy ra lỗi không xác định.',
      details: Array.isArray(rec.details) ? rec.details : [],
      correlationId: typeof rec.correlationId === 'string' ? rec.correlationId : undefined,
      retryAfterSeconds,
    }
  }

  return {
    status,
    code: status >= 500 ? 'SERVER_ERROR' : 'REQUEST_ERROR',
    message: 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.',
    details: [],
    retryAfterSeconds,
  }
}

export class AuthApiError extends Error {
  readonly parsed: ParsedApiError

  constructor(parsed: ParsedApiError) {
    super(parsed.message)
    this.name = 'AuthApiError'
    this.parsed = parsed
  }
}

let refreshInFlight: Promise<string | null> | null = null

async function silentRefreshToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const { refreshToken } = getAuthSession()
    if (!refreshToken) {
      clearAuthSession()
      return null
    }
    try {
      const res = await fetch(`${env.apiBaseUrl}/v1/auth/token/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-Id': crypto.randomUUID(),
        },
        body: JSON.stringify({ refreshToken }),
      })
      if (!res.ok) {
        if (res.status === 403) {
          const body = (await res.json().catch(() => null)) as Partial<SvcIdn.components['schemas']['APIError']> | null
          lockoutAuthSession(body?.message || 'Tài khoản của bạn đã bị khóa bởi quản trị viên.')
        } else {
          clearAuthSession()
        }
        return null
      }
      const data = (await res.json()) as SvcIdn.components['schemas']['AuthTokensResult']
      setAuthSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      })
      return data.accessToken
    } catch {
      return null
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

const requestMap = new WeakMap<Request, Request>()

const authInterceptorMiddleware: Middleware = {
  async onRequest({ request }) {
    const nextReq = request.clone()
    if (!nextReq.headers.has('X-Correlation-Id')) {
      nextReq.headers.set('X-Correlation-Id', crypto.randomUUID())
    }
    const { accessToken } = getAuthSession()
    if (accessToken && !nextReq.headers.has('Authorization')) {
      nextReq.headers.set('Authorization', `Bearer ${accessToken}`)
    }
    requestMap.set(request, nextReq.clone())
    return nextReq
  },

  async onResponse({ request, response }) {
    const urlPath = new URL(request.url, 'http://localhost').pathname
    if (urlPath.startsWith('/v1/auth/login') || urlPath.startsWith('/v1/auth/token/refresh')) {
      return response
    }

    if (response.status === 403) {
      const cloned = response.clone()
      const body = (await cloned.json().catch(() => null)) as Partial<SvcIdn.components['schemas']['APIError']> | null
      if (body?.code === 'ACCOUNT_LOCKED') {
        lockoutAuthSession(body.message || 'Tài khoản của bạn đã bị khóa bởi quản trị viên.')
      }
      return response
    }

    if (response.status === 401 && getAuthSession().refreshToken) {
      const cloned = response.clone()
      const body = (await cloned.json().catch(() => null)) as Partial<SvcIdn.components['schemas']['APIError']> | null
      if (body?.code === 'TOKEN_REVOKED' || body?.code === 'ACCOUNT_LOCKED') {
        lockoutAuthSession(body.message || 'Phiên đăng nhập đã bị thu hồi.')
        return response
      }

      const freshAccessToken = await silentRefreshToken()
      if (!freshAccessToken) {
        return response
      }

      const origClone = requestMap.get(request)
      if (!origClone) return response
      origClone.headers.set('Authorization', `Bearer ${freshAccessToken}`)
      return fetch(origClone)
    }

    return response
  },
}

export const idnClient = createClient<SvcIdn.paths>({ baseUrl: env.apiBaseUrl })
idnClient.use(authInterceptorMiddleware)

function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || !result.response.ok || result.data === undefined) {
    throw new AuthApiError(parseApiError(result.error, result.response))
  }
  return result.data
}

export async function apiRegister(body: SvcIdn.components['schemas']['RegisterRequestBody']) {
  return unwrap(await idnClient.POST('/v1/auth/register', { body }))
}

export async function apiVerifyOtp(body: SvcIdn.components['schemas']['VerifyOTPRequestBody']) {
  return unwrap(await idnClient.POST('/v1/auth/otp/verify', { body }))
}

export async function apiResendOtp(body: SvcIdn.components['schemas']['ResendOTPRequestBody']) {
  return unwrap(await idnClient.POST('/v1/auth/otp/resend', { body }))
}

export async function apiLogin(body: SvcIdn.components['schemas']['LoginRequestBody']) {
  return unwrap(await idnClient.POST('/v1/auth/login', { body }))
}

export async function apiLogout(body: SvcIdn.components['schemas']['LogoutRequestBody']) {
  return unwrap(await idnClient.POST('/v1/auth/logout', { body }))
}

export async function apiForgotPassword(body: SvcIdn.components['schemas']['ForgotPasswordRequestBody']) {
  return unwrap(await idnClient.POST('/v1/auth/password/forgot', { body }))
}

export async function apiResetPassword(body: SvcIdn.components['schemas']['ResetPasswordRequestBody']) {
  return unwrap(await idnClient.POST('/v1/auth/password/reset', { body }))
}

export async function apiGetMe() {
  return unwrap(await idnClient.GET('/v1/users/me'))
}

export async function apiUpdateMe(body: SvcIdn.components['schemas']['UpdateMeRequestBody']) {
  return unwrap(await idnClient.PUT('/v1/users/me', { body }))
}

export async function apiChangePassword(body: SvcIdn.components['schemas']['ChangePasswordRequestBody']) {
  return unwrap(await idnClient.PUT('/v1/users/me/password', { body }))
}

export async function apiListAddresses() {
  return unwrap(await idnClient.GET('/v1/users/me/addresses'))
}

export async function apiCreateAddress(body: SvcIdn.components['schemas']['AddressBody']) {
  return unwrap(await idnClient.POST('/v1/users/me/addresses', { body }))
}

export async function apiUpdateAddress(id: string, body: SvcIdn.components['schemas']['AddressBody']) {
  return unwrap(await idnClient.PUT('/v1/users/me/addresses/{id}', { params: { path: { id } }, body }))
}

export async function apiDeleteAddress(id: string) {
  return unwrap(await idnClient.DELETE('/v1/users/me/addresses/{id}', { params: { path: { id } } }))
}

export async function apiAdminListUsers(query: {
  page?: number
  pageSize?: number
  q?: string
  status?: string
  role?: string
}) {
  return unwrap(await idnClient.GET('/v1/admin/users', { params: { query } }))
}

export async function apiAdminUpdateUserRoles(
  id: string,
  body: SvcIdn.components['schemas']['AdminUpdateRolesRequestBody'],
) {
  return unwrap(await idnClient.PUT('/v1/admin/users/{id}/roles', { params: { path: { id } }, body }))
}

export async function apiAdminLockUser(
  id: string,
  body: SvcIdn.components['schemas']['AdminUserActionRequestBody'],
) {
  return unwrap(await idnClient.POST('/v1/admin/users/{id}/lock', { params: { path: { id } }, body }))
}

export async function apiAdminUnlockUser(
  id: string,
  body: SvcIdn.components['schemas']['AdminUserActionRequestBody'],
) {
  return unwrap(await idnClient.POST('/v1/admin/users/{id}/unlock', { params: { path: { id } }, body }))
}
