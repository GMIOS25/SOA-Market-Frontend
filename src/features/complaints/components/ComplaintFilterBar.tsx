import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { DisclosurePanel } from '@/components/ui/disclosure-panel'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  COMPLAINT_STATUS_FILTERS,
  COMPLAINT_TYPES,
  type ComplaintStatusFilter,
  type ComplaintType,
} from '../helpers'

export type ComplaintFilterBarProps = {
  status: ComplaintStatusFilter
  type: ComplaintType | ''
  fromDate: string
  toDate: string
  overdueOnly?: boolean
  showOverdueFilter?: boolean
  invalidDateRange: boolean
  onStatusChange: (status: ComplaintStatusFilter) => void
  onTypeChange: (type: ComplaintType | '') => void
  onFromDateChange: (value: string) => void
  onToDateChange: (value: string) => void
  onOverdueChange?: (overdue: boolean) => void
  onClearFilters: () => void
}

/**
 * Thanh lọc khiếu nại dùng chung cho cả Buyer (/account/complaints) và Seller (/seller/complaints).
 */
export function ComplaintFilterBar({
  status,
  type,
  fromDate,
  toDate,
  overdueOnly = false,
  showOverdueFilter = false,
  invalidDateRange,
  onStatusChange,
  onTypeChange,
  onFromDateChange,
  onToDateChange,
  onOverdueChange,
  onClearFilters,
}: ComplaintFilterBarProps) {
  const { t } = useTranslation('complaints')

  const hasActiveFilters =
    status !== 'ALL' || Boolean(type) || Boolean(fromDate) || Boolean(toDate) || overdueOnly

  return (
    <section
      aria-label={t('filters.statusLabel')}
      className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      <div
        role="group"
        aria-label={t('filters.statusLabel')}
        className="flex gap-1.5 overflow-x-auto p-1 [scrollbar-width:thin] sm:flex-wrap"
      >
        {COMPLAINT_STATUS_FILTERS.map((item) => {
          const active = status === item
          return (
            <button
              key={item}
              type="button"
              aria-pressed={active}
              onClick={() => onStatusChange(item)}
              className={cn(
                'inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                active
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`filters.statuses.${item}`)}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 space-y-1">
          <Label htmlFor="complaint-type-filter" className="text-xs">
            {t('filters.typeLabel')}
          </Label>
          <select
            id="complaint-type-filter"
            value={type}
            onChange={(event) => onTypeChange(event.target.value as ComplaintType | '')}
            className="block h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t('filters.allTypes')}</option>
            {COMPLAINT_TYPES.map((cplType) => (
              <option key={cplType} value={cplType}>
                {t(`types.${cplType}`)}
              </option>
            ))}
          </select>
        </div>

        {showOverdueFilter && onOverdueChange && (
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(event) => onOverdueChange(event.target.checked)}
              className="size-4 accent-primary"
            />
            <span>{t('filters.overdueOnly')}</span>
          </label>
        )}

        <DisclosurePanel
          title={t('filters.dateRange')}
          summary={fromDate || toDate ? t('filters.dateRangeActive') : undefined}
          initiallyOpen={Boolean(fromDate || toDate)}
          className="min-w-60 flex-1"
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="complaints-from-date" className="text-xs">
                {t('filters.fromDate')}
              </Label>
              <input
                id="complaints-from-date"
                type="date"
                value={fromDate}
                onChange={(event) => onFromDateChange(event.target.value)}
                className="block h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="complaints-to-date" className="text-xs">
                {t('filters.toDate')}
              </Label>
              <input
                id="complaints-to-date"
                type="date"
                value={toDate}
                onChange={(event) => onToDateChange(event.target.value)}
                className="block h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        </DisclosurePanel>

        {hasActiveFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
            {t('filters.clearFilters')}
          </Button>
        )}
      </div>

      {invalidDateRange && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-md border border-status-danger-border bg-status-danger px-3 py-2 text-xs font-medium text-status-danger-foreground"
        >
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
          <span>{t('filters.invalidDateRange')}</span>
        </p>
      )}
    </section>
  )
}
