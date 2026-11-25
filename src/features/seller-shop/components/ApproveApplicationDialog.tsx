import { Loader2, ScrollText, TriangleAlert } from 'lucide-react'
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
import { MAX_NOTE_LENGTH } from '../schemas'

type ApproveApplicationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  shopName: string
  /** Ném lỗi → dialog giữ nguyên & hiện lỗi; resolve → tự đóng (cùng quy ước với AuditReasonDialog). */
  onConfirm: (note: string) => Promise<void>
}

/**
 * Xác nhận duyệt hồ sơ — ghi chú KHÔNG bắt buộc (`ApproveApplicationRequestBody.note?`). BR-GEN-04 chỉ bắt buộc
 * lý do khi từ chối (dùng AuditReasonDialog); thao tác duyệt vẫn được SVC-SEL ghi AuditLog.
 */
export function ApproveApplicationDialog({ open, onOpenChange, ...props }: ApproveApplicationDialogProps) {
  const [submitting, setSubmitting] = useState(false)
  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        {/* Radix gỡ nội dung khi đóng → mỗi lần mở là ghi chú & lỗi mới, không cần reset bằng effect. */}
        <ApproveDialogBody {...props} onOpenChange={onOpenChange} submitting={submitting} setSubmitting={setSubmitting} />
      </DialogContent>
    </Dialog>
  )
}

type ApproveDialogBodyProps = Omit<ApproveApplicationDialogProps, 'open'> & {
  submitting: boolean
  setSubmitting: (value: boolean) => void
}

function ApproveDialogBody({ onOpenChange, shopName, onConfirm, submitting, setSubmitting }: ApproveDialogBodyProps) {
  const { t } = useTranslation('sellerShop')
  const { t: tShared } = useTranslation('shared')
  const noteId = useId()
  const [note, setNote] = useState('')
  const [error, setError] = useState<Error | null>(null)

  const tooLong = note.trim().length > MAX_NOTE_LENGTH

  async function confirm() {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(note.trim())
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
        <DialogTitle>{t('admin.approveDialog.title', { shopName })}</DialogTitle>
        <DialogDescription>{t('admin.approveDialog.description')}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={noteId}>{t('admin.approveDialog.noteLabel')}</Label>
        <Textarea
          id={noteId}
          rows={3}
          value={note}
          disabled={submitting}
          placeholder={t('admin.approveDialog.notePlaceholder')}
          aria-invalid={tooLong ? true : undefined}
          onChange={(event) => setNote(event.target.value)}
        />
        {tooLong && (
          <p className="text-xs text-status-danger-foreground">
            {t('admin.approveDialog.noteTooLong', { max: MAX_NOTE_LENGTH })}
          </p>
        )}
      </div>

      <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        <ScrollText aria-hidden="true" className="size-4 shrink-0" />
        {tShared('audit.auditNotice')}
      </p>

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
              {tShared('audit.correlationId')}:
              <CopyableId value={error.correlationId} label={tShared('audit.correlationId')} />
            </p>
          )}
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
          {t('admin.approveDialog.cancel')}
        </Button>
        <Button type="button" disabled={submitting || tooLong} onClick={() => void confirm()}>
          {submitting && <Loader2 aria-hidden="true" className="animate-spin" />}
          {submitting ? t('admin.approveDialog.submitting') : t('admin.approveDialog.confirm')}
        </Button>
      </DialogFooter>
    </>
  )
}
