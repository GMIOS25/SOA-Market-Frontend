import { useMutation, useQuery } from '@tanstack/react-query'
import { ExternalLink, FileText, Film, ImageOff, Loader2, Paperclip, RotateCcw, ShieldAlert, Upload } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/errors'
import { CopyableId } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { openBlobInNewTab, readAsDataUrl } from '@/features/seller-shop/file-utils'
import { formatDateTime } from '@/lib/format'
import { apiDownloadComplaintEvidence, complaintKeys, type EvidenceView } from '../api'
import {
  ACCEPTED_EVIDENCE_MIMES,
  MAX_EVIDENCE_PER_PARTY,
  countActiveEvidenceByRole,
  formatFileSize,
  validateEvidenceFile,
} from '../helpers'
import { ComplaintActionErrorAlert } from './ComplaintActionErrorAlert'

type EvidenceCardProps = {
  complaintId: string
  evidence: EvidenceView
}

function EvidenceCard({ complaintId, evidence }: EvidenceCardProps) {
  const { t } = useTranslation('complaints')
  const isImage = evidence.mimeType.startsWith('image/')
  const isRemoved = Boolean(evidence.removedByCs)
  const uploaderLabel = t(`roles.${evidence.uploaderRole}` as never, {
    defaultValue: evidence.uploaderRole,
  }) as string

  const imageQuery = useQuery({
    queryKey: complaintKeys.evidenceBlob(complaintId, evidence.evidenceId),
    queryFn: async () => {
      const blob = await apiDownloadComplaintEvidence(complaintId, evidence.evidenceId)
      return { blob, dataUrl: await readAsDataUrl(blob) }
    },
    enabled: isImage && !isRemoved,
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
  })

  const openFileMutation = useMutation({
    mutationFn: () => apiDownloadComplaintEvidence(complaintId, evidence.evidenceId),
    onSuccess: (blob) => {
      openBlobInNewTab(blob)
    },
  })

  return (
    <article className="flex flex-col gap-2.5 rounded-md border border-border bg-background p-3">
      {isRemoved ? (
        <div className="flex items-start gap-2 rounded bg-status-danger/60 p-2.5 text-xs text-status-danger-foreground">
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {t('evidence.removedByCs', {
              reason: evidence.removedReason ? ` (${evidence.removedReason})` : '',
            })}
          </span>
        </div>
      ) : isImage ? (
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded bg-muted">
          {imageQuery.isPending && <Skeleton className="size-full" />}
          {imageQuery.isError && (
            <div className="flex flex-col items-center gap-2 p-3 text-center text-xs text-muted-foreground">
              <ImageOff aria-hidden="true" className="size-6" />
              <span>{t('evidence.imageError')}</span>
              <Button type="button" variant="outline" size="xs" onClick={() => void imageQuery.refetch()}>
                <RotateCcw aria-hidden="true" />
                {t('evidence.retryImage')}
              </Button>
            </div>
          )}
          {imageQuery.data?.dataUrl && (
            <img
              src={imageQuery.data.dataUrl}
              alt={`${uploaderLabel} · ${evidence.mimeType}`}
              className="size-full object-contain"
            />
          )}
        </div>
      ) : (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded bg-muted/60 p-4 text-center">
          {evidence.mimeType.startsWith('video/') ? (
            <Film aria-hidden="true" className="size-8 text-primary" />
          ) : (
            <FileText aria-hidden="true" className="size-8 text-primary" />
          )}
          <span className="text-xs font-medium text-foreground">{evidence.mimeType}</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">{formatFileSize(evidence.fileSize)}</span>
        </div>
      )}

      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-foreground">{uploaderLabel}</span>
          <span className="text-muted-foreground tabular-nums">{formatFileSize(evidence.fileSize)}</span>
        </div>
        <p className="text-[11px] text-muted-foreground tabular-nums">{formatDateTime(evidence.uploadedAt)}</p>
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <CopyableId
            value={evidence.fileHash}
            display={`SHA-256: ${evidence.fileHash.slice(0, 10)}…`}
            label="SHA-256"
            className="text-[11px]"
          />
          {!isRemoved && (
            isImage && imageQuery.data ? (
              <Button
                type="button"
                variant="link"
                size="xs"
                className="h-auto px-0"
                onClick={() => openBlobInNewTab(imageQuery.data.blob)}
              >
                <ExternalLink aria-hidden="true" />
                {t('evidence.openFile')}
              </Button>
            ) : !isImage ? (
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={openFileMutation.isPending}
                onClick={() => openFileMutation.mutate()}
              >
                {openFileMutation.isPending ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : (
                  <ExternalLink aria-hidden="true" />
                )}
                {t('evidence.downloadFile')}
              </Button>
            ) : null
          )}
        </div>
        {openFileMutation.isError && (
          <p role="alert" className="text-[11px] text-status-danger-foreground">
            {openFileMutation.error instanceof Error ? openFileMutation.error.message : t('evidence.imageError')}
          </p>
        )}
      </div>
    </article>
  )
}

