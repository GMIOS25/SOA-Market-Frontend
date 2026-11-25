import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Headset,
  Info,
  Loader2,
  MessageSquare,
  PackageX,
  RefreshCw,
  Scale,
  Split,
  Undo2,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ApiError } from '@/api/errors'
import { CopyableId, ServiceFallbackBanner, SlaCountdownPill } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import {
  apiGetOrder,
  apiGetPublicShop,
  fallbackShopName,
} from '@/features/cart-checkout-order/api'
import { formatDateTime, formatVnd } from '@/lib/format'
import {
  apiEscalateComplaint,
  apiGetComplaintDetail,
  apiRespondToComplaint,
  apiUploadComplaintEvidence,
  apiWithdrawComplaint,
  complaintKeys,
} from '../api'
import { ComplaintActionErrorAlert } from '../components/ComplaintActionErrorAlert'
import { ComplaintEvidenceSection } from '../components/ComplaintEvidenceSection'
import { ComplaintReasonDialog } from '../components/ComplaintReasonDialog'
import { ComplaintTimeline } from '../components/ComplaintTimeline'
import { findLatestSellerProposal, resolveComplaintSla } from '../helpers'
import { createBuyerNegotiationSchema, type BuyerNegotiationFormValues } from '../schemas'

function BuyerComplaintDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <Skeleton className="h-44 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
        <div className="space-y-4 lg:col-span-4">
          <Skeleton className="h-44 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

/**
 * Trang chi tiết khiếu nại dành cho Buyer (`/account/complaints/:id`).
 * Hỗ trợ: xem dòng thời gian bất biến, tải bằng chứng, thương lượng (chấp nhận / phản bác / nhắn tin),
 * rút khiếu nại (Withdraw) và yêu cầu CSKH hỗ trợ (Escalate).
 */
