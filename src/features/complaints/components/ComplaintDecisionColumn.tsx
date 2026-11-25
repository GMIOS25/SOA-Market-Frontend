import { zodResolver } from '@hookform/resolvers/zod'
import {
  CheckCircle2,
  Gavel,
  Lock,
  Loader2,
  RotateCcw,
  ScrollText,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useId, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/errors'
import { CopyableId } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  DECISION_OUTCOMES,
  REFUND_OUTCOMES,
  RESPONSIBLE_PARTIES,
  type ComplaintDetailView,
  type CSDecisionInput,
  type CSDecisionResult,
  type DecisionOutcome,
  type ResponsibleParty,
} from '../api'
import { createDecisionSchema, DECISION_REASON_MAX, type DecisionFormValues } from '../schemas'

export type ComplaintDecisionColumnProps = {
  detail: ComplaintDetailView
  currentUserId?: string
  isCs: boolean
  onClaim: () => Promise<void>
  isClaiming: boolean
  onDecide: (input: CSDecisionInput) => Promise<CSDecisionResult>
  isDeciding: boolean
  actionError: ApiError | Error | null
  onReload: () => void
  isReloading: boolean
}

function resolveInitialOutcome(requestedResolution: string): DecisionOutcome {
  if ((DECISION_OUTCOMES as readonly string[]).includes(requestedResolution)) {
    return requestedResolution as DecisionOutcome
  }
  return 'FULL_REFUND'
}

function buildInitialValues(detail: ComplaintDetailView): DecisionFormValues {
  const outcome = resolveInitialOutcome(detail.complaint.requestedResolution)
  const remaining = detail.dossier?.paymentAllocation?.remainingRefundable
  let refundAmount = ''
  if (outcome === 'PARTIAL_REFUND') {
    if (detail.complaint.requestedRefundAmount && detail.complaint.requestedRefundAmount > 0) {
      refundAmount = String(detail.complaint.requestedRefundAmount)
    }
  } else if (outcome === 'FULL_REFUND' || outcome === 'RETURN_REFUND') {
    if (remaining !== undefined && remaining > 0) {
      refundAmount = String(remaining)
    }
  }
  const responsibleParty: ResponsibleParty = outcome === 'REJECTED' ? 'NONE' : 'SELLER'
  return {
    outcome,
    responsibleParty,
    refundAmount,
    reason: '',
  }
}

/**
 * Cột 3 Workspace Phân xử — Tiếp nhận Claim & Form ra quyết định kèm lý do bắt buộc (FR-CPL-006..008, BR-CPL-05..09).
 */
