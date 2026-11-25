// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
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
import type {
  ComplaintDetailView,
  ComplaintSummaryView,
  CSQueueItemView,
} from './api'
import { AdminComplaintsQueuePage } from './pages/AdminComplaintsQueuePage'
import { AdminComplaintWorkspacePage } from './pages/AdminComplaintWorkspacePage'

const CS_USER_ID = '11111111-1111-4111-8111-111111111111'
const ADMIN_USER_ID = '22222222-2222-4222-8222-222222222222'
const ORDER_ID = '33333333-3333-4333-8333-333333333333'
const SO_1_ID = '44444444-4444-4444-8444-444444444444'
const SO_2_ID = '55555555-5555-4555-8555-555555555555'
const CPL_1_ID = '66666666-6666-4666-8666-666666666666'
const CPL_2_ID = '77777777-7777-4777-8777-777777777777'
const BUYER_ID = '88888888-8888-4888-8888-888888888888'
const SHOP_1_ID = '99999999-9999-4999-8999-999999999999'
const SHOP_2_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const EV_1_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const SHA256_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function apiErrorResponse(
  status: number,
  code: string,
  message: string,
  details: Array<{ field: string; reason: string }> = [],
): Response {
  return jsonResponse({ code, message, details, correlationId: 'corr-cpl-1' }, status)
}

function makeQueueItem(overrides: Partial<CSQueueItemView> = {}): CSQueueItemView {
  const slaDueAt = overrides.slaDueAt ?? new Date(Date.now() + 2 * 3_600_000).toISOString()
  return {
    complaintId: CPL_1_ID,
    complaintCode: 'CPL-20261125-001',
    sellerOrderId: SO_1_ID,
    orderId: ORDER_ID,
    buyerId: BUYER_ID,
    shopId: SHOP_1_ID,
    type: 'DAMAGED',
    requestedResolution: 'PARTIAL_REFUND',
    requestedRefundAmount: 150_000,
    description: 'Sản phẩm bị nứt vỏ hộp khi nhận hàng.',
    status: 'ESCALATED',
    unverifiedFlag: false,
    priority: 2,
    slaDueAt,
    slaRemainingSeconds: 7200,
    slaBreached: false,
    returnReceivedConfirmed: false,
    version: 3,
    createdAt: '2026-11-25T02:00:00Z',
    updatedAt: '2026-11-25T05:00:00Z',
    ...overrides,
  }
}

function makeSummary(overrides: Partial<ComplaintSummaryView> = {}): ComplaintSummaryView {
  return {
    complaintId: CPL_1_ID,
    complaintCode: 'CPL-20261125-001',
    sellerOrderId: SO_1_ID,
    orderId: ORDER_ID,
    buyerId: BUYER_ID,
    shopId: SHOP_1_ID,
    type: 'DAMAGED',
    requestedResolution: 'PARTIAL_REFUND',
    requestedRefundAmount: 150_000,
    description: 'Sản phẩm bị nứt vỏ hộp khi nhận hàng.',
    status: 'UNDER_REVIEW',
    unverifiedFlag: false,
    priority: 2,
    slaDueAt: new Date(Date.now() + 3 * 3_600_000).toISOString(),
    assignedCsId: CS_USER_ID,
    returnReceivedConfirmed: false,
    version: 4,
    createdAt: '2026-11-25T02:00:00Z',
    updatedAt: '2026-11-25T06:00:00Z',
    ...overrides,
  }
}

