import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AuditReasonDialog, CopyableId } from '@/components/shared'
import { Label } from '@/components/ui/label'
import { formatVnd } from '@/lib/format'
import { compactId, type AdminRefund, type MarkManualSuccessPayload } from './admin-exceptions-api'

type ManualRefundDialogProps = {
  refund: AdminRefund
  submitting: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (refundId: string, payload: MarkManualSuccessPayload) => Promise<void>
}

export function ManualRefundDialog({ refund, submitting, onOpenChange, onSubmit }: ManualRefundDialogProps) {
  const { t } = useTranslation('adminExceptions')
  const fieldId = useId()
  const [bankRef, setBankRef] = useState('')
  const [confirmReconciled, setConfirmReconciled] = useState(false)
  const bankTransactionRef = bankRef.trim()
  const bankRefValid = bankTransactionRef.length >= 3 && bankTransactionRef.length <= 128
  const showBankRefError = bankRef.length > 0 && !bankRefValid

  return (
    <AuditReasonDialog
      open
      onOpenChange={onOpenChange}
      title={t('manualDialog.title')}
      description={t('manualDialog.description')}
      confirmLabel={t('manualDialog.confirm')}
      confirmDisabled={!bankRefValid || (refund.needsReconciliation && !confirmReconciled)}
      onConfirm={(reason) =>
        onSubmit(refund.refundId, {
          bankTransactionRef,
          reason,
          ...(refund.needsReconciliation ? { confirmReconciled } : {}),
        })
      }
    >
      <dl
        aria-label={t('manualDialog.refundSummaryLabel')}
        className="space-y-1.5 rounded-lg bg-primary-soft p-3.5 text-xs tabular-nums"
      >
        <div className="flex items-center justify-between gap-2">
          <dt>{t('manualDialog.refundId')}</dt>
          <dd><CopyableId value={refund.refundId} display={compactId(refund.refundId)} label={t('manualDialog.refundId')} /></dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt>{t('manualDialog.orderId')}</dt>
          <dd><CopyableId value={refund.orderId} display={compactId(refund.orderId)} label={t('manualDialog.orderId')} /></dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt>{t('manualDialog.source')}</dt>
          <dd>{t(`exceptions.sources.${refund.source}` as never, { defaultValue: refund.source })}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt>{t('manualDialog.amount')}</dt>
          <dd className="text-sm font-bold text-price">{formatVnd(refund.amount)}</dd>
        </div>
      </dl>

      <fieldset disabled={submitting} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={fieldId}>{t('manualDialog.bankRefLabel')}</Label>
          <input
            id={fieldId}
            type="text"
            value={bankRef}
            onChange={(event) => setBankRef(event.target.value)}
            placeholder={t('manualDialog.bankRefPlaceholder')}
            maxLength={128}
            aria-required="true"
            aria-invalid={showBankRefError || undefined}
            aria-describedby={showBankRefError ? `${fieldId}-error` : undefined}
            className="h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          />
          {showBankRefError && (
            <p id={`${fieldId}-error`} className="text-xs text-status-danger-foreground">
              {t('manualDialog.bankRefLength')}
            </p>
          )}
        </div>

        {refund.needsReconciliation && (
          <label className="flex items-start gap-2.5 rounded-md border border-status-warning-border bg-status-warning p-3 text-xs text-status-warning-foreground">
            <input
              type="checkbox"
              checked={confirmReconciled}
              onChange={(event) => setConfirmReconciled(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span>{t('manualDialog.reconciledCheckbox')}</span>
          </label>
        )}
      </fieldset>
    </AuditReasonDialog>
  )
}
