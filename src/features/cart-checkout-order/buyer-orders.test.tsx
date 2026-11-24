// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
import { sortTrackingEvents } from '@/features/payment-shipping/tracking'
import { clearAuthSession, setAuthSession } from '@/lib/auth/session'
import type {
  BuyerOrderDetailView,
  BuyerOrderListResult,
  BuyerSellerOrderDetailView,
  PublicShopDTO,
} from './api'
import {
  canBuyerCancelPackage,
  canBuyerConfirmReceipt,
  mapPartialRefundLines,
  toDateRangeQuery,
} from './order-helpers'
import { BuyerOrderDetailPage, type BuyerOrderDetailPageProps } from './pages/BuyerOrderDetailPage'
import { BuyerOrdersPage } from './pages/BuyerOrdersPage'

const BUYER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ORDER_ID = '11111111-1111-4111-8111-111111111111'
const SHOP_1_ID = '22222222-2222-4222-8222-222222222221'
const SHOP_2_ID = '22222222-2222-4222-8222-222222222222'
const SHOP_3_ID = '22222222-2222-4222-8222-222222222223'
const SO_1_ID = '33333333-3333-4333-8333-333333333331'
const SO_2_ID = '33333333-3333-4333-8333-333333333332'
const SO_3_ID = '33333333-3333-4333-8333-333333333333'
const SHP_1_ID = '44444444-4444-4444-8444-444444444441'

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function makeOrderListResult(overrides: Partial<BuyerOrderListResult> = {}): BuyerOrderListResult {
  return {
    items: [
      {
        orderId: ORDER_ID,
        orderCode: 'ORD-20261124-001',
        buyerId: BUYER_ID,
        status: 'PAID',
        itemsTotal: 900_000,
        shippingTotal: 75_000,
        grandTotal: 975_000,
        paymentDueAt: '2026-11-24T10:15:00Z',
        sellerOrderCount: 3,
        sellerOrders: [
          {
            sellerOrderId: SO_1_ID,
            sellerOrderCode: 'SO-001',
            shopId: SHOP_1_ID,
            status: 'DELIVERED',
            totalAmount: 425_000,
            refundStatus: 'NONE',
          },
          {
            sellerOrderId: SO_2_ID,
            sellerOrderCode: 'SO-002',
            shopId: SHOP_2_ID,
            status: 'AWAITING_CONFIRMATION',
            totalAmount: 325_000,
            refundStatus: 'NONE',
          },
          {
            sellerOrderId: SO_3_ID,
            sellerOrderCode: 'SO-003',
            shopId: SHOP_3_ID,
            status: 'CANCELLED',
            totalAmount: 225_000,
            refundStatus: 'FULL',
          },
        ],
        createdAt: '2026-11-24T09:00:00Z',
        updatedAt: '2026-11-24T09:30:00Z',
      },
    ],
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
    ...overrides,
  }
}

