import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/errors'
import { CopyableId } from '@/components/shared'
import { Button } from '@/components/ui/button'

export type OrderActionErrorAlertProps = {
  error: ApiError | Error
  onReloadOrder?: () => void
}

/**
 * Hiển thị lỗi chuẩn cho modal/thao tác đơn hàng, kèm `correlationId` và nút tải lại khi gặp xung đột 409.
 */
export function OrderActionErrorAlert({ error, onReloadOrder }: OrderActionErrorAlertProps) {
  const { t } = useTranslation('orders')

  return (
    <div
      role="alert"
      className="space-y-2 rounded-md border border-status-danger-border bg-status-danger p-3 text-xs text-status-danger-foreground"
    >
      <p className="flex items-start gap-2 font-medium">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>{error.message}</span>
      </p>
      {error instanceof ApiError && error.correlationId && (
        <p className="flex items-center gap-1">
          {t('detail.actions.correlationId')}:
          <CopyableId value={error.correlationId} label={t('detail.actions.correlationId')} />
        </p>
      )}
      {error instanceof ApiError && error.status === 409 && onReloadOrder && (
        <Button type="button" variant="outline" size="xs" onClick={onReloadOrder}>
          {t('detail.actions.conflictReload')}
        </Button>
      )}
    </div>
  )
}
