// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({ env: { apiBaseUrl: 'http://api.test', demoMode: false } }))

import '@/lib/dayjs'
import '@/lib/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { clearAuthSession, setAuthSession } from '@/lib/auth/session'
import type { ProductSummary, PublicShopDTO, ShopDTO } from './api'
import { AdminShopsPage } from './pages/AdminShopsPage'
import { PublicShopPage } from './pages/PublicShopPage'
import { SellerShopPage } from './pages/SellerShopPage'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const APP_ID = '22222222-2222-4222-8222-222222222222'
const SHOP_ID = '33333333-3333-4333-8333-333333333333'
const PROD_ID = '44444444-4444-4444-8444-444444444444'

function user(roles: string[]) {
  return { userId: USER_ID, email: 'khanh@soa.vn', fullName: 'Khánh', phone: '0900000000', createdAt: '', status: 'ACTIVE', roles }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function apiError(status: number, code: string, message: string, details: unknown[] = []) {
  return json({ code, message, details, correlationId: 'corr-shop-1' }, status)
}

function makeShop(overrides: Partial<ShopDTO> = {}): ShopDTO {
  return {
    shopId: SHOP_ID,
    applicationId: APP_ID,
    sellerUserId: USER_ID,
    name: 'Shop Nhật Khánh',
    description: 'Chuyên phụ kiện chính hãng',
    policy: 'Đổi trả trong 7 ngày',
    contactEmail: 'shop@soa.vn',
    contactPhone: '0901234567',
    status: 'ACTIVE',
    ratingAvg: 4.8,
    ratingCount: 12,
    version: 1,
    createdAt: '2026-11-20T03:00:00Z',
    updatedAt: '2026-11-21T04:00:00Z',
    pickupAddress: {
      contactName: 'Nguyễn Nhật Khánh',
      phone: '0901234567',
      line: '123 Lê Lợi',
      ward: 'Bến Thành',
      district: 'Quận 1',
      province: 'TP.HCM',
      updatedAt: '2026-11-21T04:00:00Z',
    },
    ...overrides,
  }
}

function makePublicShop(overrides: Partial<PublicShopDTO> = {}): PublicShopDTO {
  return {
    shopId: SHOP_ID,
    name: 'Shop Nhật Khánh',
    description: 'Chuyên phụ kiện chính hãng',
    policy: 'Bảo hành 12 tháng',
    ratingAvg: 4.8,
    ratingCount: 12,
    createdAt: '2026-11-20T03:00:00Z',
    ...overrides,
  }
}

function makeProduct(overrides: Partial<ProductSummary> = {}): ProductSummary {
  return {
    productId: PROD_ID,
    shopId: SHOP_ID,
    categoryId: '55555555-5555-4555-8555-555555555555',
    name: 'Bàn phím cơ không dây 75%',
    images: ['products/shop-1/kbd.jpg'],
    minPrice: 1_250_000,
    maxPrice: 1_250_000,
    inStock: true,
    soldCount: 42,
    ratingAvg: 4.9,
    ratingCount: 10,
    ...overrides,
  }
}

type Handler = (request: Request) => Response | Promise<Response>
let handlers: Array<{ method: string; path: string | RegExp; handle: Handler }>
let calls: Request[]

function on(method: string, path: string | RegExp, handle: Handler) {
  handlers.unshift({ method, path, handle })
}

beforeEach(() => {
  handlers = []
  calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(String(input), init)
      calls.push(request)
      const { pathname } = new URL(request.url)
      const match = handlers.find(
        (h) => h.method === request.method && (typeof h.path === 'string' ? h.path === pathname : h.path.test(pathname)),
      )
      if (!match) throw new Error(`Unhandled ${request.method} ${pathname}`)
      return match.handle(request)
    }),
  )
})

