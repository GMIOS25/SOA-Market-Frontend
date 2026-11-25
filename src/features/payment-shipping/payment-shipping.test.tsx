// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/lib/i18n'
import { clearAuthSession, setAuthSession } from '@/lib/auth/session'
import { MockControlPanel } from './MockControlPanel'
import { formatShipmentFailureReason, sortTrackingEvents } from './tracking'

function mountPanel(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  render(
    <QueryClientProvider client={queryClient}>
      <MockControlPanel />
    </QueryClientProvider>,
  )
  return queryClient
}

function loginAsBuyer() {
  setAuthSession({
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    user: {
      userId: '01a20e22-4887-7e44-95a8-f2e30decc0c6',
      email: 'buyer@soa-market.local',
      fullName: 'Buyer Demo',
      phone: '0901234567',
      roles: ['BUYER'],
      status: 'ACTIVE',
      createdAt: '2026-11-24T00:00:00Z',
    },
  })
}

afterEach(() => {
  cleanup()
  clearAuthSession()
  vi.restoreAllMocks()
})

describe('tracking helpers (T5-08)', () => {
  it('sorts out-of-order tracking events descending by occurredAt then receivedAt', () => {
    const sorted = sortTrackingEvents([
      { id: '1', occurredAt: '2026-11-24T08:00:00Z', receivedAt: '2026-11-24T08:01:00Z' },
      { id: '2', occurredAt: '2026-11-24T10:00:00Z', receivedAt: '2026-11-24T10:00:05Z' },
      { id: '3', occurredAt: '2026-11-24T10:00:00Z', receivedAt: '2026-11-24T10:05:00Z' },
    ])
    expect(sorted.map((item) => item.id)).toEqual(['3', '2', '1'])
  })

  it('normalizes backend failure codes into localized Vietnamese copy and preserves readable messages', () => {
    expect(formatShipmentFailureReason(null)).toBeUndefined()
    expect(formatShipmentFailureReason('   ')).toBeUndefined()
    expect(formatShipmentFailureReason('CARRIER_CREATE_UNAVAILABLE: Carrier timeout after 4 retries')).toContain(
      'Đơn vị vận chuyển tạm thời không phản hồi',
    )
    expect(formatShipmentFailureReason('PICKUP_ADDRESS_INCOMPLETE')).toContain('Địa chỉ lấy hàng của nhà bán')
    expect(formatShipmentFailureReason('CARRIER_OPERATION_UNCONFIRMED')).toContain('Chưa nhận được xác nhận')
    expect(formatShipmentFailureReason('WEIGHT_EXCEEDED')).toContain('vượt giới hạn')
    expect(formatShipmentFailureReason('UNKNOWN_BACKEND_ERR: raw detail')).toContain('Không thể khởi tạo vận đơn')
    expect(formatShipmentFailureReason('Địa chỉ lấy hàng không hợp lệ hoặc ĐVVC timeout.')).toBe(
      'Địa chỉ lấy hàng không hợp lệ hoặc ĐVVC timeout.',
    )
  })
})

describe('MockControlPanel (T5-08)', () => {
  it('does not render when user is not authenticated', () => {
    mountPanel()
    expect(screen.queryByRole('button', { name: 'Điều khiển mô phỏng' })).toBeNull()
  })

  it('advances a shipping waybill and invalidates order/shipment queries', async () => {
    loginAsBuyer()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          waybillStatus: 'OUT_FOR_DELIVERY',
          lastEventStatus: 'OUT_FOR_DELIVERY',
          deliveryAttempts: 1,
          webhooksSent: 1,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    mountPanel(queryClient)
    fireEvent.click(screen.getByRole('button', { name: 'Điều khiển mô phỏng' }))
    fireEvent.click(screen.getByRole('button', { name: 'Vận chuyển' }))

    fireEvent.change(screen.getByLabelText(/Token môi trường demo/), { target: { value: 'demo-token-123' } })
    fireEvent.change(screen.getByLabelText('Mã vận đơn MockShipping'), { target: { value: 'MOCK-SHP-DEMO0006' } })
    fireEvent.change(screen.getByLabelText('Chặng vận chuyển'), { target: { value: 'OUT_FOR_DELIVERY' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mô phỏng chặng' }))

    expect(await screen.findByText('Đã chạy mô phỏng. Dịch vụ đã gửi 1 webhook.')).toBeTruthy()
    expect(fetchSpy).toHaveBeenCalledWith(
      '/mock/ship/waybills/MOCK-SHP-DEMO0006/advance',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer demo-token-123' }),
      }),
    )
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled())
  })

  it('shows unauthorized alert when demo service returns 401', async () => {
    loginAsBuyer()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }))

    mountPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Điều khiển mô phỏng' }))
    fireEvent.change(screen.getByLabelText(/Token môi trường demo/), { target: { value: 'wrong-token' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tải cấu hình' }))

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText(/Token không hợp lệ/)).toBeTruthy()
  })
})
