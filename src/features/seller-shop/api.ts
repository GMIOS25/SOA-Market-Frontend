import { authFetch } from '@/api/auth-fetch'
import { createApiClient } from '@/api/client'
import { ApiError, networkError, toApiError, unwrap } from '@/api/errors'
import type { SvcPrd, SvcSel } from '@/api/generated'
import { env } from '@/lib/env'

export type ApplicationDTO = SvcSel.components['schemas']['ApplicationDTO']
export type ApplicationDocumentDTO = SvcSel.components['schemas']['ApplicationDocumentDTO']
export type PagedApplicationDTO = SvcSel.components['schemas']['PagedApplicationDTO']
export type ApplicationStatus = ApplicationDTO['status']
export type SellerType = ApplicationDTO['sellerType']
export type DocumentType = ApplicationDocumentDTO['type']
export type ListApplicationsParams = NonNullable<
  SvcSel.operations['admin-seller-application-list']['parameters']['query']
>

export type ShopDTO = SvcSel.components['schemas']['ShopDTO']
export type PublicShopDTO = SvcSel.components['schemas']['PublicShopDTO']
export type PickupAddressDTO = SvcSel.components['schemas']['PickupAddressDTO']
export type PagedShopDTO = SvcSel.components['schemas']['PagedShopDTO']
export type PickupAddressRequestBody = SvcSel.components['schemas']['PickupAddressRequestBody']
export type ShopStatus = ShopDTO['status']
export type StatusChangedBy = NonNullable<ShopDTO['statusChangedBy']>
export type ListShopsParams = NonNullable<SvcSel.operations['admin-shop-list']['parameters']['query']>

export type ProductSummary = SvcPrd.components['schemas']['ProductSummary']
export type ProductSearchPage = SvcPrd.components['schemas']['ProductSearchPage']
export type ListShopProductsParams = NonNullable<SvcPrd.operations['search-products']['parameters']['query']>
export type ShopProductSort = NonNullable<ListShopProductsParams['sort']>

/**
 * Hợp đồng xem trước cho `GET /v1/shops/{id}/reviews/summary` của SVC-REV (Phase 5, 02-TRD §5.2 B.7).
 * Sẽ chuyển sang type sinh từ `svc-rev.yaml` trong task T2-09.
 */
export type ShopReviewsSummaryDTO = {
  shopId?: string
  avgStars?: number
  ratingAvg?: number
  totalCount?: number
  ratingCount?: number
  starCounts?: Record<string, number>
}

export const selClient = createApiClient<SvcSel.paths>()
export const prdClient = createApiClient<SvcPrd.paths>()

/** Trường multipart của từng loại tài liệu KYC (khớp `DocumentFields` của SVC-SEL). */
export const DOCUMENT_FIELDS = {
  CCCD_FRONT: 'cccdFront',
  CCCD_BACK: 'cccdBack',
  BUSINESS_LICENSE: 'businessLicense',
  REPRESENTATIVE_CCCD_FRONT: 'representativeCccdFront',
  REPRESENTATIVE_CCCD_BACK: 'representativeCccdBack',
} as const satisfies Record<DocumentType, string>

export type DocumentField = (typeof DOCUMENT_FIELDS)[DocumentType]

/** Tài liệu bắt buộc theo loại hình (FR-SEL-001, khớp `RequiredDocuments` của SVC-SEL). */
export const REQUIRED_DOCUMENTS: Record<SellerType, DocumentType[]> = {
  INDIVIDUAL: ['CCCD_FRONT', 'CCCD_BACK'],
  ORGANIZATION: ['BUSINESS_LICENSE', 'REPRESENTATIVE_CCCD_FRONT', 'REPRESENTATIVE_CCCD_BACK'],
}

export const sellerShopKeys = {
  myApplication: ['seller-application', 'me'] as const,
  adminApplications: ['admin', 'seller-applications'] as const,
  adminApplicationList: (params: ListApplicationsParams) => ['admin', 'seller-applications', params] as const,
  kycDocument: (applicationId: string, docType: DocumentType) => ['admin', 'kyc', applicationId, docType] as const,
  myShop: ['seller', 'shop'] as const,
  adminShops: ['admin', 'shops'] as const,
  adminShopList: (params: ListShopsParams) => ['admin', 'shops', params] as const,
  publicShop: (id: string) => ['shops', id] as const,
  publicShopProducts: (id: string, params: Omit<ListShopProductsParams, 'shopId'>) =>
    ['shops', id, 'products', params] as const,
  publicShopReviewsSummary: (id: string) => ['shops', id, 'reviews-summary'] as const,
}

