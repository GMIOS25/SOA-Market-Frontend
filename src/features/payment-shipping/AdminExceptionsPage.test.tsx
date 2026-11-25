// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/lib/i18n'
import { ApiError } from '@/api/errors'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { Role } from '@/lib/auth/roles'
import { clearAuthSession, setAuthSession } from '@/lib/auth/session'
import {
  listAdminPayables,
  listAdminPayments,
  listAdminRefunds,
  listFailedShipments,
  listRptExceptions,
  markRefundManualSuccess,
  retryShipment,
  type PayablesSummary,
  type Refund,
  type SellerLedgerEntry,
  type Shipment,
} from './api'
import { AdminExceptionsPage } from './AdminExceptionsPage'

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return {
    ...actual,
    listAdminRefunds: vi.fn(),
    markRefundManualSuccess: vi.fn(),
    listAdminPayables: vi.fn(),
    listAdminPayments: vi.fn(),
    listFailedShipments: vi.fn(),
    retryShipment: vi.fn(),
    listRptExceptions: vi.fn(),
  }
})

const orderId = '11111111-1111-4111-8111-111111111111'
const sellerOrderId = '22222222-2222-4222-8222-222222222222'
const shopId = '33333333-3333-4333-8333-333333333333'
const failedRefundId = '44444444-4444-4444-8444-444444444444'
const reconcileRefundId = '55555555-5555-4555-8555-555555555555'
const shipmentId = '66666666-6666-4666-8666-666666666666'
const paymentId = '77777777-7777-4777-8777-777777777777'

function loginAs(roles: Role[]) {
  setAuthSession({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    user: {
      userId: '01a20e22-4887-7e44-95a8-f2e30decc0c6',
      email: 'ops@soa-market.local',
      fullName: 'Ops User',
      phone: '0901234567',
      roles,
      status: 'ACTIVE',
      createdAt: '2026-11-24T00:00:00Z',
    },
  })
}

function makeRefund(overrides: Partial<Refund> = {}): Refund {
  return {
    refundId: failedRefundId,
    allocationId: '88888888-8888-4888-8888-888888888888',
    sellerOrderId,
    orderId,
    complaintId: null,
    amount: 250_000,
    source: 'CANCELLATION',
    status: 'FAILED',
    needsReconciliation: false,
    idempotencyKey: 'refund:test:1',
    attempts: 4,
    nextRetryAt: null,
    gatewayRefundRef: null,
    manualBankRef: null,
    manualConfirmedBy: null,
    manualReason: null,
    lastErrorCode: 'GATEWAY_TIMEOUT',
    lastErrorMessage: 'VNPay refund API timed out after 4 retries',
    createdAt: '2026-11-25T08:00:00Z',
    updatedAt: '2026-11-25T09:00:00Z',
    ...overrides,
  }
}

function makePayables() {
  const summary: PayablesSummary = {
    totalGrossAmount: 1_000_000,
    totalRefundedAmount: 100_000,
    totalPlatformFee: 45_000,
    totalNetPayable: 855_000,
    eligibleNetPayable: 555_000,
    onHoldNetAmount: 300_000,
    shopTotals: [
      {
        shopId,
        entriesCount: 2,
        totalGrossAmount: 1_000_000,
        totalRefundedAmount: 100_000,
        totalPlatformFee: 45_000,
        totalNetPayable: 855_000,
        eligibleNetPayable: 555_000,
        onHoldNetAmount: 300_000,
      },
    ],
  }
  const entries: SellerLedgerEntry[] = [
    {
      entryId: '99999999-9999-4999-8999-999999999999',
      sellerOrderId,
      shopId,
      grossAmount: 400_000,
      itemsAmount: 370_000,
      refundedAmount: 0,
      platformFeeRate: 0.05,
      platformFee: 18_500,
      netAmount: 381_500,
      status: 'ON_HOLD',
      orderCompleted: false,
      openComplaintsCount: 1,
      lastEventVersion: 2,
      eligibleAt: null,
      updatedAt: '2026-11-25T10:00:00Z',
    },
  ]
  return {
    summary,
    data: entries,
    pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
  }
}

function makeFailedShipment(): Shipment {
  return {
    shipmentId,
    sellerOrderId,
    shopId,
    buyerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    kind: 'FORWARD',
    carrier: 'MOCK_SHIP',
    trackingCode: null,
    status: 'CREATE_FAILED',
    feeKnown: true,
    feeVnd: 30_000,
    etaAt: null,
    createAttempts: 4,
    failureReason: 'CARRIER_CREATE_UNAVAILABLE: timeout',
    cancelNeedsReconciliation: false,
    createdAt: '2026-11-25T08:30:00Z',
    updatedAt: '2026-11-25T09:15:00Z',
  }
}

