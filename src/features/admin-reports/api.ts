import { createApiClient } from '@/api/client'
import { unwrap } from '@/api/errors'
import type { SvcRpt } from '@/api/generated'
import { APP_TIMEZONE, dayjs } from '@/lib/dayjs'

const rpt = createApiClient<SvcRpt.paths>()

export type AdminOrderView = SvcRpt.components['schemas']['AdminOrderView']
export type OrderSellerRefView = SvcRpt.components['schemas']['OrderSellerRefView']
export type AdminOrdersResult = SvcRpt.components['schemas']['AdminOrdersResult']
export type AdminTransactionView = SvcRpt.components['schemas']['AdminTransactionView']
export type AdminTransactionsResult = SvcRpt.components['schemas']['AdminTransactionsResult']
export type AdminExceptionView = SvcRpt.components['schemas']['AdminExceptionView']
export type AdminExceptionsResult = SvcRpt.components['schemas']['AdminExceptionsResult']
export type BusinessParamView = SvcRpt.components['schemas']['BusinessParamView']
export type BusinessParamsResult = SvcRpt.components['schemas']['BusinessParamsResult']
export type UpdateBusinessParamInput = SvcRpt.components['schemas']['UpdateBusinessParamInputBody']
export type AuditLogView = SvcRpt.components['schemas']['AuditLogView']
export type AuditLogsResult = SvcRpt.components['schemas']['AuditLogsResult']
export type ServiceInstanceHealth = SvcRpt.components['schemas']['ServiceInstanceHealth']
export type ServiceHealthStatus = SvcRpt.components['schemas']['ServiceHealthStatus']
export type SystemHealthResult = SvcRpt.components['schemas']['SystemHealthResult']
export type DLQEntry = SvcRpt.components['schemas']['DLQEntry']
export type DLQListResult = SvcRpt.components['schemas']['DLQListResult']
export type DLQReplayResult = SvcRpt.components['schemas']['DLQReplayResult']
export type ReplayDLQInput = SvcRpt.components['schemas']['ReplayDLQInputBody']
export type DailyReportPoint = SvcRpt.components['schemas']['DailyReportPoint']
export type AdminOverviewSummary = SvcRpt.components['schemas']['AdminOverviewSummary']
export type AdminOverviewReportResult = SvcRpt.components['schemas']['AdminOverviewReportResult']
export type SellerPerformanceView = SvcRpt.components['schemas']['SellerPerformanceView']
export type AdminSellersReportResult = SvcRpt.components['schemas']['AdminSellersReportResult']
export type SellerOwnSummary = SvcRpt.components['schemas']['SellerOwnSummary']
export type SellerOwnPerformanceResult = SvcRpt.components['schemas']['SellerOwnPerformanceResult']
export type PaginationMeta = SvcRpt.components['schemas']['PaginationMeta']

export type AdminOrdersFilter = NonNullable<SvcRpt.operations['admin-list-orders']['parameters']['query']>
export type AdminTransactionsFilter = NonNullable<SvcRpt.operations['admin-list-transactions']['parameters']['query']>
export type AdminExceptionsFilter = NonNullable<SvcRpt.operations['admin-list-exceptions']['parameters']['query']>
export type AuditLogsFilter = NonNullable<SvcRpt.operations['admin-list-audit-logs']['parameters']['query']>
export type DLQListFilter = NonNullable<SvcRpt.operations['admin-list-dlq']['parameters']['query']>
export type ReportDateRangeFilter = NonNullable<SvcRpt.operations['admin-get-overview-report']['parameters']['query']>
export type AdminSellersReportFilter = NonNullable<SvcRpt.operations['admin-list-sellers-report']['parameters']['query']>

