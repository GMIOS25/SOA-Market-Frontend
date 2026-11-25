// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/lib/i18n'
import { ApiError } from '@/api/errors'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { Role } from '@/lib/auth/roles'
import { clearAuthSession, setAuthSession } from '@/lib/auth/session'
import {
  listAdminFailedShipments,
  listAdminPayables,
  listAdminRefunds,
  listAdminReviewPayments,
  markRefundManualSuccess,
  type AdminRefund,
} from './admin-exceptions-api'
import { AdminExceptionsPage } from './AdminExceptionsPage'

vi.mock('./admin-exceptions-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./admin-exceptions-api')>()
  return {
    ...actual,
    listAdminRefunds: vi.fn(),
    markRefundManualSuccess: vi.fn(),
    listAdminPayables: vi.fn(),
    listAdminReviewPayments: vi.fn(),
    listAdminFailedShipments: vi.fn(),
  }
})

const REFUND_ID = 'aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaa01'
const ORDER_ID = '11111111-1111-7111-8111-111111111113'
const SO_ID = '22222222-2222-7222-8222-222222222225'
const SHOP_ID = '33333333-3333-7333-8333-333333333331'

function sampleRefund(overrides: Partial<AdminRefund> = {}): AdminRefund {
  return {
    refundId: REFUND_ID,
    allocationId: '77777777-7777-7777-8777-777777777705',
    orderId: ORDER_ID,
    sellerOrderId: SO_ID,
    complaintId: null,
    amount: 615_000,
    source: 'DELIVERY_FAILED',
    status: 'FAILED',
    idempotencyKey: 'idem-ref-1',
    attempts: 3,
    nextRetryAt: null,
    gatewayRefundRef: null,
    manualBankRef: null,
    manualConfirmedBy: null,
    manualReason: null,
    needsReconciliation: false,
    lastErrorCode: 'GATEWAY_TIMEOUT',
    lastErrorMessage: 'Gateway refund timeout after 3 retries',
    createdAt: '2026-11-24T10:00:00Z',
    updatedAt: '2026-11-24T11:00:00Z',
    ...overrides,
  }
}

function setupDefaultMocks() {
  vi.mocked(listAdminRefunds).mockImplementation(async (query) => {
    if (query?.needsReconciliation === 'true') {
      return {
        data: [
          sampleRefund({
            refundId: 'aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaa02',
            status: 'PROCESSING',
            needsReconciliation: true,
            lastErrorMessage: 'Gateway response uncertain',
          }),
        ],
        pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      }
    }
    return {
      data: [sampleRefund()],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    }
  })

  vi.mocked(listAdminReviewPayments).mockResolvedValue({
    data: [
      {
        paymentId: '66666666-6666-7666-8666-666666666699',
        orderId: ORDER_ID,
        gateway: 'VNPAY',
        gatewayRef: 'VNP-MISMATCH-01',
        status: 'PENDING',
        amount: 990_000,
        paymentUrl: null,
        expiresAt: '2026-11-25T10:00:00Z',
        completedAt: null,
        needsManualReview: true,
        createdAt: '2026-11-24T09:00:00Z',
      },
    ],
    pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
  })

  vi.mocked(listAdminFailedShipments).mockResolvedValue({
    shipments: [
      {
        shipmentId: '88888888-8888-7888-8888-888888888883',
        sellerOrderId: SO_ID,
        shopId: SHOP_ID,
        buyerId: '01a20e22-4887-7e44-95a8-f2e30decc0c6',
        kind: 'FORWARD',
        carrier: 'GHN',
        trackingCode: null,
        status: 'CREATE_FAILED',
        feeVnd: 30_000,
        feeKnown: true,
        etaAt: null,
        createAttempts: 4,
        failureReason: 'CARRIER_CREATE_UNAVAILABLE: timeout',
        cancelNeedsReconciliation: false,
        cancelReason: undefined,
        createdAt: '2026-11-24T08:00:00Z',
        updatedAt: '2026-11-24T09:00:00Z',
      },
    ],
    pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
  })

  vi.mocked(listAdminPayables).mockResolvedValue({
    data: [
      {
        entryId: 'eeeeeeee-eeee-7eee-8eee-eeeeeeeeee01',
        sellerOrderId: SO_ID,
        shopId: SHOP_ID,
        grossAmount: 1_000_000,
        itemsAmount: 1_000_000,
        platformFeeRate: 0.05,
        platformFee: 50_000,
        refundedAmount: 0,
        netAmount: 950_000,
        status: 'ELIGIBLE',
        orderCompleted: true,
        openComplaintsCount: 0,
        lastEventVersion: 2,
        eligibleAt: '2026-11-24T12:00:00Z',
        updatedAt: '2026-11-24T12:00:00Z',
      },
    ],
    pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    summary: {
      totalGrossAmount: 1_000_000,
      totalPlatformFee: 50_000,
      totalRefundedAmount: 0,
      totalNetPayable: 950_000,
      eligibleNetPayable: 950_000,
      onHoldNetAmount: 0,
      shopTotals: [
        {
          shopId: SHOP_ID,
          entriesCount: 1,
          totalGrossAmount: 1_000_000,
          totalPlatformFee: 50_000,
          totalRefundedAmount: 0,
          totalNetPayable: 950_000,
          eligibleNetPayable: 950_000,
          onHoldNetAmount: 0,
        },
      ],
    },
  })
}

