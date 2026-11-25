import { TriangleAlert } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/errors'
import { AuditReasonDialog, CopyableId } from '@/components/shared'
import { Label } from '@/components/ui/label'
import { formatVnd } from '@/lib/format'
import { markRefundManualSuccess, type Refund } from './api'

const BANK_REF_MIN = 3
const BANK_REF_MAX = 128

export type ManualRefundDialogProps = {
  refund: Refund | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (updated: Refund) => void
}

/**
 * Modal "Xác nhận đã hoàn tiền thủ công" (OQ-07, FR-PAY-005):
 * tái sử dụng `<AuditReasonDialog />` để bắt buộc `reason` + ghi Nhật ký kiểm toán,
 * kèm trường `bankTransactionRef` và checkbox `confirmReconciled` khi cổng chưa xác định kết quả.
 */
export function ManualRefundDialog({ refund, open, onOpenChange, onSuccess }: ManualRefundDialogProps) {
  const { t } = useTranslation('paymentShipping')
  const bankRefId = useId()
  const confirmReconcileId = useId()

  const [bankTransactionRef, setBankTransactionRef] = useState('')
  const [bankRefTouched, setBankRefTouched] = useState(false)
  const [bankRefServerError, setBankRefServerError] = useState<string | null>(null)
  const [confirmReconciled, setConfirmReconciled] = useState(false)
  const [serverRequiredReconcile, setServerRequiredReconcile] = useState(false)

  const trimmedBankRef = bankTransactionRef.trim()
  const bankRefValid = trimmedBankRef.length >= BANK_REF_MIN && trimmedBankRef.length <= BANK_REF_MAX
  const requiresReconcileAck = Boolean(refund?.needsReconciliation) || serverRequiredReconcile

  const clientBankRefError =
    bankRefTouched && !bankRefValid ? t('exceptions.manualModal.bankRefTooShort') : null
  const displayedBankRefError = bankRefServerError ?? clientBankRefError

  function handleOpenChange(next: boolean) {
    if (!next) {
      setBankTransactionRef('')
      setBankRefTouched(false)
      setBankRefServerError(null)
      setConfirmReconciled(false)
      setServerRequiredReconcile(false)
    }
    onOpenChange(next)
  }

  async function handleConfirm(reason: string) {
    if (!refund) return
    setBankRefTouched(true)
    setBankRefServerError(null)
    if (!bankRefValid) return

    try {
      const updated = await markRefundManualSuccess(refund.refundId, {
        bankTransactionRef: trimmedBankRef,
        reason,
        ...(requiresReconcileAck || confirmReconciled ? { confirmReconciled } : {}),
      })
      onSuccess(updated)
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'REFUND_RECONCILIATION_REQUIRED') {
          setServerRequiredReconcile(true)
        }
        const fieldMsg = error.fieldError('bankTransactionRef')
        if (fieldMsg) setBankRefServerError(fieldMsg)
      }
      throw error
    }
  }

  return (
    <AuditReasonDialog
      open={open && Boolean(refund)}
      onOpenChange={handleOpenChange}
      title={t('exceptions.manualModal.title')}
      description={
        refund ? (
          <div className="space-y-1.5 text-sm">
            <p>
              {t('exceptions.manualModal.description', {
                refundId: refund.refundId,
                amount: formatVnd(refund.amount),
              })}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                {t('exceptions.refunds.orderId')}: <CopyableId value={refund.orderId} label={t('exceptions.refunds.orderId')} />
              </span>
              <span className="inline-flex items-center gap-1">
                {t('exceptions.refunds.sellerOrderId')}: <CopyableId value={refund.sellerOrderId} label={t('exceptions.refunds.sellerOrderId')} />
              </span>
            </div>
            {refund.lastErrorMessage && (
              <p className="rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                {t('exceptions.refunds.errorDetail')}: {refund.lastErrorMessage}
              </p>
            )}
          </div>
        ) : undefined
      }
      confirmLabel={t('exceptions.manualModal.submit')}
      confirmDisabled={!bankRefValid || (requiresReconcileAck && !confirmReconciled)}
      onConfirm={handleConfirm}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={bankRefId}>
            {t('exceptions.manualModal.bankRefLabel')}{' '}
            <span aria-hidden="true" className="text-status-danger-foreground">*</span>
          </Label>
          <input
            id={bankRefId}
            type="text"
            value={bankTransactionRef}
            maxLength={BANK_REF_MAX}
            placeholder={t('exceptions.manualModal.bankRefPlaceholder')}
            aria-required="true"
            aria-invalid={displayedBankRefError ? true : undefined}
            onBlur={() => setBankRefTouched(true)}
            onChange={(event) => {
              setBankTransactionRef(event.target.value)
              if (bankRefServerError) setBankRefServerError(null)
            }}
            className="h-10 w-full rounded-md border border-input bg-background px-3 font-mono text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
          {displayedBankRefError ? (
            <p className="text-xs text-status-danger-foreground">{displayedBankRefError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{t('exceptions.manualModal.bankRefHint')}</p>
          )}
        </div>

        {requiresReconcileAck && (
          <div className="space-y-2 rounded-lg border border-status-warning-border bg-status-warning p-3 text-xs text-status-warning-foreground">
            <p className="flex items-start gap-2 font-medium">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{t('exceptions.manualModal.reconcileWarning')}</span>
            </p>
            <label htmlFor={confirmReconcileId} className="flex cursor-pointer items-start gap-2 text-foreground">
              <input
                id={confirmReconcileId}
                type="checkbox"
                checked={confirmReconciled}
                onChange={(event) => setConfirmReconciled(event.target.checked)}
                className="mt-0.5 size-4 rounded border-input accent-primary"
              />
              <span>{t('exceptions.manualModal.confirmReconciledLabel')}</span>
            </label>
          </div>
        )}
      </div>
    </AuditReasonDialog>
  )
}
