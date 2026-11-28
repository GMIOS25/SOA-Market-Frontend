import { authFetch } from '@/api/auth-fetch'
import { createApiClient } from '@/api/client'
import { networkError, toApiError, unwrap } from '@/api/errors'
import type { SvcOrd, SvcPrd, SvcRev } from '@/api/generated'
import { env } from '@/lib/env'

export type ReviewDTO = SvcRev.components['schemas']['ReviewDTO']
export type MyReviewDTO = SvcRev.components['schemas']['MyReviewDTO']
export type AdminReviewDTO = SvcRev.components['schemas']['AdminReviewDTO']
export type ReportDTO = SvcRev.components['schemas']['ReportDTO']
export type ReplyDTO = SvcRev.components['schemas']['ReplyDTO']
export type RatingSummaryDTO = SvcRev.components['schemas']['RatingSummaryDTO']
export type ShopRatingSummaryDTO = SvcRev.components['schemas']['ShopRatingSummaryDTO']
export type ProductReviewsDTO = SvcRev.components['schemas']['ProductReviewsDTO']
export type PagedAdminReviewDTO = SvcRev.components['schemas']['PagedAdminReviewDTO']
export type ReportResultDTO = SvcRev.components['schemas']['ReportResultDTO']
export type ModerationDecision = SvcRev.components['schemas']['ModerateRequestBody']['decision']
export type ProductReviewsQuery = NonNullable<SvcRev.operations['product-reviews-list']['parameters']['query']>

export type BuyerOrderDetailView = SvcOrd.components['schemas']['BuyerOrderDetailView']
export type BuyerSellerOrderDetailView = SvcOrd.components['schemas']['BuyerSellerOrderDetailView']
export type OrderItemView = SvcOrd.components['schemas']['OrderItemView']
export type BuyerOrderListResult = SvcOrd.components['schemas']['BuyerOrderListResult']

/* Giới hạn khớp SVC-REV (services/svc-rev/internal/service/reviews.go & handler/operations.go). */
export const REVIEW_CONTENT_MAX = 1000
export const REVIEW_IMAGES_MAX = 5
export const REVIEW_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const REVIEW_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const REPLY_CONTENT_MAX = 1000
export const REASON_MAX = 1000

/** Trạng thái SellerOrder được phép đánh giá: quyền mở khi `sellerorder.delivered` (T2-08), hạn `T_REVIEW`. */
export const REVIEWABLE_SELLER_ORDER_STATUSES = new Set(['DELIVERED', 'COMPLETED'])

export const revClient = createApiClient<SvcRev.paths>()
const ordClient = createApiClient<SvcOrd.paths>()
const prdClient = createApiClient<SvcPrd.paths>()

export const reviewKeys = {
  all: ['reviews'] as const,
  product: (productId: string, query: ProductReviewsQuery) => ['reviews', 'product', productId, query] as const,
  productAll: (productId: string) => ['reviews', 'product', productId] as const,
  shopSummary: (shopId: string) => ['reviews', 'shop-summary', shopId] as const,
  moderationQueue: (page: number) => ['reviews', 'moderation-queue', page] as const,
  moderationAll: ['reviews', 'moderation-queue'] as const,
  sellerProducts: ['reviews', 'seller-products'] as const,
  buyerOrder: (orderId: string) => ['reviews', 'buyer-order', orderId] as const,
  buyerOrders: ['reviews', 'buyer-orders'] as const,
}

/**
 * URL ảnh đánh giá: SVC-REV trả URL tuyệt đối khi có `PUBLIC_ASSET_BASE_URL`, ngược lại trả đường dẫn
 * `/public-reviews/<key>` — phải ghép với origin MinIO (lấy từ `VITE_MEDIA_BASE_URL`) thay vì origin của SPA.
 */
