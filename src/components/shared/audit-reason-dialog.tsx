import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, ScrollText, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
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
import { cn } from '@/lib/utils'
import { CopyableId } from './copyable-id'

/** BR-GEN-04 / 03-App-Flow §4.6: lý do tối thiểu 10 ký tự. */
export const AUDIT_REASON_MIN = 10
export const AUDIT_REASON_MAX = 500

export type AuditReasonDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** VD "Khóa tài khoản", "Từ chối hồ sơ nhà bán", "Xác nhận đã hoàn tiền thủ công". */
  title: string
  /** Mô tả hậu quả / đối tượng bị tác động. */
  description?: ReactNode
  confirmLabel?: string
  /** `destructive` cho Khóa / Từ chối / Ẩn; `default` cho Duyệt / Lưu tham số / Replay. */
  variant?: 'default' | 'destructive'
  /**
   * Gửi API kèm `reason` đã trim. Ném lỗi (ApiError) → dialog giữ nguyên & hiện lỗi; resolve → tự đóng.
   */
  onConfirm: (reason: string) => Promise<void> | void
  /** Trường bổ sung đặt trên ô lý do, VD `bankTransactionRef` cho hoàn tiền thủ công. */
  children?: ReactNode
  /** Chặn nút xác nhận khi trường bổ sung (children) chưa hợp lệ. */
  confirmDisabled?: boolean
  minLength?: number
}

/**
 * Modal xác nhận dùng chung cho mọi thao tác nhạy cảm ảnh hưởng bên thứ ba (BR-GEN-04, Brief §4.2.5):
 * bắt buộc `reason`, đếm ký tự, nút xác nhận chỉ bật khi hợp lệ, nhắc ghi Nhật ký kiểm toán bất biến.
 */
export function AuditReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  variant = 'default',
  onConfirm,
  children,
  confirmDisabled = false,
  minLength = AUDIT_REASON_MIN,
}: AuditReasonDialogProps) {
  const { t } = useTranslation('shared')
  const fieldId = useId()
  const [submitError, setSubmitError] = useState<ApiError | Error | null>(null)

  const schema = useMemo(
    () =>
      z.object({
        reason: z
          .string()
          .trim()
          .min(minLength, t('audit.reasonTooShort', { min: minLength }))
          .max(AUDIT_REASON_MAX),
      }),
    [minLength, t],
  )

  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { reason: '' },
  })
  const { register, handleSubmit, reset, formState, control } = form
  const reasonLength = useWatch({ control, name: 'reason' }).length

  // Mỗi lần mở là một thao tác mới: xóa lý do & lỗi cũ.
  useEffect(() => {
    if (open) reset({ reason: '' })
  }, [open, reset])

  const submit = handleSubmit(async ({ reason }) => {
    setSubmitError(null)
    try {
      await onConfirm(reason)
      onOpenChange(false)
    } catch (error) {
      setSubmitError(error instanceof Error ? error : new Error(String(error)))
    }
  })

  const hintId = `${fieldId}-hint`
  const errorId = `${fieldId}-error`
  const fieldError = formState.errors.reason?.message
  const submitting = formState.isSubmitting

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) {
          if (!next) setSubmitError(null)
          onOpenChange(next)
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription asChild>
                <div>{description}</div>
              </DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{t('audit.auditNotice')}</DialogDescription>
            )}
          </DialogHeader>

          {children}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fieldId}>
              {t('audit.reasonLabel')} <span aria-hidden="true" className="text-status-danger-foreground">*</span>
            </Label>
            <Textarea
              id={fieldId}
              rows={4}
              maxLength={AUDIT_REASON_MAX}
              placeholder={t('audit.reasonPlaceholder')}
              aria-required="true"
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? `${errorId} ${hintId}` : hintId}
              {...register('reason')}
            />
            <div className="flex justify-between gap-2 text-xs">
              {fieldError ? (
                <p id={errorId} className="text-status-danger-foreground">
                  {fieldError}
                </p>
              ) : (
                <p id={hintId} className="text-muted-foreground">
                  {t('audit.reasonHint', { min: minLength })}
                </p>
              )}
              <p className="shrink-0 text-muted-foreground tabular-nums" aria-hidden="true">
                {t('audit.counter', { count: reasonLength, max: AUDIT_REASON_MAX })}
              </p>
            </div>
          </div>

          <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            <ScrollText aria-hidden="true" className="size-4 shrink-0" />
            {t('audit.auditNotice')}
          </p>

          {submitError && (
            <div
              role="alert"
              className="flex flex-col gap-1 rounded-md border border-status-danger-border bg-status-danger p-3 text-sm text-status-danger-foreground"
            >
              <p className="flex items-start gap-2 font-medium">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {submitError.message}
              </p>
              {submitError instanceof ApiError && submitError.correlationId && (
                <p className="flex items-center gap-1 text-xs">
                  {t('audit.correlationId')}:
                  <CopyableId value={submitError.correlationId} label={t('audit.correlationId')} />
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
              {t('audit.cancel')}
            </Button>
            <Button
              type="submit"
              variant={variant}
              disabled={!formState.isValid || confirmDisabled || submitting}
              className={cn(submitting && 'cursor-progress')}
            >
              {submitting && <Loader2 aria-hidden="true" className="animate-spin" />}
              {submitting ? t('audit.submitting') : (confirmLabel ?? t('audit.confirm'))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