export const adminReportsKeys = {
  all: ['admin-reports'] as const,
  orders: (filter: AdminOrdersFilter) => [...adminReportsKeys.all, 'orders', filter] as const,
  transactions: (filter: AdminTransactionsFilter) => [...adminReportsKeys.all, 'transactions', filter] as const,
  exceptions: (filter: AdminExceptionsFilter) => [...adminReportsKeys.all, 'exceptions', filter] as const,
  params: () => [...adminReportsKeys.all, 'params'] as const,
  auditLogs: (filter: AuditLogsFilter) => [...adminReportsKeys.all, 'audit-logs', filter] as const,
  health: () => [...adminReportsKeys.all, 'system-health'] as const,
  dlq: (filter: DLQListFilter) => [...adminReportsKeys.all, 'system-dlq', filter] as const,
  overview: (filter: ReportDateRangeFilter) => [...adminReportsKeys.all, 'overview', filter] as const,
  sellersReport: (filter: AdminSellersReportFilter) => [...adminReportsKeys.all, 'sellers-report', filter] as const,
  sellerOwn: (filter: ReportDateRangeFilter) => [...adminReportsKeys.all, 'seller-own', filter] as const,
}

export function listAdminOrders(query: AdminOrdersFilter, signal?: AbortSignal) {
  return unwrap(rpt.GET('/v1/admin/orders', { params: { query }, signal }))
}

export function listAdminTransactions(query: AdminTransactionsFilter, signal?: AbortSignal) {
  return unwrap(rpt.GET('/v1/admin/transactions', { params: { query }, signal }))
}

export function listAdminExceptions(query: AdminExceptionsFilter, signal?: AbortSignal) {
  return unwrap(rpt.GET('/v1/admin/exceptions', { params: { query }, signal }))
}

export function listBusinessParams(signal?: AbortSignal) {
  return unwrap(rpt.GET('/v1/admin/config/params', { signal }))
}

export function updateBusinessParam(name: string, body: UpdateBusinessParamInput) {
  return unwrap(rpt.PUT('/v1/admin/config/params/{name}', { params: { path: { name } }, body }))
}

export function listAuditLogs(query: AuditLogsFilter, signal?: AbortSignal) {
  return unwrap(rpt.GET('/v1/admin/audit-logs', { params: { query }, signal }))
}

export function getSystemHealth(signal?: AbortSignal) {
  return unwrap(rpt.GET('/v1/admin/system/health', { signal }))
}

export function listDLQ(query: DLQListFilter, signal?: AbortSignal) {
  return unwrap(rpt.GET('/v1/admin/system/dlq', { params: { query }, signal }))
}

export function replayDLQ(id: string, body: ReplayDLQInput) {
  return unwrap(rpt.POST('/v1/admin/system/dlq/{id}/replay', { params: { path: { id } }, body }))
}

export function getAdminOverviewReport(query: ReportDateRangeFilter, signal?: AbortSignal) {
  return unwrap(rpt.GET('/v1/admin/reports/overview', { params: { query }, signal }))
}

export function listAdminSellersReport(query: AdminSellersReportFilter, signal?: AbortSignal) {
  return unwrap(rpt.GET('/v1/admin/reports/sellers', { params: { query }, signal }))
}

export function getSellerPerformance(query: ReportDateRangeFilter, signal?: AbortSignal) {
  return unwrap(rpt.GET('/v1/seller/reports/performance', { params: { query }, signal }))
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Khoảng ngày mặc định [from, to] tính theo múi giờ hiển thị Asia/Ho_Chi_Minh (BR-GEN-03). */
export function defaultReportDateRange(days = 30): { from: string; to: string } {
  const safeDays = Math.max(1, days)
  const today = dayjs().tz(APP_TIMEZONE)
  return {
    from: today.subtract(safeDays - 1, 'day').format('YYYY-MM-DD'),
    to: today.format('YYYY-MM-DD'),
  }
}

const percentFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** Định dạng tỷ lệ 0..1 sang phần trăm tiếng Việt, VD 0.123 -> "12,3%". */
export function formatPercent(rate: number): string {
  if (!Number.isFinite(rate)) return '0,0%'
  return percentFormatter.format(rate)
}

/** Chuyển số giây sang đơn vị hiển thị gần nhất cho UI tiếng Việt. */
export function splitDuration(seconds: number): { unit: 'seconds' | 'minutes' | 'hours' | 'days'; count: number } {
  const s = Math.max(0, Math.floor(seconds))
  if (s < 60) return { unit: 'seconds', count: s }
  if (s < 3600) return { unit: 'minutes', count: Math.floor(s / 60) }
  if (s < 86_400) return { unit: 'hours', count: Math.floor(s / 3600) }
  return { unit: 'days', count: Math.floor(s / 86_400) }
}
