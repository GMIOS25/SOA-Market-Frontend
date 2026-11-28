import { MessageSquareReply } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDateTime } from '@/lib/format'
import { reviewImageUrl, type ReplyDTO } from '../api'
import { ReviewStars } from './ReviewStars'

type ReviewCardProps = {
  stars: number
  content?: string
  createdAt: string
  imageUrls?: string[] | null
  reply?: ReplyDTO
  /** Badge trạng thái / thông tin phụ cạnh ngày (VD trang kiểm duyệt). */
  meta?: ReactNode
  /** Hành động: Báo cáo / Phản hồi / Kiểm duyệt. */
  actions?: ReactNode
  /** Nội dung bổ sung dưới phản hồi (VD danh sách báo cáo cho Admin). */
  children?: ReactNode
}

/** Hiển thị 1 đánh giá: sao, ngày, nội dung, ảnh thực tế, phản hồi của nhà bán (FR-REV-002/003). Không lộ danh tính người mua (NĐ 13/2023). */
export function ReviewCard({ stars, content, createdAt, imageUrls, reply, meta, actions, children }: ReviewCardProps) {
  const { t } = useTranslation('reviews')
  const images = imageUrls ?? []

  return (
    <article className="flex flex-col gap-3 border-b border-border py-4 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ReviewStars stars={stars} />
          <time dateTime={createdAt} className="text-xs text-muted-foreground tabular-nums">
            {formatDateTime(createdAt)}
          </time>
          {meta}
        </div>
        {actions && <div className="flex flex-wrap gap-1.5">{actions}</div>}
      </div>

      {content && <p className="text-sm whitespace-pre-line break-words text-foreground">{content}</p>}

      {images.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {images.map((url, index) => (
            <li key={url}>
              <a
                href={reviewImageUrl(url)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('list.openImage', { index: index + 1 })}
                className="block size-20 overflow-hidden rounded-md border border-border bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <img
                  src={reviewImageUrl(url)}
                  alt={t('list.imageAlt', { index: index + 1 })}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </a>
            </li>
          ))}
        </ul>
      )}

      {reply && (
        <div className="flex gap-2 rounded-md border-l-4 border-primary bg-primary-soft px-3 py-2 text-sm">
          <MessageSquareReply aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-primary">
              {t('list.sellerReply')} ·{' '}
              <time dateTime={reply.createdAt} className="font-normal tabular-nums">
                {formatDateTime(reply.createdAt)}
              </time>
            </p>
            <p className="mt-0.5 whitespace-pre-line break-words">{reply.content}</p>
          </div>
        </div>
      )}

      {children}
    </article>
  )
}
