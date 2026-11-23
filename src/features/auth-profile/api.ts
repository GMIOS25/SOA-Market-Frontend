import { createApiClient } from '@/api/client'
import type { SvcIdn } from '@/api/generated'

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

// Dùng chung client của T2-03: authFetch tự gắn Bearer + X-Correlation-Id, silent refresh khi 401
// (single-flight + khóa giữa các tab) và thu hồi phiên khi ACCOUNT_LOCKED (FR-ACC-002, FR-ACC-006).
export const idnClient = createApiClient<SvcIdn.paths>()

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
