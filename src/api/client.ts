import createClient, { type ClientOptions } from 'openapi-fetch'
import { env } from '@/lib/env'
import { authFetch } from './auth-fetch'

/**
 * Tạo client openapi-fetch có kiểu dữ liệu từ hợp đồng OpenAPI đã sinh (src/api/generated).
 * Mọi dịch vụ đi chung 1 API Gateway (Traefik) nên dùng cùng baseUrl; `authFetch` tự gắn Bearer,
 * silent refresh khi 401 và xử lý khóa tài khoản.
 *
 * @example
 *   import type { SvcIdn } from '@/api/generated'
 *   const idn = createApiClient<SvcIdn.paths>()
 *   const me = await unwrap(idn.GET('/v1/users/me'))
 */
export function createApiClient<Paths extends object>(options: Omit<ClientOptions, 'baseUrl' | 'fetch'> = {}) {
  return createClient<Paths>({ baseUrl: env.apiBaseUrl, fetch: authFetch, ...options })
}
