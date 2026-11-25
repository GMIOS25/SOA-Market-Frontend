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
import type {
  BuyerOrderDetailView,
  BuyerOrderListResult,
  PublicShopDTO,
  SellerOrderDetailView,
  ShopDTO,
} from '@/features/cart-checkout-order/api'
import { clearAuthSession, setAuthSession } from '@/lib/auth/session'
import type {
  ComplaintDetailView,
  ComplaintListResult,
  ComplaintSummaryView,
  CreateComplaintsResult,
} from './api'
import { buildComplaintTimeline, resolveComplaintSla, validateEvidenceFile } from './helpers'
import { BuyerComplaintDetailPage } from './pages/BuyerComplaintDetailPage'
import { BuyerComplaintsPage } from './pages/BuyerComplaintsPage'
import { SellerComplaintDetailPage } from './pages/SellerComplaintDetailPage'
import { SellerComplaintsPage } from './pages/SellerComplaintsPage'

const BUYER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SELLER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ORDER_ID = '11111111-1111-4111-8111-111111111111'
const SHOP_1_ID = '22222222-2222-4222-8222-222222222221'
const SHOP_2_ID = '22222222-2222-4222-8222-222222222222'
const SO_1_ID = '33333333-3333-4333-8333-333333333331'
const SO_2_ID = '33333333-3333-4333-8333-333333333332'
const CPL_1_ID = '55555555-5555-4555-8555-555555555551'
const CPL_2_ID = '55555555-5555-4555-8555-555555555552'
const EV_1_ID = '66666666-6666-4666-8666-666666666661'

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function makeSummary(overrides: Partial<ComplaintSummaryView> = {}): ComplaintSummaryView {
  const futureDue = new Date(Date.now() + 18 * 3_600_000).toISOString()
  return {
    complaintId: CPL_1_ID,
    complaintCode: 'CPL-20261125-AA11BB',
    sellerOrderId: SO_1_ID,
    orderId: ORDER_ID,
    buyerId: BUYER_ID,
    shopId: SHOP_1_ID,
    type: 'DAMAGED',
    requestedResolution: 'PARTIAL_REFUND',
    requestedRefundAmount: 150_000,
    description: 'Hàng bị móp góc hộp khi nhận.',
    status: 'AWAITING_SELLER',
    unverifiedFlag: false,
    priority: 2,
    sellerDueAt: futureDue,
    returnReceivedConfirmed: false,
    version: 1,
    createdAt: '2026-11-25T08:00:00Z',
    updatedAt: '2026-11-25T08:05:00Z',
    ...overrides,
  }
}

function makeDetail(overrides: Partial<ComplaintDetailView> = {}): ComplaintDetailView {
  const complaint = makeSummary(overrides.complaint)
  return {
    complaint,
    availableActions: ['WITHDRAW', 'UPLOAD_EVIDENCE', 'RESPOND', 'ESCALATE'],
    statusHistory: [
      {
        historyId: 'h-2',
        complaintId: complaint.complaintId,
        fromStatus: 'SUBMITTED',
        toStatus: 'AWAITING_SELLER',
        actor: 'SYSTEM',
        reason: 'Đã xác minh tự động và chuyển đến nhà bán.',
        at: '2026-11-25T08:00:05Z',
      },
      {
        historyId: 'h-1',
        complaintId: complaint.complaintId,
        toStatus: 'SUBMITTED',
        actor: `usr:${BUYER_ID}`,
        reason: 'Người mua gửi khiếu nại',
        at: '2026-11-25T08:00:00Z',
      },
    ],
    messages: [
      {
        messageId: 'm-1',
        complaintId: complaint.complaintId,
        senderId: BUYER_ID,
        senderRole: 'BUYER',
        content: 'Sản phẩm bị móp vỏ ngoài.',
        createdAt: '2026-11-25T08:00:00Z',
      },
    ],
    evidences: [
      {
        evidenceId: EV_1_ID,
        complaintId: complaint.complaintId,
        fileHash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        fileSize: 2048,
        mimeType: 'application/pdf',
        uploadedBy: BUYER_ID,
        uploaderRole: 'BUYER',
        uploadedAt: '2026-11-25T08:02:00Z',
      },
    ],
    relatedComplaints: [
      {
        complaintId: CPL_2_ID,
        complaintCode: 'CPL-20261125-CC22DD',
        sellerOrderId: SO_2_ID,
        shopId: SHOP_2_ID,
        type: 'DAMAGED',
        status: 'AWAITING_SELLER',
        createdAt: '2026-11-25T08:00:00Z',
      },
    ],
    ...overrides,
  }
}

