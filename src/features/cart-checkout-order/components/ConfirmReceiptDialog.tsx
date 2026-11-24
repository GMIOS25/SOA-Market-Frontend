import { CheckCircle2, Loader2 } from 'lucide-react'
import { useState } from 'react'
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
import { cn } from '@/lib/utils'
import type { BuyerSellerOrderDetailView } from '../api'
import { OrderActionErrorAlert } from './OrderActionErrorAlert'

export type ConfirmReceiptDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sellerOrder: BuyerSellerOrderDetailView | null
  shopName: string
  onConfirm: (sellerOrderId: string) => Promise<void>
  onReloadOrder?: () => void
}

type ReceiptBodyProps = {
  sellerOrder: BuyerSellerOrderDetailView | null
  shopName: string
  isSubmitting: boolean
  setIsSubmitting: (next: boolean) => void
  onOpenChange: (open: boolean) => void
  onConfirm: (sellerOrderId: string) => Promise<void>
  onReloadOrder?: () => void
}

function ConfirmReceiptBody({
  sellerOrder,
  shopName,
  isSubmitting,
  setIsSubmitting,
  onOpenChange,
  onConfirm,
  onReloadOrder,
}: ReceiptBodyProps) {
  const { t } = useTranslation('orders')
  const [submitError, setSubmitError] = useState<ApiError | Error | null>(null)

  async function handleConfirm() {
    if (!sellerOrder || isSubmitting) return

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await onConfirm(sellerOrder.sellerOrderId)
      onOpenChange(false)
    } catch (err) {
      setSubmitError(err instanceof Error ? err : new Error(t('receiptDialog.errorFallback')))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle2 aria-hidden="true" className="size-5 text-primary" />
          <span>{t('receiptDialog.title')}</span>
        </DialogTitle>
        <DialogDescription>
          {t('receiptDialog.description', {
            code: sellerOrder?.sellerOrderCode ?? '',
            shop: shopName,
          })}
        </DialogDescription>
      </DialogHeader>

      <p className="rounded-md border border-border bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
        {t('receiptDialog.consequenceNotice')}
      </p>

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
          {t('receiptDialog.cancel')}
        </Button>
        <Button
          type="button"
          variant="cta"
          disabled={isSubmitting || !sellerOrder}
          onClick={() => void handleConfirm()}
          className={cn(isSubmitting && 'cursor-progress')}
        >
          {isSubmitting && <Loader2 aria-hidden="true" className="animate-spin" />}
          {isSubmitting ? t('receiptDialog.submitting') : t('receiptDialog.confirm')}
        </Button>
      </DialogFooter>
    </>
  )
}

/**
 * Modal xác nhận Buyer đã nhận được hàng cho 1 `SellerOrder` (FR-ORD-010).
 */
export function ConfirmReceiptDialog({
  open,
  onOpenChange,
  sellerOrder,
  shopName,
  onConfirm,
  onReloadOrder,
}: ConfirmReceiptDialogProps) {
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
      <DialogContent className="sm:max-w-md">
        <ConfirmReceiptBody
          key={open ? (sellerOrder?.sellerOrderId ?? 'open') : 'closed'}
          sellerOrder={sellerOrder}
          shopName={shopName}
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
