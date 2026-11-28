import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { defaultReportDateRange, type DailyReportPoint, type PaginationMeta } from './api'

const noopSubscribe = () => () => {}

/** Trả true khi chạy trên trình duyệt có ResizeObserver (tránh cảnh báo Recharts trong SSR / jsdom). */
function useCanRenderChart(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof window !== 'undefined' && typeof ResizeObserver !== 'undefined',
    () => false,
  )
}

export type PaginationBarProps = {
  pagination?: PaginationMeta | null
  onPageChange: (page: number) => void
}

export function PaginationBar({ pagination, onPageChange }: PaginationBarProps) {
  const { t } = useTranslation('adminReports')
  if (!pagination || pagination.totalPages <= 1) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
      <span className="tabular-nums">
        {t('common.pagination.summary', {
          page: pagination.page,
          totalPages: pagination.totalPages,
          total: formatNumber(pagination.totalItems),
        })}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        >
          <ChevronLeft aria-hidden="true" />
          {t('common.pagination.prev')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          {t('common.pagination.next')}
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

export type KpiCardProps = {
  label: string
  value: string
  hint?: ReactNode
  icon?: ReactNode
  tone?: 'default' | 'primary' | 'warning' | 'danger' | 'success'
  footer?: ReactNode
}

const KPI_TONE_CLASSES: Record<NonNullable<KpiCardProps['tone']>, string> = {
  default: 'border-border bg-card',
  primary: 'border-status-info-border bg-status-info/40',
  warning: 'border-status-warning-border bg-status-warning/50',
  danger: 'border-status-danger-border bg-status-danger/50',
  success: 'border-status-success-border bg-status-success/40',
}

export function KpiCard({ label, value, hint, icon, tone = 'default', footer }: KpiCardProps) {
  return (
    <article className={cn('flex flex-col justify-between gap-2 rounded-xl border p-4', KPI_TONE_CLASSES[tone])}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {footer}
    </article>
  )
}

export type DateRangeFilterProps = {
  from: string
  to: string
  onChange: (range: { from: string; to: string }) => void
}

export function DateRangeFilter({ from, to, onChange }: DateRangeFilterProps) {
  const { t } = useTranslation('adminReports')
  const invalid = Boolean(from && to && from > to)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
          {([7, 30, 90] as const).map((days) => {
            const preset = defaultReportDateRange(days)
            const active = from === preset.from && to === preset.to
            return (
              <Button
                key={days}
                type="button"
                size="xs"
                variant={active ? 'default' : 'ghost'}
                onClick={() => onChange(preset)}
              >
                {t(`common.presets.${days}d`)}
              </Button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <label className="flex items-center gap-1 text-muted-foreground">
            <span>{t('common.fromDate')}</span>
            <input
              type="date"
              value={from}
              onChange={(event) => onChange({ from: event.target.value, to })}
              aria-invalid={invalid || undefined}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
            />
          </label>
          <label className="flex items-center gap-1 text-muted-foreground">
            <span>{t('common.toDate')}</span>
            <input
              type="date"
              value={to}
              onChange={(event) => onChange({ from, to: event.target.value })}
              aria-invalid={invalid || undefined}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
            />
          </label>
        </div>
      </div>
      {invalid && <p className="text-xs text-status-danger-foreground">{t('common.invalidDateRange')}</p>}
    </div>
  )
}

function shortDayLabel(isoDate: string): string {
  const parts = isoDate.split('-')
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : isoDate
}

function formatTooltipNum(value: unknown, kind: 'currency' | 'count'): string {
  const num = typeof value === 'number' ? value : Number(value ?? 0)
  return kind === 'currency' ? formatVnd(Number.isFinite(num) ? num : 0) : formatNumber(Number.isFinite(num) ? num : 0)
}

export type DailyTrendChartProps = {
  title: string
  data: readonly DailyReportPoint[]
  variant: 'revenue' | 'orders'
  emptyMessage: string
}

export function DailyTrendChart({ title, data, variant, emptyMessage }: DailyTrendChartProps) {
  const { t } = useTranslation('adminReports')
  const canRenderChart = useCanRenderChart()

  const chartData = data.map((point) => ({
    ...point,
    label: shortDayLabel(point.date),
  }))

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {chartData.length === 0 ? (
        <p className="flex h-[240px] items-center justify-center text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : !canRenderChart ? (
        <div
          aria-label={title}
          className="flex h-[240px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground"
        >
          {t('dashboard.charts.ssrPlaceholder')}
        </div>
      ) : (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} />
              <YAxis
                tick={{ fontSize: 11, fill: '#475569' }}
                width={variant === 'revenue' ? 76 : 44}
                tickFormatter={(v: number) =>
                  variant === 'revenue'
                    ? v >= 1_000_000
                      ? `${(v / 1_000_000).toFixed(1)}M`
                      : formatNumber(v)
                    : formatNumber(v)
                }
              />
              <Tooltip
                formatter={(val) =>
                  formatTooltipNum(val, variant === 'revenue' ? 'currency' : 'count')
                }
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              {variant === 'revenue' ? (
                <>
                  <Bar
                    dataKey="gmvTotal"
                    name={t('dashboard.charts.gmvLabel')}
                    fill="#1d4ed8"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="refundTotal"
                    name={t('dashboard.charts.refundLabel')}
                    stroke="#dc2626"
                    strokeWidth={2}
                    dot={false}
                  />
                </>
              ) : (
                <>
                  <Bar
                    dataKey="ordersCount"
                    name={t('dashboard.charts.ordersLabel')}
                    fill="#047857"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="cancelledCount"
                    name={t('dashboard.charts.cancelledLabel')}
                    stroke="#b45309"
                    strokeWidth={2}
                    dot={false}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

export type JsonDiffViewerProps = {
  beforeState?: Record<string, unknown>
  afterState?: Record<string, unknown>
}

export function JsonDiffViewer({ beforeState, afterState }: JsonDiffViewerProps) {
  const { t } = useTranslation('adminReports')
  const [open, setOpen] = useState(false)
  const hasBefore = beforeState && Object.keys(beforeState).length > 0
  const hasAfter = afterState && Object.keys(afterState).length > 0

  if (!hasBefore && !hasAfter) return null

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        {open ? <ChevronUp aria-hidden="true" className="size-3.5" /> : <ChevronDown aria-hidden="true" className="size-3.5" />}
        {open ? t('auditLogs.hideDiff') : t('auditLogs.toggleDiff')}
      </button>
      {open && (
        <div className="grid gap-2 rounded-md border border-border bg-muted/40 p-2.5 sm:grid-cols-2">
          {hasBefore && (
            <div>
              <p className="mb-1 text-[11px] font-semibold text-muted-foreground uppercase">
                {t('auditLogs.beforeState')}
              </p>
              <pre className="max-h-40 overflow-auto rounded bg-card p-2 font-mono text-[11px] text-foreground">
                {JSON.stringify(beforeState, null, 2)}
              </pre>
            </div>
          )}
          {hasAfter && (
            <div>
              <p className="mb-1 text-[11px] font-semibold text-muted-foreground uppercase">
                {t('auditLogs.afterState')}
              </p>
              <pre className="max-h-40 overflow-auto rounded bg-card p-2 font-mono text-[11px] text-foreground">
                {JSON.stringify(afterState, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
