import { useState, type ReactNode } from 'react'
import { ApiError } from '@/api/errors'
import {
  AuditReasonDialog,
  CopyableId,
  PartialRefundBreakdown,
  ServiceFallbackBanner,
  ShopPackageCard,
  ShopPackageItem,
  ShopPackageSummary,
  SlaCountdownPill,
  SyncTimestampBadge,
} from '@/components/shared'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { STATUS_TONES } from '@/lib/status'

/*
 * Trang preview nội bộ (chỉ `npm run dev`, không có trong bản build) cho 6 component đặc thù — T2-04.
 * Dữ liệu dưới đây là giả lập để minh họa props; thay bằng dữ liệu API thật khi dùng trong features/.
 */

const HOUR = 3_600_000
const now = Date.now()
const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString()

function Section({ title, spec, children }: { title: string; spec: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="font-mono text-xs text-muted-foreground">{spec}</p>
      </div>
      {children}
    </section>
  )
}

function FallbackDemo() {
  const [retrying, setRetrying] = useState(false)
  return (
    <ServiceFallbackBanner
      message="Tạm thời không thể tải danh sách đánh giá."
      isRetrying={retrying}
      onRetry={() => {
        setRetrying(true)
        setTimeout(() => setRetrying(false), 1200)
      }}
    />
  )
}

function AuditDemo() {
  const [open, setOpen] = useState<null | 'ok' | 'fail'>(null)
  const [log, setLog] = useState<string | null>(null)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="destructive" onClick={() => setOpen('ok')}>
        Khóa tài khoản (thành công)
      </Button>
      <Button variant="outline" onClick={() => setOpen('fail')}>
        Hoàn tiền thủ công (API lỗi 409)
      </Button>
      {log && <p className="w-full text-xs text-muted-foreground">Đã gửi reason: “{log}”</p>}
      <AuditReasonDialog
        open={open === 'ok'}
        onOpenChange={(next) => setOpen(next ? 'ok' : null)}
        title="Khóa tài khoản người dùng"
        description="Mọi phiên đăng nhập của tài khoản sẽ bị thu hồi ngay lập tức."
        confirmLabel="Khóa tài khoản"
        variant="destructive"
        onConfirm={async (reason) => {
          await new Promise((r) => setTimeout(r, 800))
          setLog(reason)
        }}
      />
      <AuditReasonDialog
        open={open === 'fail'}
        onOpenChange={(next) => setOpen(next ? 'fail' : null)}
        title="Xác nhận đã hoàn tiền thủ công"
        onConfirm={async () => {
          await new Promise((r) => setTimeout(r, 600))
          throw new ApiError({
            status: 409,
            code: 'REFUND_ALREADY_SUCCEEDED',
            message: 'Khoản hoàn này đã được xác nhận bởi quản trị viên khác.',
            correlationId: '9f1c2d3e-4b5a-6c7d-8e9f-0a1b2c3d4e5f',
          })
        }}
      />
    </div>
  )
}