function mountPage(initialEntry = '/admin/exceptions', roles: Role[] = ['ADMINISTRATOR']) {
  setAuthSession({
    accessToken: 'test-token',
    refreshToken: 'test-refresh',
    user: { userId: 'test-user', email: 'test@soa.vn', fullName: 'Test', phone: '', createdAt: '', status: 'ACTIVE', roles },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <TooltipProvider>
          <AdminExceptionsPage />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  clearAuthSession()
  vi.resetAllMocks()
})

describe('T5-09: AdminExceptionsPage (/admin/exceptions)', () => {
  it('keeps CS in the exceptions view even via a payables deep link', async () => {
    setupDefaultMocks()
    mountPage('/admin/exceptions?tab=payables', ['CS'])

    expect(await screen.findByText('Gateway refund timeout after 3 retries')).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Khoản phải trả nhà bán' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Xác nhận hoàn tiền thủ công' })).toBeNull()
    expect(listAdminPayables).not.toHaveBeenCalled()
  })

  it('labels the unavailable stuck-order source without showing an empty result', () => {
    setupDefaultMocks()
    mountPage('/admin/exceptions?category=stuckOrders', ['CS'])

    expect(screen.getByText(/Danh sách đơn kẹt trạng thái đang chờ nguồn dữ liệu/)).toBeTruthy()
    expect(screen.queryByText('Không có ngoại lệ nào cần xử lý')).toBeNull()
  })

  it('supports arrow-key navigation to the payables panel for an admin', async () => {
    setupDefaultMocks()
    mountPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Ngoại lệ cần xử lý' }))
    await user.keyboard('{ArrowRight}')

    const payables = await screen.findByRole('tab', { name: 'Khoản phải trả nhà bán', selected: true })
    expect(document.activeElement).toBe(payables)
    expect(screen.getByRole('tabpanel', { name: 'Khoản phải trả nhà bán' }).id).toBe(payables.getAttribute('aria-controls'))
    expect(await screen.findByText('Tổng hợp khoản phải trả theo từng gian hàng')).toBeTruthy()
  })

  it('renders failed refunds and confirms manual refund success with bank ref and audit reason', async () => {
    setupDefaultMocks()
    vi.mocked(markRefundManualSuccess).mockResolvedValue(
      sampleRefund({
        status: 'SUCCEEDED',
        manualBankRef: 'FT26112500091827',
        manualReason: 'Đã chuyển khoản hoàn tiền thủ công qua Vietcombank.',
      }),
    )

    mountPage()

    expect(await screen.findByText('Gateway refund timeout after 3 retries')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hoàn tiền thủ công' }))

    const submitBtn = screen.getByRole('button', { name: 'Xác nhận đã hoàn tiền' })
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true)

    const bankRef = screen.getByLabelText(/Mã giao dịch ngân hàng/)
    fireEvent.change(bankRef, { target: { value: ' AB ' } })
    fireEvent.change(screen.getByRole('textbox', { name: /Lý do/ }), {
      target: { value: 'Đã chuyển khoản hoàn tiền thủ công qua Vietcombank.' },
    })
    expect(screen.getByText(/phải có từ 3 đến 128 ký tự/)).toBeTruthy()
    fireEvent.submit(submitBtn.closest('form')!)
    expect(markRefundManualSuccess).not.toHaveBeenCalled()
    fireEvent.change(bankRef, { target: { value: ' FT26112500091827 ' } })
    await waitFor(() => expect((submitBtn as HTMLButtonElement).disabled).toBe(false))

    fireEvent.click(submitBtn)

    await waitFor(() =>
      expect(markRefundManualSuccess).toHaveBeenCalledWith(REFUND_ID, {
        bankTransactionRef: 'FT26112500091827',
        reason: 'Đã chuyển khoản hoàn tiền thủ công qua Vietcombank.',
      }),
    )
    expect(await screen.findByText(/FT26112500091827/)).toBeTruthy()
  })

  it('requires confirmReconciled checkbox for reconciliation refunds and displays API error with correlationId', async () => {
    setupDefaultMocks()
    vi.mocked(markRefundManualSuccess).mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'CONFLICT',
        message: 'Hoàn tiền đã được xử lý trước đó.',
        correlationId: 'corr-manual-409',
      }),
    )

    mountPage('/admin/exceptions?category=refundReconciliation')

    expect(await screen.findByText('Gateway response uncertain')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hoàn tiền thủ công' }))

    fireEvent.change(screen.getByLabelText(/Mã giao dịch ngân hàng/), { target: { value: 'FT-RECON-01' } })
    fireEvent.change(screen.getByRole('textbox', { name: /Lý do/ }), {
      target: { value: 'Đã kiểm tra sao kê ngân hàng xác nhận chưa hoàn.' },
    })

    const submitBtn = screen.getByRole('button', { name: 'Xác nhận đã hoàn tiền' })
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => expect((submitBtn as HTMLButtonElement).disabled).toBe(false))

    fireEvent.click(submitBtn)

    expect(await screen.findByText('Hoàn tiền đã được xử lý trước đó.')).toBeTruthy()
    expect(screen.getByText('corr-manual-409')).toBeTruthy()
    expect(markRefundManualSuccess).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaa02',
      expect.objectContaining({ confirmReconciled: true }),
    )
  })

  it('refetches after confirmation and lets the admin recover from an empty last page', async () => {
    setupDefaultMocks()
    let confirmed = false
    vi.mocked(listAdminRefunds).mockImplementation(async (query) => {
      const page = query?.page ?? 1
      const totalPages = confirmed ? 1 : 2
      return {
        data: page === 1
          ? [sampleRefund({ refundId: ORDER_ID, lastErrorMessage: 'Refund on page one' })]
          : confirmed ? [] : [sampleRefund()],
        pagination: { page, pageSize: 10, totalItems: confirmed ? 10 : 11, totalPages },
      }
    })
    vi.mocked(markRefundManualSuccess).mockImplementation(async () => {
      confirmed = true
      return sampleRefund({ status: 'SUCCEEDED', manualBankRef: 'FT-LAST-PAGE' })
    })

    mountPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Trang sau' }))
    expect(await screen.findByText('Gateway refund timeout after 3 retries')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hoàn tiền thủ công' }))
    fireEvent.change(screen.getByLabelText(/Mã giao dịch ngân hàng/), { target: { value: 'FT-LAST-PAGE' } })
    fireEvent.change(screen.getByRole('textbox', { name: /Lý do/ }), {
      target: { value: 'Đã kiểm tra sao kê và chuyển tiền.' },
    })
    const submit = screen.getByRole('button', { name: 'Xác nhận đã hoàn tiền' })
    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(submit)

    fireEvent.click(await screen.findByRole('button', { name: 'Về trang còn dữ liệu' }))
    expect(await screen.findByText('Refund on page one')).toBeTruthy()
    expect(screen.queryByText('Gateway refund timeout after 3 retries')).toBeNull()
  })

  it('switches across payment review and failed shipment tabs and degrades gracefully when SVC-SHP fails', async () => {
    setupDefaultMocks()
    vi.mocked(listAdminFailedShipments).mockRejectedValue(
      new ApiError({ status: 503, code: 'SERVICE_UNAVAILABLE', message: 'SVC-SHP down' }),
    )

    mountPage()

    fireEvent.click(await screen.findByRole('button', { name: /Thanh toán cần kiểm tra/ }))
    expect(await screen.findByText('VNP-MISMATCH-01')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Vận đơn tạo thất bại/ }))
    expect(await screen.findByText(/Dịch vụ vận chuyển \(SVC-SHP\) đang gián đoạn/)).toBeTruthy()
  })

  it('displays seller payables KPIs, shop summaries, and filters by shop and status', async () => {
    setupDefaultMocks()

    mountPage('/admin/exceptions?tab=payables')

    expect(await screen.findByText('Tổng hợp khoản phải trả theo từng gian hàng')).toBeTruthy()
    expect(screen.getAllByText('950.000 ₫').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Tạm giữ khiếu nại' }))
    await waitFor(() =>
      expect(listAdminPayables).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ON_HOLD', page: 1, pageSize: 10 }),
      ),
    )

    fireEvent.click(await screen.findByTitle('Lọc bút toán của gian hàng này'))
    await waitFor(() =>
      expect(listAdminPayables).toHaveBeenCalledWith(
        expect.objectContaining({ shopId: SHOP_ID, status: 'ON_HOLD', page: 1, pageSize: 10 }),
      ),
    )
  })
})