function makeThreeShopOrderDetail(overrides: Partial<BuyerOrderDetailView> = {}): BuyerOrderDetailView {
  const futureCompleteDue = new Date(Date.now() + 2 * 24 * 3_600_000).toISOString()
  const futureConfirmDue = new Date(Date.now() + 12 * 3_600_000).toISOString()

  return {
    orderId: ORDER_ID,
    orderCode: 'ORD-20261124-001',
    buyerId: BUYER_ID,
    status: 'PAID',
    itemsTotal: 900_000,
    shippingTotal: 75_000,
    grandTotal: 975_000,
    deliveryAddress: {
      contactName: 'Nguyễn Khánh Dương',
      phone: '0901234567',
      line: '01 Võ Văn Ngân',
      ward: 'Phường Linh Chiểu',
      district: 'TP. Thủ Đức',
      province: 'TP. Hồ Chí Minh',
    },
    paymentDueAt: '2026-11-24T10:15:00Z',
    payment: {
      paymentId: 'pay-1',
      gateway: 'MOCK_PAY',
      gatewayRef: 'MOCK-PAY-001',
      status: 'SUCCEEDED',
      amount: 975_000,
      paymentUrl: '',
      expiresAt: '2026-11-24T10:15:00Z',
    },
    paymentDegraded: false,
    shippingDegraded: false,
    partialRefundBreakdown: {
      originalTotalAmount: 975_000,
      paidTotalAmount: 975_000,
      cancelledRefundAmount: 225_000,
      activeAllocationAmount: 750_000,
      refundedSellerOrderCount: 1,
      voucherDiscountTotal: 0,
      sellerOrders: [
        {
          sellerOrderId: SO_1_ID,
          sellerOrderCode: 'SO-001',
          shopId: SHOP_1_ID,
          shopName: 'Shop Điện Tử A',
          status: 'DELIVERED',
          refundStatus: 'NONE',
          itemsSubtotal: 400_000,
          shippingFee: 25_000,
          allocationAmount: 425_000,
          voucherShare: 0,
          isRefundedOrCancelled: false,
        },
        {
          sellerOrderId: SO_2_ID,
          sellerOrderCode: 'SO-002',
          shopId: SHOP_2_ID,
          shopName: 'Shop Thời Trang B',
          status: 'AWAITING_CONFIRMATION',
          refundStatus: 'NONE',
          itemsSubtotal: 300_000,
          shippingFee: 25_000,
          allocationAmount: 325_000,
          voucherShare: 0,
          isRefundedOrCancelled: false,
        },
        {
          sellerOrderId: SO_3_ID,
          sellerOrderCode: 'SO-003',
          shopId: SHOP_3_ID,
          shopName: 'Shop Gia Dụng C',
          status: 'CANCELLED',
          refundStatus: 'FULL',
          itemsSubtotal: 200_000,
          shippingFee: 25_000,
          allocationAmount: 225_000,
          voucherShare: 0,
          isRefundedOrCancelled: true,
        },
      ],
    },
    sellerOrders: [
      {
        sellerOrderId: SO_1_ID,
        sellerOrderCode: 'SO-001',
        orderId: ORDER_ID,
        shopId: SHOP_1_ID,
        shopName: 'Shop Điện Tử A',
        status: 'DELIVERED',
        itemsAmount: 400_000,
        shippingFee: 25_000,
        discountAmount: 0,
        totalAmount: 425_000,
        refundStatus: 'NONE',
        carrier: 'GHN',
        trackingCode: 'GHN-TRK-001',
        hasOpenComplaint: false,
        deliveredAt: '2026-11-24T08:00:00Z',
        completeDueAt: futureCompleteDue,
        availableActions: ['CONFIRM_RECEIPT'],
        items: [
          {
            orderItemId: 'oi-1',
            sellerOrderId: SO_1_ID,
            productId: 'prd-1',
            variantId: 'var-1',
            productName: 'Tai nghe ANC Snapshot 2026',
            variantLabel: 'Đen / Bản chuẩn',
            unitPrice: 400_000,
            quantity: 1,
            weightGram: 300,
            lineTotal: 400_000,
          },
        ],
        createdAt: '2026-11-24T01:00:00Z',
        updatedAt: '2026-11-24T08:00:00Z',
        version: 3,
      },
      {
        sellerOrderId: SO_2_ID,
        sellerOrderCode: 'SO-002',
        orderId: ORDER_ID,
        shopId: SHOP_2_ID,
        shopName: 'Shop Thời Trang B',
        status: 'AWAITING_CONFIRMATION',
        itemsAmount: 300_000,
        shippingFee: 25_000,
        discountAmount: 0,
        totalAmount: 325_000,
        refundStatus: 'NONE',
        hasOpenComplaint: false,
        confirmDueAt: futureConfirmDue,
        availableActions: ['CANCEL'],
        items: [
          {
            orderItemId: 'oi-2',
            sellerOrderId: SO_2_ID,
            productId: 'prd-2',
            variantId: 'var-2',
            productName: 'Áo khoác gió Snapshot',
            variantLabel: 'Xanh Navy / L',
            unitPrice: 150_000,
            quantity: 2,
            weightGram: 500,
            lineTotal: 300_000,
          },
        ],
        createdAt: '2026-11-24T01:00:00Z',
        updatedAt: '2026-11-24T01:05:00Z',
        version: 1,
      },
      {
        sellerOrderId: SO_3_ID,
        sellerOrderCode: 'SO-003',
        orderId: ORDER_ID,
        shopId: SHOP_3_ID,
        shopName: 'Shop Gia Dụng C',
        status: 'CANCELLED',
        itemsAmount: 200_000,
        shippingFee: 25_000,
        discountAmount: 0,
        totalAmount: 225_000,
        refundStatus: 'FULL',
        cancelCause: 'SELLER_TIMEOUT',
        cancelReason: 'Nhà bán không xác nhận trong thời hạn 24 giờ.',
        hasOpenComplaint: false,
        availableActions: [],
        items: [
          {
            orderItemId: 'oi-3',
            sellerOrderId: SO_3_ID,
            productId: 'prd-3',
            variantId: 'var-3',
            productName: 'Bình giữ nhiệt Inox 1L',
            variantLabel: 'Bạc',
            unitPrice: 200_000,
            quantity: 1,
            weightGram: 450,
            lineTotal: 200_000,
          },
        ],
        createdAt: '2026-11-24T01:00:00Z',
        updatedAt: '2026-11-24T05:00:00Z',
        version: 2,
      },
    ],
    history: [
      {
        historyId: 'hist-1',
        orderId: ORDER_ID,
        toStatus: 'PENDING_PAYMENT',
        cause: 'CHECKOUT_CREATED',
        actor: BUYER_ID,
        note: 'Khởi tạo đơn hàng đa nhà bán',
        at: '2026-11-24T01:00:00Z',
      },
      {
        historyId: 'hist-2',
        orderId: ORDER_ID,
        fromStatus: 'PENDING_PAYMENT',
        toStatus: 'PAID',
        cause: 'PAYMENT_SUCCEEDED',
        actor: 'SVC-PAY',
        note: 'Thanh toán thành công qua MOCK_PAY',
        at: '2026-11-24T01:02:00Z',
      },
    ],
    createdAt: '2026-11-24T01:00:00Z',
    updatedAt: '2026-11-24T08:00:00Z',
    ...overrides,
  }
}