function makeDetail(overrides: Partial<ComplaintDetailView> = {}): ComplaintDetailView {
  return {
    complaint: makeSummary(),
    availableActions: ['DECIDE', 'UPLOAD_EVIDENCE'],
    messages: [
      {
        messageId: 'msg-1',
        complaintId: CPL_1_ID,
        senderId: BUYER_ID,
        senderRole: 'BUYER',
        content: 'Nhờ CSKH hỗ trợ xem xét ảnh kiện hàng móp méo.',
        createdAt: '2026-11-25T03:00:00Z',
      },
      {
        messageId: 'msg-2',
        complaintId: CPL_1_ID,
        senderRole: 'SELLER',
        content: 'Đề xuất hoàn một phần chi phí.',
        proposal: {
          action: 'PROPOSE',
          resolution: 'PARTIAL_REFUND',
          refundAmount: 100_000,
          note: 'Hỗ trợ 100k',
        },
        createdAt: '2026-11-25T04:00:00Z',
      },
    ],
    evidences: [
      {
        evidenceId: EV_1_ID,
        complaintId: CPL_1_ID,
        fileHash: SHA256_HASH,
        mimeType: 'image/png',
        fileSize: 20480,
        uploadedBy: BUYER_ID,
        uploaderRole: 'BUYER',
        uploadedAt: '2026-11-25T02:30:00Z',
        downloadUrl: `/v1/complaints/${CPL_1_ID}/evidence/${EV_1_ID}`,
      },
    ],
    statusHistory: [
      {
        historyId: 'hist-1',
        complaintId: CPL_1_ID,
        fromStatus: 'SUBMITTED',
        toStatus: 'ESCALATED',
        actor: 'system:cron',
        reason: 'Quá hạn thương lượng 48h',
        at: '2026-11-25T04:30:00Z',
      },
      {
        historyId: 'hist-2',
        complaintId: CPL_1_ID,
        fromStatus: 'ESCALATED',
        toStatus: 'UNDER_REVIEW',
        actor: `cs:${CS_USER_ID}`,
        reason: 'Nhân viên CSKH tiếp nhận phân xử khiếu nại',
        at: '2026-11-25T05:00:00Z',
      },
    ],
    relatedComplaints: [
      {
        complaintId: CPL_2_ID,
        complaintCode: 'CPL-20261125-002',
        sellerOrderId: SO_2_ID,
        shopId: SHOP_2_ID,
        type: 'WRONG_ITEM',
        status: 'ESCALATED',
        createdAt: '2026-11-25T02:05:00Z',
      },
    ],
    dossier: {
      orderServiceUnavailable: false,
      paymentServiceUnavailable: false,
      shippingServiceUnavailable: false,
      unavailableServices: [],
      sellerOrder: {
        sellerOrderId: SO_1_ID,
        sellerOrderCode: 'SO-20261125-001',
        orderId: ORDER_ID,
        orderCode: 'ORD-20261125-001',
        shopId: SHOP_1_ID,
        buyerId: BUYER_ID,
        status: 'DELIVERED',
        itemsAmount: 500_000,
        shippingFee: 30_000,
        discountAmount: 0,
        totalAmount: 530_000,
        refundStatus: 'NONE',
        hasOpenComplaint: true,
        items: [
          {
            orderItemId: 'oi-1',
            productId: 'prd-1',
            variantId: 'var-1',
            productName: 'Tai nghe Bluetooth ANC',
            variantLabel: 'Đen nhám',
            unitPrice: 500_000,
            quantity: 1,
            weightGram: 250,
          },
        ],
      },
      paymentAllocation: {
        allocationId: 'alloc-1',
        paymentId: 'pay-1',
        sellerOrderId: SO_1_ID,
        amount: 530_000,
        refundedAmount: 0,
        remainingRefundable: 530_000,
        status: 'CAPTURED',
      },
      shipment: {
        shipmentId: 'shp-1',
        sellerOrderId: SO_1_ID,
        kind: 'FORWARD',
        carrier: 'GHN',
        trackingCode: 'GHN-998877',
        status: 'DELIVERED',
        deliveredAt: '2026-11-24T10:00:00Z',
      },
    },
    ...overrides,
  }
}

type RouteHandler = (request: Request) => Response | Promise<Response>
let handlers: Array<{ method: string; path: string | RegExp; handle: RouteHandler }>
let calls: Request[]

function on(method: string, path: string | RegExp, handle: RouteHandler) {
  handlers.unshift({ method, path, handle })
}

