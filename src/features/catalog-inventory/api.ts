import { authFetch } from '@/api/auth-fetch'
import { createApiClient } from '@/api/client'
import { networkError, toApiError, unwrap } from '@/api/errors'
import type { SvcOrd, SvcPrd } from '@/api/generated'
import { ordClient, type CartView } from '@/features/cart-checkout-order/api'
import { env } from '@/lib/env'

export type ProductSummary = SvcPrd.components['schemas']['ProductSummary']
export type ProductSearchPage = SvcPrd.components['schemas']['ProductSearchPage']
export type Product = SvcPrd.components['schemas']['Product']
export type ProductVariant = SvcPrd.components['schemas']['Variant']
export type Category = SvcPrd.components['schemas']['Category']
export type AddCartItemRequestBody = SvcOrd.components['schemas']['AddCartItemRequestBody']
export type SearchProductsParams = NonNullable<SvcPrd.operations['search-products']['parameters']['query']>
export type SearchSort = NonNullable<SearchProductsParams['sort']>

export const prdClient = createApiClient<SvcPrd.paths>()

/** Giỏ hàng của người mua — cùng query key mà `CartPage` đọc (`['cart']`), để thêm ở trang sản phẩm xong trang giỏ thấy ngay. */
export const CART_QUERY_KEY = ['cart'] as const

/** Query key của miền catalog: trang chủ, tìm kiếm và chi tiết dùng chung cache. */
export const catalogKeys = {
  categories: ['catalog', 'categories'] as const,
  search: (params: SearchProductsParams | null) => ['catalog', 'search', params] as const,
  product: (productId: string) => ['catalog', 'product', productId] as const,
  reviews: (productId: string) => ['reviews', 'product', productId] as const,
}

/** `GET /v1/products` — tìm kiếm, lọc, sắp xếp sản phẩm đang bán (FR-PRD-006). */
export function apiSearchProducts(params: SearchProductsParams): Promise<ProductSearchPage> {
  return unwrap(prdClient.GET('/v1/products', { params: { query: params } }))
}

/** `GET /v1/products/{id}` — người mua chỉ nhận sản phẩm hiển thị được; chủ gian hàng xem được cả sản phẩm nháp/ẩn (FR-PRD-004). */
export function apiGetProduct(productId: string): Promise<Product> {
  return unwrap(prdClient.GET('/v1/products/{id}', { params: { path: { id: productId } } }))
}

/** `GET /v1/categories` — cây danh mục VISIBLE 2 cấp. */
export async function apiListPublicCategories(): Promise<Category[]> {
  return (await unwrap(prdClient.GET('/v1/categories'))).data ?? []
}

/** `POST /v1/cart/items` — thêm biến thể vào giỏ, trả về giỏ hiện tại (FR-CRT-001). */
export function apiAddCartItem(body: AddCartItemRequestBody): Promise<CartView> {
  return unwrap(ordClient.POST('/v1/cart/items', { body }))
}

/**
 * `GET /v1/products/{id}/reviews` (FR-REV-002). SVC-REV chưa có hợp đồng trong `src/api/generated`
 * nên hàm này chỉ trả payload thô: T3-06 dùng để biết dịch vụ trả lời được hay không và giảm cấp đúng khối
 * (NFR-REL-005); hiển thị danh sách đánh giá thuộc T2-11.
 */
export async function apiGetProductReviews(productId: string): Promise<unknown> {
  let response: Response
  try {
    response = await authFetch(
      new Request(`${env.apiBaseUrl}/v1/products/${encodeURIComponent(productId)}/reviews`),
    )
  } catch {
    throw networkError()
  }
  if (!response.ok) throw toApiError(await response.json().catch(() => null), response)
  return response.json()
}
