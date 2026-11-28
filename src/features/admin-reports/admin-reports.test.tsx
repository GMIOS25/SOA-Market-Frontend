// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/lib/i18n'
import { ApiError } from '@/api/errors'
import { TooltipProvider } from '@/components/ui/tooltip'
import { clearAuthSession, setAuthSession } from '@/lib/auth/session'
import {
  getAdminOverviewReport,
  getSellerPerformance,
  getSystemHealth,
  listAdminOrders,
  listAdminSellersReport,
  listAdminTransactions,
  listAuditLogs,
  listBusinessParams,
  listDLQ,
  replayDLQ,
  updateBusinessParam,
} from './api'
import { AdminAuditLogsPage } from './AdminAuditLogsPage'
import { AdminDashboardPage } from './AdminDashboardPage'
import { AdminOrdersPage } from './AdminOrdersPage'
import { AdminParamsPage } from './AdminParamsPage'
import { AdminSystemPage } from './AdminSystemPage'
import { AdminTransactionsPage } from './AdminTransactionsPage'
import { SellerDashboardPage } from './SellerDashboardPage'

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return {
    ...actual,
    listAdminOrders: vi.fn(),
    listAdminTransactions: vi.fn(),
    listBusinessParams: vi.fn(),
    updateBusinessParam: vi.fn(),
    listAuditLogs: vi.fn(),
    getSystemHealth: vi.fn(),
    listDLQ: vi.fn(),
    replayDLQ: vi.fn(),
    getAdminOverviewReport: vi.fn(),
    listAdminSellersReport: vi.fn(),
    getSellerPerformance: vi.fn(),
  }
})

