import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/errors'
import { CopyableId } from '@/components/shared'
import { Button } from '@/components/ui/button'

export type ComplaintActionErrorAlertProps = {
  error: ApiError | Error
  onReload?: () => void
}

/**
 * Hiển thị lỗi chuẩn cho các thao tác khiếu nại (422 details, 409 conflict reload, correlationId).
 */
export function ComplaintActionErrorAlert({ error, onReload }: ComplaintActionErrorAlertProps) {
  const { t } = useTranslation('complaints')
  const details = error instanceof ApiError ? error.details : []

  return (
    <div
      role="alert"
      className="space-y-2 rounded-md border border-status-danger-border bg-status-danger p-3 text-xs text-status-danger-foreground"
    >
      <p className="flex items-start gap-2 font-medium">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>{error.message}</span>
      </p>
      {details.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-6">
          {details.map((detail, idx) => (
            <li key={`${detail.field}-${idx}`}>
              <span className="font-mono font-medium">{detail.field}</span>: {detail.reason}
            </li>
          ))}
        </ul>
      )}
      {error instanceof ApiError && error.correlationId && (
        <p className="flex items-center gap-1">
          <span>{t('common.correlationId')}:</span>
          <CopyableId value={error.correlationId} label={t('common.correlationId')} />
        </p>
      )}
      {error instanceof ApiError && error.status === 409 && onReload && (
        <Button type="button" variant="outline" size="xs" onClick={onReload}>
          {t('common.conflictReload')}
        </Button>
      )}
    </div>
  )
}
