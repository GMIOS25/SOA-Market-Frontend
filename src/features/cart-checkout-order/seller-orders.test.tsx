// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: {
    apiBaseUrl: 'http://api.test',
    demoMode: false,
  },
}))

import '@/lib/dayjs'
import '@/lib/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { clearAuthSession, setAuthSession } from '@/lib/auth/session'
import { SellerOrderDetailPage } from './pages/SellerOrderDetailPage'
import { SellerOrdersPage } from './pages/SellerOrdersPage'
import type {
  SellerOrderDetailView,
  SellerOrderListResult,
  SellerOrderSummaryView,
  SellerShipmentView,
  ShopDTO,
} from './seller-orders-api'

const SELLER_USER_ID = '11111111-1111-4111-8111-111111111111'
const MY_SHOP_ID = '22222222-2222-4222-8222-222222222222'
const OTHER_SHOP_ID = '33333333-3333-4333-8333-333333333333'
const ORDER_ID = '44444444-4444-4444-8444-444444444444'
const SO_1_ID = '55555555-5555-4555-8555-555555555555'
const SO_OTHER_ID = '66666666-6666-4666-8666-666666666666'
const SHIPMENT_1_ID = '77777777-7777-4777-8777-777777777777'

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function makeShop(overrides: Partial<ShopDTO> = {}): ShopDTO {
  return {
    shopId: MY_SHOP_ID,
    applicationId: 'app-1',
    sellerUserId: SELLER_USER_ID,
    name: 'Shop Điện Tử Dương',
    status: 'ACTIVE',
    ratingAvg: 4.9,
    ratingCount: 54,
    version: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    pickupAddress: {
      contactName: 'Nguyễn Khánh Dương',
      phone: '0909123456',
      line: '45 Lê Văn Việt',
      ward: 'Phường Tăng Nhơn Phú A',
      district: 'TP. Thủ Đức',
      province: 'TP. Hồ Chí Minh',
      updatedAt: '2026-10-01T00:00:00Z',
    },
    ...overrides,
  }
}

function makeOrderSummary(overrides: Partial<SellerOrderSummaryView> = {}): SellerOrderSummaryView {
  return {
    sellerOrderId: SO_1_ID,
    sellerOrderCode: 'SO-20261124-001',
    orderId: ORDER_ID,
    shopId: MY_SHOP_ID,
    buyerId: 'buyer-1',
    status: 'AWAITING_CONFIRMATION',
    itemsAmount: 300_000,
    shippingFee: 25_000,
    discountAmount: 0,
    totalAmount: 325_000,
    refundStatus: 'NONE',
    hasOpenComplaint: false,
    confirmDueAt: new Date(Date.now() + 6 * 3_600_000).toISOString(),
    version: 1,
    availableActions: ['CONFIRM', 'REJECT', 'CANCEL'],
    items: [
      {
        orderItemId: 'oi-1',
        sellerOrderId: SO_1_ID,
        productId: 'prd-1',
        variantId: 'var-1',
        productName: 'Bàn phím cơ không dây',
        variantLabel: 'Đen / Red Switch',
        unitPrice: 300_000,
        quantity: 1,
        weightGram: 800,
        lineTotal: 300_000,
      },
    ],
    createdAt: '2026-11-24T01:00:00Z',
    updatedAt: '2026-11-24T01:05:00Z',
    ...overrides,
  }
}

function makeOrderDetail(overrides: Partial<SellerOrderDetailView> = {}): SellerOrderDetailView {
  const summary = makeOrderSummary(overrides)
  return {
    ...summary,
    orderCode: 'ORD-20261124-001',
    deliveryAddress: {
      contactName: 'Trần Văn Mua',
      phone: '0901234567',
      line: '01 Võ Văn Ngân',
      ward: 'Phường Linh Chiểu',
      district: 'TP. Thủ Đức',
      province: 'TP. Hồ Chí Minh',
    },
    history: [
      {
        historyId: 'hist-1',
        orderId: ORDER_ID,
        sellerOrderId: SO_1_ID,
        fromStatus: 'PENDING_PAYMENT',
        toStatus: 'AWAITING_CONFIRMATION',
        cause: 'PAYMENT_SUCCEEDED',
        actor: 'SYSTEM',
        at: '2026-11-24T01:05:00Z',
      },
    ],
    ...overrides,
  }
}

