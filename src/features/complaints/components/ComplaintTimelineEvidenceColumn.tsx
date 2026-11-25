import {
  ArrowRight,
  Download,
  ExternalLink,
  Eye,
  History,
  Loader2,
  MessageSquare,
  Paperclip,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/errors'
import { CopyableId } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDateTime, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  apiDownloadComplaintEvidence,
  formatFileSize,
  openEvidenceBlob,
  readBlobAsDataUrl,
  type ComplaintMessageView,
  type ComplaintStatusHistoryView,
  type EvidenceView,
} from '../api'

export type ComplaintTimelineEvidenceColumnProps = {
  complaintId: string
  statusHistory: ComplaintStatusHistoryView[]
  messages: ComplaintMessageView[]
  evidences: EvidenceView[]
}

type TimelineEntry =
  | { kind: 'status'; id: string; timestamp: string; timestampMs: number; data: ComplaintStatusHistoryView }
  | { kind: 'message'; id: string; timestamp: string; timestampMs: number; data: ComplaintMessageView }

function extensionFromMime(mimeType: string): string {
  const normalized = mimeType.toLowerCase().split(';')[0]?.trim() ?? ''
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'application/pdf': 'pdf',
  }
  return map[normalized] ?? 'bin'
}

type EvidenceCardProps = {
  complaintId: string
  evidence: EvidenceView
}

