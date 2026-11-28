import { Loader2, TriangleAlert } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'

type TextEntryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  label: string
  placeholder: string
  confirmLabel: string
  maxLength: number
  /** Ném lỗi → dialog giữ nguyên & hiện lỗi; resolve → tự đóng (cùng quy ước với AuditReasonDialog). */
  onConfirm: (text: string) => Promise<void>
}

/**
 * Dialog nhập 1 đoạn văn bản bắt buộc — dùng cho Báo cáo (FR-REV-004) và Phản hồi (FR-REV-003).
 * Không dùng AuditReasonDialog vì đây không phải thao tác quản trị (BR-GEN-04 không yêu cầu ≥ 10 ký tự).
 */
export function TextEntryDialog({ open, onOpenChange, ...props }: TextEntryDialogProps) {
  const [submitting, setSubmitting] = useState(false)
  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        {/* Radix gỡ nội dung khi đóng → mỗi lần mở là nội dung & lỗi mới, không cần reset bằng effect. */}
        <TextEntryBody {...props} onOpenChange={onOpenChange} submitting={submitting} setSubmitting={setSubmitting} />
      </DialogContent>
    </Dialog>
  )
}

type TextEntryBodyProps = Omit<TextEntryDialogProps, 'open'> & {
  submitting: boolean
  setSubmitting: (value: boolean) => void
}

function TextEntryBody({
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  confirmLabel,
  maxLength,
  onConfirm,
  submitting,
  setSubmitting,
}: TextEntryBodyProps) {
  const { t } = useTranslation('reviews')
  const fieldId = useId()
  const [text, setText] = useState('')
  const [error, setError] = useState<Error | null>(null)
  const length = [...text.trim()].length
  const tooLong = length > maxLength

  async function confirm() {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(text.trim())
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (length > 0 && !tooLong) void confirm()
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId}>
          {label} <span aria-hidden="true" className="text-status-danger-foreground">*</span>
        </Label>
        <Textarea
          id={fieldId}
          rows={4}
          value={text}
          disabled={submitting}
          placeholder={placeholder}
          aria-required="true"
          aria-invalid={tooLong ? true : undefined}
          onChange={(event) => setText(event.target.value)}
        />
        <div className="flex justify-between gap-2 text-xs">
          <span className={tooLong ? 'text-status-danger-foreground' : 'text-muted-foreground'}>
            {tooLong ? t('dialog.tooLong', { max: maxLength }) : length === 0 ? t('dialog.required') : ''}
          </span>
          <span className="text-muted-foreground tabular-nums" aria-hidden="true">
            {t('dialog.counter', { count: length, max: maxLength })}
          </span>
        </div>
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
          {t('dialog.cancel')}
        </Button>
        <Button type="submit" disabled={submitting || length === 0 || tooLong}>
          {submitting && <Loader2 aria-hidden="true" className="animate-spin" />}
          {submitting ? t('dialog.submitting') : confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}