export type ComplaintEvidenceSectionProps = {
  complaintId: string
  evidences: EvidenceView[]
  viewerRole: 'BUYER' | 'SELLER'
  canUpload: boolean
  isUploading?: boolean
  uploadError?: ApiError | Error | null
  onUploadFile: (file: File) => Promise<void> | void
}

/**
 * Hiển thị danh sách bằng chứng bất biến kèm mã băm SHA-256 và cho phép tải lên tối đa 5 tệp/bên.
 */
export function ComplaintEvidenceSection({
  complaintId,
  evidences,
  viewerRole,
  canUpload,
  isUploading = false,
  uploadError = null,
  onUploadFile,
}: ComplaintEvidenceSectionProps) {
  const { t } = useTranslation('complaints')
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [clientError, setClientError] = useState<string | null>(null)

  const usedByParty = countActiveEvidenceByRole(evidences, viewerRole)
  const quotaReached = usedByParty >= MAX_EVIDENCE_PER_PARTY

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    const check = validateEvidenceFile(file)
    if (!check.ok) {
      setClientError(t(`evidence.validation.${check.code}`))
      return
    }
    setClientError(null)
    await onUploadFile(file)
  }

  return (
    <section
      aria-labelledby="complaint-evidence-heading"
      className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5"
    >
      <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Paperclip aria-hidden="true" className="size-4 text-primary" />
            <h2 id="complaint-evidence-heading" className="text-base font-semibold">
              {t('evidence.title')}
            </h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
              {t('evidence.count', { count: evidences.length })}
            </span>
          </div>
          {canUpload && (
            <p className="text-xs text-muted-foreground">
              {t('evidence.partyQuota', { used: usedByParty, max: MAX_EVIDENCE_PER_PARTY })}
            </p>
          )}
        </div>

        {canUpload && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading || quotaReached}
              onClick={() => inputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <Upload aria-hidden="true" />
              )}
              {isUploading ? t('evidence.uploading') : t('evidence.uploadButton')}
            </Button>
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept={ACCEPTED_EVIDENCE_MIMES.join(',')}
              className="sr-only"
              tabIndex={-1}
              aria-label={t('evidence.uploadButton')}
              onChange={(event) => void handleFileChange(event)}
            />
          </div>
        )}
      </div>

      {canUpload && (
        <p className="text-xs text-muted-foreground">
          {quotaReached ? t('evidence.quotaReached', { max: MAX_EVIDENCE_PER_PARTY }) : t('evidence.uploadHint')}
        </p>
      )}

      {clientError && (
        <div
          role="alert"
          className="rounded-md border border-status-danger-border bg-status-danger px-3 py-2 text-xs text-status-danger-foreground"
        >
          {clientError}
        </div>
      )}

      {uploadError && <ComplaintActionErrorAlert error={uploadError} />}

      {evidences.length === 0 ? (
        <p className="rounded-md bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
          {t('evidence.empty')}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {evidences.map((evidence) => (
            <EvidenceCard key={evidence.evidenceId} complaintId={complaintId} evidence={evidence} />
          ))}
        </div>
      )}
    </section>
  )
}
