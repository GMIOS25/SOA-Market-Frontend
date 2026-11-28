import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, CircleCheck, EyeOff, Flag, Inbox, TriangleAlert, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ApiError } from '@/api/errors'
import { AuditReasonDialog, CopyableId, ServiceFallbackBanner } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { apiGetModerationQueue, apiModerateReview, reviewKeys, type AdminReviewDTO, type ModerationDecision } from '../api'
import { ReviewCard } from '../components/ReviewCard'

const PAGE_SIZE = 20

type Pending = { review: AdminReviewDTO; decision: ModerationDecision }
type Notice = { kind: 'success' | 'conflict'; message: string }

/**
 * A7 `/admin/moderation/reviews` (FR-REV-005): hàng chờ gồm đánh giá dính từ cấm / liên kết ngoài và đánh giá
 * bị báo cáo. Mọi quyết định qua `<AuditReasonDialog />` (BR-GEN-04) kèm `version` để khóa lạc quan.
 */
export function AdminReviewModerationPage() {
  const { t } = useTranslation('reviews')
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pending, setPending] = useState<Pending | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const query = useQuery({
    queryKey: reviewKeys.moderationQueue(page),
    queryFn: () => apiGetModerationQueue(page, PAGE_SIZE),
    placeholderData: keepPreviousData,
    retry: false,
  })
  const reviews = query.data?.data ?? []
  const pagination = query.data?.pagination

  /** 409 REVIEW_VERSION_CONFLICT (Admin khác vừa xử lý) → đóng dialog, tải lại, báo xung đột; lỗi khác → giữ dialog. */
  async function moderate({ review, decision }: Pending, reason: string) {
    try {
      await apiModerateReview(review.reviewId, { decision, reason, version: review.version })
      setNotice({ kind: 'success', message: t(decision === 'PUBLISH' ? 'admin.published' : 'admin.hidden') })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'REVIEW_VERSION_CONFLICT') {
        setNotice({ kind: 'conflict', message: t('admin.conflict') })
        setPending(null)
        return
      }
      throw error
    } finally {
      void queryClient.invalidateQueries({ queryKey: reviewKeys.moderationAll })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('admin.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('admin.subtitle')}</p>
      </header>

      {notice && (
        <div
          role="status"
          className={cn(
            'flex items-start gap-3 rounded-md border p-3 text-sm',
            notice.kind === 'success'
              ? 'border-status-success-border bg-status-success text-status-success-foreground'
              : 'border-status-warning-border bg-status-warning text-status-warning-foreground',
          )}
        >
          {notice.kind === 'success' ? (
            <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          ) : (
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          )}
          <span className="flex-1 font-medium">{notice.message}</span>
          <Button type="button" variant="ghost" size="icon-xs" aria-label={t('admin.dismiss')} onClick={() => setNotice(null)}>
            <X aria-hidden="true" />
          </Button>
        </div>
      )}

      {query.isPending && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {query.isError && !query.data && (
        <ServiceFallbackBanner message={t('admin.loadError')} onRetry={() => void query.refetch()} isRetrying={query.isFetching} />
      )}

      {query.data && reviews.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          <Inbox aria-hidden="true" className="size-8" />
          {t('admin.empty')}
        </div>
      )}

      {reviews.length > 0 && (
        <ul className={cn('flex flex-col gap-3', query.isFetching && 'opacity-60')} aria-busy={query.isFetching}>
          {reviews.map((review) => (
            <li key={review.reviewId} className="rounded-lg border border-border bg-card px-4">
              <ReviewCard
                stars={review.stars}
                content={review.content}
                createdAt={review.createdAt}
                imageUrls={review.imageUrls}
                reply={review.reply}
                meta={
                  <>
                    <StatusBadge status={review.status} label={t(`status.${review.status}`)} />
                    {review.openReportCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-status-danger-foreground">
                        <Flag aria-hidden="true" className="size-3.5" />
                        {t('admin.openReports', { count: review.openReportCount })}
                      </span>
                    )}
                  </>
                }
                actions={
                  <>
                    <Button type="button" variant="outline" size="sm" onClick={() => setPending({ review, decision: 'PUBLISH' })}>
                      <CircleCheck aria-hidden="true" />
                      {t('admin.publish')}
                    </Button>
                    <Button type="button" variant="destructive-outline" size="sm" onClick={() => setPending({ review, decision: 'HIDE' })}>
                      <EyeOff aria-hidden="true" />
                      {t('admin.hide')}
                    </Button>
                  </>
                }
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {t('admin.reviewId')}:
                    <CopyableId value={review.reviewId} display={review.reviewId.slice(0, 8).toUpperCase()} label={t('admin.reviewId')} />
                  </span>
                  <Link to={`/products/${encodeURIComponent(review.productId)}`} className="text-primary hover:underline">
                    {t('admin.productLink')}
                  </Link>
                </div>

                {review.moderationReason && (
                  <p className="rounded-md bg-status-warning px-3 py-2 text-xs text-status-warning-foreground">
                    <span className="font-medium">{t('admin.moderationReason')}:</span> {review.moderationReason}
                  </p>
                )}

                {(review.reports ?? []).length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold">{t('admin.reportsTitle')}</p>
                    <ul className="flex flex-col gap-1.5">
                      {(review.reports ?? []).map((report) => (
                        <li key={report.reportId} className="rounded-md border border-border bg-background px-3 py-2 text-xs">
                          <p className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {t(`admin.reporterRole.${report.reporterRole}` as 'admin.reporterRole.BUYER', {
                                defaultValue: report.reporterRole,
                              })}
                            </span>
                            · {formatDateTime(report.createdAt)} · {t(`admin.reportStatus.${report.status}`)}
                          </p>
                          <p className="mt-0.5 whitespace-pre-line break-words">{report.reason}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </ReviewCard>
            </li>
          ))}
        </ul>
      )}

      {pagination && pagination.totalPages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-sm" aria-label={t('list.pageSummary', pagination)}>
          <span className="text-muted-foreground tabular-nums">{t('list.pageSummary', pagination)}</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1 || query.isFetching} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft aria-hidden="true" />
              {t('list.prev')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages || query.isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('list.next')}
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}

      <AuditReasonDialog
        open={Boolean(pending)}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.decision === 'HIDE' ? t('admin.hideTitle') : t('admin.publishTitle')}
        description={pending?.decision === 'HIDE' ? t('admin.hideDescription') : t('admin.publishDescription')}
        confirmLabel={pending?.decision === 'HIDE' ? t('admin.hide') : t('admin.publish')}
        variant={pending?.decision === 'HIDE' ? 'destructive' : 'default'}
        onConfirm={(reason) => (pending ? moderate(pending, reason) : Promise.resolve())}
      />
    </div>
  )
}