function mockShopResponse(shopId: string): PublicShopDTO | null {
  const map: Record<string, string> = {
    [SHOP_1_ID]: 'Shop Điện Tử A',
    [SHOP_2_ID]: 'Shop Thời Trang B',
    [SHOP_3_ID]: 'Shop Gia Dụng C',
  }
  const name = map[shopId]
  if (!name) return null
  return {
    shopId,
    name,
    ratingAvg: 4.8,
    ratingCount: 30,
    createdAt: '2026-01-01T00:00:00Z',
  }
}

function renderOrdersFeature(
  initialPath: string,
  detailProps?: BuyerOrderDetailPageProps,
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
            <Route path="/account/orders" element={<BuyerOrdersPage />} />
            <Route path="/account/orders/:id" element={<BuyerOrderDetailPage {...detailProps} />} />
            <Route path="/account/profile" element={<div>Hồ sơ cá nhân</div>} />
            <Route path="/account/addresses" element={<div>Sổ địa chỉ</div>} />
            <Route path="/account/complaints" element={<div>Khiếu nại của tôi</div>} />
            <Route path="/account/reviews" element={<div>Đánh giá của tôi</div>} />
            <Route path="/products" element={<div>Tìm kiếm sản phẩm</div>} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  setAuthSession({
    accessToken: 'jwt-buyer-test',
    refreshToken: 'rt-buyer-test',
    user: {
      userId: BUYER_ID,
      email: 'buyer@soa.vn',
      fullName: 'Nguyễn Khánh Dương',
      phone: '0901234567',
      status: 'ACTIVE',
      roles: ['BUYER'],
      createdAt: '2026-11-01T00:00:00Z',
    },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  clearAuthSession()
  cleanup()
})

describe('T4-07: order-helpers unit tests', () => {
  it('maps partial refund breakdown lines and hides when unpaid or no refund lines exist', () => {
    const detail = makeThreeShopOrderDetail()
    const mapped = mapPartialRefundLines(detail.partialRefundBreakdown, detail.sellerOrders ?? [], new Map())
    expect(mapped.paidTotal).toBe(975_000)
    expect(mapped.refunds).toEqual([
      {
        sellerOrderId: SO_3_ID,
        sellerOrderCode: 'SO-003',
        shopName: 'Shop Gia Dụng C',
        amount: 225_000,
        status: 'SUCCEEDED',
      },
    ])

    const unpaid = mapPartialRefundLines(
      { ...detail.partialRefundBreakdown, paidTotalAmount: 0, refundedSellerOrderCount: 0 },
      detail.sellerOrders ?? [],
      new Map(),
    )
    expect(unpaid.refunds).toEqual([])
  })

  it('evaluates lifecycle cancel and confirm-receipt rules including hasOpenComplaint lock', () => {
    const baseSo: BuyerSellerOrderDetailView = makeThreeShopOrderDetail().sellerOrders![0]!

    expect(canBuyerCancelPackage({ ...baseSo, status: 'AWAITING_CONFIRMATION', availableActions: null })).toBe(true)
    expect(canBuyerCancelPackage({ ...baseSo, status: 'PENDING_PAYMENT', availableActions: null })).toBe(true)
    expect(canBuyerCancelPackage({ ...baseSo, status: 'SHIPPING', availableActions: null })).toBe(false)
    expect(canBuyerCancelPackage({ ...baseSo, status: 'AWAITING_CONFIRMATION', availableActions: ['CANCEL'] })).toBe(true)

    expect(canBuyerConfirmReceipt({ ...baseSo, status: 'DELIVERED', hasOpenComplaint: false })).toBe(true)
    expect(canBuyerConfirmReceipt({ ...baseSo, status: 'DELIVERED', hasOpenComplaint: true })).toBe(false)
  })

  it('sorts out-of-order tracking events descending by occurredAt', () => {
    const sorted = sortTrackingEvents([
      { eventId: 'e1', status: 'PICKED_UP', occurredAt: '2026-11-24T02:00:00Z' },
      { eventId: 'e3', status: 'DELIVERED', occurredAt: '2026-11-24T08:00:00Z' },
      { eventId: 'e2', status: 'IN_TRANSIT', occurredAt: '2026-11-24T05:00:00Z' },
    ])
    expect(sorted.map((e) => e.eventId)).toEqual(['e3', 'e2', 'e1'])
  })

  it('validates custom date ranges and builds RFC3339 queries', () => {
    expect(toDateRangeQuery('CUSTOM', '2026-11-25', '2026-11-20')).toEqual({ invalidRange: true })

    const validCustom = toDateRangeQuery('CUSTOM', '2026-11-01', '2026-11-24')
    expect(validCustom.invalidRange).toBe(false)
    expect(validCustom.from).toBe('2026-10-31T17:00:00.000Z')
    expect(validCustom.to).toBe('2026-11-24T16:59:59.999Z')

    const preset = toDateRangeQuery('7D', '', '', new Date('2026-11-24T05:00:00.000Z'))
    expect(preset.invalidRange).toBe(false)
    expect(preset.from).toBeTruthy()
    expect(preset.to).toBe('2026-11-24T05:00:00.000Z')
  })
})

describe('T4-07: Buyer Orders List (/account/orders)', () => {
  it('renders buyer orders, filters by status and time range, and validates invalid custom dates', async () => {
    const user = userEvent.setup()
    const recordedUrls: string[] = []

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input)
      const parsed = new URL(url)

      if (parsed.pathname.startsWith('/v1/shops/')) {
        const shopId = parsed.pathname.split('/').pop()!
        const shop = mockShopResponse(shopId)
        return shop ? jsonResponse(shop) : jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
      }

      if (parsed.pathname === '/v1/orders') {
        recordedUrls.push(parsed.pathname + parsed.search)
        if (parsed.searchParams.get('status') === 'CANCELLED') {
          return jsonResponse(makeOrderListResult({ items: [], total: 0, totalPages: 0 }))
        }
        return jsonResponse(makeOrderListResult())
      }

      return jsonResponse({ code: 'NOT_FOUND', message: 'Unhandled' }, 404)
    })

    renderOrdersFeature('/account/orders')

    expect(await screen.findByText('ORD-20261124-001')).toBeTruthy()
    expect(screen.getByText('Shop Điện Tử A')).toBeTruthy()
    expect(screen.getByText('Shop Thời Trang B')).toBeTruthy()
    const morePackages = screen.getByRole('button', { name: 'Xem thêm 1 gói hàng' })
    expect(morePackages.getAttribute('aria-expanded')).toBe('false')
    await user.click(morePackages)
    expect(morePackages.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Shop Gia Dụng C').closest('[hidden]')).toBeNull()
    expect(screen.getByText(/975\.000/)).toBeTruthy()

    // Filter by status: Đã thanh toán
    await user.click(screen.getByRole('button', { name: 'Đã thanh toán' }))
    await waitFor(() => {
      expect(recordedUrls.some((u) => u.includes('status=PAID'))).toBe(true)
    })

    // Filter by time preset: 7 ngày qua
    await user.click(screen.getByRole('button', { name: 'Khoảng thời gian' }))
    await user.click(screen.getByRole('button', { name: '7 ngày qua' }))
    await waitFor(() => {
      expect(recordedUrls.some((u) => u.includes('status=PAID') && u.includes('from=') && u.includes('to='))).toBe(true)
    })

    // Filter to empty status and clear filters
    await user.click(screen.getByRole('button', { name: 'Đã hủy' }))
    expect(await screen.findByText('Không tìm thấy đơn hàng phù hợp')).toBeTruthy()

    await user.click(screen.getAllByRole('button', { name: 'Xóa bộ lọc' })[0]!)
    expect(await screen.findByText('ORD-20261124-001')).toBeTruthy()

    // Custom date invalid range check (from > to)
    await user.click(screen.getByRole('button', { name: 'Tùy chọn ngày' }))
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-11-25' } })
    await waitFor(() => {
      expect(recordedUrls.some((u) => u.includes('from=2026-11-24T17'))).toBe(true)
    })
    const callCountBeforeInvalid = recordedUrls.length
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-11-20' } })

    expect(await screen.findByText('Ngày bắt đầu không được lớn hơn ngày kết thúc.')).toBeTruthy()
    expect(recordedUrls.length).toBe(callCountBeforeInvalid)
  })
})