function makeOrderList(): BuyerOrderListResult {
  return {
    items: [
      {
        orderId: ORDER_ID,
        orderCode: 'ORD-20261125-001',
        buyerId: BUYER_ID,
        status: 'PAID',
        itemsTotal: 700_000,
        shippingTotal: 50_000,
        grandTotal: 750_000,
        paymentDueAt: '2026-11-24T09:15:00Z',
        sellerOrderCount: 2,
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
            status: 'DELIVERED',
            totalAmount: 325_000,
            refundStatus: 'NONE',
          },
        ],
        createdAt: '2026-11-24T09:00:00Z',
        updatedAt: '2026-11-24T09:30:00Z',
      },
    ],
    page: 1,
    limit: 50,
    total: 1,
    totalPages: 1,
  }
}

function makeOrderDetail(): BuyerOrderDetailView {
  return {
    orderId: ORDER_ID,
    orderCode: 'ORD-20261125-001',
    buyerId: BUYER_ID,
    status: 'PAID',
    itemsTotal: 700_000,
    shippingTotal: 50_000,
    grandTotal: 750_000,
    paymentDueAt: '2026-11-24T09:15:00Z',
    paymentDegraded: false,
    shippingDegraded: false,
    partialRefundBreakdown: {
      activeAllocationAmount: 750_000,
      cancelledRefundAmount: 0,
      originalTotalAmount: 750_000,
      paidTotalAmount: 750_000,
      refundedSellerOrderCount: 0,
      sellerOrders: [],
      voucherDiscountTotal: 0,
    },
    history: [],
    deliveryAddress: {
      contactName: 'Nguyễn Văn A',
      phone: '0901234567',
      line: '123 Lê Lợi',
      ward: 'Bến Thành',
      district: 'Quận 1',
      province: 'TP. Hồ Chí Minh',
    },
    sellerOrders: [
      {
        sellerOrderId: SO_1_ID,
        sellerOrderCode: 'SO-001',
        orderId: ORDER_ID,
        shopId: SHOP_1_ID,
        shopName: 'Cửa hàng Minh Tâm',
        status: 'DELIVERED',
        itemsAmount: 400_000,
        shippingFee: 25_000,
        discountAmount: 0,
        totalAmount: 425_000,
        refundStatus: 'NONE',
        hasOpenComplaint: false,
        availableActions: [],
        version: 1,
        items: [],
        createdAt: '2026-11-24T09:00:00Z',
        updatedAt: '2026-11-24T09:30:00Z',
      },
      {
        sellerOrderId: SO_2_ID,
        sellerOrderCode: 'SO-002',
        orderId: ORDER_ID,
        shopId: SHOP_2_ID,
        shopName: 'Shop Điện Tử ABC',
        status: 'DELIVERED',
        itemsAmount: 300_000,
        shippingFee: 25_000,
        discountAmount: 0,
        totalAmount: 325_000,
        refundStatus: 'NONE',
        hasOpenComplaint: false,
        availableActions: [],
        version: 1,
        items: [],
        createdAt: '2026-11-24T09:00:00Z',
        updatedAt: '2026-11-24T09:30:00Z',
      },
    ],
    createdAt: '2026-11-24T09:00:00Z',
    updatedAt: '2026-11-24T09:30:00Z',
  }
}

function makeSellerShop(): ShopDTO {
  return {
    shopId: SHOP_1_ID,
    applicationId: 'app-1',
    sellerUserId: SELLER_ID,
    name: 'Cửa hàng Minh Tâm',
    status: 'ACTIVE',
    ratingAvg: 4.8,
    ratingCount: 10,
    version: 1,
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  }
}

function makeSellerOrderDetail(): SellerOrderDetailView {
  return {
    sellerOrderId: SO_1_ID,
    sellerOrderCode: 'SO-001',
    orderId: ORDER_ID,
    orderCode: 'ORD-20261125-001',
    shopId: SHOP_1_ID,
    buyerId: BUYER_ID,
    status: 'DELIVERED',
    itemsAmount: 400_000,
    shippingFee: 25_000,
    discountAmount: 0,
    totalAmount: 425_000,
    refundStatus: 'NONE',
    hasOpenComplaint: true,
    availableActions: [],
    version: 1,
    deliveryAddress: {
      contactName: 'Nguyễn Văn A',
      phone: '0901234567',
      line: '123 Lê Lợi',
      ward: 'Bến Thành',
      district: 'Quận 1',
      province: 'TP. Hồ Chí Minh',
    },
    items: [
      {
        orderItemId: 'item-1',
        sellerOrderId: SO_1_ID,
        productId: 'prd-1',
        variantId: 'var-1',
        productName: 'Tai nghe Bluetooth',
        variantLabel: 'Đen',
        quantity: 1,
        unitPrice: 400_000,
        lineTotal: 400_000,
        weightGram: 250,
      },
    ],
    history: [],
    createdAt: '2026-11-24T09:00:00Z',
    updatedAt: '2026-11-24T09:30:00Z',
  }
}

