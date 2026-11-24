import { AlertTriangle, ImageOff, PackageX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CopyableId } from '@/components/shared'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ConflictItemDisplay } from '../api'

export type InsufficientStockDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  message: string
  items: ConflictItemDisplay[]
  correlationId?: string
  onBackToCart: () => void
  onRefreshSummary?: () => void
}

/**
 * Modal liệt kê chính xác các sản phẩm thiếu tồn kho / thay đổi giá / shop ngừng bán
 * khi Checkout Saga thất bại theo nguyên tắc all-or-nothing (03-App-Flow §4.2 bước 2).
 */
export function InsufficientStockDialog({
  open,
  onOpenChange,
  title,
  message,
  items,
  correlationId,
  onBackToCart,
  onRefreshSummary,
}: InsufficientStockDialogProps) {
  const { t } = useTranslation('checkout')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-status-danger-foreground">
            <PackageX aria-hidden="true" className="size-5 shrink-0" />
            <span>{title ?? t('checkout.stockModal.title')}</span>
          </DialogTitle>
          <DialogDescription>{t('checkout.stockModal.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-status-danger-border bg-status-danger px-3 py-2 text-sm font-medium text-status-danger-foreground"
          >
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{message}</span>
          </p>

          {items.length > 0 && (
            <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border bg-card">
              {items.map((item) => (
                <li key={item.key} className="flex items-start gap-3 p-3">
                  <div className="size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    {item.imageRef ? (
                      <img src={item.imageRef} alt={item.productName} className="size-full object-cover" />
                    ) : (
                      <ImageOff aria-hidden="true" className="size-full p-3 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-medium text-foreground">{item.productName}</p>
                    {(item.variantLabel || item.shopName) && (
                      <p className="text-xs text-muted-foreground">
                        {[item.variantLabel, item.shopName].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {item.requestedQuantity !== undefined && (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {t('checkout.stockModal.requestedQty', { count: item.requestedQuantity })}
                      </p>
                    )}
                    <p className="text-xs font-medium text-status-danger-foreground">{item.reason}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {correlationId && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {t('checkout.stockModal.correlationId')}:
              <CopyableId value={correlationId} label={t('checkout.stockModal.correlationId')} />
            </p>
          )}
        </div>

        <DialogFooter className="pt-2">
          {onRefreshSummary && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                onRefreshSummary()
              }}
            >
              {t('checkout.stockModal.refreshSummary')}
            </Button>
          )}
          <Button
            type="button"
            variant="cta"
            onClick={() => {
              onOpenChange(false)
              onBackToCart()
            }}
          >
            {t('checkout.stockModal.backToCart')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
