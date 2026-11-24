import { Info, Loader2 } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { ApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { BuyerSellerOrderDetailView } from '../api'
import { OrderActionErrorAlert } from './OrderActionErrorAlert'

export type CancelSellerOrderDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sellerOrder: BuyerSellerOrderDetailView | null
  shopName: string
  isPaidOrder: boolean
  onConfirm: (sellerOrderId: string, reason: string) => Promise<void>
  onReloadOrder?: () => void
}

type CancelFormBodyProps = {
  sellerOrder: BuyerSellerOrderDetailView | null
  shopName: string
  isPaidOrder: boolean
  isSubmitting: boolean
  setIsSubmitting: (next: boolean) => void
  onOpenChange: (open: boolean) => void
  onConfirm: (sellerOrderId: string, reason: string) => Promise<void>
  onReloadOrder?: () => void
}

function CancelFormBody({
  sellerOrder,
  shopName,
  isPaidOrder,
  isSubmitting,
  setIsSubmitting,
  onOpenChange,
  onConfirm,
  onReloadOrder,
}: CancelFormBodyProps) {
  const { t } = useTranslation('orders')
  const reasonId = useId()
  const [reason, setReason] = useState('')
  const [submitError, setSubmitError] = useState<ApiError | Error | null>(null)

  const presetReasonsRaw = t('cancelDialog.presetReasons', { returnObjects: true })
  const presetReasons = Array.isArray(presetReasonsRaw) ? (presetReasonsRaw as string[]) : []

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sellerOrder || isSubmitting) return

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await onConfirm(sellerOrder.sellerOrderId, reason.trim())
      onOpenChange(false)
    } catch (err) {
      setSubmitError(err instanceof Error ? err : new Error(t('cancelDialog.errorFallback')))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>
          {t('cancelDialog.title', { code: sellerOrder?.sellerOrderCode ?? '' })}
        </DialogTitle>
        <DialogDescription>
          {t('cancelDialog.description', { shop: shopName })}
        </DialogDescription>
      </DialogHeader>

      {sellerOrder && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-status-info-border bg-status-info px-3 py-2.5 text-xs text-status-info-foreground"
        >
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {isPaidOrder
              ? t('cancelDialog.refundNotice', { amount: formatVnd(sellerOrder.totalAmount) })
              : t('cancelDialog.unpaidNotice')}
          </span>
        </div>
      )}

      {presetReasons.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {presetReasons.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setReason(preset)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                reason === preset
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {preset}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={reasonId}>{t('cancelDialog.reasonLabel')}</Label>
        <Textarea
          id={reasonId}
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('cancelDialog.reasonPlaceholder')}
        />
      </div>

      {submitError && (
        <OrderActionErrorAlert
          error={submitError}
          onReloadOrder={
            onReloadOrder
              ? () => {
                  onOpenChange(false)
                  onReloadOrder()
                }
              : undefined
          }
        />
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={() => onOpenChange(false)}
        >
          {t('cancelDialog.cancel')}
        </Button>
        <Button
          type="submit"
          variant="destructive"
          disabled={isSubmitting || !sellerOrder}
          className={cn(isSubmitting && 'cursor-progress')}
        >
          {isSubmitting && <Loader2 aria-hidden="true" className="animate-spin" />}
          {isSubmitting ? t('cancelDialog.submitting') : t('cancelDialog.confirm')}
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * Modal xác nhận hủy riêng 1 gói `SellerOrder` cho Buyer (FR-ORD-007, BR-ORD-04).
 */
export function CancelSellerOrderDialog({
  open,
  onOpenChange,
  sellerOrder,
  shopName,
  isPaidOrder,
  onConfirm,
  onReloadOrder,
}: CancelSellerOrderDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) {
          onOpenChange(next)
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <CancelFormBody
          key={open ? (sellerOrder?.sellerOrderId ?? 'open') : 'closed'}
          sellerOrder={sellerOrder}
          shopName={shopName}
          isPaidOrder={isPaidOrder}
          isSubmitting={isSubmitting}
          setIsSubmitting={setIsSubmitting}
          onOpenChange={onOpenChange}
          onConfirm={onConfirm}
          onReloadOrder={onReloadOrder}
        />
      </DialogContent>
    </Dialog>
  )
}