export function reviewImageUrl(url: string): string {
  if (/^https?:\/\//i.test(url) || !url.startsWith('/')) return url
  try {
    return env.mediaBaseUrl ? `${new URL(env.mediaBaseUrl).origin}${url}` : url
  } catch {
    return url
  }
}

// ---------- Public (FR-REV-002) ----------

export function apiGetProductReviews(productId: string, query: ProductReviewsQuery): Promise<ProductReviewsDTO> {
  return unwrap(revClient.GET('/v1/products/{id}/reviews', { params: { path: { id: productId }, query } }))
}

export function apiGetShopReviewSummary(shopId: string): Promise<ShopRatingSummaryDTO> {
  return unwrap(revClient.GET('/v1/shops/{id}/reviews/summary', { params: { path: { id: shopId } } }))
}

// ---------- Buyer (FR-REV-001, FR-REV-004) ----------

export type SubmitReviewInput = {
  orderItemId: string
  stars: number
  content: string
  images: File[]
}

/**
 * `POST /v1/reviews` (multipart/form-data). Gọi thẳng `authFetch` với `FormData` để trình duyệt tự đặt
 * `Content-Type` kèm boundary (cùng cách với hồ sơ KYC của seller-shop).
 */
export async function apiSubmitReview(input: SubmitReviewInput): Promise<MyReviewDTO> {
  const form = new FormData()
  form.set('orderItemId', input.orderItemId)
  form.set('stars', String(input.stars))
  const content = input.content.trim()
  if (content) form.set('content', content)
  for (const image of input.images) form.append('images', image, image.name)

  let response: Response
  try {
    response = await authFetch(new Request(`${env.apiBaseUrl}/v1/reviews`, { method: 'POST', body: form }))
  } catch {
    throw networkError()
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw toApiError(body, response)
  return body as MyReviewDTO
}

/** Báo cáo đánh giá vi phạm — Buyer, Seller hoặc người dùng đã đăng nhập (FR-REV-004). */
export function apiReportReview(reviewId: string, reason: string): Promise<ReportResultDTO> {
  return unwrap(
    revClient.POST('/v1/reviews/{id}/reports', { params: { path: { id: reviewId } }, body: { reason: reason.trim() } }),
  )
}

/** Đơn của tôi — lấy món hàng (`orderItemId`, tên, ảnh) để chọn sản phẩm cần đánh giá. */
export function apiGetBuyerOrder(orderId: string): Promise<BuyerOrderDetailView> {
  return unwrap(ordClient.GET('/v1/orders/{id}', { params: { path: { id: orderId } } }))
}

export function apiListBuyerOrders(page = 1, limit = 20): Promise<BuyerOrderListResult> {
  return unwrap(ordClient.GET('/v1/orders', { params: { query: { page, limit } } }))
}

// ---------- Seller (FR-REV-003) ----------

export function apiReplyReview(reviewId: string, content: string): Promise<ReplyDTO> {
  return unwrap(
    revClient.POST('/v1/reviews/{id}/reply', { params: { path: { id: reviewId } }, body: { content: content.trim() } }),
  )
}

export type SellerReviewProduct = { productId: string; productName: string; productStatus: string }

/**
 * Sản phẩm của gian hàng để chọn xem đánh giá. SVC-PRD không có `GET /v1/seller/products` nên gộp theo
 * `productId` từ `GET /v1/seller/inventory` (cùng nguồn với `/seller/products` của T3-07).
 */
export async function apiListSellerReviewProducts(): Promise<SellerReviewProduct[]> {
  const byId = new Map<string, SellerReviewProduct>()
  for (let page = 1; ; page += 1) {
    const res = await unwrap(prdClient.GET('/v1/seller/inventory', { params: { query: { page, pageSize: 100 } } }))
    const rows = res.data ?? []
    for (const row of rows) {
      if (!byId.has(row.productId)) {
        byId.set(row.productId, { productId: row.productId, productName: row.productName, productStatus: row.productStatus })
      }
    }
    if (rows.length === 0 || page >= res.pagination.totalPages) break
  }
  return [...byId.values()].sort((a, b) => a.productName.localeCompare(b.productName, 'vi'))
}

// ---------- Admin (FR-REV-005) ----------

export function apiGetModerationQueue(page: number, pageSize = 20): Promise<PagedAdminReviewDTO> {
  return unwrap(revClient.GET('/v1/admin/reviews/moderation-queue', { params: { query: { page, pageSize } } }))
}

export function apiModerateReview(
  reviewId: string,
  body: { decision: ModerationDecision; reason: string; version: number },
): Promise<AdminReviewDTO> {
  return unwrap(
    revClient.POST('/v1/admin/reviews/{id}/moderate', {
      params: { path: { id: reviewId } },
      body: { ...body, reason: body.reason.trim() },
    }),
  )
}
