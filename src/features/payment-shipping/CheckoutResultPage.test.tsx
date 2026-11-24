// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/lib/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { apiGetOrder, type BuyerOrderDetailView } from '@/features/cart-checkout-order/api'
import { getPayment, retryOrderPayment } from './api'
import { CheckoutResultPage } from './CheckoutResultPage'

vi.mock('@/features/cart-checkout-order/api', () => ({ apiGetOrder: vi.fn() }))
vi.mock('./api', () => ({ getPayment: vi.fn(), retryOrderPayment: vi.fn(), httpUrl: vi.fn() }))

const orderId = '11111111-1111-4111-8111-111111111111'
const paymentId = '22222222-2222-4222-8222-222222222222'

function order(overrides: Partial<BuyerOrderDetailView> = {}) {
  return {
    orderId, orderCode: 'ORD-20261124-01', status: 'PENDING_PAYMENT',
    paymentDueAt: new Date(Date.now() + 60_000).toISOString(), createdAt: new Date().toISOString(),
    grandTotal: 150_000,
    payment: { paymentId, status: 'FAILED', gateway: 'MOCK_PAY' },
    sellerOrders: [{ sellerOrderId: 'package1', sellerOrderCode: 'SO-01', status: 'AWAITING_CONFIRMATION' }],
    history: [],
    ...overrides,
  } as BuyerOrderDetailView
}

function mount(search = `?orderId=${orderId}`) {
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.mocked(getPayment).mockResolvedValue({ needsManualReview: false } as Awaited<ReturnType<typeof getPayment>>)
  render(
    <QueryClientProvider client={query}>
      <MemoryRouter initialEntries={[`/checkout/result${search}`]}>
        <TooltipProvider><CheckoutResultPage /></TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => { cleanup(); vi.resetAllMocks() })

describe('Checkout payment result', () => {
  it('uses the current order and attempt when retrying and refreshes if already captured', async () => {
    vi.mocked(apiGetOrder).mockResolvedValueOnce(order()).mockResolvedValue(order({ status: 'PAID' }))
    vi.mocked(retryOrderPayment).mockResolvedValue({ status: 'SUCCEEDED' } as Awaited<ReturnType<typeof retryOrderPayment>>)
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Thanh toán lại ngay' }))
    await waitFor(() => expect(retryOrderPayment).toHaveBeenCalledWith(orderId, paymentId))
    expect(await screen.findByRole('heading', { name: 'Thanh toán thành công' })).toBeTruthy()
    expect(screen.getByText('SO-01')).toBeTruthy()
  })

  it('shows the late-payment refund and hides retry after cancellation', async () => {
    vi.mocked(apiGetOrder).mockResolvedValue(order({
      status: 'CANCELLED',
      history: [{ cause: 'LATE_PAYMENT_REJECTED' }] as BuyerOrderDetailView['history'],
    }))
    mount()
    expect(await screen.findByText(/tự động khởi tạo hoàn 100%/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Thanh toán lại ngay' })).toBeNull()
  })

  it('ignores gateway parameters without an order identifier', () => {
    mount('?vnp_ResponseCode=00')
    expect(screen.getByText(/thiếu mã đơn hàng hợp lệ/)).toBeTruthy()
    expect(apiGetOrder).not.toHaveBeenCalled()
  })
})