function mountUi(element: ReactElement) {
  setAuthSession({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    user: {
      userId: '11111111-1111-4111-8111-111111111111',
      email: 'admin@soa.vn',
      fullName: 'Admin',
      phone: '0900000000',
      roles: ['ADMINISTRATOR', 'SELLER'],
      status: 'ACTIVE',
      createdAt: '2026-11-24T00:00:00Z',
    },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TooltipProvider>{element}</TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  clearAuthSession()
  vi.resetAllMocks()
})

describe('admin-reports feature pages (T1-11)', () => {
  it('AdminDashboardPage displays KPIs, filters anomalous sellers, and falls back on 503', async () => {
    vi.mocked(getAdminOverviewReport).mockResolvedValue({
      from: '2026-10-30',
      to: '2026-11-28',
      syncedAt: '2026-11-28T03:00:00Z',
      summary: {
        ordersCount: 120,
        gmvTotal: 45_500_000,
        cancelledCount: 6,
        cancelRate: 0.05,
        refundTotal: 1_200_000,
        newUsersCount: 30,
        newSellersCount: 4,
        openExceptionsCount: 2,
      },
      daily: [
        { date: '2026-11-27', ordersCount: 50, gmvTotal: 20_000_000, cancelledCount: 2, refundTotal: 500_000 },
        { date: '2026-11-28', ordersCount: 70, gmvTotal: 25_500_000, cancelledCount: 4, refundTotal: 700_000 },
      ],
    })
    vi.mocked(listAdminSellersReport).mockResolvedValue({
      data: [
        {
          shopId: '22222222-2222-4222-8222-222222222222',
          shopName: 'Shop Cảnh Báo',
          shopStatus: 'ACTIVE',
          totalOrders: 10,
          sellerTimeoutCount: 3,
          sellerRejectedCount: 0,
          deliveredCount: 7,
          deliveryFailedCount: 0,
          complaintsCount: 2,
          complaintsNoResponseCount: 2,
          ratingAvg: 2.8,
          cancelRate: 0.3,
          timeoutRate: 0.3,
          deliveryFailedRate: 0,
          complaintRate: 0.2,
          isAnomalous: true,
          anomalyReasons: ['Tỷ lệ hủy/từ chối từ phía nhà bán >= 20%'],
          updatedAt: '2026-11-28T03:00:00Z',
        },
      ],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      syncedAt: '2026-11-28T03:00:00Z',
    })

    mountUi(<AdminDashboardPage />)

    expect((await screen.findAllByText(/45\.500\.000/)).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('Shop Cảnh Báo')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText(/Tỷ lệ hủy\/từ chối từ phía nhà bán/)).length).toBeGreaterThan(0)

    const toggle = screen.getByLabelText('Chỉ hiện gian hàng bất thường')
    fireEvent.click(toggle)
    await waitFor(() =>
      expect(listAdminSellersReport).toHaveBeenLastCalledWith(
        expect.objectContaining({ anomalyOnly: true, page: 1, pageSize: 20 }),
        expect.any(AbortSignal),
      ),
    )

    cleanup()
    vi.mocked(getAdminOverviewReport).mockRejectedValue(
      new ApiError({ status: 503, code: 'SERVICE_UNAVAILABLE', message: 'SVC-RPT offline' }),
    )
    mountUi(<AdminDashboardPage />)
    expect(await screen.findByText(/Dịch vụ tổng hợp báo cáo SVC-RPT hiện tạm gián đoạn/)).toBeTruthy()
  })

  it('AdminOrdersPage & AdminTransactionsPage render rows and validate UUID inputs', async () => {
    vi.mocked(listAdminOrders).mockResolvedValue({
      data: [
        {
          orderId: '33333333-3333-4333-8333-333333333333',
          orderCode: 'ORD-20261128-001',
          buyerId: '44444444-4444-4444-8444-444444444444',
          status: 'PAID',
          grandTotal: 350_000,
          sellerOrders: [
            { sellerOrderId: '55555555-5555-4555-8555-555555555555', status: 'AWAITING_CONFIRMATION', totalAmount: 350_000 },
          ],
          statusChangedAt: '2026-11-28T02:00:00Z',
          syncedAt: '2026-11-28T02:05:00Z',
          createdAt: '2026-11-28T01:55:00Z',
        },
      ],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      syncedAt: '2026-11-28T02:05:00Z',
    })

    mountUi(<AdminOrdersPage />)
    expect((await screen.findAllByText('ORD-20261128-001')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText(/350\.000/)).length).toBeGreaterThan(0)

    fireEvent.change(screen.getByLabelText('Nhập UUID cần tra cứu...'), { target: { value: 'not-a-uuid' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    expect(await screen.findByText('Vui lòng nhập đúng định dạng UUID.')).toBeTruthy()

    cleanup()
    vi.mocked(listAdminTransactions).mockResolvedValue({
      data: [
        {
          paymentId: '66666666-6666-4666-8666-666666666666',
          orderId: '33333333-3333-4333-8333-333333333333',
          gatewayRef: 'VNP-TX-9988',
          amount: 350_000,
          refundedTotal: 0,
          status: 'SUCCEEDED',
          createdAt: '2026-11-28T02:00:00Z',
          syncedAt: '2026-11-28T02:05:00Z',
        },
      ],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      syncedAt: '2026-11-28T02:05:00Z',
    })

    mountUi(<AdminTransactionsPage />)
    expect((await screen.findAllByText('VNP-TX-9988')).length).toBeGreaterThan(0)
  })

  it('AdminParamsPage validates bounds & T_RESERVE >= T_PAY and submits with AuditReasonDialog', async () => {
    vi.mocked(listBusinessParams).mockResolvedValue({
      data: [
        {
          code: 'PRM-05',
          name: 'T_PAY',
          version: 1,
          value: '15',
          unit: 'minutes',
          minValue: '10',
          maxValue: '30',
          description: 'Hạn thanh toán Order',
          effectiveFrom: '2026-11-01T00:00:00Z',
          reason: 'Mặc định',
        },
        {
          code: 'PRM-06',
          name: 'T_RESERVE',
          version: 1,
          value: '15',
          unit: 'minutes',
          minValue: '10',
          maxValue: '30',
          description: 'Hạn giữ chỗ tồn kho',
          effectiveFrom: '2026-11-01T00:00:00Z',
          reason: 'Mặc định',
        },
      ],
      syncedAt: '2026-11-28T02:00:00Z',
    })
    vi.mocked(updateBusinessParam).mockResolvedValue({
      code: 'PRM-05',
      name: 'T_PAY',
      version: 2,
      value: '12',
      unit: 'minutes',
      minValue: '10',
      maxValue: '30',
      description: 'Hạn thanh toán Order',
      effectiveFrom: '2026-11-28T03:00:00Z',
      reason: 'Giảm hạn thanh toán vào giờ cao điểm',
    })

    mountUi(<AdminParamsPage />)

    expect((await screen.findAllByText('T_PAY')).length).toBeGreaterThan(0)
    const [editTPayBtn] = screen.getAllByRole('button', { name: 'Chỉnh sửa' })
    fireEvent.click(editTPayBtn!)

    const valueInput = await screen.findByLabelText(/Giá trị mới/)
    // Out of bounds (< 10)
    fireEvent.change(valueInput, { target: { value: '5' } })
    expect(await screen.findByText(/không được nhỏ hơn 10/)).toBeTruthy()

    // Violates T_PAY <= T_RESERVE (15)
    fireEvent.change(valueInput, { target: { value: '25' } })
    expect(await screen.findByText(/không được vượt quá hạn giữ chỗ T_RESERVE/)).toBeTruthy()

    // Valid value + reason >= 10 chars
    fireEvent.change(valueInput, { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText(/Lý do/), {
      target: { value: 'Giảm hạn thanh toán vào giờ cao điểm' },
    })

    const submitBtn = screen.getByRole('button', { name: 'Lưu & Phát config.changed' })
    await waitFor(() => expect((submitBtn as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(submitBtn)

    await waitFor(() =>
      expect(updateBusinessParam).toHaveBeenCalledWith('T_PAY', {
        value: '12',
        reason: 'Giảm hạn thanh toán vào giờ cao điểm',
      }),
    )
    expect(await screen.findByText('Đã cập nhật tham số T_PAY lên phiên bản v2')).toBeTruthy()
  })

  it('AdminAuditLogsPage renders read-only logs with expandable state diff and no edit/delete buttons', async () => {
    vi.mocked(listAuditLogs).mockResolvedValue({
      data: [
        {
          auditId: '77777777-7777-4777-8777-777777777777',
          actor: '11111111-1111-4111-8111-111111111111',
          role: 'ADMINISTRATOR',
          action: 'CONFIG_PARAM_UPDATED',
          entityType: 'BusinessParameter',
          entityId: 'T_PAY',
          beforeState: { value: '15', version: 1 },
          afterState: { value: '12', version: 2 },
          reason: 'Điều chỉnh thử nghiệm hệ thống',
          correlationId: '88888888-8888-4888-8888-888888888888',
          at: '2026-11-28T03:00:00Z',
        },
      ],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      syncedAt: '2026-11-28T03:00:00Z',
    })

    mountUi(<AdminAuditLogsPage />)

    expect((await screen.findAllByText('CONFIG_PARAM_UPDATED')).length).toBeGreaterThan(0)
    expect(screen.getByText(/Chỉ đọc · Không cho phép sửa\/xóa/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^(Xóa|Sửa|Chỉnh sửa|Xóa bản ghi)$/i })).toBeNull()

    const [diffBtn] = screen.getAllByRole('button', { name: 'Xem diff trạng thái' })
    fireEvent.click(diffBtn!)
    expect(await screen.findByText('Trước thay đổi')).toBeTruthy()
    expect(screen.getByText('Sau thay đổi')).toBeTruthy()
  })

  it('AdminSystemPage displays Consul service health and supports DLQ Replay via AuditReasonDialog', async () => {
    vi.mocked(getSystemHealth).mockResolvedValue({
      overallStatus: 'degraded',
      checkedAt: '2026-11-28T03:00:00Z',
      services: [
        {
          serviceName: 'svc-idn',
          status: 'healthy',
          totalInstances: 1,
          passingInstances: 1,
          instances: [{ instanceId: 'idn-1', address: '10.0.0.1', port: 8081, status: 'passing', checkOutput: 'ok' }],
        },
        { serviceName: 'svc-rev', status: 'missing', totalInstances: 0, passingInstances: 0, instances: [] },
      ],
    })
    vi.mocked(listDLQ).mockResolvedValue({
      checkedAt: '2026-11-28T03:00:00Z',
      data: [
        {
          id: '42',
          sequence: 42,
          subject: 'dlq.svc-rpt.order.paid',
          eventId: '99999999-9999-4999-8999-999999999999',
          eventType: 'order.paid',
          producer: 'SVC-ORD',
          aggregateId: '33333333-3333-4333-8333-333333333333',
          correlationId: '88888888-8888-4888-8888-888888888888',
          consumer: 'svc-rpt-projector',
          error: 'db timeout',
          attempts: 4,
          failedAt: '2026-11-28T02:50:00Z',
          ageSeconds: 600,
          replayable: true,
        },
        {
          id: '43',
          sequence: 43,
          subject: 'dlq.svc-rpt.malformed',
          eventId: '',
          eventType: '',
          producer: '',
          aggregateId: '',
          correlationId: '',
          consumer: 'svc-rpt-projector',
          error: 'invalid json',
          attempts: 1,
          failedAt: '2026-11-28T02:55:00Z',
          ageSeconds: 300,
          replayable: false,
        },
      ],
      pagination: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
    })
    vi.mocked(replayDLQ).mockResolvedValue({
      id: '42',
      eventId: '99999999-9999-4999-8999-999999999999',
      eventType: 'order.paid',
      targetSubject: 'events.order.paid',
      replayedAt: '2026-11-28T03:01:00Z',
    })

    mountUi(<AdminSystemPage />)

    expect(await screen.findByText('svc-idn')).toBeTruthy()
    expect(screen.getByText('svc-rev')).toBeTruthy()
    expect(screen.getAllByText('Không thể phát lại (lỗi phong bì)').length).toBeGreaterThan(0)

    const [replayBtn] = screen.getAllByRole('button', { name: 'Phát lại (Replay)' })
    fireEvent.click(replayBtn!)

    fireEvent.change(await screen.findByLabelText(/Lý do/), {
      target: { value: 'Đã khắc phục kết nối Postgres, phát lại sự kiện' },
    })
    const confirmBtn = screen.getByRole('button', { name: 'Xác nhận phát lại' })
    await waitFor(() => expect((confirmBtn as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(confirmBtn)

    await waitFor(() =>
      expect(replayDLQ).toHaveBeenCalledWith('42', {
        reason: 'Đã khắc phục kết nối Postgres, phát lại sự kiện',
      }),
    )
    expect(await screen.findByText('Đã phát lại thông điệp DLQ #42')).toBeTruthy()
  })

  it('SellerDashboardPage shows performance metrics, awaiting banner, and 404 SHOP_NOT_FOUND empty state', async () => {
    vi.mocked(getSellerPerformance).mockResolvedValue({
      shopId: '22222222-2222-4222-8222-222222222222',
      shopName: 'Cửa hàng Gió Mới',
      shopStatus: 'ACTIVE',
      from: '2026-10-30',
      to: '2026-11-28',
      syncedAt: '2026-11-28T03:00:00Z',
      summary: {
        totalOrders: 24,
        awaitingConfirmationCount: 3,
        deliveredCount: 19,
        deliveryFailedCount: 1,
        sellerTimeoutCount: 1,
        sellerRejectedCount: 0,
        complaintsCount: 1,
        complaintsNoResponseCount: 0,
        ratingAvg: 4.85,
        cancelRate: 0.0417,
        periodOrdersCount: 12,
        periodGmvTotal: 8_400_000,
        periodCancelledCount: 1,
        periodRefundTotal: 200_000,
      },
      daily: [{ date: '2026-11-28', ordersCount: 4, gmvTotal: 2_800_000, cancelledCount: 0, refundTotal: 0 }],
    })

    mountUi(<SellerDashboardPage />)

    expect(await screen.findByText(/Cửa hàng Gió Mới/)).toBeTruthy()
    expect(screen.getByText(/Bạn đang có 3 gói đơn hàng chờ xác nhận/)).toBeTruthy()
    expect(screen.getByText(/8\.400\.000/)).toBeTruthy()

    cleanup()
    vi.mocked(getSellerPerformance).mockRejectedValue(
      new ApiError({ status: 404, code: 'SHOP_NOT_FOUND', message: 'Chưa có dữ liệu gian hàng' }),
    )
    mountUi(<SellerDashboardPage />)
    expect(await screen.findByText('Chưa có dữ liệu báo cáo cho gian hàng của bạn')).toBeTruthy()
  })
})
