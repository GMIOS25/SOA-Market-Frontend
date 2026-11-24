import { AlertTriangle, MapPin, Settings, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { ApiError } from '@/api/errors'
import { CopyableId } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { PICKUP_ADDRESS_SETTINGS_PATH } from '../seller-orders-api'

export type PickupAddressAlertProps = {
  /** Lỗi HTTP 422 trả về từ thao tác xác nhận đơn hoặc tạo lại vận đơn. */
  apiError?: ApiError | null
  /** Cảnh báo chủ động khi shop hiện chưa cấu hình địa chỉ lấy hàng. */
  proactiveMissing?: boolean
  onDismissError?: () => void
}

/**
 * Cảnh báo thiếu địa chỉ lấy hàng (FR-ORD-004 E3, §2.3):
 * luôn kèm liên kết điều hướng trực tiếp tới trang cấu hình địa chỉ lấy hàng `/seller/shop`.
 */
export function PickupAddressAlert({
  apiError,
  proactiveMissing = false,
  onDismissError,
}: PickupAddressAlertProps) {
  const { t } = useTranslation('sellerOrders')

  if (apiError) {
    return (
      <div
        role="alert"
        className="flex flex-col gap-3 rounded-lg border border-status-danger-border bg-status-danger p-4 text-sm text-status-danger-foreground shadow-xs sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
            <span className="rounded border border-status-danger-border bg-card px-1.5 py-0.5 font-mono text-xs font-semibold">
              HTTP {apiError.status}
            </span>
            <p className="font-semibold">{t('pickupAlert.error422Title')}</p>
          </div>
          <p>{apiError.message}</p>
          <p className="text-xs opacity-90">{t('pickupAlert.error422Hint')}</p>
          {apiError.correlationId && (
            <p className="flex items-center gap-1 text-xs">
              <span>{t('common.correlationId')}:</span>
              <CopyableId value={apiError.correlationId} label={t('common.correlationId')} />
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm">
            <Link to={PICKUP_ADDRESS_SETTINGS_PATH}>
              <Settings aria-hidden="true" />
              {t('pickupAlert.configureLink')}
            </Link>
          </Button>
          {onDismissError && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onDismissError}
              aria-label={t('shipment.labelDialog.close')}
            >
              <X aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (!proactiveMissing) {
    return null
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-lg border border-status-warning-border bg-status-warning p-4 text-sm text-status-warning-foreground shadow-xs sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2.5">
        <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div className="space-y-0.5">
          <p className="font-semibold">{t('pickupAlert.proactiveTitle')}</p>
          <p className="text-xs">{t('pickupAlert.proactiveDescription')}</p>
        </div>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0 self-start sm:self-auto">
        <Link to={PICKUP_ADDRESS_SETTINGS_PATH}>
          <Settings aria-hidden="true" />
          {t('pickupAlert.configureLink')}
        </Link>
      </Button>
    </div>
  )
}
