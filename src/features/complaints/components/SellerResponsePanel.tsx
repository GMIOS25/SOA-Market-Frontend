import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Coins, Loader2, MessageSquareReply } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { RespondComplaintInput } from '../api'
import { isRefundExceedsLimitError } from '../helpers'
import {
  SELLER_RESPONSE_MODES,
  createSellerResponseSchema,
  type SellerResponseFormValues,
  type SellerResponseMode,
} from '../schemas'
import { ComplaintActionErrorAlert } from './ComplaintActionErrorAlert'

export type SellerResponsePanelProps = {
  requestedResolution: string
  requestedRefundAmount?: number
  /** Giá trị gói SellerOrder tương ứng (trần hoàn tiền một phần, undefined nếu chưa tải được từ SVC-ORD). */
  maxRefundAmount?: number
  isSubmitting?: boolean
  onSubmitResponse: (input: RespondComplaintInput) => Promise<void>
  onReload?: () => void
}

/**
 * Form phản hồi & đề xuất giải quyết khiếu nại dành cho Seller (/seller/complaints/:id):
 * - Hỗ trợ đề xuất hoàn tiền một phần (kiểm tra trần giá trị gói hàng + xử lý lỗi HTTP 422).
 * - Hỗ trợ chấp nhận yêu cầu Buyer, đề xuất phương án khác, hoặc trao đổi/phản bác.
 */
