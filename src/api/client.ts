import createClient, { type ClientOptions } from 'openapi-fetch'
import { env } from '@/lib/env'

/**
 * Tạo client openapi-fetch có kiểu dữ liệu từ hợp đồng OpenAPI đã sinh (src/api/generated).
 * Mọi dịch vụ đi chung 1 API Gateway (Traefik) nên dùng cùng baseUrl.
 *
 * @example
 *   import type { SvcIdn } from '@/api/generated'
 *   const idn = createApiClient<SvcIdn.paths>()
 *   const { data, error } = await idn.GET('/v1/users/me')
 *
 * JWT refresh, X-Correlation-Id và Idempotency-Key middleware được gắn ở T2-03.
 */
export function createApiClient<Paths extends object>(options: Omit<ClientOptions, 'baseUrl'> = {}) {
  return createClient<Paths>({ baseUrl: env.apiBaseUrl, ...options })
}
