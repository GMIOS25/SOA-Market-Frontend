import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Flag, MessageSquareReply, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { loginPathFor } from '@/app/redirects'
import { ServiceFallbackBanner } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthSession } from '@/lib/auth/session'
import { cn } from '@/lib/utils'
import {
  apiGetProductReviews,
  apiReplyReview,
  apiReportReview,
  REASON_MAX,
  REPLY_CONTENT_MAX,
  reviewKeys,
  type ProductReviewsQuery,
  type ReviewDTO,
} from '../api'
import { RatingSummary } from './RatingSummary'
import { ReviewCard } from './ReviewCard'
import { TextEntryDialog } from './TextEntryDialog'

const PAGE_SIZE = 10
const STAR_FILTERS = [5, 4, 3, 2, 1] as const

type ProductReviewsPanelProps = {
  productId: string
  /** `public`: trang sản phẩm (báo cáo khi đã đăng nhập). `seller`: trang nhà bán (thêm Phản hồi 1 lần). */
  mode?: 'public' | 'seller'
  /** Ẩn bảng tổng hợp khi trang cha đã hiển thị điểm (VD `/seller/reviews`). */
  showSummary?: boolean
}

/**
 * Danh sách đánh giá đang hiển thị của 1 sản phẩm (FR-REV-002) — query độc lập: SVC-REV lỗi thì CHỈ khối
 * này hiện `<ServiceFallbackBanner />`, phần còn lại của trang (thêm giỏ, thông tin SP) vẫn chạy (NFR-REL-005).
 */
export function ProductReviewsPanel({ productId, mode = 'public', showSummary = true }: ProductReviewsPanelProps) {
  const { t } = useTranslation('reviews')
  const queryClient = useQueryClient()
  const location = useLocation()
  const { accessToken } = useAuthSession()
  const [stars, setStars] = useState(0)
  const [hasImages, setHasImages] = useState(false)
  const [page, setPage] = useState(1)
  const [reporting, setReporting] = useState<ReviewDTO | null>(null)
  const [replying, setReplying] = useState<ReviewDTO | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const query: ProductReviewsQuery = { page, pageSize: PAGE_SIZE, ...(stars ? { stars } : {}), ...(hasImages ? { hasImages } : {}) }
  const reviewsQuery = useQuery({
    queryKey: reviewKeys.product(productId, query),
    queryFn: () => apiGetProductReviews(productId, query),
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 60_000,
  })

  const data = reviewsQuery.data
  const reviews = data?.data ?? []
  const pagination = data?.pagination
  const summary = data?.summary
  const filtered = stars !== 0 || hasImages

  function applyFilter(nextStars: number, nextHasImages: boolean) {
    setStars(nextStars)
    setHasImages(nextHasImages)
    setPage(1)
  }

  async function report(review: ReviewDTO, reason: string) {
    const result = await apiReportReview(review.reviewId, reason)
    const hidden = result.reviewStatus !== 'PUBLISHED'
    setNotice(t(hidden ? 'report.hiddenAfterReport' : 'report.success'))
    if (hidden) void queryClient.invalidateQueries({ queryKey: reviewKeys.productAll(productId) })
  }

  async function reply(review: ReviewDTO, content: string) {
    await apiReplyReview(review.reviewId, content)
    setNotice(t('reply.success'))
    await queryClient.invalidateQueries({ queryKey: reviewKeys.productAll(productId) })
  }

  if (reviewsQuery.isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (reviewsQuery.isError && !data) {
    return (
      <ServiceFallbackBanner
        message={t('list.loadError')}
        onRetry={() => void reviewsQuery.refetch()}
        isRetrying={reviewsQuery.isFetching}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {showSummary && summary && summary.totalCount > 0 && (
        <RatingSummary avgStars={summary.avgStars} totalCount={summary.totalCount} starCounts={summary.starCounts} />
      )}

      {notice && (
        <div
          role="status"
          className="flex items-start justify-between gap-2 rounded-md border border-status-success-border bg-status-success px-3 py-2 text-sm text-status-success-foreground"
        >
          <span>{notice}</span>
          <button
            type="button"
            aria-label={t('admin.dismiss')}
            onClick={() => setNotice(null)}
            className="rounded p-0.5 hover:bg-background/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      )}

      {(reviews.length > 0 || filtered) && (
        <div role="group" aria-label={t('list.filterLabel')} className="flex flex-wrap gap-2">
          <FilterChip active={!filtered} onClick={() => applyFilter(0, false)}>
            {t('list.filterAll')}
          </FilterChip>
          {STAR_FILTERS.map((value) => (
            <FilterChip key={value} active={stars === value} onClick={() => applyFilter(stars === value ? 0 : value, hasImages)}>
              {t('list.filterStars', { count: value })}
            </FilterChip>
          ))}
          <FilterChip active={hasImages} onClick={() => applyFilter(stars, !hasImages)}>
            {t('list.filterWithImages')}
          </FilterChip>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">{filtered ? t('list.emptyFiltered') : t('list.empty')}</p>
      ) : (
        <div aria-busy={reviewsQuery.isFetching} className={cn(reviewsQuery.isFetching && 'opacity-60')}>
          {reviews.map((review) => (
            <ReviewCard
              key={review.reviewId}
              stars={review.stars}
              content={review.content}
              createdAt={review.createdAt}
              imageUrls={review.imageUrls}
              reply={review.reply}
              actions={
                <>
                  {mode === 'seller' && !review.reply && (
                    <Button type="button" variant="outline" size="xs" onClick={() => setReplying(review)}>
                      <MessageSquareReply aria-hidden="true" />
                      {t('list.reply')}
                    </Button>
                  )}
                  {accessToken ? (
                    <Button type="button" variant="ghost" size="xs" onClick={() => setReporting(review)}>
                      <Flag aria-hidden="true" />
                      {t('list.report')}
                    </Button>
                  ) : (
                    <Button asChild variant="link" size="xs" className="h-auto px-0">
                      <Link to={loginPathFor(location)}>{t('report.loginToReport')}</Link>
                    </Button>
                  )}
                </>
              }
            />
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-sm" aria-label={t('list.pageSummary', pagination)}>
          <span className="text-muted-foreground tabular-nums">{t('list.pageSummary', pagination)}</span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || reviewsQuery.isFetching}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft aria-hidden="true" />
              {t('list.prev')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages || reviewsQuery.isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('list.next')}
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}

      <TextEntryDialog
        open={Boolean(reporting)}
        onOpenChange={(open) => !open && setReporting(null)}
        title={t('report.title')}
        description={t('report.description')}
        label={t('report.label')}
        placeholder={t('report.placeholder')}
        confirmLabel={t('report.confirm')}
        maxLength={REASON_MAX}
        onConfirm={(reason) => report(reporting!, reason)}
      />
      <TextEntryDialog
        open={Boolean(replying)}
        onOpenChange={(open) => !open && setReplying(null)}
        title={t('reply.title')}
        description={t('reply.description')}
        label={t('reply.label')}
        placeholder={t('reply.placeholder')}
        confirmLabel={t('reply.confirm')}
        maxLength={REPLY_CONTENT_MAX}
        onConfirm={(content) => reply(replying!, content)}
      />
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'h-8 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        active ? 'border-primary bg-primary-soft text-primary' : 'border-input bg-card text-foreground hover:bg-background',
      )}
    >
      {children}
    </button>
  )
}