export function SellerResponsePanel({
  requestedResolution,
  requestedRefundAmount,
  maxRefundAmount,
  isSubmitting = false,
  onSubmitResponse,
  onReload,
}: SellerResponsePanelProps) {
  const { t } = useTranslation('complaints')
  const [submitError, setSubmitError] = useState<ApiError | Error | null>(null)

  const schema = useMemo(
    () => createSellerResponseSchema(t, maxRefundAmount),
    [t, maxRefundAmount],
  )

  const form = useForm<SellerResponseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      mode: 'PARTIAL_REFUND',
      resolution: 'RETURN_REFUND',
      refundAmount: '',
      messageAction: 'MESSAGE',
      content: '',
    },
  })

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    reset,
    formState: { errors },
  } = form

  const mode = useWatch({ control, name: 'mode' })

  function handleModeChange(nextMode: SellerResponseMode) {
    setSubmitError(null)
    setValue('mode', nextMode, { shouldValidate: false })
  }

  async function submitWithPayload(values: SellerResponseFormValues, overrideMessageAction?: 'MESSAGE' | 'REJECT') {
    setSubmitError(null)

    let payload: RespondComplaintInput
    if (values.mode === 'PARTIAL_REFUND') {
      payload = {
        action: 'PROPOSE',
        resolution: 'PARTIAL_REFUND',
        refundAmount: Number.parseInt(values.refundAmount.trim(), 10),
        content: values.content.trim(),
      }
    } else if (values.mode === 'ACCEPT') {
      payload = {
        action: 'ACCEPT',
        content: values.content.trim(),
      }
    } else if (values.mode === 'OTHER_PROPOSAL') {
      payload = {
        action: 'PROPOSE',
        resolution: values.resolution,
        content: values.content.trim(),
      }
    } else {
      payload = {
        action: overrideMessageAction ?? values.messageAction,
        content: values.content.trim(),
      }
    }

    try {
      await onSubmitResponse(payload)
      reset({
        mode: values.mode,
        resolution: values.resolution,
        refundAmount: '',
        messageAction: 'MESSAGE',
        content: '',
      })
    } catch (err) {
      if (err instanceof ApiError) {
        const refundMsg =
          err.fieldError('refundAmount') ??
          (isRefundExceedsLimitError(err) ? err.message : undefined)
        if (refundMsg) {
          setError('refundAmount', { message: refundMsg })
        }
        const contentMsg = err.fieldError('content')
        if (contentMsg) {
          setError('content', { message: contentMsg })
        }
        setSubmitError(err)
      } else {
        setSubmitError(err instanceof Error ? err : new Error(String(err)))
      }
    }
  }

  const handleFormSubmit = handleSubmit((values) => submitWithPayload(values))
  const handleRejectSubmit = handleSubmit((values) => submitWithPayload(values, 'REJECT'))

  return (
    <section
      aria-labelledby="seller-response-heading"
      className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5"
    >
      <div className="space-y-1 border-b border-border pb-3">
        <h2 id="seller-response-heading" className="flex items-center gap-2 text-base font-semibold">
          <MessageSquareReply aria-hidden="true" className="size-4 text-primary" />
          <span>{t('sellerResponse.title')}</span>
        </h2>
        <p className="text-xs text-muted-foreground">{t('sellerResponse.subtitle')}</p>
      </div>

      <div
        role="group"
        aria-label={t('sellerResponse.title')}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {SELLER_RESPONSE_MODES.map((item) => {
          const active = mode === item
          return (
            <button
              key={item}
              type="button"
              aria-pressed={active}
              onClick={() => handleModeChange(item)}
              className={cn(
                'flex items-center gap-2 rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                active
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              {item === 'PARTIAL_REFUND' && <Coins aria-hidden="true" className="size-3.5 shrink-0" />}
              <span>{t(`sellerResponse.modes.${item}`)}</span>
            </button>
          )
        })}
      </div>

      <form onSubmit={(event) => void handleFormSubmit(event)} noValidate className="space-y-4">
        {mode === 'PARTIAL_REFUND' && (
          <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                {maxRefundAmount !== undefined
                  ? t('sellerResponse.refundCeilingNotice', { amount: formatVnd(maxRefundAmount) })
                  : t('sellerResponse.refundCeilingUnknown')}
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="seller-partial-refund-amount">
                {t('sellerResponse.refundAmountLabel')}
              </Label>
              <input
                id="seller-partial-refund-amount"
                type="number"
                min={1}
                step={1}
                placeholder={t('sellerResponse.refundAmountPlaceholder')}
                aria-invalid={errors.refundAmount ? true : undefined}
                {...register('refundAmount')}
                className="block h-9 w-full rounded-md border border-input bg-card px-3 text-sm tabular-nums focus-visible:ring-2 focus-visible:ring-ring"
              />
              {errors.refundAmount && (
                <p role="alert" className="text-xs font-medium text-status-danger-foreground">
                  {errors.refundAmount.message}
                </p>
              )}
            </div>
          </div>
        )}

        {mode === 'ACCEPT' && (
          <div className="space-y-1 rounded-md border border-status-info-border bg-status-info/50 px-3 py-2 text-xs text-status-info-foreground">
            <p className="font-medium">
              {t('sellerResponse.acceptNotice', {
                resolution: t(`resolutions.${requestedResolution}` as never, {
                  defaultValue: requestedResolution,
                }) as string,
              })}
            </p>
            {requestedRefundAmount !== undefined && requestedRefundAmount > 0 && (
              <p className="tabular-nums">
                {t('sellerResponse.acceptRefundNotice', {
                  amount: formatVnd(requestedRefundAmount),
                })}
              </p>
            )}
          </div>
        )}

        {mode === 'OTHER_PROPOSAL' && (
          <div className="space-y-1.5">
            <Label htmlFor="seller-proposal-resolution">{t('sellerResponse.resolutionLabel')}</Label>
            <select
              id="seller-proposal-resolution"
              {...register('resolution')}
              className="block h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
            >
              {(['FULL_REFUND', 'RETURN_REFUND', 'EXCHANGE'] as const).map((res) => (
                <option key={res} value={res}>
                  {t(`resolutions.${res}`)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="seller-response-content">{t('sellerResponse.contentLabel')}</Label>
          <Textarea
            id="seller-response-content"
            rows={3}
            placeholder={t('sellerResponse.contentPlaceholder')}
            aria-invalid={errors.content ? true : undefined}
            {...register('content')}
          />
          {errors.content && (
            <p className="text-xs text-status-danger-foreground">{errors.content.message}</p>
          )}
        </div>

        {submitError && <ComplaintActionErrorAlert error={submitError} onReload={onReload} />}

        <div className="flex flex-wrap items-center gap-2">
          {mode === 'MESSAGE' ? (
            <>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting && <Loader2 aria-hidden="true" className="animate-spin" />}
                {isSubmitting ? t('sellerResponse.submitting') : t('sellerResponse.submitMessage')}
              </Button>
              <Button
                type="button"
                variant="destructive-outline"
                size="sm"
                disabled={isSubmitting}
                onClick={() => void handleRejectSubmit()}
              >
                {t('sellerResponse.submitReject')}
              </Button>
            </>
          ) : (
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 aria-hidden="true" className="animate-spin" />}
              {isSubmitting
                ? t('sellerResponse.submitting')
                : mode === 'PARTIAL_REFUND'
                  ? t('sellerResponse.submitPartialRefund')
                  : mode === 'ACCEPT'
                    ? t('sellerResponse.submitAccept')
                    : t('sellerResponse.submitProposal')}
            </Button>
          )}
        </div>
      </form>
    </section>
  )
}
