import { Loader2 } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/errors'
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
import { ComplaintActionErrorAlert } from './ComplaintActionErrorAlert'

const REASON_MAX_LENGTH = 500

export type ComplaintReasonDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  variant?: 'default' | 'destructive'
  onConfirm: (reason: string) => Promise<void>
  onReload?: () => void
}

type ReasonFormProps = Omit<ComplaintReasonDialogProps, 'open'> & {
  submitting: boolean
  onSubmittingChange: (submitting: boolean) => void
}

function ComplaintReasonForm({
  onOpenChange,
  title,
  description,
  confirmLabel,
  variant = 'default',
  onConfirm,
  onReload,
  submitting,
  onSubmittingChange,
}: ReasonFormProps) {
  const { t } = useTranslation('complaints')
  const fieldId = useId()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<ApiError | Error | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmittingChange(true)
    setError(null)
    try {
      await onConfirm(reason.trim())
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      onSubmittingChange(false)
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor={fieldId}>{t('dialogs.reasonLabel')}</Label>
        <Textarea
          id={fieldId}
          rows={3}
          maxLength={REASON_MAX_LENGTH}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t('dialogs.reasonPlaceholder')}
        />
        <p className="text-right text-xs text-muted-foreground tabular-nums">
          {t('dialogs.counter', { count: reason.length, max: REASON_MAX_LENGTH })}
        </p>
      </div>

      {error && <ComplaintActionErrorAlert error={error} onReload={onReload} />}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={submitting}
          onClick={() => onOpenChange(false)}
        >
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant={variant} disabled={submitting}>
          {submitting && <Loader2 aria-hidden="true" className="animate-spin" />}
          {submitting ? t('dialogs.submitting') : confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * Dialog xác nhận Rút khiếu nại (Withdraw) hoặc Chuyển cấp CSKH (Escalate) kèm lý do tùy chọn.
 */
export function ComplaintReasonDialog({
  open,
  onOpenChange,
  ...rest
}: ComplaintReasonDialogProps) {
  const [submitting, setSubmitting] = useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {open && (
          <ComplaintReasonForm
            {...rest}
            onOpenChange={onOpenChange}
            submitting={submitting}
            onSubmittingChange={setSubmitting}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
