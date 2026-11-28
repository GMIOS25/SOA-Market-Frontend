// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: { apiBaseUrl: 'http://api.test', demoMode: false, mediaBaseUrl: 'http://media.test/public-products' },
}))

import '@/lib/dayjs'
import '@/lib/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { clearAuthSession, setAuthSession } from '@/lib/auth/session'
import type { AdminReviewDTO, BuyerOrderDetailView, ReviewDTO } from './api'
import { ProductReviewsPanel } from './components/ProductReviewsPanel'
import { AdminReviewModerationPage } from './pages/AdminReviewModerationPage'
import { MyReviewsPage } from './pages/MyReviewsPage'
import { SellerReviewsPage } from './pages/SellerReviewsPage'

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111'
const SHOP_ID = '22222222-2222-4222-8222-222222222222'
const ORDER_ID = '33333333-3333-4333-8333-333333333333'
const SO_ID = '44444444-4444-4444-8444-444444444444'
const ITEM_A = '55555555-5555-4555-8555-555555555555'
const ITEM_B = '66666666-6666-4666-8666-666666666666'
const REVIEW_ID = '77777777-7777-4777-8777-777777777777'

function user(roles: string[]) {
  return { userId: 'u-1', email: 'khanh@soa.vn', fullName: 'Khánh', phone: '0900000000', createdAt: '', status: 'ACTIVE', roles }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function apiError(status: number, code: string, message: string, details: unknown[] = []) {
  return json({ code, message, details, correlationId: 'corr-1' }, status)
}

function makeReview(overrides: Partial<ReviewDTO> = {}): ReviewDTO {
  return {
    reviewId: REVIEW_ID,
    productId: PRODUCT_ID,
    shopId: SHOP_ID,
    stars: 5,
    content: 'Áo mặc mát, đúng mô tả.',
    imageUrls: ['/public-reviews/r1.jpg'],
    createdAt: '2026-11-20T03:00:00Z',
    ...overrides,
  }
}

function reviewsPage(reviews: ReviewDTO[], overrides: Record<string, unknown> = {}) {
  return json({
    data: reviews,
    pagination: { page: 1, pageSize: 10, totalItems: reviews.length, totalPages: 1 },
    summary: { avgStars: 4.5, totalCount: reviews.length, starCounts: { '5': reviews.length } },
    ...overrides,
  })
}

function makeOrder(soStatus = 'DELIVERED'): BuyerOrderDetailView {
  const item = (orderItemId: string, productName: string) => ({
    orderItemId,
    sellerOrderId: SO_ID,
    productId: PRODUCT_ID,
    productName,
    variantId: 'v-1',
    variantLabel: 'Đen / M',
    quantity: 1,
    unitPrice: 150_000,
    lineTotal: 150_000,
    weightGram: 200,
  })
  return {
    orderId: ORDER_ID,
    orderCode: 'ORD-001',
    status: 'COMPLETED',
    sellerOrders: [
      {
        sellerOrderId: SO_ID,
        sellerOrderCode: 'SO-001',
        shopId: SHOP_ID,
        shopName: 'Shop Nhật Khánh',
        status: soStatus,
        deliveredAt: '2026-11-25T03:00:00Z',
        items: [item(ITEM_A, 'Áo thun Cotton'), item(ITEM_B, 'Quần short Kaki')],
      },
    ],
  } as unknown as BuyerOrderDetailView
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

function renderAt(path: string, routePath: string, element: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={routePath} element={element} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

const reviewsPath = `/v1/products/${PRODUCT_ID}/reviews`
const reviewCalls = () => calls.filter((r) => new URL(r.url).pathname === reviewsPath).map((r) => new URL(r.url).searchParams)
const png = (name: string) => new File(['png'], name, { type: 'image/png' })

describe('ProductReviewsPanel — public block on /products/:id (FR-REV-002)', () => {
  it('shows the summary, reviews, seller reply and resolves relative image URLs against the media origin', async () => {
    on('GET', reviewsPath, () =>
      reviewsPage([makeReview({ reply: { content: 'Cảm ơn bạn!', createdAt: '2026-11-21T03:00:00Z' } })]),
    )
    renderAt('/p', '/p', <ProductReviewsPanel productId={PRODUCT_ID} />)

    expect(await screen.findByText('Áo mặc mát, đúng mô tả.')).toBeTruthy()
    expect(screen.getByText('Cảm ơn bạn!')).toBeTruthy()
    expect(screen.getByText('Phản hồi của nhà bán', { exact: false })).toBeTruthy()
    expect(screen.getByRole('img', { name: '5 trên 5 sao' })).toBeTruthy()
    expect(screen.getByAltText('Ảnh 1 của đánh giá').getAttribute('src')).toBe('http://media.test/public-reviews/r1.jpg')
    expect(screen.getByText('1 lượt đánh giá')).toBeTruthy()
  })

  it('filters by stars and "with images", resetting to page 1, and explains an empty filtered result', async () => {
    const u = userEvent.setup()
    on('GET', reviewsPath, (request) =>
      new URL(request.url).searchParams.get('stars') === '1' ? reviewsPage([]) : reviewsPage([makeReview()]),
    )
    renderAt('/p', '/p', <ProductReviewsPanel productId={PRODUCT_ID} />)
    await screen.findByText('Áo mặc mát, đúng mô tả.')

    await u.click(screen.getByRole('button', { name: 'Có ảnh' }))
    await u.click(screen.getByRole('button', { name: '1 sao' }))
    expect(await screen.findByText('Không có đánh giá nào phù hợp bộ lọc.')).toBeTruthy()

    const last = reviewCalls().at(-1)!
    expect(last.get('stars')).toBe('1')
    expect(last.get('hasImages')).toBe('true')
    expect(last.get('page')).toBe('1')
    expect(screen.getByRole('button', { name: '1 sao' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('NFR-REL-005: SVC-REV failure only degrades this block, with a retry that refetches', async () => {
    const u = userEvent.setup()
    on('GET', reviewsPath, () => apiError(503, 'SERVICE_UNAVAILABLE', 'Unavailable'))
    renderAt('/p', '/p', <ProductReviewsPanel productId={PRODUCT_ID} />)

    expect(await screen.findByText('Tạm thời không thể tải danh sách đánh giá.')).toBeTruthy()
    on('GET', reviewsPath, () => reviewsPage([makeReview()]))
    await u.click(screen.getByRole('button', { name: /Thử tải lại khối này/ }))
    expect(await screen.findByText('Áo mặc mát, đúng mô tả.')).toBeTruthy()
  })

  it('guests are invited to log in instead of reporting', async () => {
    on('GET', reviewsPath, () => reviewsPage([makeReview()]))
    renderAt('/p', '/p', <ProductReviewsPanel productId={PRODUCT_ID} />)
    expect(await screen.findByRole('link', { name: 'Đăng nhập để báo cáo' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Báo cáo' })).toBeNull()
  })

  it('FR-REV-004: a logged-in user reports with a required reason; a report that hides the review reloads the list', async () => {
    const u = userEvent.setup()
    setAuthSession({ accessToken: 'access-buyer', refreshToken: 'r', user: user(['BUYER']) })
    on('GET', reviewsPath, () => reviewsPage([makeReview()]))
    let body: unknown
    on('POST', `/v1/reviews/${REVIEW_ID}/reports`, async (request) => {
      body = await request.json()
      return json({ report: { reportId: 'rp-1', reason: 'x', reporterRole: 'BUYER', status: 'OPEN', createdAt: '' }, reviewStatus: 'PENDING_MODERATION' }, 201)
    })
    renderAt('/p', '/p', <ProductReviewsPanel productId={PRODUCT_ID} />)

    await u.click(await screen.findByRole('button', { name: 'Báo cáo' }))
    const dialog = await screen.findByRole('dialog', { name: 'Báo cáo đánh giá vi phạm' })
    const confirm = within(dialog).getByRole('button', { name: 'Gửi báo cáo' })
    expect(confirm.hasAttribute('disabled')).toBe(true)

    const before = reviewCalls().length
    await u.type(within(dialog).getByRole('textbox'), '  Quảng cáo shop khác  ')
    await u.click(confirm)

    expect(await screen.findByText(/Đánh giá đã được tạm ẩn để chờ kiểm duyệt/)).toBeTruthy()
    expect(body).toEqual({ reason: 'Quảng cáo shop khác' })
    await waitFor(() => expect(reviewCalls().length).toBeGreaterThan(before))
  })

  it('ALREADY_REPORTED stays inside the dialog with the correlation id', async () => {
    const u = userEvent.setup()
    setAuthSession({ accessToken: 'access-buyer', refreshToken: 'r', user: user(['BUYER']) })
    on('GET', reviewsPath, () => reviewsPage([makeReview()]))
    on('POST', `/v1/reviews/${REVIEW_ID}/reports`, () => apiError(409, 'ALREADY_REPORTED', 'Bạn đã báo cáo đánh giá này.'))
    renderAt('/p', '/p', <ProductReviewsPanel productId={PRODUCT_ID} />)

    await u.click(await screen.findByRole('button', { name: 'Báo cáo' }))
    const dialog = await screen.findByRole('dialog')
    await u.type(within(dialog).getByRole('textbox'), 'Spam')
    await u.click(within(dialog).getByRole('button', { name: 'Gửi báo cáo' }))

    expect(await within(dialog).findByText('Bạn đã báo cáo đánh giá này.')).toBeTruthy()
    expect(within(dialog).getByText('corr-1')).toBeTruthy()
  })
})

describe('MyReviewsPage — /account/reviews (FR-REV-001)', () => {
  beforeEach(() => setAuthSession({ accessToken: 'access-buyer', refreshToken: 'r', user: user(['BUYER']) }))

  function openItem(orderItemId = ITEM_A, soStatus = 'DELIVERED') {
    on('GET', `/v1/orders/${ORDER_ID}`, () => json(makeOrder(soStatus)))
    renderAt(`/account/reviews?orderId=${ORDER_ID}&orderItemId=${orderItemId}`, '/account/reviews', <MyReviewsPage />)
  }

  it('the item link from order detail shows only that item', async () => {
    openItem()
    expect(await screen.findByText('Áo thun Cotton')).toBeTruthy()
    expect(screen.queryByText('Quần short Kaki')).toBeNull()
  })

  it('the package link lists every item of the package with its own form', async () => {
    on('GET', `/v1/orders/${ORDER_ID}`, () => json(makeOrder('COMPLETED')))
    renderAt(`/account/reviews?orderId=${ORDER_ID}&sellerOrderId=${SO_ID}`, '/account/reviews', <MyReviewsPage />)
    expect(await screen.findByText('Áo thun Cotton')).toBeTruthy()
    expect(screen.getByText('Quần short Kaki')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Gửi đánh giá' })).toHaveLength(2)
  })

  it('requires a star rating before calling the API', async () => {
    const u = userEvent.setup()
    openItem()
    await u.click(await screen.findByRole('button', { name: 'Gửi đánh giá' }))
    expect(screen.getByText('Vui lòng chọn số sao')).toBeTruthy()
    expect(calls.filter((r) => r.method === 'POST')).toHaveLength(0)
  })

  it('submits multipart (orderItemId, stars, trimmed content, images) and shows the submitted state', async () => {
    const u = userEvent.setup()
    const setSpy = vi.spyOn(FormData.prototype, 'set')
    const appendSpy = vi.spyOn(FormData.prototype, 'append')
    openItem()
    on('POST', '/v1/reviews', () =>
      json({ reviewId: REVIEW_ID, orderItemId: ITEM_A, productId: PRODUCT_ID, shopId: SHOP_ID, stars: 4, status: 'PUBLISHED', imageUrls: [], createdAt: '' }, 201),
    )

    await screen.findByText('Áo thun Cotton')
    await u.click(screen.getByLabelText('4 sao'))
    await u.type(screen.getByLabelText('Nhận xét (không bắt buộc)'), '  Vải đẹp  ')
    await u.upload(screen.getByLabelText(/Ảnh thực tế/), [png('a.png'), png('b.png')])
    await u.click(screen.getByRole('button', { name: 'Gửi đánh giá' }))

    expect(await screen.findByText('Đã gửi đánh giá')).toBeTruthy()
    const post = calls.find((r) => r.method === 'POST')!
    expect(post.headers.get('Authorization')).toBe('Bearer access-buyer')
    expect(post.headers.get('Content-Type')).toMatch(/^multipart\/form-data; boundary=/)
    expect(Object.fromEntries(setSpy.mock.calls.map(([k, v]) => [k, v]))).toEqual({ orderItemId: ITEM_A, stars: '4', content: 'Vải đẹp' })
    expect(appendSpy.mock.calls.map(([k, v]) => [k, (v as File).name])).toEqual([
      ['images', 'a.png'],
      ['images', 'b.png'],
    ])
  })

  it('a review caught by the content filter is shown as pending moderation', async () => {
    const u = userEvent.setup()
    openItem()
    on('POST', '/v1/reviews', () =>
      json({ reviewId: REVIEW_ID, orderItemId: ITEM_A, productId: PRODUCT_ID, shopId: SHOP_ID, stars: 1, status: 'PENDING_MODERATION', imageUrls: [], createdAt: '' }, 201),
    )
    await screen.findByText('Áo thun Cotton')
    await u.click(screen.getByLabelText('1 sao'))
    await u.click(screen.getByRole('button', { name: 'Gửi đánh giá' }))
    expect(await screen.findByText(/đang chờ kiểm duyệt trước khi hiển thị/)).toBeTruthy()
  })

  it.each([
    ['ALREADY_REVIEWED', 409, 'Bạn đã đánh giá sản phẩm này.'],
    ['REVIEW_WINDOW_CLOSED', 403, 'Đã hết hạn đánh giá sản phẩm này.'],
  ])('%s replaces the form with a final state', async (code, status, text) => {
    const u = userEvent.setup()
    openItem()
    on('POST', '/v1/reviews', () => apiError(status, code, 'x'))
    await screen.findByText('Áo thun Cotton')
    await u.click(screen.getByLabelText('5 sao'))
    await u.click(screen.getByRole('button', { name: 'Gửi đánh giá' }))
    expect(await screen.findByText(text)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Gửi đánh giá' })).toBeNull()
  })

  it('REVIEW_ELIGIBILITY_PENDING keeps the form and offers a retry', async () => {
    const u = userEvent.setup()
    openItem()
    on('POST', '/v1/reviews', () => apiError(409, 'REVIEW_ELIGIBILITY_PENDING', 'x'))
    await screen.findByText('Áo thun Cotton')
    await u.click(screen.getByLabelText('5 sao'))
    await u.click(screen.getByRole('button', { name: 'Gửi đánh giá' }))
    expect(await screen.findByText(/đang cập nhật thông tin giao hàng/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy()
  })

  it('rejects unsupported images and more than 5 images', async () => {
    const u = userEvent.setup({ applyAccept: false })
    openItem()
    await screen.findByText('Áo thun Cotton')
    await u.upload(screen.getByLabelText(/Ảnh thực tế/), new File(['g'], 'a.gif', { type: 'image/gif' }))
    expect(screen.getByText('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP')).toBeTruthy()

    await u.upload(screen.getByLabelText(/Ảnh thực tế/), [1, 2, 3, 4, 5, 6].map((n) => png(`${n}.png`)))
    expect(screen.getByText('Chỉ được chọn tối đa 5 ảnh')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /Bỏ ảnh/ })).toHaveLength(5)
  })

  it('a package that is not delivered yet cannot be reviewed', async () => {
    openItem(ITEM_A, 'SHIPPING')
    expect(await screen.findByText('Gói hàng này chưa được giao nên chưa thể đánh giá.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Gửi đánh giá' })).toBeNull()
  })

  it('without parameters lists only delivered / completed packages with links carrying orderId', async () => {
    on('GET', '/v1/orders', () =>
      json({
        items: [
          {
            orderId: ORDER_ID,
            orderCode: 'ORD-001',
            createdAt: '2026-11-20T03:00:00Z',
            sellerOrders: [
              { sellerOrderId: SO_ID, sellerOrderCode: 'SO-001', shopId: SHOP_ID, status: 'COMPLETED', totalAmount: 1, refundStatus: 'NONE' },
              { sellerOrderId: 'so-2', sellerOrderCode: 'SO-002', shopId: SHOP_ID, status: 'SHIPPING', totalAmount: 1, refundStatus: 'NONE' },
            ],
          },
        ],
      }),
    )
    renderAt('/account/reviews', '/account/reviews', <MyReviewsPage />)

    const link = await screen.findByRole('link', { name: 'Đánh giá sản phẩm' })
    expect(link.getAttribute('href')).toBe(`/account/reviews?orderId=${ORDER_ID}&sellerOrderId=${SO_ID}`)
    expect(screen.getByText('Gói SO-001')).toBeTruthy()
    expect(screen.queryByText('Gói SO-002')).toBeNull()
  })
})

describe('SellerReviewsPage — /seller/reviews (FR-REV-003)', () => {
  beforeEach(() => setAuthSession({ accessToken: 'access-seller', refreshToken: 'r', user: user(['BUYER', 'SELLER']) }))

  function inventory() {
    const row = (productId: string, productName: string, variantId: string) => ({
      productId, productName, productStatus: 'PUBLISHED', variantId, sku: variantId, attributes: {}, available: 1, onHand: 1, reserved: 0, price: 1, isActive: true, version: 1,
    })
    on('GET', '/v1/seller/inventory', () =>
      json({
        data: [row(PRODUCT_ID, 'Áo thun Cotton', 'v-1'), row(PRODUCT_ID, 'Áo thun Cotton', 'v-2'), row('p-2', 'Balo du lịch', 'v-3')],
        pagination: { page: 1, pageSize: 100, totalItems: 3, totalPages: 1 },
      }),
    )
  }

  it('lists each product once and loads reviews for the chosen one', async () => {
    const u = userEvent.setup()
    inventory()
    on('GET', reviewsPath, () => reviewsPage([makeReview()]))
    renderAt('/seller/reviews', '/seller/reviews', <SellerReviewsPage />)

    const select = await screen.findByLabelText('Sản phẩm')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      '— Chọn sản phẩm —',
      'Áo thun Cotton',
      'Balo du lịch',
    ])
    await u.selectOptions(select, PRODUCT_ID)
    expect(await screen.findByText('Áo mặc mát, đúng mô tả.')).toBeTruthy()
  })

  it('replies once: the button disappears for reviews that already have a reply', async () => {
    const u = userEvent.setup()
    inventory()
    let replied = false
    on('GET', reviewsPath, () =>
      reviewsPage([makeReview(replied ? { reply: { content: 'Cảm ơn bạn đã ủng hộ', createdAt: '' } } : {})]),
    )
    let body: unknown
    on('POST', `/v1/reviews/${REVIEW_ID}/reply`, async (request) => {
      body = await request.json()
      replied = true
      return json({ content: 'Cảm ơn bạn đã ủng hộ', createdAt: '' }, 201)
    })
    renderAt(`/seller/reviews?productId=${PRODUCT_ID}`, '/seller/reviews', <SellerReviewsPage />)

    await u.click(await screen.findByRole('button', { name: 'Phản hồi' }))
    const dialog = await screen.findByRole('dialog', { name: 'Phản hồi đánh giá' })
    await u.type(within(dialog).getByRole('textbox'), 'Cảm ơn bạn đã ủng hộ')
    await u.click(within(dialog).getByRole('button', { name: 'Gửi phản hồi' }))

    expect(await screen.findByText('Đã gửi phản hồi.')).toBeTruthy()
    expect(body).toEqual({ content: 'Cảm ơn bạn đã ủng hộ' })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Phản hồi' })).toBeNull())
  })

  it('ALREADY_REPLIED and content-filter rejections stay in the dialog', async () => {
    const u = userEvent.setup()
    inventory()
    on('GET', reviewsPath, () => reviewsPage([makeReview()]))
    on('POST', `/v1/reviews/${REVIEW_ID}/reply`, () => apiError(422, 'REPLY_CONTENT_REJECTED', 'Phản hồi chứa liên kết ngoài.'))
    renderAt(`/seller/reviews?productId=${PRODUCT_ID}`, '/seller/reviews', <SellerReviewsPage />)

    await u.click(await screen.findByRole('button', { name: 'Phản hồi' }))
    const dialog = await screen.findByRole('dialog')
    await u.type(within(dialog).getByRole('textbox'), 'xem http://abc')
    await u.click(within(dialog).getByRole('button', { name: 'Gửi phản hồi' }))
    expect(await within(dialog).findByText('Phản hồi chứa liên kết ngoài.')).toBeTruthy()
  })
})

describe('AdminReviewModerationPage — /admin/moderation/reviews (FR-REV-005)', () => {
  beforeEach(() => setAuthSession({ accessToken: 'access-admin', refreshToken: 'r', user: user(['ADMINISTRATOR']) }))

  function makeAdminReview(overrides: Partial<AdminReviewDTO> = {}): AdminReviewDTO {
    return {
      ...makeReview({ content: 'Liên hệ zalo để mua rẻ hơn' }),
      buyerId: 'b-1',
      status: 'PENDING_MODERATION',
      version: 3,
      openReportCount: 2,
      moderationReason: 'Chứa liên kết ngoài',
      reports: [
        { reportId: 'rp-1', reason: 'Quảng cáo', reporterRole: 'SHOP_OWNER', status: 'OPEN', createdAt: '2026-11-21T03:00:00Z' },
      ],
      ...overrides,
    }
  }

  function queue(reviews: AdminReviewDTO[]) {
    on('GET', '/v1/admin/reviews/moderation-queue', () =>
      json({ data: reviews, pagination: { page: 1, pageSize: 20, totalItems: reviews.length, totalPages: 1 } }),
    )
  }

  it('shows the queue with status, open reports, moderation reason and report details', async () => {
    queue([makeAdminReview()])
    renderAt('/a', '/a', <AdminReviewModerationPage />)

    expect(await screen.findByText('Liên hệ zalo để mua rẻ hơn')).toBeTruthy()
    expect(screen.getByText('Chờ kiểm duyệt')).toBeTruthy()
    expect(screen.getByText('2 báo cáo đang mở')).toBeTruthy()
    expect(screen.getByText('Chứa liên kết ngoài')).toBeTruthy()
    expect(screen.getByText('Quảng cáo')).toBeTruthy()
    expect(screen.getByText('Nhà bán')).toBeTruthy()
  })

  it('hiding requires an audit reason (≥ 10 chars) and sends decision, reason and version', async () => {
    const u = userEvent.setup()
    queue([makeAdminReview()])
    let body: unknown
    on('POST', `/v1/admin/reviews/${REVIEW_ID}/moderate`, async (request) => {
      body = await request.json()
      return json(makeAdminReview({ status: 'HIDDEN' }))
    })
    renderAt('/a', '/a', <AdminReviewModerationPage />)

    await u.click(await screen.findByRole('button', { name: 'Ẩn đánh giá' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ẩn đánh giá' })
    const confirm = within(dialog).getByRole('button', { name: 'Ẩn đánh giá' })
    await u.type(within(dialog).getByRole('textbox'), 'quảng cáo')
    expect(confirm.hasAttribute('disabled')).toBe(true)
    await u.type(within(dialog).getByRole('textbox'), ' sang shop khác')
    await u.click(confirm)

    expect(await screen.findByText('Đã ẩn đánh giá.')).toBeTruthy()
    expect(body).toEqual({ decision: 'HIDE', reason: 'quảng cáo sang shop khác', version: 3 })
  })

  it('409 REVIEW_VERSION_CONFLICT closes the dialog, reloads the queue and explains', async () => {
    const u = userEvent.setup()
    queue([makeAdminReview()])
    on('POST', `/v1/admin/reviews/${REVIEW_ID}/moderate`, () =>
      apiError(409, 'REVIEW_VERSION_CONFLICT', 'Đánh giá đã được người khác xử lý.'),
    )
    renderAt('/a', '/a', <AdminReviewModerationPage />)

    await u.click(await screen.findByRole('button', { name: 'Cho hiển thị' }))
    const dialog = await screen.findByRole('dialog')
    const before = calls.filter((r) => r.url.includes('moderation-queue')).length
    await u.type(within(dialog).getByRole('textbox'), 'Nội dung hợp lệ, giữ lại')
    await u.click(within(dialog).getByRole('button', { name: 'Cho hiển thị' }))

    expect(await screen.findByText(/vừa được Quản trị viên khác xử lý/)).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(calls.filter((r) => r.url.includes('moderation-queue')).length).toBeGreaterThan(before))
  })

  it('shows an empty state when nothing is waiting', async () => {
    queue([])
    renderAt('/a', '/a', <AdminReviewModerationPage />)
    expect(await screen.findByText('Không còn đánh giá nào chờ kiểm duyệt.')).toBeTruthy()
  })
})