function setupDefaultMocks() {
  const failed = makeRefund()
  vi.mocked(listAdminRefunds).mockImplementation(async (query) => {
    if (query.needsReconciliation === 'true') {
      return {
        data: [
          makeRefund({
            refundId: reconcileRefundId,
            status: 'PROCESSING',
            needsReconciliation: true,
            lastErrorCode: 'WORKER_INTERRUPTED',
            lastErrorMessage: 'worker stopped before recording gateway refund response',
          }),
        ],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      }
    }
    if (query.source === 'LATE_PAYMENT') {
      return {
        data: [makeRefund({ refundId: 'abababab-abab-4bab-8bab-abababababab', source: 'LATE_PAYMENT', status: 'SUCCEEDED' })],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      }
    }
    if (query.status === 'SUCCEEDED') {
      return {
        data: [makeRefund({ status: 'SUCCEEDED', manualBankRef: 'VCB-REF-999' })],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      }
    }
    return {
      data: [failed],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    }
  })

  vi.mocked(listFailedShipments).mockResolvedValue({
    shipments: [makeFailedShipment()],
    pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
  })

  vi.mocked(listAdminPayments).mockResolvedValue({
    data: [
      {
        paymentId,
        orderId,
        gateway: 'VNPAY',
        gatewayRef: 'VNP-8899',
        status: 'SUCCEEDED',
        amount: 500_000,
        paymentUrl: null,
        expiresAt: '2026-11-25T08:15:00Z',
        completedAt: '2026-11-25T08:05:00Z',
        needsManualReview: true,
        createdAt: '2026-11-25T08:00:00Z',
      },
    ],
    pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
  })

  vi.mocked(listRptExceptions).mockRejectedValue(
    new ApiError({ status: 503, code: 'SERVICE_UNAVAILABLE', message: 'SVC-RPT unavailable' }),
  )

  vi.mocked(listAdminPayables).mockResolvedValue(makePayables())
}

function mountPage(roles: Role[] = ['ADMINISTRATOR']) {
  loginAs(roles)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TooltipProvider>
          <AdminExceptionsPage />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return queryClient
}

afterEach(() => {
  cleanup()
  clearAuthSession()
  vi.resetAllMocks()
})