/** Hồ sơ mới nhất của tôi; `null` khi chưa từng nộp (404 `APPLICATION_NOT_FOUND`). */
export async function apiGetMyApplication(): Promise<ApplicationDTO | null> {
  try {
    return await unwrap(selClient.GET('/v1/seller-applications/me'))
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export type SubmitApplicationInput = {
  sellerType: SellerType
  shopName: string
  identityOrBusinessNumber: string
  taxCode: string
  files: Partial<Record<DocumentType, File>>
}

/**
 * `POST /v1/seller-applications` (multipart/form-data). Gọi thẳng `authFetch` với `FormData` để trình duyệt
 * tự đặt `Content-Type` kèm boundary; chỉ gửi tài liệu áp dụng cho loại hình đã chọn (BE trả 422 nếu thừa).
 */
export async function apiSubmitApplication(input: SubmitApplicationInput): Promise<ApplicationDTO> {
  const form = new FormData()
  form.set('sellerType', input.sellerType)
  form.set('shopName', input.shopName.trim())
  form.set('identityOrBusinessNumber', input.identityOrBusinessNumber.trim())
  form.set('taxCode', input.taxCode.trim())
  for (const docType of REQUIRED_DOCUMENTS[input.sellerType]) {
    const file = input.files[docType]
    if (file) form.set(DOCUMENT_FIELDS[docType], file, file.name)
  }

  let response: Response
  try {
    response = await authFetch(
      new Request(`${env.apiBaseUrl}/v1/seller-applications`, { method: 'POST', body: form }),
    )
  } catch {
    throw networkError()
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw toApiError(body, response)
  return body as ApplicationDTO
}

export function apiAdminListApplications(params: ListApplicationsParams): Promise<PagedApplicationDTO> {
  return unwrap(selClient.GET('/v1/admin/seller-applications', { params: { query: params } }))
}

export function apiAdminApproveApplication(id: string, note?: string): Promise<ApplicationDTO> {
  const trimmed = note?.trim()
  return unwrap(
    selClient.POST('/v1/admin/seller-applications/{id}/approve', {
      params: { path: { id } },
      body: trimmed ? { note: trimmed } : {},
    }),
  )
}

export function apiAdminRejectApplication(id: string, reason: string): Promise<ApplicationDTO> {
  return unwrap(
    selClient.POST('/v1/admin/seller-applications/{id}/reject', {
      params: { path: { id } },
      body: { reason },
    }),
  )
}

/**
 * Ảnh KYC qua proxy của SVC-SEL (bucket `private-kyc`, NFR-SEC-011). Thẻ `<img>` không gửi được Bearer
 * nên phải tải bằng `authFetch` thành Blob rồi hiển thị qua object URL.
 */
export async function apiAdminGetDocument(applicationId: string, docType: DocumentType): Promise<Blob> {
  const url = `${env.apiBaseUrl}/v1/admin/seller-applications/${encodeURIComponent(applicationId)}/documents/${docType}`
  let response: Response
  try {
    response = await authFetch(new Request(url, { method: 'GET', cache: 'no-store' }))
  } catch {
    throw networkError()
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    throw toApiError(body, response)
  }
  return response.blob()
}

export function apiGetMyShop(): Promise<ShopDTO> {
  return unwrap(selClient.GET('/v1/seller/shop'))
}

export type UpdateShopInput = {
  name: string
  description: string
  policy: string
  contactEmail: string
  contactPhone: string
  logo?: File | null
}

/**
 * `PUT /v1/seller/shop` (multipart/form-data). Luôn gửi đủ trường văn bản để có thể xóa trường tùy chọn khi bỏ trống;
 * chỉ đính kèm `logo` khi người dùng chọn tệp ảnh mới (không gửi = giữ nguyên logo hiện tại).
 */
export async function apiUpdateMyShop(input: UpdateShopInput): Promise<ShopDTO> {
  const form = new FormData()
  form.set('name', input.name.trim())
  form.set('description', input.description.trim())
  form.set('policy', input.policy.trim())
  form.set('contactEmail', input.contactEmail.trim())
  form.set('contactPhone', input.contactPhone.trim())
  if (input.logo instanceof File) {
    form.set('logo', input.logo, input.logo.name)
  }

  let response: Response
  try {
    response = await authFetch(new Request(`${env.apiBaseUrl}/v1/seller/shop`, { method: 'PUT', body: form }))
  } catch {
    throw networkError()
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw toApiError(body, response)
  return body as ShopDTO
}

export function apiUpdatePickupAddress(body: PickupAddressRequestBody): Promise<ShopDTO> {
  return unwrap(
    selClient.PUT('/v1/seller/shop/pickup-address', {
      body: {
        contactName: body.contactName.trim(),
        phone: body.phone.trim(),
        line: body.line.trim(),
        ward: body.ward.trim(),
        district: body.district.trim(),
        province: body.province.trim(),
      },
    }),
  )
}

export function apiSuspendMyShop(reason?: string): Promise<ShopDTO> {
  const trimmed = reason?.trim()
  return unwrap(
    selClient.POST('/v1/seller/shop/suspend', {
      body: trimmed ? { reason: trimmed } : {},
    }),
  )
}

export function apiResumeMyShop(): Promise<ShopDTO> {
  return unwrap(selClient.POST('/v1/seller/shop/resume'))
}

export function apiAdminListShops(params: ListShopsParams): Promise<PagedShopDTO> {
  return unwrap(selClient.GET('/v1/admin/shops', { params: { query: params } }))
}

export function apiAdminUpdateShopStatus(id: string, status: ShopStatus, reason: string): Promise<ShopDTO> {
  return unwrap(
    selClient.POST('/v1/admin/shops/{id}/status', {
      params: { path: { id } },
      body: { status, reason },
    }),
  )
}

export function apiGetPublicShop(id: string): Promise<PublicShopDTO> {
  return unwrap(selClient.GET('/v1/shops/{id}', { params: { path: { id } } }))
}

export function apiListShopProducts(params: ListShopProductsParams): Promise<ProductSearchPage> {
  return unwrap(prdClient.GET('/v1/products', { params: { query: params } }))
}

/** Gọi độc lập tới SVC-REV để khối đánh giá tự giảm cấp bằng `<ServiceFallbackBanner />` khi dịch vụ chưa sẵn sàng/lỗi (NFR-REL-005). */
export async function apiGetPublicShopReviewsSummary(shopId: string): Promise<ShopReviewsSummaryDTO> {
  const url = `${env.apiBaseUrl}/v1/shops/${encodeURIComponent(shopId)}/reviews/summary`
  let response: Response
  try {
    response = await authFetch(new Request(url, { method: 'GET' }))
  } catch {
    throw networkError()
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw toApiError(body, response)
  return (body ?? {}) as ShopReviewsSummaryDTO
}