function EvidenceCard({ complaintId, evidence }: EvidenceCardProps) {
  const { t } = useTranslation('complaints')
  const [busyAction, setBusyAction] = useState<'preview' | 'download' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<{ blob: Blob; dataUrl: string } | null>(null)

  const isImage = evidence.mimeType.toLowerCase().startsWith('image/')
  const uploaderRoleLabel = t(`common.roles.${evidence.uploaderRole}` as never, {
    defaultValue: evidence.uploaderRole,
  }) as string

  async function handlePreview() {
    setError(null)
    setBusyAction('preview')
    try {
      const blob = await apiDownloadComplaintEvidence(complaintId, evidence.evidenceId)
      if (isImage) {
        const dataUrl = await readBlobAsDataUrl(blob)
        setPreviewData({ blob, dataUrl })
      } else {
        openEvidenceBlob(blob)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('timeline.evidence.previewError'))
    } finally {
      setBusyAction(null)
    }
  }

  async function handleDownload() {
    setError(null)
    setBusyAction('download')
    try {
      const blob = await apiDownloadComplaintEvidence(complaintId, evidence.evidenceId)
      const ext = extensionFromMime(evidence.mimeType)
      openEvidenceBlob(blob, `evidence-${evidence.evidenceId.slice(0, 8)}.${ext}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('timeline.evidence.previewError'))
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <li className="flex flex-col gap-2.5 rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded border border-border bg-card px-2 py-0.5 font-medium text-foreground">
              {uploaderRoleLabel}
            </span>
            <span className="font-mono text-muted-foreground">{evidence.mimeType}</span>
            <span className="text-muted-foreground tabular-nums">{formatFileSize(evidence.fileSize)}</span>
          </div>
          <span className="text-muted-foreground tabular-nums">
            {t('timeline.evidence.uploadedAt')}: {formatDateTime(evidence.uploadedAt)}
          </span>
        </div>

        {evidence.removedByCs && (
          <span className="rounded-full border border-status-danger-border bg-status-danger px-2 py-0.5 text-[11px] font-medium text-status-danger-foreground">
            {t('timeline.evidence.removedTag')}
          </span>
        )}
      </div>

      {evidence.removedReason && (
        <p className="text-xs text-status-danger-foreground">
          {t('timeline.evidence.removedReason', { reason: evidence.removedReason })}
        </p>
      )}

      {/* Mã kiểm toàn SHA-256 bất biến */}
      <div className="flex flex-col gap-1 rounded-md border border-border bg-card px-2.5 py-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          <ShieldCheck aria-hidden="true" className="size-3.5 text-status-success-foreground" />
          <span>SHA-256</span>
        </div>
        <CopyableId
          value={evidence.fileHash}
          label={t('timeline.evidence.sha256Label')}
          className="w-full items-start [&>span:first-child]:flex-1 [&>span:first-child]:whitespace-normal [&>span:first-child]:break-all [&>span:first-child]:text-foreground"
        />
      </div>

      {previewData && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-2">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="link"
              size="xs"
              className="h-auto px-0"
              onClick={() => openEvidenceBlob(previewData.blob)}
            >
              <ExternalLink aria-hidden="true" />
              {t('timeline.evidence.openNewTab')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t('timeline.evidence.closePreview')}
              onClick={() => setPreviewData(null)}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
          <img
            src={previewData.dataUrl}
            alt={`${uploaderRoleLabel} · ${evidence.evidenceId}`}
            className="max-h-64 w-full rounded bg-muted object-contain"
          />
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-status-danger-foreground">
          <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={busyAction !== null}
          onClick={() => void handlePreview()}
        >
          {busyAction === 'preview' ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <Eye aria-hidden="true" />
          )}
          {busyAction === 'preview' ? t('timeline.evidence.loadingPreview') : t('timeline.evidence.preview')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={busyAction !== null}
          onClick={() => void handleDownload()}
        >
          {busyAction === 'download' ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <Download aria-hidden="true" />
          )}
          {t('timeline.evidence.download')}
        </Button>
      </div>
    </li>
  )
}

/**
 * Cột 2 Workspace Phân xử — Dòng thời gian bất biến & Bằng chứng SHA-256 (FR-CPL-003, FR-CPL-009, DC-18).
 */
export function ComplaintTimelineEvidenceColumn({
  complaintId,
  statusHistory,
  messages,
  evidences,
}: ComplaintTimelineEvidenceColumnProps) {
  const { t } = useTranslation('complaints')

  const timelineEntries = useMemo<TimelineEntry[]>(() => {
    const entries: TimelineEntry[] = [
      ...statusHistory.map((item) => ({
        kind: 'status' as const,
        id: item.historyId,
        timestamp: item.at,
        timestampMs: Date.parse(item.at),
        data: item,
      })),
      ...messages.map((item) => ({
        kind: 'message' as const,
        id: item.messageId,
        timestamp: item.createdAt,
        timestampMs: Date.parse(item.createdAt),
        data: item,
      })),
    ]
    return entries.sort((a, b) => {
      if (a.timestampMs !== b.timestampMs) return a.timestampMs - b.timestampMs
      if (a.kind !== b.kind) return a.kind === 'status' ? -1 : 1
      return a.id.localeCompare(b.id)
    })
  }, [statusHistory, messages])

  return (
    <section
      aria-labelledby="workspace-col-timeline"
      className="flex min-w-0 flex-col gap-4"
    >
      <h2 id="workspace-col-timeline" className="text-base font-semibold text-foreground">
        {t('workspace.columns.timelineEvidence')}
      </h2>

      {/* Dòng thời gian bất biến */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-border pb-2.5">
          <History aria-hidden="true" className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{t('timeline.title')}</h3>
        </div>

        {timelineEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('timeline.empty')}</p>
        ) : (
          <ol className="space-y-4 border-l-2 border-border pl-4">
            {timelineEntries.map((entry) =>
              entry.kind === 'status' ? (
                <li key={`status-${entry.id}`} className="relative space-y-1.5 text-sm">
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-primary bg-card"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {entry.data.fromStatus
                        ? t('timeline.statusChange.fromTo')
                        : t('timeline.statusChange.initial')}
                    </span>
                    <time
                      dateTime={entry.data.at}
                      className="text-xs text-muted-foreground tabular-nums"
                    >
                      {formatDateTime(entry.data.at)}
                    </time>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {entry.data.fromStatus && (
                      <>
                        <StatusBadge status={entry.data.fromStatus} />
                        <ArrowRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
                      </>
                    )}
                    <StatusBadge status={entry.data.toStatus} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('timeline.statusChange.actor', { actor: entry.data.actor })}
                  </p>
                  {entry.data.reason && (
                    <p className="rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-foreground">
                      {t('timeline.statusChange.reason', { reason: entry.data.reason })}
                    </p>
                  )}
                </li>
              ) : (
                <li key={`msg-${entry.id}`} className="relative space-y-1.5 text-sm">
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-border bg-card"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                        entry.data.senderRole === 'CS'
                          ? 'border-status-info-border bg-status-info text-status-info-foreground'
                          : 'border-border bg-muted text-foreground',
                      )}
                    >
                      <MessageSquare aria-hidden="true" className="size-3" />
                      {
                        t(`common.roles.${entry.data.senderRole}` as never, {
                          defaultValue: entry.data.senderRole,
                        }) as string
                      }
                    </span>
                    <time
                      dateTime={entry.data.createdAt}
                      className="text-xs text-muted-foreground tabular-nums"
                    >
                      {formatDateTime(entry.data.createdAt)}
                    </time>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {entry.data.content}
                  </p>
                  {entry.data.proposal && (
                    <div className="space-y-1 rounded-md border border-status-info-border bg-status-info p-2.5 text-xs text-status-info-foreground">
                      <p className="font-semibold">
                        {t('timeline.message.proposalLabel', { action: entry.data.proposal.action })}
                      </p>
                      {entry.data.proposal.resolution && (
                        <p>
                          {t('timeline.message.proposalResolution', {
                            resolution: t(`common.resolutions.${entry.data.proposal.resolution}` as never, {
                              defaultValue: entry.data.proposal.resolution,
                            }) as string,
                          })}
                        </p>
                      )}
                      {entry.data.proposal.refundAmount !== undefined && (
                        <p className="tabular-nums">
                          {t('timeline.message.proposalRefund', {
                            amount: formatVnd(entry.data.proposal.refundAmount),
                          })}
                        </p>
                      )}
                      {entry.data.proposal.note && <p>{entry.data.proposal.note}</p>}
                    </div>
                  )}
                </li>
              ),
            )}
          </ol>
        )}
      </div>

      {/* Bằng chứng & SHA-256 */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
          <div className="flex items-center gap-2">
            <Paperclip aria-hidden="true" className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{t('timeline.evidence.title')}</h3>
          </div>
          <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
            {t('timeline.evidence.count', { count: evidences.length })}
          </span>
        </div>

        {evidences.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('timeline.evidence.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {evidences.map((ev) => (
              <EvidenceCard key={ev.evidenceId} complaintId={complaintId} evidence={ev} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
