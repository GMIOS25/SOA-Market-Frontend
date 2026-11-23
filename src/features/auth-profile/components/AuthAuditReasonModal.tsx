import { useEffect, useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, X } from 'lucide-react'

type AuthAuditReasonModalProps = {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  destructive?: boolean
  loading?: boolean
  errorMessage?: string | null
  children?: ReactNode
  onClose: () => void
  onConfirm: (reason: string) => void | Promise<void>
}

const MIN_REASON_LENGTH = 10

export function AuthAuditReasonModal(props: AuthAuditReasonModalProps) {
  if (!props.open) return null
  return <AuthAuditReasonModalContent {...props} />
}

function AuthAuditReasonModalContent({
  title,
  description,
  confirmLabel,
  destructive = false,
  loading = false,
  errorMessage,
  children,
  onClose,
  onConfirm,
}: AuthAuditReasonModalProps) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const titleId = useId()
  const reasonId = useId()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [loading, onClose])

  const trimmedLen = reason.trim().length
  const isReasonValid = trimmedLen >= MIN_REASON_LENGTH

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-foreground">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          <button
            type="button"
            aria-label="Đóng hộp thoại"
            disabled={loading}
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-md border border-status-warning-border bg-status-warning p-3 text-xs text-status-warning-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{t('authProfile.auditDialog.notice')}</span>
        </div>

        {children && <div className="mt-4">{children}</div>}

        <div className="mt-4">
          <label htmlFor={reasonId} className="block text-sm font-medium text-foreground">
            {t('authProfile.auditDialog.reasonLabel')}
          </label>
          <textarea
            id={reasonId}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('authProfile.auditDialog.reasonPlaceholder')}
            aria-invalid={trimmedLen > 0 && !isReasonValid}
            className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {trimmedLen < MIN_REASON_LENGTH
                ? `Cần thêm ${MIN_REASON_LENGTH - trimmedLen} ký tự`
                : 'Lý do hợp lệ'}
            </span>
            <span className="font-mono">{trimmedLen} ký tự</span>
          </div>
        </div>

        {errorMessage && (
          <p
            role="alert"
            className="mt-3 rounded-md border border-status-danger-border bg-status-danger px-3 py-2 text-xs text-status-danger-foreground"
          >
            {errorMessage}
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-card px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('authProfile.auditDialog.cancel')}
          </button>
          <button
            type="button"
            disabled={!isReasonValid || loading}
            onClick={() => void onConfirm(reason.trim())}
            className={[
              'inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
              destructive ? 'bg-destructive hover:opacity-90' : 'bg-primary hover:bg-primary-hover',
            ].join(' ')}
          >
            {loading ? 'Đang xử lý...' : (confirmLabel ?? t('authProfile.auditDialog.confirm'))}
          </button>
        </div>
      </div>
    </div>
  )
}
