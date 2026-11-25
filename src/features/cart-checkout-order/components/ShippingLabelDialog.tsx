import { ExternalLink, Printer } from 'lucide-react'
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
import { formatDateTime } from '@/lib/format'
import type { AddressSnapshot } from '../api'
import type { ShipmentLabelResult } from '../seller-orders-api'

export type ShippingLabelDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  label: ShipmentLabelResult | null
  sellerOrderCode: string
  carrier?: string | null
  trackingCode?: string | null
  deliveryAddress: AddressSnapshot
  onOpenExternal?: (url: string) => void
}

/** Modal xem trước & mở in nhãn vận chuyển từ `GET /v1/shipments/{id}/label`. */
export function ShippingLabelDialog({
  open,
  onOpenChange,
  label,
  sellerOrderCode,
  carrier,
  trackingCode,
  deliveryAddress,
  onOpenExternal,
}: ShippingLabelDialogProps) {
  const { t } = useTranslation('sellerOrders')
  const resolvedTracking = label?.trackingCode || trackingCode || undefined
  const formattedAddress = [
    deliveryAddress.line,
    deliveryAddress.ward,
    deliveryAddress.district,
    deliveryAddress.province,
  ]
    .filter(Boolean)
    .join(', ')

  function handleOpenPrint() {
    if (!label?.labelUrl) return
    if (onOpenExternal) {
      onOpenExternal(label.labelUrl)
      return
    }
    window.open?.(label.labelUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer aria-hidden="true" className="size-5 text-primary" />
            <span>{t('shipment.labelDialog.title', { code: sellerOrderCode })}</span>
          </DialogTitle>
          <DialogDescription>{t('shipment.labelDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border border-border bg-background p-4 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            {carrier && (
              <>
                <dt className="text-muted-foreground">{t('shipment.labelDialog.carrier')}</dt>
                <dd className="font-medium text-foreground">{carrier}</dd>
              </>
            )}
            {resolvedTracking && (
              <>
                <dt className="text-muted-foreground">{t('shipment.labelDialog.trackingCode')}</dt>
                <dd>
                  <CopyableId value={resolvedTracking} label={t('common.trackingCodeLabel')} />
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">{t('shipment.labelDialog.recipient')}</dt>
            <dd className="font-medium text-foreground">
              {deliveryAddress.contactName} · <span className="font-mono text-xs">{deliveryAddress.phone}</span>
            </dd>
            <dt className="text-muted-foreground">{t('shipment.labelDialog.destination')}</dt>
            <dd className="text-muted-foreground">{formattedAddress}</dd>
          </dl>

          {label?.expiresAt && (
            <p className="text-xs text-muted-foreground">
              {t('shipment.labelDialog.expiresAt', { datetime: formatDateTime(label.expiresAt) })}
            </p>
          )}

          {!label?.labelUrl && (
            <p className="text-xs text-muted-foreground">{t('shipment.labelDialog.noUrlHint')}</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('shipment.labelDialog.close')}
          </Button>
          {label?.labelUrl &&
            (onOpenExternal ? (
              <Button type="button" onClick={handleOpenPrint}>
                <ExternalLink aria-hidden="true" />
                {t('shipment.labelDialog.openPrint')}
              </Button>
            ) : (
              <Button asChild>
                <a href={label.labelUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden="true" />
                  {t('shipment.labelDialog.openPrint')}
                </a>
              </Button>
            ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