function loginAs(roles: string[], userId = CS_USER_ID) {
  setAuthSession({
    accessToken: roles.includes('CS') ? 'access-cs' : 'access-admin',
    refreshToken: 'refresh-1',
    user: {
      userId,
      email: 'cs@soa.vn',
      fullName: 'Nhân viên CSKH',
      phone: '0900000001',
      createdAt: '2026-11-01T00:00:00Z',
      status: 'ACTIVE',
      roles,
    },
  })
}

function renderComplaintsRoute(initialPath: string) {
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
            <Route path="/admin/complaints/queue" element={<AdminComplaintsQueuePage />} />
            <Route path="/admin/complaints/:id" element={<AdminComplaintWorkspacePage />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  )
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
      if (!match) {
        throw new Error(`Unhandled ${request.method} ${pathname}`)
      }
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

describe('T4-12: CSKH SLA Queue (/admin/complaints/queue)', () => {
  it('sorts complaints ascending by remaining SLA and shows countdown pills and priorities', async () => {
    loginAs(['CS'])
    const laterDue = new Date(Date.now() + 10 * 3_600_000).toISOString()
    const overdueDue = new Date(Date.now() - 1 * 3_600_000).toISOString()
    const soonDue = new Date(Date.now() + 30 * 60_000).toISOString()

    on('GET', '/v1/cs/complaints/queue', () =>
      jsonResponse({
        items: [
          makeQueueItem({
            complaintId: 'cpl-later',
            complaintCode: 'CPL-LATER',
            priority: 3,
            slaDueAt: laterDue,
            slaRemainingSeconds: 36_000,
          }),
          makeQueueItem({
            complaintId: 'cpl-overdue',
            complaintCode: 'CPL-OVERDUE',
            priority: 1,
            slaDueAt: overdueDue,
            slaRemainingSeconds: -3600,
            slaBreached: true,
          }),
          makeQueueItem({
            complaintId: 'cpl-soon',
            complaintCode: 'CPL-SOON',
            priority: 2,
            slaDueAt: soonDue,
            slaRemainingSeconds: 1800,
          }),
        ],
        total: 3,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    )

    renderComplaintsRoute('/admin/complaints/queue')

    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    expect(rows[0]!.textContent).toContain('CPL-OVERDUE')
    expect(rows[0]!.textContent).toContain('Quá hạn')
    expect(rows[1]!.textContent).toContain('CPL-SOON')
    expect(rows[2]!.textContent).toContain('CPL-LATER')
    expect(within(rows[0]!).getByText('P1 · Khẩn cấp')).toBeTruthy()
  })

  it('filters by priority, type, overdue, and unverifiedOnly', async () => {
    const u = userEvent.setup()
    loginAs(['CS'])
    on('GET', '/v1/cs/complaints/queue', () =>
      jsonResponse({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
    )

    renderComplaintsRoute('/admin/complaints/queue')
    await screen.findByText('Chưa có khiếu nại nào')

    await u.selectOptions(screen.getByLabelText('Mức độ ưu tiên'), '1')
    await u.selectOptions(screen.getByLabelText('Loại vấn đề'), 'NOT_RECEIVED')
    await u.click(screen.getByLabelText('Chỉ quá hạn SLA'))
    await u.click(screen.getByLabelText('Chỉ chưa xác minh tự động'))

    await waitFor(() => {
      const lastCall = calls
        .filter((r) => new URL(r.url).pathname === '/v1/cs/complaints/queue')
        .at(-1)
      expect(lastCall).toBeTruthy()
      const sp = new URL(lastCall!.url).searchParams
      expect(sp.get('priority')).toBe('1')
      expect(sp.get('type')).toBe('NOT_RECEIVED')
      expect(sp.get('overdue')).toBe('true')
      expect(sp.get('unverifiedOnly')).toBe('true')
    })

    expect(await screen.findByText(/Không tìm thấy khiếu nại khớp với bộ lọc/)).toBeTruthy()
  })

  it('claims a complaint with optimistic version and navigates to the 3-column workspace', async () => {
    const u = userEvent.setup()
    loginAs(['CS'])
    on('GET', '/v1/cs/complaints/queue', () =>
      jsonResponse({
        items: [makeQueueItem({ version: 5 })],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    )

    let claimBody: unknown
    on('POST', `/v1/cs/complaints/${CPL_1_ID}/claim`, async (request) => {
      claimBody = await request.json()
      return jsonResponse(makeSummary({ status: 'UNDER_REVIEW', version: 6 }))
    })
    on('GET', `/v1/complaints/${CPL_1_ID}`, () =>
      jsonResponse(makeDetail({ complaint: makeSummary({ status: 'UNDER_REVIEW', version: 6 }) })),
    )

    renderComplaintsRoute('/admin/complaints/queue')

    const table = await screen.findByRole('table')
    await u.click(within(table).getByRole('button', { name: /Claim: CPL-20261125-001/ }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Workspace phân xử CPL-20261125-001/ })).toBeTruthy()
    })
    expect(claimBody).toEqual({ version: 5 })
    expect(screen.getByText(/Bạn đã tiếp nhận xử lý khiếu nại CPL-20261125-001/)).toBeTruthy()
  })

  it('TC-CPL-06: handles 409 conflict when two CS agents claim concurrently and reloads queue', async () => {
    const u = userEvent.setup()
    loginAs(['CS'])
    on('GET', '/v1/cs/complaints/queue', () =>
      jsonResponse({
        items: [makeQueueItem()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    )
    on('POST', `/v1/cs/complaints/${CPL_1_ID}/claim`, () =>
      apiErrorResponse(
        409,
        'COMPLAINT_ALREADY_CLAIMED',
        'Khiếu nại này đã được nhân viên CSKH khác tiếp nhận xử lý.',
      ),
    )

    renderComplaintsRoute('/admin/complaints/queue')

    const table = await screen.findByRole('table')
    const queueCallsBefore = calls.filter(
      (r) => new URL(r.url).pathname === '/v1/cs/complaints/queue',
    ).length
    await u.click(within(table).getByRole('button', { name: /Claim: CPL-20261125-001/ }))

    expect(
      await screen.findByText('Khiếu nại này đã được nhân viên CSKH khác tiếp nhận xử lý.'),
    ).toBeTruthy()
    const reloadBtn = screen.getByRole('button', { name: 'Tải lại hàng chờ' })
    expect(reloadBtn).toBeTruthy()

    await u.click(reloadBtn)
    await waitFor(() => {
      const queueCallsAfter = calls.filter(
        (r) => new URL(r.url).pathname === '/v1/cs/complaints/queue',
      ).length
      expect(queueCallsAfter).toBeGreaterThan(queueCallsBefore)
    })
  })

  it('shows ServiceFallbackBanner on queue error and retries cleanly', async () => {
    const u = userEvent.setup()
    loginAs(['CS'])
    let shouldFail = true
    on('GET', '/v1/cs/complaints/queue', () => {
      if (shouldFail) {
        return apiErrorResponse(503, 'SERVICE_UNAVAILABLE', 'SVC-CPL tạm thời gián đoạn.')
      }
      return jsonResponse({
        items: [makeQueueItem()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      })
    })

    renderComplaintsRoute('/admin/complaints/queue')

    expect(await screen.findByText('SVC-CPL tạm thời gián đoạn.')).toBeTruthy()
    shouldFail = false
    await u.click(screen.getByRole('button', { name: 'Thử tải lại khối này' }))

    expect(await screen.findByRole('table')).toBeTruthy()
  })

  it('renders read-only complaints list for ADMINISTRATOR without calling CS queue endpoint', async () => {
    loginAs(['ADMINISTRATOR'], ADMIN_USER_ID)
    on('GET', '/v1/complaints', () =>
      jsonResponse({
        items: [makeSummary({ status: 'ESCALATED', assignedCsId: undefined })],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    )

    renderComplaintsRoute('/admin/complaints/queue')

    expect(await screen.findByText(/Chỉ nhân viên CSKH mới có quyền tiếp nhận/)).toBeTruthy()
    const table = await screen.findByRole('table')
    expect(within(table).queryByRole('button', { name: /Claim/ })).toBeNull()
    expect(within(table).getByRole('link', { name: /Xem hồ sơ/ })).toBeTruthy()
    expect(calls.some((r) => new URL(r.url).pathname === '/v1/cs/complaints/queue')).toBe(false)
  })
})

describe('T4-12: 3-Column Arbitration Workspace (/admin/complaints/:id)', () => {
  it('renders 3 columns, cross-service dossier, and sibling orderId tabs', async () => {
    const u = userEvent.setup()
    loginAs(['CS'])

    on('GET', `/v1/complaints/${CPL_1_ID}`, () => jsonResponse(makeDetail()))
    on('GET', `/v1/complaints/${CPL_2_ID}`, () =>
      jsonResponse(
        makeDetail({
          complaint: makeSummary({
            complaintId: CPL_2_ID,
            complaintCode: 'CPL-20261125-002',
            sellerOrderId: SO_2_ID,
            shopId: SHOP_2_ID,
            type: 'WRONG_ITEM',
            status: 'ESCALATED',
            assignedCsId: undefined,
          }),
          availableActions: ['CLAIM', 'UPLOAD_EVIDENCE'],
          relatedComplaints: [
            {
              complaintId: CPL_1_ID,
              complaintCode: 'CPL-20261125-001',
              sellerOrderId: SO_1_ID,
              shopId: SHOP_1_ID,
              type: 'DAMAGED',
              status: 'UNDER_REVIEW',
              createdAt: '2026-11-25T02:00:00Z',
            },
          ],
        }),
      ),
    )

    renderComplaintsRoute(`/admin/complaints/${CPL_1_ID}`)

    const dossierCol = await screen.findByRole('region', { name: 'Hồ sơ tổng hợp đa dịch vụ' })
    const timelineCol = screen.getByRole('region', { name: 'Dòng thời gian & Bằng chứng' })
    const decisionCol = screen.getByRole('region', { name: 'Ra quyết định phân xử' })

    expect(dossierCol).toBeTruthy()
    expect(timelineCol).toBeTruthy()
    expect(decisionCol).toBeTruthy()

    // Column 1: Multi-service dossier & sibling tabs
    expect(within(dossierCol).getByText('Tai nghe Bluetooth ANC')).toBeTruthy()
    expect(within(dossierCol).getByText('GHN-998877')).toBeTruthy()
    expect(within(dossierCol).getByText('Hạn mức khả hoàn còn lại')).toBeTruthy()

    const siblingTab = within(dossierCol).getByRole('tab', { name: /CPL-20261125-002/ })
    await u.click(siblingTab)

    expect(
      await screen.findByRole('heading', { name: /Workspace phân xử CPL-20261125-002/ }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: /Claim · Tiếp nhận phân xử/ })).toBeTruthy()
  })

  it('TC-CPL-07: degrades gracefully with ServiceFallbackBanner when SVC-PAY is down and retries', async () => {
    const u = userEvent.setup()
    loginAs(['CS'])

    let payDown = true
    on('GET', `/v1/complaints/${CPL_1_ID}`, () => {
      const base = makeDetail()
      if (payDown) {
        return jsonResponse({
          ...base,
          dossier: {
            ...base.dossier!,
            paymentAllocation: undefined,
            paymentServiceUnavailable: true,
            unavailableServices: ['SVC-PAY'],
          },
        })
      }
      return jsonResponse(base)
    })

    renderComplaintsRoute(`/admin/complaints/${CPL_1_ID}`)

    const dossierCol = await screen.findByRole('region', { name: 'Hồ sơ tổng hợp đa dịch vụ' })
    expect(within(dossierCol).getByText('Tai nghe Bluetooth ANC')).toBeTruthy()
    expect(
      within(dossierCol).getByText(/Dịch vụ thanh toán \(SVC-PAY\) tạm thời gián đoạn/),
    ).toBeTruthy()

    payDown = false
    await u.click(within(dossierCol).getByRole('button', { name: 'Thử tải lại khối này' }))

    await waitFor(() => {
      expect(within(dossierCol).getByText('Hạn mức khả hoàn còn lại')).toBeTruthy()
    })
  })

  it('displays timeline, SHA-256 hash, and downloads evidence using Bearer auth', async () => {
    const u = userEvent.setup()
    loginAs(['CS'])
    on('GET', `/v1/complaints/${CPL_1_ID}`, () => jsonResponse(makeDetail()))
    on('GET', `/v1/complaints/${CPL_1_ID}/evidence/${EV_1_ID}`, () =>
      new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      }),
    )

    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-evidence')
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    expect(createSpy).toBeDefined()
    expect(revokeSpy).toBeDefined()

    renderComplaintsRoute(`/admin/complaints/${CPL_1_ID}`)

    const timelineCol = await screen.findByRole('region', { name: 'Dòng thời gian & Bằng chứng' })
    expect(within(timelineCol).getByText('Quá hạn thương lượng 48h', { exact: false })).toBeTruthy()
    expect(
      within(timelineCol).getByText('Nhờ CSKH hỗ trợ xem xét ảnh kiện hàng móp méo.'),
    ).toBeTruthy()
    expect(within(timelineCol).getByText(SHA256_HASH)).toBeTruthy()

    await u.click(within(timelineCol).getByRole('button', { name: 'Xem' }))

    await waitFor(() => {
      expect(within(timelineCol).getByRole('img')).toBeTruthy()
    })
    const evCall = calls.find((r) => new URL(r.url).pathname.endsWith(`/evidence/${EV_1_ID}`))
    expect(evCall?.headers.get('Authorization')).toBe('Bearer access-cs')
  })

  it('blocks decision submission when reason is empty or whitespace-only and enforces BR-CPL-06 ceiling', async () => {
    const u = userEvent.setup()
    loginAs(['CS'])
    on('GET', `/v1/complaints/${CPL_1_ID}`, () => jsonResponse(makeDetail()))

    renderComplaintsRoute(`/admin/complaints/${CPL_1_ID}`)

    const decisionCol = await screen.findByRole('region', { name: 'Ra quyết định phân xử' })
    const submitBtn = within(decisionCol).getByRole('button', { name: 'Xác nhận quyết định' })
    const reasonBox = within(decisionCol).getByLabelText(/Lý do quyết định/)

    // Empty reason -> submit disabled
    expect(submitBtn.hasAttribute('disabled')).toBe(true)

    // Whitespace-only reason -> still disabled & no API call
    await u.type(reasonBox, '     ')
    expect(submitBtn.hasAttribute('disabled')).toBe(true)
    expect(
      within(decisionCol).getByText('Bắt buộc nhập lý do quyết định phân xử.'),
    ).toBeTruthy()

    // Exceeds remainingRefundable (530,000) -> validation error & submit disabled
    await u.clear(reasonBox)
    await u.type(reasonBox, 'Bằng chứng rõ ràng, chấp nhận hoàn một phần.')
    const refundInput = within(decisionCol).getByLabelText(/Số tiền hoàn/)
    await u.clear(refundInput)
    await u.type(refundInput, '600000')

    expect(
      await within(decisionCol).findByText(/Số tiền hoàn vượt quá hạn mức khả hoàn còn lại/),
    ).toBeTruthy()
    expect(submitBtn.hasAttribute('disabled')).toBe(true)
    expect(calls.filter((r) => r.method === 'POST')).toHaveLength(0)
  })

  it('submits CS decision with mandatory reason and locks finalized view', async () => {
    const u = userEvent.setup()
    loginAs(['CS'])
    const finalizedResolution = {
      resolutionId: 'res-1',
      complaintId: CPL_1_ID,
      outcome: 'PARTIAL_REFUND',
      refundAmount: 150_000,
      responsibleParty: 'SELLER',
      reason: 'Hộp móp nhưng sản phẩm hoạt động bình thường, hỗ trợ hoàn 150.000đ.',
      decidedBy: CS_USER_ID,
      decidedAt: '2026-11-25T07:00:00Z',
    }
    let decided = false
    on('GET', `/v1/complaints/${CPL_1_ID}`, () =>
      jsonResponse(
        decided
          ? makeDetail({
              complaint: makeSummary({ status: 'EXECUTING', version: 5 }),
              resolution: finalizedResolution,
              availableActions: [],
            })
          : makeDetail(),
      ),
    )

    let decisionBody: unknown
    on('POST', `/v1/cs/complaints/${CPL_1_ID}/decision`, async (request) => {
      decisionBody = await request.json()
      decided = true
      return jsonResponse({
        complaint: makeSummary({ status: 'EXECUTING', version: 5 }),
        resolution: finalizedResolution,
        refundDispatched: true,
      })
    })

    renderComplaintsRoute(`/admin/complaints/${CPL_1_ID}`)

    const decisionCol = await screen.findByRole('region', { name: 'Ra quyết định phân xử' })
    const reasonBox = within(decisionCol).getByLabelText(/Lý do quyết định/)
    await u.type(reasonBox, '  Hộp móp nhưng sản phẩm hoạt động bình thường, hỗ trợ hoàn 150.000đ.  ')

    const submitBtn = within(decisionCol).getByRole('button', { name: 'Xác nhận quyết định' })
    await waitFor(() => expect(submitBtn.hasAttribute('disabled')).toBe(false))
    await u.click(submitBtn)

    expect(await screen.findByText(/Đã ghi nhận quyết định phân xử cho khiếu nại CPL-20261125-001/)).toBeTruthy()
    expect(decisionBody).toEqual({
      outcome: 'PARTIAL_REFUND',
      responsibleParty: 'SELLER',
      refundAmount: 150_000,
      reason: 'Hộp móp nhưng sản phẩm hoạt động bình thường, hỗ trợ hoàn 150.000đ.',
      version: 4,
    })
    expect(within(decisionCol).getByText('Quyết định phân xử chung thẩm')).toBeTruthy()
  })

  it('surfaces 409 version conflict on decision submission with reload button', async () => {
    const u = userEvent.setup()
    loginAs(['CS'])
    on('GET', `/v1/complaints/${CPL_1_ID}`, () => jsonResponse(makeDetail()))
    on('POST', `/v1/cs/complaints/${CPL_1_ID}/decision`, () =>
      apiErrorResponse(409, 'VERSION_CONFLICT', 'Khiếu nại vừa được cập nhật đồng thời, vui lòng tải lại.'),
    )

    renderComplaintsRoute(`/admin/complaints/${CPL_1_ID}`)

    const decisionCol = await screen.findByRole('region', { name: 'Ra quyết định phân xử' })
    await u.type(within(decisionCol).getByLabelText(/Lý do quyết định/), 'Xử lý theo quy định.')
    const submitBtn = within(decisionCol).getByRole('button', { name: 'Xác nhận quyết định' })
    await waitFor(() => expect(submitBtn.hasAttribute('disabled')).toBe(false))
    await u.click(submitBtn)

    expect(
      await within(decisionCol).findByText('Khiếu nại vừa được cập nhật đồng thời, vui lòng tải lại.'),
    ).toBeTruthy()
    expect(within(decisionCol).getByText('corr-cpl-1')).toBeTruthy()
    expect(within(decisionCol).getByRole('button', { name: 'Tải lại hồ sơ mới nhất' })).toBeTruthy()
  })
})