afterEach(() => {
  cleanup()
  clearAuthSession()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function renderAt(pathPattern: string, initialEntry: string, element: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path={pathPattern} element={element} />
            <Route path="/products/:id" element={<p>PRODUCT DETAIL</p>} />
            <Route path="/" element={<p>HOME</p>} />
            <Route path="/products" element={<p>PRODUCTS</p>} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

describe('SellerShopPage (/seller/shop — FR-SEL-003, FR-SEL-004, TC-SEL-03..04)', () => {
  beforeEach(() => setAuthSession({ accessToken: 'access-seller', refreshToken: 'r-1', user: user(['BUYER', 'SELLER']) }))

  it('TC-SEL-03: shows missing pickup alert, updates shop profile multipart, and updates pickup address', async () => {
    const u = userEvent.setup()
    const setSpy = vi.spyOn(FormData.prototype, 'set')
    const initialShop = makeShop({ pickupAddress: undefined })

    on('GET', '/v1/seller/shop', () => json(initialShop))
    on('PUT', '/v1/seller/shop', () => json(makeShop({ name: 'Shop Khánh Pro', pickupAddress: undefined, version: 2 })))
    on('PUT', '/v1/seller/shop/pickup-address', async (req) => {
      const body = (await req.json()) as Record<string, string>
      expect(body.province).toBe('TP.HCM')
      return json(makeShop({ name: 'Shop Khánh Pro', version: 2 }))
    })

    renderAt('/seller/shop', '/seller/shop', <SellerShopPage />)

    expect(await screen.findByText('Chưa cấu hình địa chỉ lấy hàng')).toBeTruthy()

    const nameInput = screen.getByLabelText(/Tên gian hàng/)
    await u.clear(nameInput)
    await u.type(nameInput, 'Shop Khánh Pro')
    await u.upload(screen.getByLabelText(/Logo gian hàng/), new File(['png'], 'logo.png', { type: 'image/png' }))
    await u.click(screen.getByRole('button', { name: 'Lưu thông tin' }))

    expect(await screen.findByText('Đã cập nhật thông tin gian hàng.')).toBeTruthy()
    expect(setSpy.mock.calls.some(([field, val]) => field === 'logo' && val instanceof File)).toBe(true)

    await u.type(screen.getByLabelText(/Tên người liên hệ lấy hàng/), 'Nguyễn Nhật Khánh')
    await u.type(screen.getByLabelText(/Số điện thoại lấy hàng/), '0901234567')
    await u.type(screen.getByLabelText(/Địa chỉ chi tiết/), '123 Lê Lợi')
    await u.type(screen.getByLabelText(/Phường \/ Xã/), 'Bến Thành')
    await u.type(screen.getByLabelText(/Quận \/ Huyện/), 'Quận 1')
    await u.type(screen.getByLabelText(/Tỉnh \/ Thành phố/), 'TP.HCM')
    await u.click(screen.getByRole('button', { name: 'Lưu địa chỉ lấy hàng' }))

    expect(await screen.findByText('Đã cập nhật địa chỉ lấy hàng mặc định.')).toBeTruthy()
    expect(screen.queryByText('Chưa cấu hình địa chỉ lấy hàng')).toBeNull()
  })

  it('maps 409 SHOP_NAME_TAKEN onto the shop name input', async () => {
    const u = userEvent.setup()
    on('GET', '/v1/seller/shop', () => json(makeShop()))
    on('PUT', '/v1/seller/shop', () => apiError(409, 'SHOP_NAME_TAKEN', 'Tên gian hàng đã được sử dụng.'))

    renderAt('/seller/shop', '/seller/shop', <SellerShopPage />)
    await screen.findByDisplayValue('Shop Nhật Khánh')
    await u.click(screen.getByRole('button', { name: 'Lưu thông tin' }))

    expect(await screen.findByText('Tên gian hàng đã được sử dụng.')).toBeTruthy()
    expect(screen.getByLabelText(/Tên gian hàng/).getAttribute('aria-invalid')).toBe('true')
  })

  it('TC-SEL-03/04: locks profile/logo/pickup/status editing when shop is LOCKED', async () => {
    on('GET', '/v1/seller/shop', () =>
      json(makeShop({ status: 'LOCKED', statusChangedBy: 'ADMIN', statusReason: 'Vi phạm quy định bán hàng giả' })),
    )

    renderAt('/seller/shop', '/seller/shop', <SellerShopPage />)

    expect(await screen.findByText('Gian hàng đang bị Quản trị viên khóa')).toBeTruthy()
    expect(screen.getAllByText(/Vi phạm quy định bán hàng giả/).length).toBeGreaterThanOrEqual(1)
    expect((screen.getByLabelText(/Tên gian hàng/) as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText(/Mô tả gian hàng/) as HTMLTextAreaElement).disabled).toBe(true)
    expect((screen.getByLabelText(/Chính sách bán hàng/) as HTMLTextAreaElement).disabled).toBe(true)
    expect((screen.getByLabelText(/Địa chỉ chi tiết/) as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Lưu địa chỉ lấy hàng' }).hasAttribute('disabled')).toBe(true)
    expect((screen.getByLabelText(/Email liên hệ/) as HTMLInputElement).disabled).toBe(false)
    expect(screen.queryByRole('button', { name: 'Tạm ngưng gian hàng' })).toBeNull()
  })

  it('TC-SEL-04: allows seller suspend & resume, and blocks resume when suspended by ADMIN', async () => {
    const u = userEvent.setup()
    on('GET', '/v1/seller/shop', () => json(makeShop()))
    on('POST', '/v1/seller/shop/suspend', async (req) => {
      const body = (await req.json()) as { reason?: string }
      expect(body.reason).toBe('Nghỉ lễ 2 ngày')
      return json(makeShop({ status: 'SUSPENDED', statusChangedBy: 'SELLER', statusReason: 'Nghỉ lễ 2 ngày', version: 2 }))
    })
    on('POST', '/v1/seller/shop/resume', () => json(makeShop({ status: 'ACTIVE', statusChangedBy: 'SELLER', version: 3 })))

    renderAt('/seller/shop', '/seller/shop', <SellerShopPage />)
    await u.click(await screen.findByRole('button', { name: 'Tạm ngưng gian hàng' }))

    const dialog = await screen.findByRole('dialog')
    await u.type(within(dialog).getByRole('textbox'), 'Nghỉ lễ 2 ngày')
    await u.click(within(dialog).getByRole('button', { name: 'Xác nhận tạm ngưng' }))

    expect(await screen.findByText('Đã tạm ngưng gian hàng.')).toBeTruthy()
    await u.click(screen.getByRole('button', { name: 'Mở lại gian hàng' }))
    expect(await screen.findByText('Đã mở lại gian hàng.')).toBeTruthy()

    cleanup()
    on('GET', '/v1/seller/shop', () =>
      json(makeShop({ status: 'SUSPENDED', statusChangedBy: 'ADMIN', statusReason: 'Chờ bổ sung chứng từ' })),
    )
    renderAt('/seller/shop', '/seller/shop', <SellerShopPage />)
    expect(await screen.findByText('Gian hàng đang bị Quản trị viên tạm ngưng')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mở lại gian hàng' }).hasAttribute('disabled')).toBe(true)
  })
})

describe('AdminShopsPage (/admin/shops — FR-SEL-004, TC-SEL-04)', () => {
  beforeEach(() => setAuthSession({ accessToken: 'access-admin', refreshToken: 'r-a', user: user(['ADMINISTRATOR']) }))

  it('filters by status tab, searches by name, and locks a shop with mandatory AuditReasonDialog', async () => {
    const u = userEvent.setup()
    const shop = makeShop()
    on('GET', '/v1/admin/shops', () =>
      json({ data: [shop], pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } }),
    )
    let statusBody: unknown
    on('POST', `/v1/admin/shops/${SHOP_ID}/status`, async (req) => {
      statusBody = await req.json()
      return json(makeShop({ status: 'LOCKED', statusChangedBy: 'ADMIN', statusReason: 'Bán hàng giả mạo thương hiệu' }))
    })

    renderAt('/admin/shops', '/admin/shops', <AdminShopsPage />)
    const [detailBtn] = await screen.findAllByRole('button', { name: /Chi tiết/ })

    await u.click(screen.getByRole('tab', { name: 'Tạm ngưng' }))
    await u.type(screen.getByRole('searchbox'), 'Nhật Khánh')
    await u.click(screen.getByRole('button', { name: 'Tìm' }))

    const shopListQueries = calls
      .filter((r) => new URL(r.url).pathname === '/v1/admin/shops')
      .map((r) => new URL(r.url).searchParams.toString())
    expect(shopListQueries.some((q) => q.includes('status=SUSPENDED') && q.includes('q=Nh'))).toBe(true)

    await u.click(detailBtn!)
    const sheet = await screen.findByRole('dialog')
    await u.click(within(sheet).getByRole('button', { name: 'Khóa gian hàng' }))

    const auditDialog = await screen.findByRole('dialog', { name: /Khóa gian hàng Shop Nhật Khánh/ })
    const confirmBtn = within(auditDialog).getByRole('button', { name: 'Xác nhận khóa gian hàng' })
    await u.type(within(auditDialog).getByRole('textbox'), 'ngắn')
    expect(confirmBtn.hasAttribute('disabled')).toBe(true)

    await u.type(within(auditDialog).getByRole('textbox'), ' — bán hàng giả mạo thương hiệu')
    await u.click(confirmBtn)

    expect(await screen.findByText('Đã cập nhật trạng thái gian hàng Shop Nhật Khánh.')).toBeTruthy()
    expect(statusBody).toEqual({ status: 'LOCKED', reason: 'ngắn — bán hàng giả mạo thương hiệu' })
  })

  it('handles 409 SHOP_STATUS_CONFLICT by closing dialog and reloading list', async () => {
    const u = userEvent.setup()
    on('GET', '/v1/admin/shops', () =>
      json({ data: [makeShop()], pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } }),
    )
    on('POST', `/v1/admin/shops/${SHOP_ID}/status`, () =>
      apiError(409, 'SHOP_STATUS_CONFLICT', 'Gian hàng đã ở trạng thái LOCKED.'),
    )

    renderAt('/admin/shops', '/admin/shops', <AdminShopsPage />)
    const [detailBtn] = await screen.findAllByRole('button', { name: /Chi tiết/ })
    await u.click(detailBtn!)
    await u.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Khóa gian hàng' }))

    const auditDialog = await screen.findByRole('dialog', { name: /Khóa gian hàng Shop Nhật Khánh/ })
    await u.type(within(auditDialog).getByRole('textbox'), 'Lý do khóa gian hàng hợp lệ ≥ 10 ký tự')
    await u.click(within(auditDialog).getByRole('button', { name: 'Xác nhận khóa gian hàng' }))

    expect(await screen.findByText('Trạng thái gian hàng vừa thay đổi trước đó. Danh sách đã được tải lại.')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

describe('PublicShopPage (/shops/:id — FR-SEL-005, TC-SEL-05, NFR-REL-005)', () => {
  it('TC-SEL-05: renders public shop and products normally while degrading gracefully when SVC-REV is unavailable', async () => {
    const u = userEvent.setup()
    on('GET', `/v1/shops/${SHOP_ID}`, () => json(makePublicShop()))
    on('GET', '/v1/products', () =>
      json({ data: [makeProduct()], pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } }),
    )
    let revAttempts = 0
    on('GET', `/v1/shops/${SHOP_ID}/reviews/summary`, () => {
      revAttempts += 1
      if (revAttempts === 1) return apiError(503, 'SERVICE_UNAVAILABLE', 'SVC-REV down')
      return json({
        shopId: SHOP_ID,
        avgStars: 4.8,
        totalCount: 12,
        starCounts: { '5': 10, '4': 2, '3': 0, '2': 0, '1': 0 },
      })
    })

    renderAt('/shops/:id', `/shops/${SHOP_ID}`, <PublicShopPage />)

    expect(await screen.findByRole('heading', { name: 'Shop Nhật Khánh' })).toBeTruthy()
    expect(await screen.findByText('Bàn phím cơ không dây 75%')).toBeTruthy()
    expect(screen.getByText(/1\.250\.000/)).toBeTruthy()
    expect(await screen.findByText('Tạm thời không thể tải khối đánh giá gian hàng.')).toBeTruthy()

    await u.click(screen.getByRole('button', { name: 'Thử tải lại khối này' }))
    expect(await screen.findByText('12 lượt đánh giá')).toBeTruthy()

    await u.selectOptions(screen.getByLabelText('Sắp xếp'), 'price_asc')
    await waitFor(() =>
      expect(
        calls.some((r) => {
          const url = new URL(r.url)
          return url.pathname === '/v1/products' && url.searchParams.get('sort') === 'price_asc' && url.searchParams.get('shopId') === SHOP_ID
        }),
      ).toBe(true),
    )
  })

  it('renders 404 unavailable message when shop is SUSPENDED/LOCKED/missing', async () => {
    on('GET', `/v1/shops/${SHOP_ID}`, () => apiError(404, 'SHOP_NOT_AVAILABLE', 'Gian hàng không khả dụng.'))

    renderAt('/shops/:id', `/shops/${SHOP_ID}`, <PublicShopPage />)
    expect(await screen.findByRole('heading', { name: 'Gian hàng không khả dụng' })).toBeTruthy()
  })

  it('degrades only the products block when SVC-PRD fails', async () => {
    on('GET', `/v1/shops/${SHOP_ID}`, () => json(makePublicShop()))
    on('GET', `/v1/shops/${SHOP_ID}/reviews/summary`, () => json({ avgStars: 4.8, totalCount: 12, starCounts: {} }))
    on('GET', '/v1/products', () => apiError(503, 'SERVICE_UNAVAILABLE', 'SVC-PRD down'))

    renderAt('/shops/:id', `/shops/${SHOP_ID}`, <PublicShopPage />)
    expect(await screen.findByRole('heading', { name: 'Shop Nhật Khánh' })).toBeTruthy()
    expect(await screen.findByText('Tạm thời không thể tải danh sách sản phẩm của gian hàng.')).toBeTruthy()
  })
})