export function ComponentsPreviewPage() {
  const [syncing, setSyncing] = useState(false)
  const [syncedAt, setSyncedAt] = useState(iso(-42_000))
  const [selected, setSelected] = useState(true)

  return (
    <main id="main" className="mx-auto flex max-w-5xl flex-col gap-10 p-4 md:p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Shared components — preview</h1>
        <p className="text-muted-foreground">
          04-UI-UX-Design-Brief §4.2 · import từ <code className="font-mono">@/components/shared</code>
        </p>
      </header>

      <Section title="1. ShopPackageCard — Chi tiết đơn (Buyer)" spec="NFR-USA-005 · FR-ORD-009">
        <ShopPackageCard
          shop={{ id: 'shop-a', name: 'Shop Điện Tử A' }}
          status="AWAITING_CONFIRMATION"
          code={{ value: '0193a8b1-9999-7000-8000-000000000002', display: 'SO-001' }}
          sla={<SlaCountdownPill label="Xác nhận" startedAt={iso(-20 * HOUR)} deadline={iso(4 * HOUR)} />}
          footer={<ShopPackageSummary itemsAmount={1_050_000} shippingFee={32_000} carrier="GHN" etaAt={iso(72 * HOUR)} />}
          actions={<Button variant="destructive-outline">Hủy gói hàng này</Button>}
        >
          <ShopPackageItem name="Tai nghe Bluetooth chống ồn ANC X200" variantLabel="Màu Đen" quantity={1} unitPrice={890_000} />
          <ShopPackageItem name="Cáp sạc USB-C 2m bọc dù" variantLabel="Màu Trắng" quantity={2} unitPrice={80_000} />
        </ShopPackageCard>
      </Section>

      <Section title="ShopPackageCard — Giỏ hàng (checkbox + cảnh báo dòng)" spec="FR-CRT-003">
        <ShopPackageCard
          shop={{ id: 'shop-b', name: 'Thời Trang B' }}
          headerStart={
            <input
              type="checkbox"
              aria-label="Chọn tất cả sản phẩm của Thời Trang B"
              checked={selected}
              onChange={(e) => setSelected(e.target.checked)}
              className="size-4 accent-primary"
            />
          }
          footer={<ShopPackageSummary itemsAmount={240_000} shippingFee={25_000} isEstimatedFee />}
        >
          <ShopPackageItem
            name="Áo thun cotton basic"
            variantLabel="Trắng / M"
            quantity={2}
            unitPrice={120_000}
            start={<input type="checkbox" aria-label="Chọn Áo thun cotton basic" defaultChecked className="mt-1 size-4 accent-primary" />}
            badges={<StatusBadge status="PARTIAL" tone="warning" label="Giá đã thay đổi từ 100.000 ₫ → 120.000 ₫" />}
          />
          <ShopPackageItem
            name="Quần jean slim fit"
            variantLabel="Xanh đậm / 30"
            quantity={1}
            unitPrice={450_000}
            dimmed
            start={<input type="checkbox" aria-label="Chọn Quần jean slim fit" disabled className="mt-1 size-4" />}
            badges={<StatusBadge status="EXPIRED" tone="danger" label="Hết hàng" />}
          />
        </ShopPackageCard>
      </Section>

      <Section title="2. PartialRefundBreakdown" spec="FR-ORD-009 · tự ẩn khi refunds = []">
        <PartialRefundBreakdown
          paidTotal={1_500_000}
          refunds={[
            { sellerOrderId: 'so-2', sellerOrderCode: 'SO-002', shopName: 'Shop B hủy', amount: 450_000, status: 'SUCCEEDED' },
            { sellerOrderId: 'so-3', sellerOrderCode: 'SO-003', shopName: 'Shop C giao thất bại', amount: 120_000, status: 'PROCESSING' },
          ]}
        />
      </Section>

      <Section title="3. ServiceFallbackBanner" spec="NFR-REL-005 · SOA-R09">
        <FallbackDemo />
      </Section>

      <Section title="4. SlaCountdownPill" spec="> 25% xám · ≤ 25% cam · quá hạn đỏ">
        <div className="flex flex-wrap gap-2">
          <SlaCountdownPill label="T_CONFIRM" startedAt={iso(-2 * HOUR)} deadline={iso(22 * HOUR)} />
          <SlaCountdownPill label="T_PAY" startedAt={iso(-13 * 60_000)} deadline={iso(2 * 60_000 + 15_000)} />
          <SlaCountdownPill label="T_CPL_SELLER" startedAt={iso(-26 * HOUR)} deadline={iso(-2 * HOUR)} />
        </div>
      </Section>

      <Section title="5. AuditReasonDialog" spec="BR-GEN-04 · reason ≥ 10 ký tự">
        <AuditDemo />
      </Section>

      <Section title="6. SyncTimestampBadge" spec="FR-ADM-001 E1 · FR-RPT-001">
        <div className="flex flex-wrap gap-2">
          <SyncTimestampBadge
            syncedAt={syncedAt}
            isRefreshing={syncing}
            onRefresh={() => {
              setSyncing(true)
              setTimeout(() => {
                setSyncedAt(new Date().toISOString())
                setSyncing(false)
              }, 800)
            }}
          />
          <SyncTimestampBadge syncedAt={null} />
        </div>
      </Section>

      <Section title="Phụ trợ: StatusBadge · CopyableId · Button" spec="Brief §2.2, §4.1">
        <div className="flex flex-wrap gap-2">
          {Object.keys(STATUS_TONES).map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
        <CopyableId value="9f1c2d3e-4b5a-6c7d-8e9f-0a1b2c3d4e5f" label="mã tra cứu" />
        <div className="flex flex-wrap gap-2">
          <Button variant="cta" size="cta">Đặt hàng &amp; Thanh toán</Button>
          <Button>Xác nhận đơn</Button>
          <Button variant="outline">Secondary</Button>
          <Button variant="destructive">Từ chối</Button>
          <Button variant="destructive-outline">Hủy đơn</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
        <p className="text-2xl font-bold text-price tabular-nums">1.250.000 ₫</p>
      </Section>
    </main>
  )
}