function makeShipment(overrides: Partial<SellerShipmentView> = {}): SellerShipmentView {
  return {
    shipmentId: SHIPMENT_1_ID,
    sellerOrderId: SO_1_ID,
    shopId: MY_SHOP_ID,
    carrier: 'GHN',
    trackingCode: 'GHN-TRACK-8899',
    status: 'CREATED',
    etaAt: '2026-11-27T00:00:00Z',
    ...overrides,
  }
}

function renderSellerRoute(
  initialPath: string,
  options: { onOpenLabel?: (url: string) => void } = {},
) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/seller/orders" element={<SellerOrdersPage />} />
            <Route
              path="/seller/orders/:id"
              element={<SellerOrderDetailPage onOpenLabel={options.onOpenLabel} />}
            />
            <Route path="/seller/shop" element={<div>Trang cấu hình gian hàng và địa chỉ lấy hàng</div>} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

function requestOf(input: RequestInfo | URL, init?: RequestInit): { url: string; method: string; bodyText: Promise<string> } {
  if (input instanceof Request) {
    return {
      url: input.url,
      method: input.method.toUpperCase(),
      bodyText: input.clone().text(),
    }
  }
  return {
    url: String(input),
    method: (init?.method ?? 'GET').toUpperCase(),
    bodyText: Promise.resolve(typeof init?.body === 'string' ? init.body : ''),
  }
}

beforeEach(() => {
  setAuthSession({
    accessToken: 'jwt-seller-test',
    refreshToken: 'rt-seller-test',
    user: {
      userId: SELLER_USER_ID,
      email: 'seller@soa.vn',
      fullName: 'Nguyễn Khánh Dương',
      phone: '0909123456',
      status: 'ACTIVE',
      roles: ['BUYER', 'SELLER'],
      createdAt: '2026-01-01T00:00:00Z',
    },
  })
})

