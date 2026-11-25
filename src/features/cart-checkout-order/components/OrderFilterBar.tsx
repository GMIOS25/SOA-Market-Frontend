import { Calendar, FilterX } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { DisclosurePanel } from '@/components/ui/disclosure-panel'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  ORDER_STATUS_FILTER_VALUES,
  TIME_PRESET_VALUES,
  type OrderStatusFilter,
  type OrderTimePreset,
} from '../order-helpers'

export type OrderFilterBarProps = {
  status: OrderStatusFilter
  timePreset: OrderTimePreset
  customFrom: string
  customTo: string
  invalidDateRange: boolean
  onStatusChange: (status: OrderStatusFilter) => void
  onTimePresetChange: (preset: OrderTimePreset) => void
  onCustomDateChange: (field: 'from' | 'to', value: string) => void
  onClearFilters: () => void
}

/**
 * Bộ lọc trạng thái và khoảng thời gian cho `/account/orders` (FR-ORD-009, responsive 360px–1920px).
 */
export function OrderFilterBar({
  status,
  timePreset,
  customFrom,
  customTo,
  invalidDateRange,
  onStatusChange,
  onTimePresetChange,
  onCustomDateChange,
  onClearFilters,
}: OrderFilterBarProps) {
  const { t } = useTranslation('orders')
  const baseId = useId()
  const hasActiveFilter = status !== 'ALL' || timePreset !== 'ALL' || Boolean(customFrom) || Boolean(customTo)

  return (
    <section
      aria-label={t('list.statusLabel')}
      className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label={t('list.statusLabel')} className="flex max-w-full min-w-0 gap-1.5 overflow-x-auto p-1 [scrollbar-width:thin] sm:flex-wrap">
          {ORDER_STATUS_FILTER_VALUES.map((item) => {
            const active = status === item
            return (
              <button
                key={item}
                type="button"
                aria-pressed={active}
                onClick={() => onStatusChange(item)}
                className={cn(
                  'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                  active
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-border bg-card text-foreground hover:bg-muted',
                )}
              >
                {t(`list.statuses.${item}`)}
              </button>
            )
          })}
        </div>

        {hasActiveFilter && (
          <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
            <FilterX aria-hidden="true" />
            {t('list.clearFilters')}
          </Button>
        )}
      </div>

      <DisclosurePanel
        title={t('list.timeLabel')}
        summary={timePreset === 'ALL' ? undefined : t(`list.timePresets.${timePreset}`)}
        initiallyOpen={timePreset !== 'ALL'}
        icon={<Calendar />}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('list.timeLabel')}>
            {TIME_PRESET_VALUES.map((preset) => {
              const active = timePreset === preset
              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onTimePresetChange(preset)}
                  className={cn(
                    'inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    active
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-input bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {t(`list.timePresets.${preset}`)}
                </button>
              )
            })}
          </div>

          {timePreset === 'CUSTOM' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Label htmlFor={`${baseId}-from`} className="text-xs text-muted-foreground">
                  {t('list.fromDate')}
                </Label>
                <input
                  id={`${baseId}-from`}
                  type="date"
                  value={customFrom}
                  aria-invalid={invalidDateRange ? true : undefined}
                  onChange={(e) => onCustomDateChange('from', e.target.value)}
                  className="h-9 rounded-md border border-input bg-card px-2.5 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-invalid:border-destructive"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <Label htmlFor={`${baseId}-to`} className="text-xs text-muted-foreground">
                  {t('list.toDate')}
                </Label>
                <input
                  id={`${baseId}-to`}
                  type="date"
                  value={customTo}
                  aria-invalid={invalidDateRange ? true : undefined}
                  onChange={(e) => onCustomDateChange('to', e.target.value)}
                  className="h-9 rounded-md border border-input bg-card px-2.5 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-invalid:border-destructive"
                />
              </div>
            </div>
          )}
        </div>
      </DisclosurePanel>

      {invalidDateRange && (
        <p role="alert" className="text-xs font-medium text-status-danger-foreground">
          {t('list.invalidDateRange')}
        </p>
      )}
    </section>
  )
}
