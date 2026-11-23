/** Một khoản hoàn của 1 gói SellerOrder bị hủy/giao thất bại/khiếu nại (FR-ORD-009). */
export type RefundLine = {
  sellerOrderId: string
  /** Mã hiển thị, VD "SO-002". */
  sellerOrderCode: string
  shopName: string
  /** VND, số dương. */
  amount: number
  /** SUCCEEDED = đã hoàn; PENDING/PROCESSING = đang hoàn; FAILED = chờ xử lý thủ công. */
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED'
}

/**
 * `Tổng đã thanh toán` − `Tổng hoàn` = `Giá trị đơn thực tế còn lại`.
 * Mọi khoản (kể cả đang hoàn) đều trừ: gói đã hủy không còn thuộc giá trị đơn, dù tiền chưa về tài khoản.
 */
export function computeRefundBreakdown(paidTotal: number, refunds: readonly RefundLine[]) {
  const refundedTotal = refunds.reduce((sum, refund) => sum + refund.amount, 0)
  return { refundedTotal, remaining: Math.max(0, paidTotal - refundedTotal) }
}
