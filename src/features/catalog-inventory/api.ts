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
export type ProductBody = SvcPrd.components['schemas']['ProductBody']
export type VariantInput = SvcPrd.components['schemas']['VariantInput']
export type SellerInventoryEntry = SvcPrd.components['schemas']['SellerInventoryEntry']
export type PageSellerInventoryEntry = SvcPrd.components['schemas']['PageSellerInventoryEntry']
export type SellerStockInput = SvcPrd.components['schemas']['SellerStockInput']
export type SellerStockResult = SvcPrd.components['schemas']['SellerStockResult']
export type CategoryBody = SvcPrd.components['schemas']['CategoryBody']
export type PageProduct = SvcPrd.components['schemas']['PageProduct']
export type ReviewDecisionRequestBody = SvcPrd.components['schemas']['ReviewDecisionRequestBody']
export type ImageUploadResponseBody = SvcPrd.components['schemas']['ImageUploadResponseBody']
export type AddCartItemRequestBody = SvcOrd.components['schemas']['AddCartItemRequestBody']
export type SearchProductsParams = NonNullable<SvcPrd.operations['search-products']['parameters']['query']>
export type SearchSort = NonNullable<SearchProductsParams['sort']>

export const prdClient = createApiClient<SvcPrd.paths>()

/** Giỏ hàng của người mua — cùng query key mà `CartPage` đọc (`['cart']`), để thêm ở trang sản phẩm xong trang giỏ thấy ngay. */
export const CART_QUERY_KEY = ['cart'] as const