afterEach(() => {
  cleanup()
  clearAuthSession()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('T4-08: Seller Order List (/seller/orders)', () => {
  it('displays only SellerOrders belonging to the Seller shop, supports status filter, and shows T_CONFIRM countdown', async () => {
    const user = userEvent.setup()
    const listCalls: string[] = []

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = requestOf(input, init)
      if (req.url.endsWith('/v1/seller/shop') && req.method === 'GET') {
        return jsonResponse(makeShop())
      }
      if (req.url.includes('/v1/seller-orders') && req.method === 'GET') {
        listCalls.push(req.url)
        const payload: SellerOrderListResult = {
          items: [
            makeOrderSummary(),
            makeOrderSummary({
              sellerOrderId: SO_OTHER_ID,
              sellerOrderCode: 'SO-FOREIGN-999',
              shopId: OTHER_SHOP_ID,
              items: [
                {
                  orderItemId: 'oi-other',
                  sellerOrderId: SO_OTHER_ID,
                  productId: 'prd-other',
                  variantId: 'var-other',
                  productName: 'Sản phẩm của shop khác',
                  variantLabel: 'X',
                  unitPrice: 999_000,
                  quantity: 1,
                  weightGram: 200,
                  lineTotal: 999_000,
                },
              ],
            }),
          ],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        }
        return jsonResponse(payload)
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })

    renderSellerRoute('/seller/orders')

    expect(await screen.findAllByText('SO-20261124-001')).not.toHaveLength(0)
    expect(screen.getAllByText('Bàn phím cơ không dây')).not.toHaveLength(0)
    expect(screen.getAllByText('325.000 ₫')).not.toHaveLength(0)
    expect(screen.getAllByRole('timer')).not.toHaveLength(0)

    // Defense-in-depth: never render orders from another shopId.
    expect(screen.queryByText('SO-FOREIGN-999')).toBeNull()
    expect(screen.queryByText('Sản phẩm của shop khác')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Chờ xác nhận' }))
    await waitFor(() => {
      expect(listCalls.some((url) => url.includes('status=AWAITING_CONFIRMATION'))).toBe(true)
    })
    expect(fetchSpy).toHaveBeenCalled()
  })
})

describe('T4-08: Seller Order Detail (/seller/orders/:id)', () => {
  it('blocks viewing orders of another shop on 403 and on shopId mismatch', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = requestOf(input, init)
      if (req.url.endsWith('/v1/seller/shop')) {
        return jsonResponse(makeShop())
      }
      if (req.url.endsWith(`/v1/seller-orders/${SO_OTHER_ID}`)) {
        return jsonResponse(
          {
            code: 'FORBIDDEN',
            message: 'Bạn không có quyền truy cập đơn hàng của cửa hàng này.',
          },
          403,
        )
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })

    renderSellerRoute(`/seller/orders/${SO_OTHER_ID}`)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Không thể truy cập đơn hàng của gian hàng khác')
    expect(screen.queryByRole('button', { name: 'Xác nhận đơn hàng' })).toBeNull()

    cleanup()

    // Even if backend somehow returned 200 with a foreign shopId, UI isolates it.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = requestOf(input, init)
      if (req.url.endsWith('/v1/seller/shop')) {
        return jsonResponse(makeShop())
      }
      if (req.url.endsWith(`/v1/seller-orders/${SO_OTHER_ID}`)) {
        return jsonResponse(
          makeOrderDetail({
            sellerOrderId: SO_OTHER_ID,
            sellerOrderCode: 'SO-FOREIGN-200',
            shopId: OTHER_SHOP_ID,
          }),
        )
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })

    renderSellerRoute(`/seller/orders/${SO_OTHER_ID}`)
    const mismatchAlert = await screen.findByRole('alert')
    expect(mismatchAlert.textContent).toContain('Không thể truy cập đơn hàng của gian hàng khác')
    expect(screen.queryByText('SO-FOREIGN-200')).toBeNull()
  })

  it('shows live T_CONFIRM countdown that ticks into overdue', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-11-24T02:00:00Z'))

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = requestOf(input, init)
      if (req.url.endsWith('/v1/seller/shop')) {
        return jsonResponse(makeShop())
      }
      if (req.url.endsWith(`/v1/seller-orders/${SO_1_ID}`)) {
        return jsonResponse(
          makeOrderDetail({
            createdAt: '2026-11-23T02:00:00Z',
            updatedAt: '2026-11-23T02:00:05Z',
            confirmDueAt: '2026-11-24T02:00:10Z',
          }),
        )
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })

    renderSellerRoute(`/seller/orders/${SO_1_ID}`)

    const timers = await screen.findAllByRole('timer')
    expect(timers[0]!.textContent).toMatch(/Còn (9|10) giây/)

    act(() => {
      vi.advanceTimersByTime(12_000)
    })

    expect(screen.getAllByRole('timer')[0]!.textContent).toMatch(/Quá hạn (1|2|3) giây/)
  })

  it('confirms order and transitions to CONFIRMED with shipment lookup', async () => {
    const user = userEvent.setup()
    let currentDetail = makeOrderDetail({ status: 'AWAITING_CONFIRMATION' })
    let confirmedCalled = false

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = requestOf(input, init)
      if (req.url.endsWith('/v1/seller/shop')) {
        return jsonResponse(makeShop())
      }
      if (req.url.endsWith(`/v1/seller-orders/${SO_1_ID}`) && req.method === 'GET') {
        return jsonResponse(currentDetail)
      }
      if (req.url.endsWith(`/v1/seller-orders/${SO_1_ID}/confirm`) && req.method === 'POST') {
        confirmedCalled = true
        currentDetail = makeOrderDetail({
          status: 'CONFIRMED',
          availableActions: ['CANCEL'],
        })
        return jsonResponse({
          sellerOrderId: SO_1_ID,
          sellerOrderCode: currentDetail.sellerOrderCode,
          orderId: ORDER_ID,
          orderStatus: 'PAID',
          status: 'CONFIRMED',
          version: 2,
          hasOpenComplaint: false,
          availableActions: ['CANCEL'],
          updatedAt: '2026-11-24T02:00:00Z',
        })
      }
      if (req.url.includes(`/v1/shipments?sellerOrderId=${SO_1_ID}`) && req.method === 'GET') {
        return jsonResponse({ shipments: [makeShipment()] })
      }
      if (new URL(req.url).pathname === `/v1/shipments/${SHIPMENT_1_ID}/tracking`) {
        return jsonResponse({ events: [] })
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })

    renderSellerRoute(`/seller/orders/${SO_1_ID}`)

    const confirmBtn = await screen.findByRole('button', { name: 'Xác nhận đơn hàng' })
    await user.click(confirmBtn)

    await waitFor(() => expect(confirmedCalled).toBe(true))
    expect(await screen.findByText(/Đã xác nhận đơn hàng/)).toBeTruthy()
    expect(await screen.findByText('GHN-TRACK-8899')).toBeTruthy()
  })

  it('displays HTTP 422 alert with link to /seller/shop when pickup address is missing', async () => {
    const user = userEvent.setup()

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = requestOf(input, init)
      if (req.url.endsWith('/v1/seller/shop')) {
        return jsonResponse(makeShop({ pickupAddress: undefined }))
      }
      if (req.url.endsWith(`/v1/seller-orders/${SO_1_ID}`) && req.method === 'GET') {
        return jsonResponse(makeOrderDetail({ status: 'AWAITING_CONFIRMATION' }))
      }
      if (req.url.endsWith(`/v1/seller-orders/${SO_1_ID}/confirm`) && req.method === 'POST') {
        return jsonResponse(
          {
            code: 'PICKUP_ADDRESS_REQUIRED',
            message: 'Cửa hàng chưa cấu hình đầy đủ địa chỉ lấy hàng (pickupAddress).',
            correlationId: 'corr-422-pickup',
          },
          422,
        )
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })

    renderSellerRoute(`/seller/orders/${SO_1_ID}`)

    const confirmBtn = await screen.findByRole('button', { name: 'Xác nhận đơn hàng' })
    await user.click(confirmBtn)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('HTTP 422')
    expect(alert.textContent).toContain('Cửa hàng chưa cấu hình đầy đủ địa chỉ lấy hàng')
    expect(alert.textContent).toContain('corr-422-pickup')

    const configLink = within(alert).getByRole('link', { name: /Cấu hình địa chỉ lấy hàng/ })
    expect(configLink.getAttribute('href')).toBe('/seller/shop')

    await user.click(configLink)
    expect(await screen.findByText('Trang cấu hình gian hàng và địa chỉ lấy hàng')).toBeTruthy()
  })

  it('requires a non-empty reason to reject an order and blocks blank submissions', async () => {
    const user = userEvent.setup()
    let rejectedReason: string | null = null
    let currentDetail = makeOrderDetail({ status: 'AWAITING_CONFIRMATION' })

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = requestOf(input, init)
      if (req.url.endsWith('/v1/seller/shop')) {
        return jsonResponse(makeShop())
      }
      if (req.url.endsWith(`/v1/seller-orders/${SO_1_ID}`) && req.method === 'GET') {
        return jsonResponse(currentDetail)
      }
      if (req.url.endsWith(`/v1/seller-orders/${SO_1_ID}/reject`) && req.method === 'POST') {
        const body = JSON.parse(await req.bodyText) as { reason?: string }
        rejectedReason = body.reason ?? ''
        currentDetail = makeOrderDetail({
          status: 'CANCELLED',
          cancelCause: 'SELLER_REJECTED',
          cancelReason: rejectedReason,
          availableActions: [],
        })
        return jsonResponse({
          sellerOrderId: SO_1_ID,
          sellerOrderCode: currentDetail.sellerOrderCode,
          orderId: ORDER_ID,
          orderStatus: 'CANCELLED',
          status: 'CANCELLED',
          version: 2,
          hasOpenComplaint: false,
          cancelCause: 'SELLER_REJECTED',
          cancelReason: rejectedReason,
          availableActions: [],
          updatedAt: '2026-11-24T02:10:00Z',
        })
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })

    renderSellerRoute(`/seller/orders/${SO_1_ID}`)

    await user.click(await screen.findByRole('button', { name: 'Từ chối đơn hàng' }))

    const dialog = await screen.findByRole('dialog')
    const confirmRejectBtn = within(dialog).getByRole('button', { name: 'Xác nhận từ chối' }) as HTMLButtonElement
    const reasonInput = within(dialog).getByRole('textbox', { name: /Lý do/ })

    // Cannot reject without reason (empty or whitespace-only).
    expect(confirmRejectBtn.disabled).toBe(true)
    await user.type(reasonInput, '     ')
    expect(confirmRejectBtn.disabled).toBe(true)

    await user.clear(reasonInput)
    await user.type(reasonInput, 'Hết hàng tồn kho thực tế')
    expect(confirmRejectBtn.disabled).toBe(false)

    await user.click(confirmRejectBtn)

    await waitFor(() => expect(rejectedReason).toBe('Hết hàng tồn kho thực tế'))
    expect(await screen.findByText(/Đã từ chối đơn hàng/)).toBeTruthy()
  })

  it('cancels a CONFIRMED order before pickup and locks cancel once shipment is PICKED_UP', async () => {
    const user = userEvent.setup()
    let cancelledReason: string | null = null
    let currentDetail = makeOrderDetail({
      status: 'CONFIRMED',
      availableActions: ['CANCEL'],
    })

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = requestOf(input, init)
      if (req.url.endsWith('/v1/seller/shop')) {
        return jsonResponse(makeShop())
      }
      if (req.url.endsWith(`/v1/seller-orders/${SO_1_ID}`) && req.method === 'GET') {
        return jsonResponse(currentDetail)
      }
      if (req.url.includes(`/v1/shipments?sellerOrderId=${SO_1_ID}`)) {
        return jsonResponse({ shipments: [makeShipment({ status: 'CREATED' })] })
      }
      if (new URL(req.url).pathname === `/v1/shipments/${SHIPMENT_1_ID}/tracking`) {
        return jsonResponse({ events: [] })
      }
      if (req.url.endsWith(`/v1/seller-orders/${SO_1_ID}/cancel`) && req.method === 'POST') {
        const body = JSON.parse(await req.bodyText) as { reason?: string }
        cancelledReason = body.reason ?? ''
        currentDetail = makeOrderDetail({
          status: 'CANCELLED',
          cancelCause: 'SELLER_CANCELLED',
          cancelReason: cancelledReason,
          availableActions: [],
        })
        return jsonResponse({
          sellerOrderId: SO_1_ID,
          sellerOrderCode: currentDetail.sellerOrderCode,
          orderId: ORDER_ID,
          orderStatus: 'CANCELLED',
          status: 'CANCELLED',
          version: 3,
          hasOpenComplaint: false,
          cancelCause: 'SELLER_CANCELLED',
          cancelReason: cancelledReason,
          availableActions: [],
          updatedAt: '2026-11-24T02:20:00Z',
        })
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })

    renderSellerRoute(`/seller/orders/${SO_1_ID}`)

    const cancelBtn = await screen.findByRole('button', { name: 'Hủy đơn trước khi lấy hàng' })
    await user.click(cancelBtn)

    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByRole('textbox', { name: /Lý do/ }), 'Khách yêu cầu đổi phân loại khác')
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận hủy đơn' }))

    await waitFor(() => expect(cancelledReason).toBe('Khách yêu cầu đổi phân loại khác'))
    expect(await screen.findByText(/Đã hủy gói đơn hàng trước khi lấy hàng/)).toBeTruthy()

    cleanup()

    // Once shipment is PICKED_UP, Seller cannot cancel before pickup anymore.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = requestOf(input, init)
      if (req.url.endsWith('/v1/seller/shop')) {
        return jsonResponse(makeShop())
      }
      if (req.url.endsWith(`/v1/seller-orders/${SO_1_ID}`) && req.method === 'GET') {
        return jsonResponse(makeOrderDetail({ status: 'CONFIRMED', availableActions: ['CANCEL'] }))
      }
      if (req.url.includes(`/v1/shipments?sellerOrderId=${SO_1_ID}`)) {
        return jsonResponse({ shipments: [makeShipment({ status: 'PICKED_UP' })] })
      }
      if (new URL(req.url).pathname === `/v1/shipments/${SHIPMENT_1_ID}/tracking`) {
        return jsonResponse({ events: [] })
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })

    renderSellerRoute(`/seller/orders/${SO_1_ID}`)
    await waitFor(() => {
      const lockedBtn = screen.getByRole('button', { name: 'Hủy đơn trước khi lấy hàng' }) as HTMLButtonElement
      expect(lockedBtn.disabled).toBe(true)
    })
    expect(screen.getByText(/Đơn vị vận chuyển đã lấy hàng/)).toBeTruthy()
  })

  it('prints shipping label via GET /v1/shipments/{id}/label', async () => {
    const user = userEvent.setup()
    const onOpenLabel = vi.fn()

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = requestOf(input, init)
      if (req.url.endsWith('/v1/seller/shop')) {
        return jsonResponse(makeShop())
      }
      if (req.url.endsWith(`/v1/seller-orders/${SO_1_ID}`) && req.method === 'GET') {
        return jsonResponse(makeOrderDetail({ status: 'CONFIRMED', availableActions: ['CANCEL'] }))
      }
      if (req.url.includes(`/v1/shipments?sellerOrderId=${SO_1_ID}`)) {
        return jsonResponse({ shipments: [makeShipment({ status: 'CREATED' })] })
      }
      if (new URL(req.url).pathname === `/v1/shipments/${SHIPMENT_1_ID}/tracking`) {
        return jsonResponse({ events: [] })
      }
      if (req.url.endsWith(`/v1/shipments/${SHIPMENT_1_ID}/label`) && req.method === 'GET') {
        return jsonResponse({
          trackingCode: 'GHN-TRACK-8899',
          labelUrl: 'https://shipping.mock.local/labels/GHN-TRACK-8899.pdf',
          expiresAt: '2026-11-25T00:00:00Z',
        })
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })

    renderSellerRoute(`/seller/orders/${SO_1_ID}`, { onOpenLabel })

    const printButton = await screen.findByRole('button', { name: 'In nhãn vận chuyển' })
    await user.click(printButton)

    await waitFor(() =>
      expect(onOpenLabel).toHaveBeenCalledWith('https://shipping.mock.local/labels/GHN-TRACK-8899.pdf'),
    )
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('GHN-TRACK-8899')
  })

  it('retries a CREATE_FAILED shipment and shows HTTP 422 pickup alert if retry returns 422', async () => {
    const user = userEvent.setup()
    let currentShipment = makeShipment({
      status: 'CREATE_FAILED',
      trackingCode: null,
      failureReason: 'Địa chỉ lấy hàng không hợp lệ hoặc ĐVVC timeout.',
    })
    let retryAttempt = 0

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = requestOf(input, init)
      if (req.url.endsWith('/v1/seller/shop')) {
        return jsonResponse(makeShop())
      }
      if (req.url.endsWith(`/v1/seller-orders/${SO_1_ID}`) && req.method === 'GET') {
        return jsonResponse(makeOrderDetail({ status: 'CONFIRMED', availableActions: ['CANCEL'] }))
      }
      if (req.url.includes(`/v1/shipments?sellerOrderId=${SO_1_ID}`)) {
        return jsonResponse({ shipments: [currentShipment] })
      }
      if (new URL(req.url).pathname === `/v1/shipments/${SHIPMENT_1_ID}/tracking`) {
        return jsonResponse({ events: [] })
      }
      if (req.url.endsWith(`/v1/shipments/${SHIPMENT_1_ID}/retry`) && req.method === 'POST') {
        retryAttempt += 1
        if (retryAttempt === 1) {
          return jsonResponse(
            {
              code: 'PICKUP_ADDRESS_REQUIRED',
              message: 'Thiếu địa chỉ lấy hàng hợp lệ để tạo lại vận đơn.',
            },
            422,
          )
        }
        currentShipment = makeShipment({
          status: 'CREATED',
          trackingCode: 'GHN-RETRY-777',
          failureReason: null,
        })
        return jsonResponse(currentShipment)
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })

    renderSellerRoute(`/seller/orders/${SO_1_ID}`)

    expect(await screen.findByText('Tạo vận đơn thất bại (CREATE_FAILED)')).toBeTruthy()
    expect(screen.getByText('Địa chỉ lấy hàng không hợp lệ hoặc ĐVVC timeout.')).toBeTruthy()

    const retryButtons = screen.getAllByRole('button', { name: 'Tạo lại vận đơn' })
    await user.click(retryButtons[0]!)

    // First attempt returns 422 -> displays 422 alert with link to /seller/shop.
    const alert422Title = await screen.findByText(/Chưa cấu hình địa chỉ lấy hàng \(HTTP 422\)/)
    const alert422 = alert422Title.closest('[role="alert"]') as HTMLElement
    expect(alert422).toBeTruthy()
    expect(alert422.textContent).toContain('HTTP 422')
    expect(within(alert422).getByRole('link', { name: /Cấu hình địa chỉ lấy hàng/ }).getAttribute('href')).toBe(
      '/seller/shop',
    )

    // Second attempt succeeds -> transitions to CREATED and reveals tracking code + Print Label.
    await user.click(screen.getAllByRole('button', { name: 'Tạo lại vận đơn' })[0]!)
    expect(await screen.findByText('GHN-RETRY-777')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'In nhãn vận chuyển' })).toBeTruthy()
  })

  it('degrades gracefully with ServiceFallbackBanner when SVC-SHP fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = requestOf(input, init)
      if (req.url.endsWith('/v1/seller/shop')) {
        return jsonResponse(makeShop())
      }
      if (req.url.endsWith(`/v1/seller-orders/${SO_1_ID}`) && req.method === 'GET') {
        return jsonResponse(
          makeOrderDetail({
            status: 'CONFIRMED',
            carrier: 'GHN',
            trackingCode: 'GHN-CACHED-111',
          }),
        )
      }
      if (req.url.includes(`/v1/shipments?sellerOrderId=${SO_1_ID}`)) {
        return jsonResponse(
          { code: 'SERVICE_UNAVAILABLE', message: 'Dịch vụ vận chuyển đang bảo trì.' },
          503,
        )
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })

    renderSellerRoute(`/seller/orders/${SO_1_ID}`)

    expect(await screen.findByText('Bàn phím cơ không dây')).toBeTruthy()
    expect(screen.getByText('Trần Văn Mua')).toBeTruthy()
    expect(await screen.findByText('GHN-CACHED-111')).toBeTruthy()
    expect(await screen.findByText('Dịch vụ vận chuyển đang bảo trì.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Thử tải lại khối này' })).toBeTruthy()
  })
})