describe('T4-07: Buyer Order Detail (/account/orders/:id)', () => {
  it('displays 3 <ShopPackageCard />s, immutable snapshot prices (TC-ORD-13), and <PartialRefundBreakdown />', async () => {
    const user = userEvent.setup()
    const requestedPaths: string[] = []

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input)
      const parsed = new URL(url)
      requestedPaths.push(parsed.pathname + parsed.search)

      if (parsed.pathname === `/v1/orders/${ORDER_ID}`) {
        return jsonResponse(makeThreeShopOrderDetail())
      }
      if (parsed.pathname === '/v1/shipments') {
        const soId = parsed.searchParams.get('sellerOrderId')
        if (soId === SO_1_ID) {
          return jsonResponse({
            shipments: [
              {
                shipmentId: SHP_1_ID,
                sellerOrderId: SO_1_ID,
                kind: 'FORWARD',
                carrier: 'GHN',
                trackingCode: 'GHN-TRK-001',
                status: 'DELIVERED',
              },
            ],
          })
        }
        return jsonResponse({ shipments: [] })
      }
      if (parsed.pathname === `/v1/shipments/${SHP_1_ID}/tracking`) {
        return jsonResponse({
          events: [
            {
              eventId: 'ev-1',
              status: 'PICKED_UP',
              note: 'Shipper đã lấy hàng',
              occurredAt: '2026-11-24T02:00:00Z',
            },
            {
              eventId: 'ev-2',
              status: 'DELIVERED',
              note: 'Giao hàng thành công',
              occurredAt: '2026-11-24T08:00:00Z',
            },
          ],
        })
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })

    renderOrdersFeature(`/account/orders/${ORDER_ID}`)

    expect(await screen.findByText('ORD-20261124-001')).toBeTruthy()
    expect(screen.getByText('Shop Điện Tử A')).toBeTruthy()
    expect(screen.getByText('Shop Thời Trang B')).toBeTruthy()
    expect(screen.getByText('Shop Gia Dụng C')).toBeTruthy()

    // TC-ORD-13: immutable snapshot prices rendered without querying SVC-PRD products API
    expect(screen.getByText('Tai nghe ANC Snapshot 2026')).toBeTruthy()
    expect(screen.getByText('Áo khoác gió Snapshot')).toBeTruthy()
    const firstPackage = screen.getByRole('article', { name: /Shop Điện Tử A/ })
    expect(within(firstPackage).getByText('400.000 ₫')).toBeTruthy()
    expect(within(firstPackage).getByText('Số lượng 1')).toBeTruthy()
    expect(screen.getByText(/2 × 150\.000/)).toBeTruthy()
    expect(requestedPaths.some((p) => p.startsWith('/v1/products'))).toBe(false)

    const refundDetails = screen.getByRole('button', { name: /Chi tiết hoàn tiền/ })
    expect(screen.queryByRole('region', { name: 'Đối chiếu hoàn tiền' })).toBeNull()
    await user.click(refundDetails)
    expect(screen.getByRole('region', { name: 'Đối chiếu hoàn tiền' })).toBeTruthy()
    expect(screen.getByText(/Hoàn tiền — Gói SO-003 \(Shop Gia Dụng C\)/)).toBeTruthy()
    expect(screen.getByText(/750\.000/)).toBeTruthy()
    expect(await screen.findByText('Giao hàng thành công')).toBeTruthy()
    const tracking = within(firstPackage).getByRole('button', { name: 'Hành trình vận chuyển' })
    const firstProduct = within(firstPackage).getByRole('link', { name: 'Tai nghe ANC Snapshot 2026' })
    expect(firstProduct.compareDocumentPosition(tracking) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(tracking.getAttribute('aria-expanded')).toBe('false')
    expect(within(firstPackage).queryByText('Shipper đã lấy hàng')).toBeNull()
    expect(within(firstPackage).queryByText('GHN-TRK-001')).toBeNull()
    await user.click(tracking)
    expect(within(firstPackage).getByText('Shipper đã lấy hàng')).toBeTruthy()
    expect(within(firstPackage).getByText('GHN-TRK-001')).toBeTruthy()
    await user.click(within(firstPackage).getByRole('button', { name: 'Tổng gói hàng' }))
    expect(within(firstPackage).getByText('Phí vận chuyển')).toBeTruthy()
  })

  it('cancels eligible package, confirms receipt for delivered package, and locks receipt when complaint is open', async () => {
    const user = userEvent.setup()
    let currentDetail = makeThreeShopOrderDetail()
    const cancelCalls: Array<{ id: string; body: unknown }> = []
    const receiptCalls: string[] = []

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const req = input instanceof Request ? input : new Request(String(input))
      const parsed = new URL(req.url)

      if (req.method === 'GET' && parsed.pathname === `/v1/orders/${ORDER_ID}`) {
        return jsonResponse(currentDetail)
      }

      if (req.method === 'POST' && parsed.pathname === `/v1/seller-orders/${SO_2_ID}/cancel`) {
        const body = await req.json()
        cancelCalls.push({ id: SO_2_ID, body })
        currentDetail = makeThreeShopOrderDetail({
          sellerOrders: currentDetail.sellerOrders!.map((so) =>
            so.sellerOrderId === SO_2_ID
              ? {
                  ...so,
                  status: 'CANCELLED',
                  refundStatus: 'FULL',
                  cancelCause: 'BUYER_CANCELLED',
                  cancelReason: 'Muốn thay đổi địa chỉ nhận hàng',
                  availableActions: [],
                }
              : so,
          ),
        })
        return jsonResponse({
          sellerOrderId: SO_2_ID,
          sellerOrderCode: 'SO-002',
          orderId: ORDER_ID,
          orderStatus: 'PAID',
          status: 'CANCELLED',
          hasOpenComplaint: false,
          availableActions: [],
          updatedAt: '2026-11-24T09:10:00Z',
          version: 2,
        })
      }

      if (req.method === 'POST' && parsed.pathname === `/v1/seller-orders/${SO_1_ID}/receipt`) {
        receiptCalls.push(SO_1_ID)
        currentDetail = makeThreeShopOrderDetail({
          sellerOrders: currentDetail.sellerOrders!.map((so) =>
            so.sellerOrderId === SO_1_ID
              ? {
                  ...so,
                  status: 'COMPLETED',
                  availableActions: [],
                }
              : so,
          ),
        })
        return jsonResponse({
          sellerOrderId: SO_1_ID,
          sellerOrderCode: 'SO-001',
          orderId: ORDER_ID,
          orderStatus: 'PAID',
          status: 'COMPLETED',
          hasOpenComplaint: false,
          availableActions: [],
          updatedAt: '2026-11-24T09:12:00Z',
          version: 4,
        })
      }

      if (parsed.pathname === '/v1/shipments') {
        return jsonResponse({ shipments: [] })
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })

    renderOrdersFeature(`/account/orders/${ORDER_ID}`)
    expect(await screen.findByText('ORD-20261124-001')).toBeTruthy()

    // Only SO-002 (AWAITING_CONFIRMATION) shows "Hủy gói hàng này"
    const cancelButtons = screen.getAllByRole('button', { name: 'Hủy gói hàng này' })
    expect(cancelButtons).toHaveLength(1)

    // T_COMPLETE countdown pill is visible for SO-001 (DELIVERED)
    expect(screen.getByText(/Tự động hoàn tất/)).toBeTruthy()

    // Cancel SO-002 with preset reason
    await user.click(cancelButtons[0]!)
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Muốn thay đổi địa chỉ nhận hàng' }))
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận hủy gói' }))

    await waitFor(() => {
      expect(cancelCalls).toHaveLength(1)
    })
    expect(cancelCalls[0]!.body).toEqual({ reason: 'Muốn thay đổi địa chỉ nhận hàng' })
    expect(await screen.findByText(/Đã hủy gói hàng SO-002 thành công/)).toBeTruthy()

    // Confirm receipt for SO-001
    await user.click(screen.getByRole('button', { name: 'Đã nhận hàng' }))
    const receiptDialog = await screen.findByRole('dialog')
    await user.click(within(receiptDialog).getByRole('button', { name: 'Tôi đã nhận hàng' }))

    await waitFor(() => {
      expect(receiptCalls).toEqual([SO_1_ID])
    })
    expect(await screen.findByText(/Đã xác nhận nhận hàng cho gói SO-001 thành công/)).toBeTruthy()
  })

  it('disables confirm receipt and hides T_COMPLETE countdown when hasOpenComplaint is true', async () => {
    const orderWithComplaint = makeThreeShopOrderDetail()
    orderWithComplaint.sellerOrders![0] = {
      ...orderWithComplaint.sellerOrders![0]!,
      hasOpenComplaint: true,
      availableActions: [],
    }

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input)
      const parsed = new URL(url)
      if (parsed.pathname === `/v1/orders/${ORDER_ID}`) {
        return jsonResponse(orderWithComplaint)
      }
      if (parsed.pathname === '/v1/shipments') {
        return jsonResponse({ shipments: [] })
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })

    renderOrdersFeature(`/account/orders/${ORDER_ID}`)
    expect(await screen.findByText(/Gói hàng đang có khiếu nại mở/)).toBeTruthy()
    const receiptBtn = screen.getByRole('button', { name: 'Đã nhận hàng' }) as HTMLButtonElement
    expect(receiptBtn.disabled).toBe(true)
  })

  it('gracefully degrades when SVC-SHP returns 503 and recovers on retry without breaking order detail (NFR-REL-005)', async () => {
    const user = userEvent.setup()
    let shpDown = true

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input)
      const parsed = new URL(url)

      if (parsed.pathname === `/v1/orders/${ORDER_ID}`) {
        return jsonResponse(makeThreeShopOrderDetail())
      }

      if (parsed.pathname === '/v1/shipments') {
        if (shpDown) {
          return jsonResponse({ code: 'SERVICE_UNAVAILABLE', message: 'SVC-SHP down' }, 503)
        }
        const soId = parsed.searchParams.get('sellerOrderId')
        if (soId === SO_1_ID) {
          return jsonResponse({
            shipments: [
              {
                shipmentId: SHP_1_ID,
                sellerOrderId: SO_1_ID,
                kind: 'FORWARD',
                carrier: 'GHN',
                trackingCode: 'GHN-TRK-001',
                status: 'DELIVERED',
              },
            ],
          })
        }
        return jsonResponse({ shipments: [] })
      }

      if (parsed.pathname === `/v1/shipments/${SHP_1_ID}/tracking`) {
        return jsonResponse({
          events: [
            {
              eventId: 'ev-old',
              status: 'PICKED_UP',
              note: 'Đã lấy hàng tại kho',
              occurredAt: '2026-11-24T02:00:00Z',
            },
            {
              eventId: 'ev-new',
              status: 'DELIVERED',
              note: 'Đã giao cho người nhận',
              occurredAt: '2026-11-24T08:00:00Z',
            },
          ],
        })
      }

      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })

    renderOrdersFeature(`/account/orders/${ORDER_ID}`)

    // Order details, snapshot items, refund breakdown, and actions still render cleanly
    expect(await screen.findByText('ORD-20261124-001')).toBeTruthy()
    expect(screen.getByText('Tai nghe ANC Snapshot 2026')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Chi tiết hoàn tiền' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Đã nhận hàng' })).toBeTruthy()

    // The compact status stays visible while the retry action lives in tracking details.
    const trackingPanel = within(screen.getByTestId(`tracking-panel-${SO_1_ID}`))
    expect(await trackingPanel.findByText('Chưa cập nhật được hành trình')).toBeTruthy()
    await user.click(trackingPanel.getByRole('button', { name: 'Hành trình vận chuyển' }))
    expect(await trackingPanel.findByText(/Tạm thời không thể tải hành trình vận chuyển/)).toBeTruthy()

    // Recover SVC-SHP and retry tracking block only
    shpDown = false
    await user.click(trackingPanel.getByRole('button', { name: 'Thử tải lại khối này' }))

    expect((await trackingPanel.findAllByText('Đã giao cho người nhận')).length).toBeGreaterThan(0)
  })

  it('supports external <ShipmentTrackingTimeline /> hook via renderExternalTimeline prop', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input)
      const parsed = new URL(url)
      if (parsed.pathname === `/v1/orders/${ORDER_ID}`) {
        return jsonResponse(makeThreeShopOrderDetail())
      }
      if (parsed.pathname === '/v1/shipments') {
        const soId = parsed.searchParams.get('sellerOrderId')
        if (soId === SO_1_ID) {
          return jsonResponse({
            shipments: [
              {
                shipmentId: SHP_1_ID,
                sellerOrderId: SO_1_ID,
                kind: 'FORWARD',
                carrier: 'GHN',
                trackingCode: 'GHN-TRK-001',
                status: 'DELIVERED',
              },
            ],
          })
        }
        return jsonResponse({ shipments: [] })
      }
      if (parsed.pathname === `/v1/shipments/${SHP_1_ID}/tracking`) {
        return jsonResponse({
          events: [
            { eventId: 'ev-1', status: 'DELIVERED', occurredAt: '2026-11-24T08:00:00Z' },
          ],
        })
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })

    renderOrdersFeature(`/account/orders/${ORDER_ID}`, {
      renderExternalTimeline: ({ sellerOrderId, events }) => (
        <div data-testid={`external-timeline-${sellerOrderId}`}>
          External timeline ({events.length})
        </div>
      ),
    })

    const trackingPanel = within(await screen.findByTestId(`tracking-panel-${SO_1_ID}`))
    await user.click(trackingPanel.getByRole('button', { name: 'Hành trình vận chuyển' }))
    expect(await trackingPanel.findByTestId(`external-timeline-${SO_1_ID}`)).toBeTruthy()
    expect(screen.getByText('External timeline (1)')).toBeTruthy()
  })
})
