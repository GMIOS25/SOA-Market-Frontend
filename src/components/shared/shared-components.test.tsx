// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/lib/dayjs'
import '@/lib/i18n'
import { ApiError } from '@/api/errors'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuditReasonDialog } from './audit-reason-dialog'
import { PartialRefundBreakdown } from './partial-refund-breakdown'
import { ServiceFallbackBanner } from './service-fallback-banner'
import { ShopPackageCard, ShopPackageItem, ShopPackageSummary } from './shop-package-card'
import { SlaCountdownPill } from './sla-countdown-pill'
import { SyncTimestampBadge } from './sync-timestamp-badge'

const NBSP = String.fromCharCode(0xa0)
/** Intl vi-VN chỉ đặt NBSP ngay trước ₫. */
const vnd = (text: string) => text.replace(/ ₫/g, `${NBSP}₫`)
const isDisabled = (el: HTMLElement) => (el as HTMLButtonElement).disabled

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <TooltipProvider>{ui}</TooltipProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('AuditReasonDialog (BR-GEN-04)', () => {
  function Harness({ onConfirm }: { onConfirm: (reason: string) => Promise<void> }) {
    const [open, setOpen] = useState(true)
    return (
      <>
        <span data-testid="state">{open ? 'open' : 'closed'}</span>
        <AuditReasonDialog open={open} onOpenChange={setOpen} title="Khóa tài khoản" onConfirm={onConfirm} />
      </>
    )
  }

  it('keeps confirm disabled until the trimmed reason has ≥ 10 characters', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness onConfirm={vi.fn()} />)
    const confirm = screen.getByRole('button', { name: 'Xác nhận' })
    const reason = screen.getByRole('textbox', { name: /Lý do/ })

    expect(isDisabled(confirm)).toBe(true)
    await user.type(reason, '   ngắn   ')
    expect(isDisabled(confirm)).toBe(true)
    expect(screen.getByText('Lý do cần tối thiểu 10 ký tự.')).toBeTruthy()
    expect(reason.getAttribute('aria-invalid')).toBe('true')

    await user.type(reason, 'vi phạm chính sách')
    expect(isDisabled(confirm)).toBe(false)
  })

  it('submits the trimmed reason and closes on success', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<Harness onConfirm={onConfirm} />)

    await user.type(screen.getByRole('textbox', { name: /Lý do/ }), '  Spam đánh giá nhiều lần  ')
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }))

    expect(onConfirm).toHaveBeenCalledWith('Spam đánh giá nhiều lần')
    expect(screen.getByTestId('state').textContent).toBe('closed')
  })

  it('stays open and shows the API message + correlationId when the action fails', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockRejectedValue(
      new ApiError({ status: 409, code: 'CONFLICT', message: 'Đã có quản trị viên khác xử lý.', correlationId: 'corr-123' }),
    )
    renderWithProviders(<Harness onConfirm={onConfirm} />)

    await user.type(screen.getByRole('textbox', { name: /Lý do/ }), 'Xác nhận hoàn tiền thủ công')
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }))

    expect(screen.getByRole('alert').textContent).toContain('Đã có quản trị viên khác xử lý.')
    expect(screen.getByText('corr-123')).toBeTruthy()
    expect(screen.getByTestId('state').textContent).toBe('open')
  })
})

describe('ShopPackageCard', () => {
  it('shows shop, status, items and a separated amount summary', () => {
    renderWithProviders(
      <ShopPackageCard
        shop={{ id: 's1', name: 'Shop A' }}
        status="AWAITING_CONFIRMATION"
        code={{ value: 'uuid-1', display: 'SO-001' }}
        footer={<ShopPackageSummary itemsAmount={200_000} shippingFee={30_000} carrier="GHN" />}
      >
        <ShopPackageItem name="Áo thun" variantLabel="M" quantity={2} unitPrice={100_000} />
      </ShopPackageCard>,
    )

    const card = screen.getByRole('article', { name: /Shop A/ })
    expect(screen.getByRole('link', { name: 'Shop A' }).getAttribute('href')).toBe('/shops/s1')
    expect(card.textContent).toContain('Chờ nhà bán xác nhận')
    expect(card.textContent).toContain('SO-001')
    expect(card.textContent).toContain(vnd('2 × 100.000 ₫'))
    expect(card.textContent).toContain(vnd('230.000 ₫'))
    expect(screen.getByRole('button', { name: 'Sao chép mã gói hàng' })).toBeTruthy()
  })
})

describe('PartialRefundBreakdown (FR-ORD-009)', () => {
  it('renders nothing without refunds', () => {
    const { container } = renderWithProviders(<PartialRefundBreakdown paidTotal={1_000} refunds={[]} />)
    expect(container.textContent).toBe('')
  })

  it('shows paid − refunded = remaining', () => {
    renderWithProviders(
      <PartialRefundBreakdown
        paidTotal={1_500_000}
        refunds={[{ sellerOrderId: '2', sellerOrderCode: 'SO-002', shopName: 'Shop B', amount: 450_000, status: 'SUCCEEDED' }]}
      />,
    )
    const region = screen.getByRole('region', { name: 'Đối chiếu hoàn tiền' })
    expect(region.textContent).toContain('Đã hoàn')
    expect(region.textContent).toContain(vnd('- 450.000 ₫'))
    expect(region.textContent).toContain(vnd('1.050.000 ₫'))
  })
})

describe('ServiceFallbackBanner (NFR-REL-005)', () => {
  it('retries only the failed block and disables the button while retrying', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const { rerender } = renderWithProviders(<ServiceFallbackBanner onRetry={onRetry} />)

    await user.click(screen.getByRole('button', { name: 'Thử tải lại khối này' }))
    expect(onRetry).toHaveBeenCalledOnce()

    rerender(
      <MemoryRouter>
        <TooltipProvider>
          <ServiceFallbackBanner onRetry={onRetry} isRetrying />
        </TooltipProvider>
      </MemoryRouter>,
    )
    expect(isDisabled(screen.getByRole('button', { name: 'Đang tải lại...' }))).toBe(true)
  })
})

describe('SlaCountdownPill', () => {
  it('ticks down and flips to overdue', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-22T00:00:00Z'))
    renderWithProviders(
      <SlaCountdownPill label="Xác nhận" startedAt="2026-11-21T00:00:30Z" deadline="2026-11-22T00:00:02Z" />,
    )
    expect(screen.getByRole('timer').textContent).toContain('Còn 2 giây')
    expect(screen.getByRole('timer').className).toContain('text-sla-warning')

    act(() => void vi.advanceTimersByTime(5_000))
    expect(screen.getByRole('timer').textContent).toContain('Quá hạn 3 giây')
    expect(screen.getByRole('timer').className).toContain('text-sla-overdue')
  })
})

describe('SyncTimestampBadge', () => {
  it('shows the UTC+7 sync time and refreshes', async () => {
    const user = userEvent.setup()
    const onRefresh = vi.fn()
    renderWithProviders(<SyncTimestampBadge syncedAt="2026-11-22T03:42:15Z" onRefresh={onRefresh} />)

    expect(screen.getByText('Đồng bộ sự kiện lúc 10:42:15')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Làm mới dữ liệu' }))
    expect(onRefresh).toHaveBeenCalledOnce()
  })
})
