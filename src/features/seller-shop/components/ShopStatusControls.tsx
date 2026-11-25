import { CircleCheck, Loader2, LockKeyhole, PauseCircle, PlayCircle, TriangleAlert } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/errors'
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
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import { apiResumeMyShop, apiSuspendMyShop, type ShopDTO } from '../api'
import { MAX_NOTE_LENGTH } from '../schemas'

type ShopStatusControlsProps = {
  shop: ShopDTO
  onUpdated: (shop: ShopDTO) => void
}

/** Khối tự tạm ngưng / mở lại gian hàng của Nhà bán (`FR-SEL-004`). */
export function ShopStatusControls({ shop, onUpdated }: ShopStatusControlsProps) {
  const { t } = useTranslation('sellerShop')
  const [suspendOpen, setSuspendOpen] = useState(false)
  const [resuming, setResuming] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<ApiError | Error | null>(null)

  const canSuspend = shop.status === 'ACTIVE'
  const canSellerResume = shop.status === 'SUSPENDED' && shop.statusChangedBy === 'SELLER'
  const suspendedByAdmin = shop.status === 'SUSPENDED' && shop.statusChangedBy !== 'SELLER'
  const locked = shop.status === 'LOCKED'

  async function handleResume() {
    setResuming(true)
    setActionError(null)
    setNotice(null)
    try {
      const updated = await apiResumeMyShop()
      onUpdated(updated)
      setNotice(t('sellerShop.status.resumedSuccess'))
    } catch (error) {
      setActionError(error instanceof Error ? error : new Error(String(error)))
    } finally {
      setResuming(false)
    }
  }

  return (
    <section
      aria-labelledby="shop-status-heading"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-xs"
    >
      <header className="flex flex-col gap-1 border-b border-border pb-3">
        <h2 id="shop-status-heading" className="text-lg font-semibold">
          {t('sellerShop.status.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('sellerShop.status.description')}</p>
      </header>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">{t('sellerShop.status.currentStatus')}</dt>
          <dd>
            <StatusBadge status={shop.status} />
          </dd>
        </div>
        {shop.statusChangedBy && (
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">{t('sellerShop.status.changedByLabel')}</dt>
            <dd className="font-medium">{t(`sellerShop.status.changedBy.${shop.statusChangedBy}`)}</dd>
          </div>
        )}
      </dl>

      {shop.statusReason && (
        <div className="rounded-md border border-border bg-background p-3 text-sm">
          <p className="font-medium">{t('sellerShop.status.reasonLabel')}</p>
          <p className="mt-1 whitespace-pre-line text-muted-foreground">{shop.statusReason}</p>
        </div>
      )}

      {locked && (
        <p className="flex items-center gap-2 rounded-md border border-status-danger-border bg-status-danger px-3 py-2 text-xs text-status-danger-foreground">
          <LockKeyhole aria-hidden="true" className="size-4 shrink-0" />
          {t('sellerShop.status.lockedNotice')}
        </p>
      )}

      {suspendedByAdmin && (
        <p className="flex items-center gap-2 rounded-md border border-status-warning-border bg-status-warning px-3 py-2 text-xs text-status-warning-foreground">
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
          {t('sellerShop.status.adminSuspendedNotice')}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md border border-status-success-border bg-status-success px-3 py-2 text-sm text-status-success-foreground"
        >
          <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
          {notice}
        </p>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-md border border-status-danger-border bg-status-danger p-3 text-sm text-status-danger-foreground"
        >
          <p className="flex items-start gap-2 font-medium">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {actionError.message}
          </p>
          {actionError instanceof ApiError && actionError.correlationId && (
            <p className="flex items-center gap-1 text-xs">
              X-Correlation-Id: <CopyableId value={actionError.correlationId} label="X-Correlation-Id" />
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {canSuspend && (
          <Button
            type="button"
            variant="destructive-outline"
            onClick={() => {
              setNotice(null)
              setActionError(null)
              setSuspendOpen(true)
            }}
          >
            <PauseCircle aria-hidden="true" />
            {t('sellerShop.status.suspend')}
          </Button>
        )}
        {shop.status === 'SUSPENDED' && (
          <Button
            type="button"
            disabled={!canSellerResume || resuming}
            onClick={() => void handleResume()}
          >
            {resuming ? <Loader2 aria-hidden="true" className="animate-spin" /> : <PlayCircle aria-hidden="true" />}
            {resuming ? t('sellerShop.status.resuming') : t('sellerShop.status.resume')}
          </Button>
        )}
      </div>

      <SuspendShopDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        shopName={shop.name}
        onConfirm={async (reason) => {
          const updated = await apiSuspendMyShop(reason)
          onUpdated(updated)
          setNotice(t('sellerShop.status.suspendedSuccess'))
        }}
      />
    </section>
  )
}

type SuspendShopDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  shopName: string
  onConfirm: (reason: string) => Promise<void>
}

function SuspendShopDialog({ open, onOpenChange, ...props }: SuspendShopDialogProps) {
  const [submitting, setSubmitting] = useState(false)
  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <SuspendShopDialogBody
          {...props}
          onOpenChange={onOpenChange}
          submitting={submitting}
          setSubmitting={setSubmitting}
        />
      </DialogContent>
    </Dialog>
  )
}

function SuspendShopDialogBody({
  onOpenChange,
  shopName,
  onConfirm,
  submitting,
  setSubmitting,
}: Omit<SuspendShopDialogProps, 'open'> & { submitting: boolean; setSubmitting: (value: boolean) => void }) {
  const { t } = useTranslation('sellerShop')
  const reasonId = useId()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<Error | null>(null)
  const tooLong = reason.trim().length > MAX_NOTE_LENGTH

  async function confirm() {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(reason.trim())
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('sellerShop.status.suspendDialog.title', { shopName })}</DialogTitle>
        <DialogDescription>{t('sellerShop.status.suspendDialog.description')}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={reasonId}>{t('sellerShop.status.suspendDialog.reasonLabel')}</Label>
        <Textarea
          id={reasonId}
          rows={3}
          value={reason}
          disabled={submitting}
          placeholder={t('sellerShop.status.suspendDialog.reasonPlaceholder')}
          aria-invalid={tooLong ? true : undefined}
          onChange={(event) => setReason(event.target.value)}
        />
        {tooLong && (
          <p className="text-xs text-status-danger-foreground">
            {t('sellerShop.status.suspendDialog.reasonTooLong', { max: MAX_NOTE_LENGTH })}
          </p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-md border border-status-danger-border bg-status-danger p-3 text-sm text-status-danger-foreground"
        >
          <p className="flex items-start gap-2 font-medium">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {error.message}
          </p>
          {error instanceof ApiError && error.correlationId && (
            <p className="flex items-center gap-1 text-xs">
              X-Correlation-Id: <CopyableId value={error.correlationId} label="X-Correlation-Id" />
            </p>
          )}
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
          {t('sellerShop.status.suspendDialog.cancel')}
        </Button>
        <Button type="button" variant="destructive" disabled={submitting || tooLong} onClick={() => void confirm()}>
          {submitting && <Loader2 aria-hidden="true" className="animate-spin" />}
          {submitting ? t('sellerShop.status.suspendDialog.submitting') : t('sellerShop.status.suspendDialog.confirm')}
        </Button>
      </DialogFooter>
    </>
  )
}
