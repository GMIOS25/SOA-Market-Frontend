import { ArrowRight, FileCheck2, History, Lock, MessageSquare } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDateTime, formatDateTimeFull, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ComplaintDetailView } from '../api'
import { buildComplaintTimeline, formatFileSize } from '../helpers'

type TimelineFilter = 'ALL' | 'status' | 'message' | 'evidence'

export type ComplaintTimelineProps = {
  detail: Pick<ComplaintDetailView, 'statusHistory' | 'messages' | 'evidences'>
}

const ROLE_BADGE_STYLE: Record<string, string> = {
  BUYER: 'border-status-info-border bg-status-info text-status-info-foreground',
  SELLER: 'border-status-warning-border bg-status-warning text-status-warning-foreground',
  CS: 'border-status-success-border bg-status-success text-status-success-foreground',
  SYSTEM: 'border-status-neutral-border bg-status-neutral text-status-neutral-foreground',
}

/**
 * Dòng thời gian bất biến hiển thị lịch sử trạng thái, trao đổi/đề xuất thương lượng và bằng chứng
 * đúng thứ tự phát sinh (FR-CPL-009). Không hỗ trợ chỉnh sửa hoặc xóa.
 */
export function ComplaintTimeline({ detail }: ComplaintTimelineProps) {
  const { t } = useTranslation('complaints')
  const [filter, setFilter] = useState<TimelineFilter>('ALL')

  const items = useMemo(() => buildComplaintTimeline(detail), [detail])
  const filtered = useMemo(
    () => (filter === 'ALL' ? items : items.filter((item) => item.kind === filter)),
    [items, filter],
  )

  return (
    <section
      aria-labelledby="complaint-timeline-heading"
      className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5"
    >
      <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <History aria-hidden="true" className="size-4 text-primary" />
            <h2 id="complaint-timeline-heading" className="text-base font-semibold">
              {t('timeline.title')}
            </h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
              {t('timeline.count', { count: items.length })}
            </span>
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <span>{t('timeline.immutableNotice')}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('timeline.title')}>
        {(['ALL', 'status', 'message', 'evidence'] as const).map((kind) => {
          const active = filter === kind
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(kind)}
              className={cn(
                'inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                active
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`timeline.filters.${kind}`)}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
          {t('timeline.empty')}
        </p>
      ) : (
        <ol className="space-y-4 border-l-2 border-border pl-4">
          {filtered.map((item) => {
            if (item.kind === 'status') {
              const { entry } = item
              return (
                <li key={item.id} data-timeline-kind="status" className="relative space-y-1.5 text-sm">
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-primary bg-card"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">{t('timeline.statusChanged')}</span>
                      {entry.fromStatus && (
                        <>
                          <StatusBadge status={entry.fromStatus} />
                          <ArrowRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
                        </>
                      )}
                      <StatusBadge status={entry.toStatus} />
                    </div>
                    <time
                      dateTime={entry.at}
                      title={formatDateTimeFull(entry.at)}
                      className="text-xs text-muted-foreground tabular-nums"
                    >
                      {formatDateTime(entry.at)}
                    </time>
                  </div>
                  {entry.reason && <p className="text-xs text-muted-foreground">{entry.reason}</p>}
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {t('timeline.actorLabel', { actor: entry.actor })}
                  </p>
                </li>
              )
            }

            if (item.kind === 'message') {
              const { entry } = item
              const roleLabel = t(`roles.${entry.senderRole}` as never, {
                defaultValue: entry.senderRole,
              }) as string
              const badgeStyle = ROLE_BADGE_STYLE[entry.senderRole] ?? ROLE_BADGE_STYLE.SYSTEM

              return (
                <li key={item.id} data-timeline-kind="message" className="relative space-y-2 text-sm">
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-border bg-card"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare aria-hidden="true" className="size-3.5 text-muted-foreground" />
                      <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', badgeStyle)}>
                        {roleLabel}
                      </span>
                    </div>
                    <time
                      dateTime={entry.createdAt}
                      title={formatDateTimeFull(entry.createdAt)}
                      className="text-xs text-muted-foreground tabular-nums"
                    >
                      {formatDateTime(entry.createdAt)}
                    </time>
                  </div>

                  <p className="rounded-md bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap text-foreground">
                    {entry.content}
                  </p>

                  {entry.proposal && (
                    <div className="space-y-1 rounded-md border border-status-warning-border bg-status-warning/50 px-3 py-2 text-xs text-status-warning-foreground">
                      <p className="font-semibold">{t('timeline.proposalLabel')}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        {entry.proposal.resolution && (
                          <span>
                            {t('proposal.proposedResolution')}:{' '}
                            <strong>
                              {t(`resolutions.${entry.proposal.resolution}` as never, {
                                defaultValue: entry.proposal.resolution,
                              }) as string}
                            </strong>
                          </span>
                        )}
                        {entry.proposal.refundAmount !== undefined && entry.proposal.refundAmount > 0 && (
                          <span className="tabular-nums">
                            {t('proposal.proposedRefund')}: <strong>{formatVnd(entry.proposal.refundAmount)}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              )
            }

            const { entry } = item
            const uploaderLabel = t(`roles.${entry.uploaderRole}` as never, {
              defaultValue: entry.uploaderRole,
            }) as string

            return (
              <li key={item.id} data-timeline-kind="evidence" className="relative space-y-1 text-sm">
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-border bg-card"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileCheck2 aria-hidden="true" className="size-3.5 text-primary" />
                    <span className="text-xs font-medium text-foreground">{t('timeline.evidenceUploaded')}</span>
                    <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {uploaderLabel}
                    </span>
                  </div>
                  <time
                    dateTime={entry.uploadedAt}
                    title={formatDateTimeFull(entry.uploadedAt)}
                    className="text-xs text-muted-foreground tabular-nums"
                  >
                    {formatDateTime(entry.uploadedAt)}
                  </time>
                </div>
                <p className="text-xs text-muted-foreground">
                  {entry.mimeType} · {formatFileSize(entry.fileSize)} ·{' '}
                  <span className="font-mono">{t('timeline.evidenceHash', { hash: `${entry.fileHash.slice(0, 16)}…` })}</span>
                </p>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