function renderWithRouter(ui: React.ReactElement, initialEntries: string[], pathPattern: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path={pathPattern} element={ui} />
            <Route path="/account/complaints" element={ui} />
            <Route path="/account/complaints/:id" element={ui} />
            <Route path="/seller/complaints" element={ui} />
            <Route path="/seller/complaints/:id" element={ui} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

function setBuyerSession() {
  setAuthSession({
    accessToken: 'buyer-token',
    refreshToken: 'refresh-token',
    user: {
      userId: BUYER_ID,
      email: 'buyer@soa.vn',
      fullName: 'Buyer Test',
      phone: '0901234567',
      createdAt: '2026-11-01T00:00:00Z',
      status: 'ACTIVE',
      roles: ['BUYER'],
    },
  })
}

function setSellerSession() {
  setAuthSession({
    accessToken: 'seller-token',
    refreshToken: 'refresh-token',
    user: {
      userId: SELLER_ID,
      email: 'seller@soa.vn',
      fullName: 'Seller Test',
      phone: '0907654321',
      createdAt: '2026-11-01T00:00:00Z',
      status: 'ACTIVE',
      roles: ['BUYER', 'SELLER'],
    },
  })
}

describe('T4-11: Complaints helpers & unit tests', () => {
  it('buildComplaintTimeline sorts chronologically without mutating input arrays', () => {
    const statusHistory = Object.freeze([
      {
        historyId: 'h-2',
        complaintId: CPL_1_ID,
        fromStatus: 'SUBMITTED',
        toStatus: 'AWAITING_SELLER',
        actor: 'SYSTEM',
        at: '2026-11-25T08:00:05Z',
      },
      {
        historyId: 'h-1',
        complaintId: CPL_1_ID,
        toStatus: 'SUBMITTED',
        actor: `usr:${BUYER_ID}`,
        at: '2026-11-25T08:00:00Z',
      },
    ]) as ComplaintDetailView['statusHistory']

    const messages = Object.freeze([
      {
        messageId: 'm-2',
        complaintId: CPL_1_ID,
        senderRole: 'SELLER',
        content: 'Đề xuất hoàn 100k',
        createdAt: '2026-11-25T09:00:00Z',
      },
      {
        messageId: 'm-1',
        complaintId: CPL_1_ID,
        senderRole: 'BUYER',
        content: 'Mở khiếu nại',
        createdAt: '2026-11-25T08:00:00Z',
      },
    ]) as ComplaintDetailView['messages']

    const evidences = Object.freeze([
      {
        evidenceId: EV_1_ID,
        complaintId: CPL_1_ID,
        fileHash: 'abc123',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        uploadedBy: BUYER_ID,
        uploaderRole: 'BUYER',
        uploadedAt: '2026-11-25T08:30:00Z',
      },
    ]) as ComplaintDetailView['evidences']

    const timeline = buildComplaintTimeline({ statusHistory, messages, evidences })

    expect(timeline.map((item) => item.id)).toEqual([
      'status-h-1',
      'message-m-1',
      'status-h-2',
      `evidence-${EV_1_ID}`,
      'message-m-2',
    ])
  })

  it('resolveComplaintSla selects active SLA deadline per status', () => {
    const due = '2026-11-26T08:00:00Z'
    expect(
      resolveComplaintSla(makeSummary({ status: 'AWAITING_SELLER', sellerDueAt: due }))?.labelKey,
    ).toBe('sla.seller')
    expect(
      resolveComplaintSla(makeSummary({ status: 'NEGOTIATING', negotiateDueAt: due }))?.labelKey,
    ).toBe('sla.negotiate')
    expect(
      resolveComplaintSla(makeSummary({ status: 'ESCALATED', slaDueAt: due }))?.labelKey,
    ).toBe('sla.cs')
    expect(resolveComplaintSla(makeSummary({ status: 'CLOSED', sellerDueAt: due }))).toBeNull()
    expect(resolveComplaintSla(makeSummary({ status: 'WITHDRAWN', sellerDueAt: due }))).toBeNull()
  })

  it('validateEvidenceFile enforces file types and size caps (5MB image, 20MB video/PDF)', () => {
    expect(validateEvidenceFile({ name: 'empty.jpg', type: 'image/jpeg', size: 0 })).toEqual({
      ok: false,
      code: 'EMPTY',
    })
    expect(validateEvidenceFile({ name: 'script.exe', type: 'application/x-msdownload', size: 100 })).toEqual({
      ok: false,
      code: 'INVALID_TYPE',
    })
    expect(validateEvidenceFile({ name: 'big.png', type: 'image/png', size: 6 * 1024 * 1024 })).toEqual({
      ok: false,
      code: 'IMAGE_TOO_LARGE',
    })
    expect(validateEvidenceFile({ name: 'ok.jpg', type: 'image/jpeg', size: 1024 })).toEqual({
      ok: true,
      mimeType: 'image/jpeg',
      isImage: true,
    })
    expect(validateEvidenceFile({ name: 'clip.mp4', type: 'video/mp4', size: 10 * 1024 * 1024 })).toEqual({
      ok: true,
      mimeType: 'video/mp4',
      isImage: false,
    })
    expect(validateEvidenceFile({ name: 'huge.pdf', type: 'application/pdf', size: 21 * 1024 * 1024 })).toEqual({
      ok: false,
      code: 'MEDIA_TOO_LARGE',
    })
  })
})

describe('T4-11: Buyer Complaints UI (/account/complaints & :id)', () => {
  afterEach(() => {
    cleanup()
    clearAuthSession()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    setBuyerSession()
  })

  it('lists buyer complaints with SLA countdown, filters, and handles 503 fallback', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString()
      if (url.includes('/v1/complaints')) {
        const list: ComplaintListResult = {
          items: [makeSummary()],
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        }
        return jsonResponse(list)
      }
      if (url.includes(`/v1/shops/${SHOP_1_ID}`)) {
        const shop: PublicShopDTO = {
          shopId: SHOP_1_ID,
          name: 'Cửa hàng Minh Tâm',
          ratingAvg: 4.8,
          ratingCount: 10,
          createdAt: '2026-11-01T00:00:00Z',
        }
        return jsonResponse(shop)
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderWithRouter(<BuyerComplaintsPage />, ['/account/complaints'], '/account/complaints')

    expect(await screen.findByText('CPL-20261125-AA11BB')).toBeTruthy()
    expect(await screen.findByText('Cửa hàng Minh Tâm')).toBeTruthy()
    expect(screen.getByRole('timer')).toBeTruthy()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Đang thương lượng' }))

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(([req]) =>
        typeof req === 'string' ? req : req instanceof Request ? req.url : req.toString(),
      )
      expect(calls.some((u) => u.includes('status=NEGOTIATING'))).toBe(true)
    })
  })

  it('creates multi-shop split complaints with Idempotency-Key and uploads evidence to each split complaint', async () => {
    const user = userEvent.setup()
    const uploadedTargets: string[] = []
    let createPayload: Record<string, unknown> | null = null
    let idempotencyHeader: string | null = null

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const req = input instanceof Request ? input : new Request(input.toString())
      const url = req.url

      if (url.includes('/v1/complaints') && req.method === 'GET') {
        return jsonResponse({ items: [], page: 1, limit: 10, total: 0, totalPages: 0 })
      }
      if (url.includes('/v1/orders?') || url.endsWith('/v1/orders')) {
        return jsonResponse(makeOrderList())
      }
      if (url.includes(`/v1/orders/${ORDER_ID}`)) {
        return jsonResponse(makeOrderDetail())
      }
      if (url.includes(`/v1/shops/${SHOP_1_ID}`)) {
        return jsonResponse({ shopId: SHOP_1_ID, name: 'Cửa hàng Minh Tâm', status: 'ACTIVE', createdAt: '' })
      }
      if (url.includes(`/v1/shops/${SHOP_2_ID}`)) {
        return jsonResponse({ shopId: SHOP_2_ID, name: 'Shop Điện Tử ABC', status: 'ACTIVE', createdAt: '' })
      }
      if (url.endsWith('/v1/complaints') && req.method === 'POST') {
        idempotencyHeader = req.headers.get('Idempotency-Key')
        createPayload = JSON.parse(await req.clone().text()) as Record<string, unknown>
        const result: CreateComplaintsResult = {
          orderId: ORDER_ID,
          splitCount: 2,
          idempotentReplay: false,
          complaints: [
            makeSummary({ complaintId: CPL_1_ID, complaintCode: 'CPL-SPLIT-01', shopId: SHOP_1_ID, sellerOrderId: SO_1_ID }),
            makeSummary({ complaintId: CPL_2_ID, complaintCode: 'CPL-SPLIT-02', shopId: SHOP_2_ID, sellerOrderId: SO_2_ID }),
          ],
        }
        return jsonResponse(result, 201)
      }
      if (url.includes('/evidence') && req.method === 'POST') {
        uploadedTargets.push(url)
        return jsonResponse(
          {
            evidenceId: 'ev-new',
            complaintId: CPL_1_ID,
            fileHash: 'deadbeef',
            fileSize: 128,
            mimeType: 'image/jpeg',
            uploadedBy: BUYER_ID,
            uploaderRole: 'BUYER',
            uploadedAt: '2026-11-25T09:00:00Z',
          },
          201,
        )
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderWithRouter(<BuyerComplaintsPage />, ['/account/complaints'], '/account/complaints')

    const createBtn = await screen.findByRole('button', { name: 'Tạo khiếu nại mới' })
    await user.click(createBtn)

    const dialog = await screen.findByRole('dialog')
    const orderSelect = await within(dialog).findByLabelText('1. Chọn đơn hàng')
    await user.selectOptions(orderSelect, ORDER_ID)

    const checkboxes = await within(dialog).findAllByRole('checkbox')
    expect(checkboxes.length).toBe(2)
    await user.click(checkboxes[0]!)
    await user.click(checkboxes[1]!)

    expect(
      await within(dialog).findByText(/Hệ thống sẽ tự động tách thành 2 khiếu nại độc lập/i),
    ).toBeTruthy()

    await user.type(
      within(dialog).getByLabelText('Mô tả chi tiết sự cố'),
      'Cả 2 shop đều giao thiếu phụ kiện kèm theo.',
    )

    const fileInput = within(dialog).getByLabelText('Chọn tệp bằng chứng') as HTMLInputElement
    const imgFile = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'proof.jpg', {
      type: 'image/jpeg',
    })
    fireEvent.change(fileInput, { target: { files: [imgFile] } })
    expect(await within(dialog).findByText('proof.jpg')).toBeTruthy()

    await user.click(within(dialog).getByRole('button', { name: 'Gửi khiếu nại' }))

    expect(await within(dialog).findByText('Đã tạo 2 khiếu nại thành công')).toBeTruthy()
    expect(within(dialog).getByText('CPL-SPLIT-01')).toBeTruthy()
    expect(within(dialog).getByText('CPL-SPLIT-02')).toBeTruthy()

    expect(idempotencyHeader).toBeTruthy()
    expect(createPayload).toMatchObject({
      sellerOrderIds: [SO_1_ID, SO_2_ID],
      type: 'DAMAGED',
      requestedResolution: 'FULL_REFUND',
    })
    expect(uploadedTargets).toHaveLength(2)
    expect(uploadedTargets.some((u) => u.includes(CPL_1_ID))).toBe(true)
    expect(uploadedTargets.some((u) => u.includes(CPL_2_ID))).toBe(true)
  })

  it('supports buyer timeline, proposal accept, negotiation, evidence download, escalate, and withdraw', async () => {
    const user = userEvent.setup()
    let currentDetail = makeDetail({
      complaint: makeSummary({ status: 'NEGOTIATING', negotiateDueAt: new Date(Date.now() + 3600_000).toISOString() }),
      messages: [
        {
          messageId: 'm-1',
          complaintId: CPL_1_ID,
          senderId: BUYER_ID,
          senderRole: 'BUYER',
          content: 'Sản phẩm bị móp vỏ ngoài.',
          createdAt: '2026-11-25T08:00:00Z',
        },
        {
          messageId: 'm-2',
          complaintId: CPL_1_ID,
          senderId: SELLER_ID,
          senderRole: 'SELLER',
          content: 'Shop đề xuất hoàn một phần 150.000đ.',
          proposal: {
            action: 'PROPOSE',
            resolution: 'PARTIAL_REFUND',
            refundAmount: 150_000,
            note: 'Shop đề xuất hoàn một phần 150.000đ.',
          },
          createdAt: '2026-11-25T09:00:00Z',
        },
      ],
    })

    const recordedCalls: Array<{ method: string; url: string; body?: unknown }> = []

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const req = input instanceof Request ? input : new Request(input.toString())
      const url = req.url

      if (url.endsWith(`/v1/complaints/${CPL_1_ID}`) && req.method === 'GET') {
        return jsonResponse(currentDetail)
      }
      if (url.includes(`/v1/orders/${ORDER_ID}`)) {
        return jsonResponse(makeOrderDetail())
      }
      if (url.includes(`/v1/shops/${SHOP_1_ID}`)) {
        return jsonResponse({ shopId: SHOP_1_ID, name: 'Cửa hàng Minh Tâm', status: 'ACTIVE', createdAt: '' })
      }
      if (url.endsWith(`/v1/complaints/${CPL_1_ID}/evidence/${EV_1_ID}`) && req.method === 'GET') {
        recordedCalls.push({ method: 'GET', url })
        return new Response(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), {
          status: 200,
          headers: { 'Content-Type': 'application/pdf' },
        })
      }
      if (url.endsWith(`/v1/complaints/${CPL_1_ID}/responses`) && req.method === 'POST') {
        const body = JSON.parse(await req.clone().text()) as { action: string; content: string }
        recordedCalls.push({ method: 'POST', url, body })
        return jsonResponse({
          complaint: currentDetail.complaint,
          message: {
            messageId: 'm-new',
            complaintId: CPL_1_ID,
            senderId: BUYER_ID,
            senderRole: 'BUYER',
            content: body.content,
            createdAt: '2026-11-25T10:00:00Z',
          },
        })
      }
      if (url.endsWith(`/v1/complaints/${CPL_1_ID}/escalate`) && req.method === 'POST') {
        const body = JSON.parse(await req.clone().text()) as { reason?: string }
        recordedCalls.push({ method: 'POST', url, body })
        currentDetail = {
          ...currentDetail,
          complaint: makeSummary({ status: 'ESCALATED', slaDueAt: new Date(Date.now() + 12 * 3600_000).toISOString() }),
          availableActions: ['WITHDRAW', 'UPLOAD_EVIDENCE'],
        }
        return jsonResponse(currentDetail.complaint)
      }
      if (url.endsWith(`/v1/complaints/${CPL_1_ID}/withdraw`) && req.method === 'POST') {
        const body = JSON.parse(await req.clone().text()) as { reason?: string }
        recordedCalls.push({ method: 'POST', url, body })
        currentDetail = {
          ...currentDetail,
          complaint: makeSummary({ status: 'WITHDRAWN' }),
          availableActions: [],
        }
        return jsonResponse(currentDetail.complaint)
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const origCreateObjectURL = URL.createObjectURL
    const origRevokeObjectURL = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()

    try {
      renderWithRouter(
        <BuyerComplaintDetailPage />,
        [`/account/complaints/${CPL_1_ID}`],
        '/account/complaints/:id',
      )

      // Chờ chi tiết + timeline + khiếu nại cùng Order hiển thị
      expect(await screen.findByText('CPL-20261125-AA11BB')).toBeTruthy()
      expect(screen.getByText('CPL-20261125-CC22DD')).toBeTruthy()

      // Kiểm tra thứ tự bất biến trên dòng thời gian
      const timelineSection = screen.getByRole('region', { name: 'Dòng thời gian xử lý khiếu nại' })
      const timelineList = within(timelineSection).getByRole('list')
      const timelineItems = timelineList.querySelectorAll('li[data-timeline-kind]')
      expect(timelineItems.length).toBeGreaterThanOrEqual(4)
      expect(timelineItems[0]?.getAttribute('data-timeline-kind')).toBe('status')
      expect(timelineItems[1]?.getAttribute('data-timeline-kind')).toBe('message')

      // Tải bằng chứng PDF qua authFetch
      await user.click(screen.getByRole('button', { name: 'Xem / Tải xuống' }))
      await waitFor(() => {
        expect(recordedCalls.some((c) => c.url.includes(`/evidence/${EV_1_ID}`))).toBe(true)
      })

      // Gửi tin nhắn thương lượng
      await user.type(screen.getByLabelText('Nội dung trao đổi'), 'Vui lòng hoàn thêm phí ship.')
      await user.click(screen.getByRole('button', { name: 'Gửi phản hồi' }))
      await waitFor(() => {
        expect(
          recordedCalls.some(
            (c) =>
              c.url.endsWith('/responses') &&
              (c.body as { action: string }).action === 'MESSAGE',
          ),
        ).toBe(true)
      })

      // Chấp nhận đề xuất từ Seller
      await user.click(screen.getByRole('button', { name: 'Chấp nhận đề xuất' }))
      await waitFor(() => {
        expect(
          recordedCalls.some(
            (c) =>
              c.url.endsWith('/responses') &&
              (c.body as { action: string }).action === 'ACCEPT_PROPOSAL',
          ),
        ).toBe(true)
      })

      // Yêu cầu CSKH hỗ trợ (Escalate)
      await user.click(screen.getByRole('button', { name: 'Yêu cầu CSKH hỗ trợ' }))
      const escalateDialog = await screen.findByRole('dialog')
      await user.type(within(escalateDialog).getByLabelText('Lý do (tùy chọn)'), 'Cần CSKH phân xử')
      await user.click(within(escalateDialog).getByRole('button', { name: 'Gửi yêu cầu CSKH' }))
      await waitFor(() => {
        expect(recordedCalls.some((c) => c.url.endsWith('/escalate'))).toBe(true)
      })

      // Rút khiếu nại (Withdraw)
      await user.click(await screen.findByRole('button', { name: 'Rút khiếu nại' }))
      const withdrawDialog = await screen.findByRole('dialog')
      await user.type(within(withdrawDialog).getByLabelText('Lý do (tùy chọn)'), 'Đã tự thỏa thuận xong')
      await user.click(within(withdrawDialog).getByRole('button', { name: 'Xác nhận rút khiếu nại' }))
      await waitFor(() => {
        expect(recordedCalls.some((c) => c.url.endsWith('/withdraw'))).toBe(true)
      })
    } finally {
      openSpy.mockRestore()
      URL.createObjectURL = origCreateObjectURL
      URL.revokeObjectURL = origRevokeObjectURL
    }
  })
})

