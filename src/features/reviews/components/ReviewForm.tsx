import { CircleCheck, Clock, Loader2, RotateCcw, TriangleAlert } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/errors'
import { CopyableId } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiSubmitReview, REVIEW_CONTENT_MAX, type MyReviewDTO } from '../api'
import { ReviewImagesInput } from './ReviewImagesInput'
import { StarRatingInput } from './StarRatingInput'

/** Kết quả cuối của 1 món — form được thay bằng thông báo tương ứng. */
type Outcome =
  | { kind: 'submitted'; review: MyReviewDTO }
  | { kind: 'alreadyReviewed' }
  | { kind: 'windowClosed'; message: string }

type ReviewFormProps = {
  orderItemId: string
  onSubmitted?: (review: MyReviewDTO) => void
}

/**
 * Gửi đánh giá cho 1 `OrderItem` (FR-REV-001): 1–5 sao, nhận xét ≤ 1.000 ký tự, tối đa 5 ảnh.
 * Không có API "đã đánh giá chưa" → trạng thái suy ra từ mã lỗi: 409 ALREADY_REVIEWED, 403 REVIEW_WINDOW_CLOSED /
 * NOT_ORDER_BUYER, 409 REVIEW_ELIGIBILITY_PENDING (dữ liệu giao hàng chưa tới — cho thử lại).
 */
export function ReviewForm({ orderItemId, onSubmitted }: ReviewFormProps) {
  const { t } = useTranslation('reviews')
  const contentId = useId()
  const [stars, setStars] = useState(0)
  const [content, setContent] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [imageError, setImageError] = useState<string | null>(null)
  const [starsError, setStarsError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<Error | null>(null)
  const [pendingEligibility, setPendingEligibility] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const contentLength = [...content.trim()].length
  const contentTooLong = contentLength > REVIEW_CONTENT_MAX

  async function submit() {
    if (stars < 1) {
      setStarsError(t('form.starsRequired'))
      return
    }
    if (contentTooLong || imageError) return
    setSubmitting(true)
    setSubmitError(null)
    setPendingEligibility(false)
    try {
      const review = await apiSubmitReview({ orderItemId, stars, content, images })
      setOutcome({ kind: 'submitted', review })
      onSubmitted?.(review)
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'ALREADY_REVIEWED') return setOutcome({ kind: 'alreadyReviewed' })
        if (error.code === 'REVIEW_WINDOW_CLOSED' || error.code === 'NOT_ORDER_BUYER') {
          return setOutcome({ kind: 'windowClosed', message: error.code === 'REVIEW_WINDOW_CLOSED' ? t('form.windowClosed') : error.message })
        }
        if (error.code === 'REVIEW_ELIGIBILITY_PENDING') return setPendingEligibility(true)
        const imageDetail = error.details.find((d) => d.field.startsWith('images'))
        if (imageDetail) setImageError(imageDetail.reason)
        const contentDetail = error.details.find((d) => d.field === 'content')
        if (contentDetail) setSubmitError(new Error(contentDetail.reason))
        else setSubmitError(error)
        return
      }
      setSubmitError(error instanceof Error ? error : new Error(String(error)))
    } finally {
      setSubmitting(false)
    }
  }

  if (outcome) {
    const pending = outcome.kind === 'submitted' && outcome.review.status === 'PENDING_MODERATION'
    const closed = outcome.kind === 'windowClosed'
    const Icon = closed ? TriangleAlert : pending ? Clock : CircleCheck
    const text =
      outcome.kind === 'submitted'
        ? t(pending ? 'form.submittedPending' : 'form.submitted')
        : outcome.kind === 'alreadyReviewed'
          ? t('form.alreadyReviewed')
          : outcome.message
    return (
      <p
        role="status"
        className={
          closed
            ? 'flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground'
            : 'flex items-center gap-2 rounded-md border border-status-success-border bg-status-success px-3 py-2 text-sm text-status-success-foreground'
        }
      >
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        {text}
      </p>
    )
  }

  return (
    <form
      noValidate
      aria-busy={submitting}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <StarRatingInput
        value={stars}
        disabled={submitting}
        error={starsError ?? undefined}
        onChange={(value) => {
          setStars(value)
          setStarsError(null)
        }}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={contentId}>{t('form.contentLabel')}</Label>
        <Textarea
          id={contentId}
          rows={3}
          value={content}
          disabled={submitting}
          placeholder={t('form.contentPlaceholder')}
          aria-invalid={contentTooLong ? true : undefined}
          onChange={(event) => setContent(event.target.value)}
        />
        <div className="flex justify-between gap-2 text-xs">
          <span className="text-status-danger-foreground">
            {contentTooLong ? t('form.contentTooLong', { max: REVIEW_CONTENT_MAX }) : ''}
          </span>
          <span className="text-muted-foreground tabular-nums" aria-hidden="true">
            {t('dialog.counter', { count: contentLength, max: REVIEW_CONTENT_MAX })}
          </span>
        </div>
      </div>

      <ReviewImagesInput
        files={images}
        onChange={setImages}
        onError={setImageError}
        error={imageError ?? undefined}
        disabled={submitting}
      />

      {pendingEligibility && (
        <p role="status" className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Clock aria-hidden="true" className="size-4 shrink-0" />
          {t('form.eligibilityPending')}
        </p>
      )}

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
              X-Correlation-Id: <CopyableId value={submitError.correlationId} label="X-Correlation-Id" />
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting || contentTooLong}>
          {submitting ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : pendingEligibility ? (
            <RotateCcw aria-hidden="true" />
          ) : null}
          {submitting ? t('form.submitting') : pendingEligibility ? t('form.retry') : t('form.submit')}
        </Button>
      </div>
    </form>
  )
}