export function ComplaintDecisionColumn({
  detail,
  currentUserId,
  isCs,
  onClaim,
  isClaiming,
  onDecide,
  isDeciding,
  actionError,
  onReload,
  isReloading,
}: ComplaintDecisionColumnProps) {
  const { t } = useTranslation('complaints')
  const outcomeId = useId()
  const refundId = useId()
  const partyId = useId()
  const reasonId = useId()

  const { complaint, resolution, dossier, availableActions } = detail
  const remainingRefundable = dossier?.paymentAllocation?.remainingRefundable

  const schema = useMemo(
    () =>
      createDecisionSchema({
        remainingRefundable,
        messages: {
          positiveInt: t('decision.form.validation.positiveInt'),
          exceedsRemaining: t('decision.form.validation.exceedsRemaining', {
            max: remainingRefundable !== undefined ? formatVnd(remainingRefundable) : '0 ₫',
          }),
          requiredForPartial: t('decision.form.validation.requiredForPartial'),
          reasonRequired: t('decision.form.reasonRequiredError'),
          reasonMax: t('decision.form.reasonMaxError', { max: DECISION_REASON_MAX }),
        },
      }),
    [remainingRefundable, t],
  )

  const form = useForm<DecisionFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: buildInitialValues(detail),
  })

  const { register, handleSubmit, control, reset, setValue, getValues, setError, formState } = form
  const watchedOutcome = useWatch({ control, name: 'outcome' })
  const watchedReason = useWatch({ control, name: 'reason' }) ?? ''
  const showRefundField = REFUND_OUTCOMES.has(watchedOutcome)

  useEffect(() => {
    reset(buildInitialValues(detail))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ reset khi chuyển sang khiếu nại khác hoặc trạng thái chuyển sang UNDER_REVIEW
  }, [complaint.complaintId, complaint.status, reset])

  useEffect(() => {
    if (formState.isDirty) return
    if ((watchedOutcome === 'FULL_REFUND' || watchedOutcome === 'RETURN_REFUND') && remainingRefundable !== undefined && remainingRefundable > 0) {
      setValue('refundAmount', String(remainingRefundable), { shouldValidate: true })
    }
  }, [formState.isDirty, remainingRefundable, setValue, watchedOutcome])

  useEffect(() => {
    if (!(actionError instanceof ApiError)) return
    for (const fieldErr of actionError.details) {
      if (
        fieldErr.field === 'outcome' ||
        fieldErr.field === 'refundAmount' ||
        fieldErr.field === 'responsibleParty' ||
        fieldErr.field === 'reason'
      ) {
        setError(fieldErr.field, { type: 'server', message: fieldErr.reason })
      }
    }
  }, [actionError, setError])

  function handleOutcomeChange(nextOutcome: DecisionOutcome) {
    setValue('outcome', nextOutcome, { shouldDirty: true, shouldValidate: true })
    if (nextOutcome === 'REJECTED') {
      setValue('responsibleParty', 'NONE', { shouldDirty: true, shouldValidate: true })
      setValue('refundAmount', '', { shouldDirty: true, shouldValidate: true })
      return
    }
    if (getValues('responsibleParty') === 'NONE') {
      setValue('responsibleParty', 'SELLER', { shouldDirty: true, shouldValidate: true })
    }
    if (nextOutcome === 'EXCHANGE') {
      setValue('refundAmount', '', { shouldDirty: true, shouldValidate: true })
      return
    }
    if (nextOutcome === 'PARTIAL_REFUND') {
      const requested =
        complaint.requestedRefundAmount && complaint.requestedRefundAmount > 0
          ? String(complaint.requestedRefundAmount)
          : ''
      setValue('refundAmount', requested, { shouldDirty: true, shouldValidate: true })
      return
    }
    if (remainingRefundable !== undefined && remainingRefundable > 0) {
      setValue('refundAmount', String(remainingRefundable), { shouldDirty: true, shouldValidate: true })
    }
  }

  const submit = handleSubmit(async (values) => {
    const trimmedReason = values.reason.trim()
    if (!trimmedReason) return
    const trimmedAmount = values.refundAmount.trim()
    const payload: CSDecisionInput = {
      outcome: values.outcome,
      responsibleParty: values.responsibleParty,
      reason: trimmedReason,
      version: complaint.version,
      ...(REFUND_OUTCOMES.has(values.outcome) && trimmedAmount !== ''
        ? { refundAmount: Number(trimmedAmount) }
        : {}),
    }
    await onDecide(payload)
  })

  const isFinalized =
    Boolean(resolution) || complaint.status === 'CLOSED' || complaint.status === 'EXECUTING'
  const isAssignedToCurrentOrUnknown =
    !complaint.assignedCsId || (Boolean(currentUserId) && complaint.assignedCsId === currentUserId)
  const canClaim =
    !isFinalized &&
    isCs &&
    complaint.status === 'ESCALATED' &&
    Boolean(availableActions?.includes('CLAIM'))
  const canDecide =
    !isFinalized &&
    isCs &&
    complaint.status === 'UNDER_REVIEW' &&
    Boolean(availableActions?.includes('DECIDE')) &&
    isAssignedToCurrentOrUnknown

  const isConflictError = actionError instanceof ApiError && actionError.status === 409
  const reasonError = formState.errors.reason?.message
  const refundError = formState.errors.refundAmount?.message
  const isSubmitDisabled = !formState.isValid || watchedReason.trim().length === 0 || isDeciding

  return (
    <section
      aria-labelledby="workspace-col-decision"
      className="flex min-w-0 flex-col gap-4"
    >
      <h2 id="workspace-col-decision" className="text-base font-semibold text-foreground">
        {t('workspace.columns.decision')}
      </h2>

      {actionError && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-status-danger-border bg-status-danger p-3.5 text-sm text-status-danger-foreground"
        >
          <div className="flex items-start gap-2 font-medium">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{actionError.message}</span>
          </div>
          {actionError instanceof ApiError && actionError.correlationId && (
            <p className="flex items-center gap-1.5 text-xs">
              <span>{t('common.correlationId')}:</span>
              <CopyableId value={actionError.correlationId} label={t('common.correlationId')} />
            </p>
          )}
          {isConflictError && (
            <div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={isReloading}
                onClick={onReload}
              >
                <RotateCcw aria-hidden="true" className={isReloading ? 'animate-spin' : undefined} />
                {t('workspace.conflictReload')}
              </Button>
            </div>
          )}
        </div>
      )}

      {isFinalized ? (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-border pb-2.5">
            <CheckCircle2 aria-hidden="true" className="size-4 text-status-success-foreground" />
            <h3 className="text-sm font-semibold text-foreground">{t('decision.finalized.title')}</h3>
          </div>

          {resolution && (
            <dl className="grid grid-cols-1 gap-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs text-muted-foreground">{t('decision.finalized.outcome')}</dt>
                <dd className="font-semibold text-foreground">
                  {
                    t(`common.resolutions.${resolution.outcome}` as never, {
                      defaultValue: resolution.outcome,
                    }) as string
                  }
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 tabular-nums">
                <dt className="text-xs text-muted-foreground">{t('decision.finalized.refundAmount')}</dt>
                <dd className="font-bold text-foreground">{formatVnd(resolution.refundAmount)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs text-muted-foreground">
                  {t('decision.finalized.responsibleParty')}
                </dt>
                <dd className="font-medium text-foreground">
                  {
                    t(`common.parties.${resolution.responsibleParty}` as never, {
                      defaultValue: resolution.responsibleParty,
                    }) as string
                  }
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('decision.finalized.reason')}</dt>
                <dd className="mt-1 whitespace-pre-wrap rounded-md bg-muted/60 p-2.5 text-xs leading-relaxed text-foreground">
                  {resolution.reason}
                </dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                <dt className="text-xs text-muted-foreground">{t('decision.finalized.decidedBy')}</dt>
                <dd>
                  <CopyableId value={resolution.decidedBy} label={t('decision.finalized.decidedBy')} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
                <dt className="text-muted-foreground">{t('decision.finalized.decidedAt')}</dt>
                <dd>{formatDateTime(resolution.decidedAt)}</dd>
              </div>
            </dl>
          )}

          {complaint.status === 'EXECUTING' && resolution?.outcome === 'RETURN_REFUND' && (
            <div className="flex flex-col gap-1.5 rounded-md border border-status-info-border bg-status-info p-3 text-xs text-status-info-foreground">
              <p className="font-semibold">{t('decision.finalized.returnExecutionTitle')}</p>
              {complaint.returnShipmentId && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span>{t('dossier.shipping.returnShipmentId')}:</span>
                  <CopyableId
                    value={complaint.returnShipmentId}
                    label={t('dossier.shipping.returnShipmentId')}
                  />
                </div>
              )}
              <p>
                {complaint.returnReceivedConfirmed
                  ? t('decision.finalized.returnConfirmed')
                  : t('decision.finalized.returnWaiting')}
              </p>
            </div>
          )}

          <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            <Lock aria-hidden="true" className="size-3.5 shrink-0" />
            <span>{t('decision.finalized.finalNotice')}</span>
          </p>
        </div>
      ) : canClaim ? (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-border pb-2.5">
            <Gavel aria-hidden="true" className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{t('decision.claimCard.title')}</h3>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t('decision.claimCard.description')}
          </p>
          <Button type="button" disabled={isClaiming} onClick={() => void onClaim()}>
            {isClaiming && <Loader2 aria-hidden="true" className="animate-spin" />}
            {isClaiming ? t('decision.claimCard.claiming') : t('decision.claimCard.button')}
          </Button>
        </div>
      ) : canDecide ? (
        <form
          onSubmit={(event) => void submit(event)}
          noValidate
          className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs"
        >
          <div className="flex items-center gap-2 border-b border-border pb-2.5">
            <Gavel aria-hidden="true" className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{t('decision.form.title')}</h3>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={outcomeId}>
              {t('decision.form.outcomeLabel')}{' '}
              <span aria-hidden="true" className="text-status-danger-foreground">
                *
              </span>
            </Label>
            <select
              id={outcomeId}
              value={watchedOutcome}
              onChange={(event) => handleOutcomeChange(event.target.value as DecisionOutcome)}
              className="h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
            >
              {DECISION_OUTCOMES.map((outcome) => (
                <option key={outcome} value={outcome}>
                  {t(`common.resolutions.${outcome}`)}
                </option>
              ))}
            </select>
          </div>

          {showRefundField && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={refundId}>
                {t('decision.form.refundAmountLabel')}
                {watchedOutcome === 'PARTIAL_REFUND' && (
                  <span aria-hidden="true" className="ml-1 text-status-danger-foreground">
                    *
                  </span>
                )}
              </Label>
              <input
                id={refundId}
                type="number"
                min={0}
                step={1000}
                inputMode="numeric"
                placeholder={t('decision.form.refundAmountPlaceholder')}
                aria-invalid={refundError ? true : undefined}
                className={cn(
                  'h-9 w-full rounded-md border border-input bg-card px-3 text-sm tabular-nums focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  refundError && 'border-destructive',
                )}
                {...register('refundAmount')}
              />
              {refundError && (
                <p role="alert" className="text-xs text-status-danger-foreground">
                  {refundError}
                </p>
              )}
              {remainingRefundable !== undefined ? (
                remainingRefundable <= 0 ? (
                  <p className="text-xs font-medium text-status-warning-foreground">
                    {t('decision.form.refundAmountZeroWarning')}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {t('decision.form.refundAmountMaxHint', { max: formatVnd(remainingRefundable) })}
                  </p>
                )
              ) : (
                dossier?.paymentServiceUnavailable && (
                  <p className="text-xs text-status-warning-foreground">
                    {t('decision.form.payUnavailableWarning')}
                  </p>
                )
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={partyId}>
              {t('decision.form.responsiblePartyLabel')}{' '}
              <span aria-hidden="true" className="text-status-danger-foreground">
                *
              </span>
            </Label>
            <select
              id={partyId}
              className="h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
              {...register('responsibleParty')}
            >
              {RESPONSIBLE_PARTIES.map((party) => (
                <option key={party} value={party}>
                  {t(`common.parties.${party}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={reasonId}>
              {t('decision.form.reasonLabel')}{' '}
              <span aria-hidden="true" className="text-status-danger-foreground">
                *
              </span>
            </Label>
            <Textarea
              id={reasonId}
              rows={4}
              maxLength={DECISION_REASON_MAX}
              placeholder={t('decision.form.reasonPlaceholder')}
              aria-required="true"
              aria-invalid={reasonError ? true : undefined}
              {...register('reason')}
            />
            <div className="flex items-start justify-between gap-2 text-xs">
              {reasonError ? (
                <p role="alert" className="text-status-danger-foreground">
                  {reasonError}
                </p>
              ) : (
                <span className="text-muted-foreground">{t('decision.form.reasonHint')}</span>
              )}
              <span className="shrink-0 text-muted-foreground tabular-nums" aria-hidden="true">
                {t('decision.form.reasonCounter', {
                  count: watchedReason.length,
                  max: DECISION_REASON_MAX,
                })}
              </span>
            </div>
          </div>

          <p className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            <ScrollText aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{t('decision.form.auditFinalNotice')}</span>
          </p>

          <Button type="submit" disabled={isSubmitDisabled} className="w-full">
            {isDeciding && <Loader2 aria-hidden="true" className="animate-spin" />}
            {isDeciding ? t('decision.form.submitting') : t('decision.form.submit')}
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-border pb-2.5">
            <Lock aria-hidden="true" className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              {!isCs
                ? t('decision.readonly.adminOnlyTitle')
                : complaint.status === 'UNDER_REVIEW' && !isAssignedToCurrentOrUnknown
                  ? t('decision.readonly.assignedOtherTitle')
                  : t('decision.readonly.notEligibleTitle')}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {!isCs
              ? t('decision.readonly.adminOnlyDescription')
              : complaint.status === 'UNDER_REVIEW' && !isAssignedToCurrentOrUnknown
                ? t('decision.readonly.assignedOtherDescription')
                : t('decision.readonly.notEligibleDescription', { status: complaint.status })}
          </p>
        </div>
      )}
    </section>
  )
}