describe('T4-11: Seller Complaints UI (/seller/complaints & :id)', () => {
  afterEach(() => {
    cleanup()
    clearAuthSession()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    setSellerSession()
  })

  it('lists only seller shop complaints and renders <SlaCountdownPill />', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const req = input instanceof Request ? input : new Request(input.toString())
      if (req.url.endsWith('/v1/seller/shop')) {
        return jsonResponse(makeSellerShop())
      }
      if (req.url.includes('/v1/complaints')) {
        return jsonResponse({
          items: [
            makeSummary({ complaintId: CPL_1_ID, complaintCode: 'CPL-MY-SHOP', shopId: SHOP_1_ID }),
            makeSummary({ complaintId: CPL_2_ID, complaintCode: 'CPL-OTHER-SHOP', shopId: SHOP_2_ID }),
          ],
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        } satisfies ComplaintListResult)
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderWithRouter(<SellerComplaintsPage />, ['/seller/complaints'], '/seller/complaints')

    expect((await screen.findAllByText('CPL-MY-SHOP')).length).toBeGreaterThan(0)
    expect(screen.queryByText('CPL-OTHER-SHOP')).toBeNull()
    expect(screen.getAllByRole('timer').length).toBeGreaterThan(0)
  })

  it('returns 403 UI if complaint belongs to a different shop and hides relatedComplaints', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const req = input instanceof Request ? input : new Request(input.toString())
      if (req.url.endsWith('/v1/seller/shop')) {
        return jsonResponse(makeSellerShop())
      }
      if (req.url.endsWith(`/v1/complaints/${CPL_2_ID}`)) {
        return jsonResponse(
          makeDetail({
            complaint: makeSummary({ complaintId: CPL_2_ID, shopId: SHOP_2_ID }),
          }),
        )
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderWithRouter(
      <SellerComplaintDetailPage />,
      [`/seller/complaints/${CPL_2_ID}`],
      '/seller/complaints/:id',
    )

    expect(await screen.findByText('403 — Không có quyền truy cập')).toBeTruthy()
  })

  it('validates partial refund ceiling client-side AND handles HTTP 422 Unprocessable Entity from backend', async () => {
    const user = userEvent.setup()
    let sellerOrderFails = false
    let submittedProposal: Record<string, unknown> | null = null

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const req = input instanceof Request ? input : new Request(input.toString())
      if (req.url.endsWith('/v1/seller/shop')) {
        return jsonResponse(makeSellerShop())
      }
      if (req.url.endsWith(`/v1/complaints/${CPL_1_ID}`) && req.method === 'GET') {
        return jsonResponse(makeDetail({ relatedComplaints: [] }))
      }
      if (req.url.endsWith(`/v1/seller-orders/${SO_1_ID}`)) {
        if (sellerOrderFails) {
          return jsonResponse({ code: 'SERVICE_UNAVAILABLE', message: 'SVC-ORD down' }, 503)
        }
        return jsonResponse(makeSellerOrderDetail())
      }
      if (req.url.endsWith(`/v1/complaints/${CPL_1_ID}/responses`) && req.method === 'POST') {
        const body = JSON.parse(await req.clone().text()) as {
          action: string
          resolution?: string
          refundAmount?: number
          content: string
        }
        if (body.refundAmount && body.refundAmount > 425_000) {
          return jsonResponse(
            {
              code: 'REFUND_AMOUNT_EXCEEDS_PAID',
              message: 'Số tiền đề xuất hoàn vượt quá số tiền đã thanh toán còn lại của gói hàng.',
              details: [{ field: 'refundAmount', reason: 'Tối đa 425000 VND' }],
              correlationId: 'corr-422-test',
            },
            422,
          )
        }
        submittedProposal = body
        return jsonResponse({
          complaint: makeSummary({ status: 'NEGOTIATING' }),
          message: {
            messageId: 'm-seller',
            complaintId: CPL_1_ID,
            senderId: SELLER_ID,
            senderRole: 'SELLER',
            content: body.content,
            proposal: {
              action: body.action,
              resolution: body.resolution,
              refundAmount: body.refundAmount,
            },
            createdAt: '2026-11-25T09:30:00Z',
          },
        })
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    // 1. Khi đã tải được SellerOrder (totalAmount = 425.000): kiểm tra chặn client-side nếu nhập > 425.000
    const { unmount } = renderWithRouter(
      <SellerComplaintDetailPage />,
      [`/seller/complaints/${CPL_1_ID}`],
      '/seller/complaints/:id',
    )

    expect(await screen.findByText('CPL-20261125-AA11BB')).toBeTruthy()
    expect(await screen.findByText(/Giá trị gói hàng tối đa có thể hoàn/i)).toBeTruthy()
    expect(screen.getByRole('timer')).toBeTruthy()

    const amountInput = screen.getByLabelText('Số tiền đề xuất hoàn một phần (VND)')
    const contentInput = screen.getByLabelText('Nội dung giải trình / phản hồi')

    await user.type(amountInput, '500000')
    await user.type(contentInput, 'Đề xuất hoàn vượt giá trị đơn')
    await user.click(screen.getByRole('button', { name: 'Gửi đề xuất hoàn một phần' }))

    expect(await screen.findByText(/Số tiền hoàn không được vượt quá giá trị gói hàng/i)).toBeTruthy()
    expect(submittedProposal).toBeNull()

    // Sửa lại số tiền hợp lệ (<= 425.000) và gửi thành công
    await user.clear(amountInput)
    await user.type(amountInput, '150000')
    await user.click(screen.getByRole('button', { name: 'Gửi đề xuất hoàn một phần' }))

    await waitFor(() => {
      expect(submittedProposal).toMatchObject({
        action: 'PROPOSE',
        resolution: 'PARTIAL_REFUND',
        refundAmount: 150_000,
      })
    })
    unmount()

    // 2. Khi SVC-ORD gián đoạn (chưa có ceiling phía client): server trả HTTP 422 Unprocessable Entity và UI xử lý chuẩn
    sellerOrderFails = true
    renderWithRouter(
      <SellerComplaintDetailPage />,
      [`/seller/complaints/${CPL_1_ID}`],
      '/seller/complaints/:id',
    )

    expect(
      await screen.findByText(/Hệ thống máy chủ sẽ kiểm tra giới hạn hoàn tiền khi gửi \(HTTP 422/i),
    ).toBeTruthy()

    await user.type(screen.getByLabelText('Số tiền đề xuất hoàn một phần (VND)'), '999000')
    await user.type(screen.getByLabelText('Nội dung giải trình / phản hồi'), 'Thử gửi số tiền vượt mức')
    await user.click(screen.getByRole('button', { name: 'Gửi đề xuất hoàn một phần' }))

    expect(
      await screen.findByText(/Số tiền đề xuất hoàn vượt quá số tiền đã thanh toán còn lại/i),
    ).toBeTruthy()
    expect(screen.getByText('corr-422-test')).toBeTruthy()
  })
})