/** Query key của miền catalog: storefront, quản lý sản phẩm/kho nhà bán và danh mục/kiểm duyệt admin. */
export const catalogKeys = {
  categories: ['catalog', 'categories'] as const,
  search: (params: SearchProductsParams | null) => ['catalog', 'search', params] as const,
  product: (productId: string) => ['catalog', 'product', productId] as const,
  reviews: (productId: string) => ['reviews', 'product', productId] as const,
  sellerProductsList: ['catalog', 'seller-products'] as const,
  sellerInventoryRoot: ['catalog', 'seller-inventory'] as const,
  sellerInventory: (params: { page?: number; pageSize?: number; productId?: string }) =>
    ['catalog', 'seller-inventory', params] as const,
  adminCategories: ['catalog', 'admin-categories'] as const,
  adminReviewQueueRoot: ['catalog', 'admin-review-queue'] as const,
  adminReviewQueue: (params: { page?: number; pageSize?: number }) =>
    ['catalog', 'admin-review-queue', params] as const,
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

/** `GET /v1/seller/inventory` — danh sách tồn kho theo SKU của gian hàng (FR-PRD-007). */
export function apiListSellerInventory(params: {
  page?: number
  pageSize?: number
  productId?: string
}): Promise<PageSellerInventoryEntry> {
  return unwrap(
    prdClient.GET('/v1/seller/inventory', {
      params: {
        query: {
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 20,
          ...(params.productId ? { productId: params.productId } : {}),
        },
      },
    }),
  )
}

/** Tải toàn bộ trang tồn kho (pageSize=100) để nhóm thành danh sách sản phẩm cho `/seller/products`. */
export async function apiListAllSellerInventory(): Promise<SellerInventoryEntry[]> {
  const all: SellerInventoryEntry[] = []
  let page = 1
  for (;;) {
    const res = await apiListSellerInventory({ page, pageSize: 100 })
    const rows = res.data ?? []
    all.push(...rows)
    if (page >= res.pagination.totalPages || rows.length === 0) break
    page += 1
  }
  return all
}

/** `PUT /v1/seller/variants/{id}/stock` — cập nhật tồn kho vật lý với optimistic locking (FR-PRD-007). */
export function apiUpdateVariantStock(variantId: string, body: SellerStockInput): Promise<SellerStockResult> {
  return unwrap(
    prdClient.PUT('/v1/seller/variants/{id}/stock', {
      params: { path: { id: variantId } },
      body,
    }),
  )
}

/**
 * `POST /v1/seller/products/images` (multipart/form-data, JPEG/PNG/WebP ≤ 5 MB).
 * Gọi trực tiếp `authFetch` với `FormData` để trình duyệt tự đặt multipart boundary.
 */
export async function apiUploadProductImage(file: File): Promise<ImageUploadResponseBody> {
  const form = new FormData()
  form.set('file', file, file.name)

  let response: Response
  try {
    response = await authFetch(
      new Request(`${env.apiBaseUrl}/v1/seller/products/images`, { method: 'POST', body: form }),
    )
  } catch {
    throw networkError()
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw toApiError(body, response)
  return body as ImageUploadResponseBody
}

/** `POST /v1/seller/products` — tạo sản phẩm với nhiều biến thể SKU (FR-PRD-001). */
export function apiCreateProduct(body: ProductBody): Promise<Product> {
  return unwrap(prdClient.POST('/v1/seller/products', { body }))
}

/** `PUT /v1/seller/products/{id}` — cập nhật sản phẩm kèm `version` (FR-PRD-002). */
export function apiUpdateProduct(productId: string, body: ProductBody): Promise<Product> {
  return unwrap(
    prdClient.PUT('/v1/seller/products/{id}', {
      params: { path: { id: productId } },
      body,
    }),
  )
}

/** `POST /v1/seller/products/{id}/hide` — ẩn tạm thời sản phẩm (FR-PRD-003). */
export function apiHideProduct(productId: string, version: number): Promise<Product> {
  return unwrap(
    prdClient.POST('/v1/seller/products/{id}/hide', {
      params: { path: { id: productId } },
      body: { version },
    }),
  )
}

/** `DELETE /v1/seller/products/{id}` — xóa mềm sản phẩm (FR-PRD-003, BR-PRD-04). */
export function apiDeleteProduct(productId: string, version: number): Promise<Product> {
  return unwrap(
    prdClient.DELETE('/v1/seller/products/{id}', {
      params: { path: { id: productId }, query: { version } },
    }),
  )
}

/** `GET /v1/admin/categories` — toàn bộ cây danh mục 2 cấp kể cả danh mục HIDDEN (FR-PRD-005). */
export async function apiAdminListCategories(): Promise<Category[]> {
  return (await unwrap(prdClient.GET('/v1/admin/categories'))).data ?? []
}

/** `POST /v1/admin/categories` — tạo danh mục cấp 1 hoặc cấp 2. */
export function apiAdminCreateCategory(body: CategoryBody): Promise<Category> {
  return unwrap(prdClient.POST('/v1/admin/categories', { body }))
}

/** `PUT /v1/admin/categories/{id}` — sửa tên, thứ tự hoặc trạng thái hiển thị của danh mục. */
export function apiAdminUpdateCategory(categoryId: string, body: CategoryBody): Promise<Category> {
  return unwrap(
    prdClient.PUT('/v1/admin/categories/{id}', {
      params: { path: { id: categoryId } },
      body,
    }),
  )
}

/** `DELETE /v1/admin/categories/{id}` — xóa danh mục trống (còn con/sản phẩm trả 409 CATEGORY_IN_USE). */
export async function apiAdminDeleteCategory(categoryId: string): Promise<void> {
  await unwrap(
    prdClient.DELETE('/v1/admin/categories/{id}', {
      params: { path: { id: categoryId } },
    }),
  )
}

/** `GET /v1/admin/products/review-queue` — hàng chờ kiểm duyệt sản phẩm PENDING_REVIEW (FR-PRD-009). */
export function apiAdminListReviewQueue(params: { page?: number; pageSize?: number }): Promise<PageProduct> {
  return unwrap(
    prdClient.GET('/v1/admin/products/review-queue', {
      params: {
        query: {
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 20,
        },
      },
    }),
  )
}

/** `POST /v1/admin/products/{id}/decision` — APPROVE / REJECT / TAKEDOWN (FR-PRD-009). */
export function apiAdminDecideProduct(productId: string, body: ReviewDecisionRequestBody): Promise<Product> {
  return unwrap(
    prdClient.POST('/v1/admin/products/{id}/decision', {
      params: { path: { id: productId } },
      body,
    }),
  )
}