export function BuyerComplaintDetailPage() {
  const { t } = useTranslation('complaints')
  const { id: complaintId = '' } = useParams()
  const queryClient = useQueryClient()

  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [actionError, setActionError] = useState<ApiError | Error | null>(null)
  const [proposalNote, setProposalNote] = useState('')
  const [reasonDialogMode, setReasonDialogMode] = useState<'withdraw' | 'escalate' | null>(null)

  const detailQuery = useQuery({
    queryKey: complaintKeys.detail(complaintId),
    queryFn: () => apiGetComplaintDetail(complaintId),
    enabled: Boolean(complaintId),
    retry: false,
  })

  const detail = detailQuery.data
  const complaint = detail?.complaint

  const orderQuery = useQuery({
    queryKey: ['order', 'buyer', complaint?.orderId],
    queryFn: () => apiGetOrder(complaint!.orderId),
    enabled: Boolean(complaint?.orderId),
    retry: false,
  })

  const shopQuery = useQuery({
    queryKey: ['shop', 'public', complaint?.shopId],
    queryFn: () => apiGetPublicShop(complaint!.shopId),
    enabled: Boolean(complaint?.shopId),
    retry: false,
    staleTime: 5 * 60_000,
  })

  const negotiationSchema = useMemo(() => createBuyerNegotiationSchema(t), [t])
  const negotiationForm = useForm<BuyerNegotiationFormValues>({
    resolver: zodResolver(negotiationSchema),
    defaultValues: { content: '' },
  })

  function invalidateComplaintQueries() {
    void queryClient.invalidateQueries({ queryKey: complaintKeys.detail(complaintId) })
    void queryClient.invalidateQueries({ queryKey: complaintKeys.lists() })
  }

  const respondMutation = useMutation({
    mutationFn: (body: { action: string; content: string }) =>
      apiRespondToComplaint(complaintId, body),
    onMutate: () => {
      setActionError(null)
      setActionSuccess(null)
    },
    onSuccess: (_, variables) => {
      if (variables.action === 'ACCEPT_PROPOSAL') {
        setActionSuccess(t('proposal.acceptSuccess'))
        setProposalNote('')
      } else if (variables.action === 'REJECT_PROPOSAL') {
        setActionSuccess(t('proposal.rejectSuccess'))
        setProposalNote('')
      } else {
        setActionSuccess(t('detail.respondSuccess'))
        negotiationForm.reset({ content: '' })
      }
      invalidateComplaintQueries()
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err : new Error(String(err)))
    },
  })

  const uploadEvidenceMutation = useMutation({
    mutationFn: (file: File) => apiUploadComplaintEvidence(complaintId, file),
    onMutate: () => {
      setActionSuccess(null)
    },
    onSuccess: () => {
      setActionSuccess(t('detail.evidenceUploadSuccess'))
      invalidateComplaintQueries()
    },
  })

  const withdrawMutation = useMutation({
    mutationFn: (reason: string) => apiWithdrawComplaint(complaintId, reason),
    onSuccess: () => {
      setActionSuccess(t('detail.withdrawSuccess'))
      invalidateComplaintQueries()
    },
  })

  const escalateMutation = useMutation({
    mutationFn: (reason: string) => apiEscalateComplaint(complaintId, reason),
    onSuccess: () => {
      setActionSuccess(t('detail.escalateSuccess'))
      invalidateComplaintQueries()
    },
  })

  if (detailQuery.isLoading) {
    return <BuyerComplaintDetailSkeleton />
  }

  if (detailQuery.isError) {
    const apiErr = detailQuery.error instanceof ApiError ? detailQuery.error : null
    if (apiErr?.status === 404 || apiErr?.status === 403) {
      return (
        <section className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-12 text-center shadow-xs">
          <PackageX aria-hidden="true" className="size-10 text-muted-foreground" />
          <h1 className="text-xl font-bold">
            {apiErr.status === 403 ? t('common.forbiddenTitle') : t('common.notFoundTitle')}
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {apiErr.status === 403
              ? t('common.forbiddenDescription')
              : t('common.notFoundDescription')}
          </p>
          <Button asChild variant="outline" className="mt-1">
            <Link to="/account/complaints">{t('detail.backToBuyerList')}</Link>
          </Button>
        </section>
      )
    }

    if (apiErr?.isServiceUnavailable) {
      return (
        <div className="space-y-4">
          <Link
            to="/account/complaints"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            <span>{t('detail.backToBuyerList')}</span>
          </Link>
          <ServiceFallbackBanner
            message={apiErr.message || t('buyerList.loadError')}
            onRetry={() => void detailQuery.refetch()}
            isRetrying={detailQuery.isFetching}
          />
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <Link
          to="/account/complaints"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          <span>{t('detail.backToBuyerList')}</span>
        </Link>
        <ComplaintActionErrorAlert
          error={
            detailQuery.error instanceof Error
              ? detailQuery.error
              : new Error(t('buyerList.loadError'))
          }
        />
        <Button type="button" variant="outline" size="sm" onClick={() => void detailQuery.refetch()}>
          <RefreshCw aria-hidden="true" />
          {t('common.refresh')}
        </Button>
      </div>
    )
  }

  if (!detail || !complaint) return null

  const availableActions = detail.availableActions ?? []
  const canRespond = availableActions.includes('RESPOND')
  const canUploadEvidence = availableActions.includes('UPLOAD_EVIDENCE')
  const canWithdraw = availableActions.includes('WITHDRAW')
  const canEscalate = availableActions.includes('ESCALATE')

  const sla = resolveComplaintSla(complaint)
  const latestSellerProposal = findLatestSellerProposal(detail.messages)
  const shopName = shopQuery.data?.name || fallbackShopName(complaint.shopId)
  const matchedSellerOrder = orderQuery.data?.sellerOrders?.find(
    (so) => so.sellerOrderId === complaint.sellerOrderId,
  )
  const relatedComplaints = detail.relatedComplaints ?? []

  const submitNegotiation = (action: 'MESSAGE' | 'COUNTER') =>
    negotiationForm.handleSubmit((values) => {
      respondMutation.mutate({ action, content: values.content.trim() })
    })

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <Link
            to="/account/complaints"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            <span>{t('detail.backToBuyerList')}</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">{t('detail.title')}</h1>
            <CopyableId
              value={complaint.complaintCode}
              display={complaint.complaintCode}
              label={t('common.complaintCodeLabel')}
              className="rounded border border-border bg-card px-2 py-0.5 text-sm font-semibold text-foreground"
            />
            <StatusBadge status={complaint.status} />
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {t('detail.createdAt', { datetime: formatDateTime(complaint.createdAt) })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sla && (
            <SlaCountdownPill
              label={t(sla.labelKey)}
              startedAt={sla.startedAt}
              deadline={sla.deadline}
            />
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={detailQuery.isFetching}
            onClick={() => void detailQuery.refetch()}
          >
            <RefreshCw aria-hidden="true" className={detailQuery.isFetching ? 'animate-spin' : undefined} />
            {detailQuery.isFetching ? t('common.refreshing') : t('common.refresh')}
          </Button>
        </div>
      </header>

      {actionSuccess && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-status-success-border bg-status-success px-4 py-3 text-sm font-medium text-status-success-foreground"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
            {actionSuccess}
          </span>
          <button
            type="button"
            aria-label={t('common.cancel')}
            onClick={() => setActionSuccess(null)}
            className="rounded p-1 hover:bg-card/50"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      )}

      {actionError && (
        <ComplaintActionErrorAlert
          error={actionError}
          onReload={() => void detailQuery.refetch()}
        />
      )}

      {complaint.unverifiedFlag && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-status-warning-border bg-status-warning px-4 py-3 text-xs text-status-warning-foreground"
        >
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{t('common.unverifiedNotice')}</span>
        </div>
      )}

      {complaint.rejectionReason && (
        <div
          role="status"
          className="space-y-1 rounded-lg border border-status-danger-border bg-status-danger px-4 py-3 text-sm text-status-danger-foreground"
        >
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
            <span>{t('detail.rejectionTitle')}</span>
          </p>
          <p className="text-xs">{complaint.rejectionReason}</p>
        </div>
      )}

      {detail.resolution && (
        <section
          aria-labelledby="complaint-resolution-heading"
          className="space-y-3 rounded-lg border border-status-success-border bg-status-success/40 p-4 text-sm sm:p-5"
        >
          <h2 id="complaint-resolution-heading" className="flex items-center gap-2 text-base font-semibold text-status-success-foreground">
            <Scale aria-hidden="true" className="size-4" />
            <span>{t('detail.resolutionTitle')}</span>
          </h2>
          <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">{t('detail.outcomeLabel')}</dt>
              <dd className="font-semibold text-foreground">
                {t(`outcomes.${detail.resolution.outcome}` as never, {
                  defaultValue: detail.resolution.outcome,
                }) as string}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('detail.refundAmountLabel')}</dt>
              <dd className="font-bold text-price tabular-nums">
                {formatVnd(detail.resolution.refundAmount)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('detail.responsiblePartyLabel')}</dt>
              <dd className="font-medium text-foreground">
                {t(`parties.${detail.resolution.responsibleParty}` as never, {
                  defaultValue: detail.resolution.responsibleParty,
                }) as string}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('detail.decidedAtLabel')}</dt>
              <dd className="tabular-nums text-foreground">
                {formatDateTime(detail.resolution.decidedAt)}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-foreground">
            <span className="font-medium text-muted-foreground">{t('detail.reasonLabel')}: </span>
            {detail.resolution.reason}
          </p>
        </section>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-5 lg:col-span-8">
          {canRespond && latestSellerProposal && (
            <section
              aria-labelledby="seller-latest-proposal-heading"
              className="space-y-4 rounded-lg border border-status-warning-border bg-status-warning/30 p-4 shadow-xs sm:p-5"
            >
              <div className="space-y-1">
                <h2 id="seller-latest-proposal-heading" className="text-base font-semibold text-foreground">
                  {t('proposal.latestTitle')}
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  {latestSellerProposal.proposal.resolution && (
                    <span>
                      {t('proposal.proposedResolution')}:{' '}
                      <strong>
                        {t(`resolutions.${latestSellerProposal.proposal.resolution}` as never, {
                          defaultValue: latestSellerProposal.proposal.resolution,
                        }) as string}
                      </strong>
                    </span>
                  )}
                  {latestSellerProposal.proposal.refundAmount !== undefined &&
                    latestSellerProposal.proposal.refundAmount > 0 && (
                      <span className="tabular-nums">
                        {t('proposal.proposedRefund')}:{' '}
                        <strong className="text-price">
                          {formatVnd(latestSellerProposal.proposal.refundAmount)}
                        </strong>
                      </span>
                    )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('proposal.note')}: {latestSellerProposal.message.content}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="buyer-proposal-note">{t('proposal.responseNoteLabel')}</Label>
                <Textarea
                  id="buyer-proposal-note"
                  rows={2}
                  value={proposalNote}
                  onChange={(event) => setProposalNote(event.target.value)}
                  placeholder={t('proposal.responseNotePlaceholder')}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="cta"
                  size="sm"
                  disabled={respondMutation.isPending}
                  onClick={() =>
                    respondMutation.mutate({
                      action: 'ACCEPT_PROPOSAL',
                      content: proposalNote.trim() || t('proposal.acceptButton'),
                    })
                  }
                >
                  {respondMutation.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
                  {t('proposal.acceptButton')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={respondMutation.isPending}
                  onClick={() =>
                    respondMutation.mutate({
                      action: 'REJECT_PROPOSAL',
                      content: proposalNote.trim() || t('proposal.rejectButton'),
                    })
                  }
                >
                  {t('proposal.rejectButton')}
                </Button>
              </div>
            </section>
          )}

          {canRespond && (
            <section
              aria-labelledby="buyer-negotiation-heading"
              className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5"
            >
              <div className="space-y-1">
                <h2 id="buyer-negotiation-heading" className="flex items-center gap-2 text-base font-semibold">
                  <MessageSquare aria-hidden="true" className="size-4 text-primary" />
                  <span>{t('negotiation.buyerTitle')}</span>
                </h2>
                <p className="text-xs text-muted-foreground">{t('negotiation.buyerHint')}</p>
              </div>

              <form onSubmit={(event) => void submitNegotiation('MESSAGE')(event)} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="buyer-negotiation-content">{t('negotiation.contentLabel')}</Label>
                  <Textarea
                    id="buyer-negotiation-content"
                    rows={3}
                    placeholder={t('negotiation.contentPlaceholder')}
                    aria-invalid={negotiationForm.formState.errors.content ? true : undefined}
                    {...negotiationForm.register('content')}
                  />
                  {negotiationForm.formState.errors.content && (
                    <p className="text-xs text-status-danger-foreground">
                      {negotiationForm.formState.errors.content.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" size="sm" disabled={respondMutation.isPending}>
                    {respondMutation.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
                    {t('negotiation.sendMessage')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={respondMutation.isPending}
                    onClick={() => void submitNegotiation('COUNTER')()}
                  >
                    {t('negotiation.sendCounter')}
                  </Button>
                </div>
              </form>
            </section>
          )}

          <ComplaintTimeline detail={detail} />

          <ComplaintEvidenceSection
            complaintId={complaint.complaintId}
            evidences={detail.evidences ?? []}
            viewerRole="BUYER"
            canUpload={canUploadEvidence}
            isUploading={uploadEvidenceMutation.isPending}
            uploadError={uploadEvidenceMutation.error}
            onUploadFile={async (file) => {
              await uploadEvidenceMutation.mutateAsync(file)
            }}
          />
        </div>

        <aside className="min-w-0 space-y-4 lg:col-span-4">
          {(canEscalate || canWithdraw) && (
            <section
              aria-labelledby="buyer-actions-heading"
              className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5"
            >
              <h2 id="buyer-actions-heading" className="text-base font-semibold">
                {t('detail.buyerActionsTitle')}
              </h2>
              <div className="flex flex-col gap-2">
                {canEscalate && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setReasonDialogMode('escalate')}
                    className="w-full justify-start"
                  >
                    <Headset aria-hidden="true" />
                    {t('detail.escalateButton')}
                  </Button>
                )}
                {canWithdraw && (
                  <Button
                    type="button"
                    variant="destructive-outline"
                    onClick={() => setReasonDialogMode('withdraw')}
                    className="w-full justify-start"
                  >
                    <Undo2 aria-hidden="true" />
                    {t('detail.withdrawButton')}
                  </Button>
                )}
              </div>
            </section>
          )}

          <section
            aria-labelledby="complaint-summary-heading"
            className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5"
          >
            <h2 id="complaint-summary-heading" className="text-base font-semibold">
              {t('detail.summaryTitle')}
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t('detail.shopLabel')}</dt>
                <dd className="font-medium text-foreground">{shopName}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t('detail.typeLabel')}</dt>
                <dd className="font-medium text-foreground">
                  {t(`types.${complaint.type}` as never, { defaultValue: complaint.type }) as string}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t('detail.requestedResolutionLabel')}</dt>
                <dd className="font-medium text-foreground">
                  {t(`resolutions.${complaint.requestedResolution}` as never, {
                    defaultValue: complaint.requestedResolution,
                  }) as string}
                </dd>
              </div>
              {complaint.requestedRefundAmount !== undefined && complaint.requestedRefundAmount > 0 && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t('detail.requestedRefundLabel')}</dt>
                  <dd className="font-bold text-price tabular-nums">
                    {formatVnd(complaint.requestedRefundAmount)}
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t('detail.orderLinkLabel')}</dt>
                <dd>
                  <Link
                    to={`/account/orders/${complaint.orderId}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {orderQuery.data?.orderCode ?? t('detail.viewOrder')}
                  </Link>
                </dd>
              </div>
            </dl>
          </section>

          <section
            aria-labelledby="buyer-package-context-heading"
            className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5"
          >
            <h2 id="buyer-package-context-heading" className="text-base font-semibold">
              {t('detail.packageContextTitle')}
            </h2>
            {orderQuery.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : orderQuery.isError ? (
              <ServiceFallbackBanner
                message={t('detail.packageLoadFallback')}
                onRetry={() => void orderQuery.refetch()}
                isRetrying={orderQuery.isFetching}
              />
            ) : matchedSellerOrder ? (
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">{t('common.sellerOrderCodeLabel')}</dt>
                  <dd>
                    <CopyableId
                      value={matchedSellerOrder.sellerOrderCode}
                      display={matchedSellerOrder.sellerOrderCode}
                      label={t('common.sellerOrderCodeLabel')}
                    />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">{t('detail.packageStatusLabel')}</dt>
                  <dd>
                    <StatusBadge status={matchedSellerOrder.status} />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">{t('detail.packageValueLabel')}</dt>
                  <dd className="font-bold text-foreground tabular-nums">
                    {formatVnd(matchedSellerOrder.totalAmount)}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground font-mono">{complaint.sellerOrderId}</p>
            )}
          </section>

          {relatedComplaints.length > 0 && (
            <section
              aria-labelledby="related-complaints-heading"
              className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5"
            >
              <h2 id="related-complaints-heading" className="flex items-center gap-2 text-base font-semibold">
                <Split aria-hidden="true" className="size-4 text-primary" />
                <span>{t('detail.relatedTitle', { count: relatedComplaints.length })}</span>
              </h2>
              <p className="text-xs text-muted-foreground">{t('detail.relatedDescription')}</p>
              <ul className="space-y-2">
                {relatedComplaints.map((rel) => (
                  <li key={rel.complaintId}>
                    <Link
                      to={`/account/complaints/${rel.complaintId}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs transition-colors hover:border-primary/40 hover:bg-muted/30"
                    >
                      <span className="font-mono font-medium text-primary">{rel.complaintCode}</span>
                      <StatusBadge status={rel.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      <ComplaintReasonDialog
        open={reasonDialogMode !== null}
        onOpenChange={(next) => {
          if (!next) setReasonDialogMode(null)
        }}
        title={
          reasonDialogMode === 'withdraw'
            ? t('dialogs.withdrawTitle', { code: complaint.complaintCode })
            : t('dialogs.escalateTitle', { code: complaint.complaintCode })
        }
        description={
          reasonDialogMode === 'withdraw'
            ? t('dialogs.withdrawDescription')
            : t('dialogs.escalateDescription')
        }
        confirmLabel={
          reasonDialogMode === 'withdraw'
            ? t('dialogs.withdrawConfirm')
            : t('dialogs.escalateConfirm')
        }
        variant={reasonDialogMode === 'withdraw' ? 'destructive' : 'default'}
        onConfirm={async (reason) => {
          if (reasonDialogMode === 'withdraw') {
            await withdrawMutation.mutateAsync(reason)
            return
          }
          await escalateMutation.mutateAsync(reason)
        }}
        onReload={() => void detailQuery.refetch()}
      />
    </div>
  )
}