describe('AdminExceptionsPage (T5-09)', () => {
  it('renders 4 exception groups and confirms manual refund with bankTransactionRef + audit reason', async () => {
    setupDefaultMocks()
    vi.mocked(markRefundManualSuccess).mockResolvedValue(
      makeRefund({
        status: 'SUCCEEDED',
        manualBankRef: 'VCB-20261125-001',
        manualReason: 'Đã chuyển khoản hoàn tiền thủ công cho người mua',
      }),
    )

    mountPage(['ADMINISTRATOR'])

    // Verify all 4 exception group tabs are present.
    expect(screen.getByRole('tab', { name: /Hoàn tiền thất bại \/ đối soát/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Tạo vận đơn lỗi/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Thanh toán muộn \/ lệch tiền/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Đơn kẹt & đối soát sàn/ })).toBeTruthy()

    const [confirmBtn] = await screen.findAllByRole('button', { name: 'Xác nhận hoàn tiền thủ công' })
    fireEvent.click(confirmBtn!)

    const submitBtn = await screen.findByRole('button', { name: 'Xác nhận hoàn tiền thành công' })
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(/Mã tham chiếu giao dịch ngân hàng/), {
      target: { value: 'VCB-20261125-001' },
    })
    fireEvent.change(screen.getByLabelText(/Lý do/), {
      target: { value: 'Đã chuyển khoản hoàn tiền thủ công cho người mua' },
    })

    await waitFor(() => expect((submitBtn as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(submitBtn)

    await waitFor(() =>
      expect(markRefundManualSuccess).toHaveBeenCalledWith(failedRefundId, {
        bankTransactionRef: 'VCB-20261125-001',
        reason: 'Đã chuyển khoản hoàn tiền thủ công cho người mua',
      }),
    )

    expect(await screen.findByText('Đã xác nhận hoàn tiền thủ công thành công')).toBeTruthy()
    expect(screen.getByText(/VCB-20261125-001/)).toBeTruthy()
  })

  it('requires confirmReconciled acknowledgement for PROCESSING refunds needing reconciliation', async () => {
    setupDefaultMocks()
    vi.mocked(markRefundManualSuccess).mockResolvedValue(
      makeRefund({
        refundId: reconcileRefundId,
        status: 'SUCCEEDED',
        needsReconciliation: false,
        manualBankRef: 'VNP-RECONCILED-77',
      }),
    )

    mountPage(['ADMINISTRATOR'])

    fireEvent.click(screen.getByRole('button', { name: 'Cần đối soát' }))
    const [openModalBtn] = await screen.findAllByRole('button', { name: 'Xác nhận hoàn tiền thủ công' })
    fireEvent.click(openModalBtn!)

    expect(await screen.findByText(/chưa xác định kết quả từ cổng thanh toán/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText(/Mã tham chiếu giao dịch ngân hàng/), {
      target: { value: 'VNP-RECONCILED-77' },
    })
    fireEvent.change(screen.getByLabelText(/Lý do/), {
      target: { value: 'Đã đối soát sao kê cổng VNPay và chuyển khoản thủ công' },
    })

    const submitBtn = screen.getByRole('button', { name: 'Xác nhận hoàn tiền thành công' })
    // Must stay disabled until confirmReconciled checkbox is checked.
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByLabelText(/Tôi đã đối soát trực tiếp/))
    await waitFor(() => expect((submitBtn as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(submitBtn)

    await waitFor(() =>
      expect(markRefundManualSuccess).toHaveBeenCalledWith(reconcileRefundId, {
        bankTransactionRef: 'VNP-RECONCILED-77',
        reason: 'Đã đối soát sao kê cổng VNPay và chuyển khoản thủ công',
        confirmReconciled: true,
      }),
    )
  })

  it('supports retrying CREATE_FAILED shipments, viewing late/mismatch payments, and graceful SVC-RPT fallback', async () => {
    setupDefaultMocks()
    vi.mocked(retryShipment).mockResolvedValue({ ...makeFailedShipment(), status: 'CREATED' })

    mountPage(['ADMINISTRATOR'])

    // Group 2: Shipments CREATE_FAILED + Retry
    fireEvent.click(screen.getByRole('tab', { name: /Tạo vận đơn lỗi/ }))
    const retryBtn = await screen.findByRole('button', { name: 'Thử tạo lại vận đơn' })
    expect(screen.getByText(/Đơn vị vận chuyển tạm thời không phản hồi/)).toBeTruthy()
    fireEvent.click(retryBtn)

    await waitFor(() => expect(retryShipment).toHaveBeenCalledWith(shipmentId))
    expect(await screen.findByText(/Đã gửi yêu cầu tạo lại vận đơn/)).toBeTruthy()

    // Group 3: Late payment & amount mismatch
    fireEvent.click(screen.getByRole('tab', { name: /Thanh toán muộn \/ lệch tiền/ }))
    expect(await screen.findByText('VNP-8899')).toBeTruthy()
    expect(screen.getByText('Cần kiểm tra thủ công')).toBeTruthy()

    // Group 4: SVC-RPT offline shows ServiceFallbackBanner instead of crashing
    fireEvent.click(screen.getByRole('tab', { name: /Đơn kẹt & đối soát sàn/ }))
    expect(await screen.findByText(/Dịch vụ tổng hợp đối soát SVC-RPT chưa khả dụng/)).toBeTruthy()
  })

  it('displays Payables tab summary, shop totals filter, and ledger entries (FR-PAY-006)', async () => {
    setupDefaultMocks()
    mountPage(['ADMINISTRATOR'])

    fireEvent.click(screen.getByRole('tab', { name: 'Khoản phải trả nhà bán' }))

    expect(await screen.findByText('Tổng hợp khoản phải trả theo gian hàng')).toBeTruthy()
    expect((await screen.findAllByText(/555\.000/)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/1 khiếu nại mở/).length).toBeGreaterThan(0)

    const [filterShopBtn] = screen.getAllByRole('button', { name: 'Xem chi tiết sổ cái' })
    fireEvent.click(filterShopBtn!)
    await waitFor(() =>
      expect(listAdminPayables).toHaveBeenLastCalledWith(
        expect.objectContaining({ shopId, page: 1, pageSize: 20 }),
        expect.any(AbortSignal),
      ),
    )
  })

  it('hides admin-only Payables tab and manual refund mutation controls for CS role', async () => {
    setupDefaultMocks()
    mountPage(['CS'])

    expect(await screen.findByText(/Vai trò CSKH chỉ xem danh sách ngoại lệ/)).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Khoản phải trả nhà bán' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Xác nhận hoàn tiền thủ công' })).toBeNull()
    expect(listAdminPayables).not.toHaveBeenCalled()
  })
})
