/**
 * Chuẩn hóa lỗi API theo Huma Error Model của backend (pkg/middleware/huma_error.go, 02-TRD §5.1):
 * { code, message, details: [{ field, reason }], correlationId }.
 */
export type ApiFieldError = { field: string; reason: string }

type ApiErrorBody = {
  code?: unknown
  message?: unknown
  details?: unknown
  correlationId?: unknown
}

/** Thông điệp nghiệp vụ dự phòng khi body không có `message` — không bao giờ lộ "500 Internal Server Error" (NFR-USA-003). */
const FALLBACK_MESSAGES: Record<number, string> = {
  0: 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.',
  400: 'Yêu cầu không hợp lệ.',
  401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  403: 'Bạn không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy dữ liệu yêu cầu.',
  409: 'Dữ liệu đã thay đổi. Vui lòng tải lại dữ liệu mới nhất.',
  410: 'Yêu cầu đã hết hạn.',
  422: 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại các trường được đánh dấu.',
  429: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.',
}
const FALLBACK_SERVER_ERROR = 'Hệ thống đang bận. Vui lòng thử lại sau giây lát.'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: ApiFieldError[]
  readonly correlationId?: string
  /** Từ header `Retry-After` khi 429 (giây). */
  readonly retryAfterSeconds?: number

  constructor(init: {
    status: number
    code: string
    message: string
    details?: ApiFieldError[]
    correlationId?: string
    retryAfterSeconds?: number
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.details = init.details ?? []
    this.correlationId = init.correlationId
    this.retryAfterSeconds = init.retryAfterSeconds
  }

  /** 502/503/504 — dịch vụ phụ thuộc lỗi: hiển thị Fallback Banner theo khối (NFR-REL-005). */
  get isServiceUnavailable(): boolean {
    return this.status === 0 || this.status >= 502
  }

  /** Lỗi của 1 trường (map vào React Hook Form `setError`). */
  fieldError(field: string): string | undefined {
    return this.details.find((detail) => detail.field === field)?.reason
  }
}

function parseDetails(value: unknown): ApiFieldError[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is ApiFieldError =>
      typeof item === 'object' && item !== null && typeof item.field === 'string' && typeof item.reason === 'string',
  )
}

function parseRetryAfter(response: Response): number | undefined {
  const header = response.headers.get('Retry-After')
  if (!header) return undefined
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return seconds
  const date = Date.parse(header)
  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - Date.now()) / 1000))
}

/** Tạo ApiError từ `{ error, response }` mà openapi-fetch trả về. */
export function toApiError(body: unknown, response: Response): ApiError {
  const parsed = (typeof body === 'object' && body !== null ? body : {}) as ApiErrorBody
  const status = response.status
  return new ApiError({
    status,
    code: typeof parsed.code === 'string' ? parsed.code : `HTTP_${status}`,
    message:
      typeof parsed.message === 'string' && parsed.message
        ? parsed.message
        : (FALLBACK_MESSAGES[status] ?? FALLBACK_SERVER_ERROR),
    details: parseDetails(parsed.details),
    correlationId:
      typeof parsed.correlationId === 'string'
        ? parsed.correlationId
        : (response.headers.get('X-Correlation-Id') ?? undefined),
    retryAfterSeconds: parseRetryAfter(response),
  })
}

export function networkError(): ApiError {
  return new ApiError({ status: 0, code: 'NETWORK_ERROR', message: FALLBACK_MESSAGES[0]! })
}

/**
 * Biến kết quả openapi-fetch thành Promise ném ApiError — dùng trong queryFn/mutationFn của TanStack Query.
 * @example useQuery({ queryKey: ['me'], queryFn: () => unwrap(idn.GET('/v1/users/me')) })
 */
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let result: Awaited<typeof call>
  try {
    result = await call
  } catch {
    throw networkError()
  }
  if (!result.response.ok) throw toApiError(result.error, result.response)
  return result.data as T
}
