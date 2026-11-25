import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CheckCircle2,
  Headset,
  Info,
  Package,
  RefreshCw,
  Scale,
  ShieldAlert,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ApiError } from '@/api/errors'
import { CopyableId, ServiceFallbackBanner, SlaCountdownPill } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  apiGetSellerOrderDetail,
  apiGetSellerShop,
} from '@/features/cart-checkout-order/seller-orders-api'
import { useAuthSession } from '@/lib/auth/session'
import { formatDateTime, formatVnd } from '@/lib/format'
import {
  apiEscalateComplaint,
  apiGetComplaintDetail,
  apiRespondToComplaint,
  apiUploadComplaintEvidence,
  complaintKeys,
  type RespondComplaintInput,
} from '../api'
import { ComplaintEvidenceSection } from '../components/ComplaintEvidenceSection'
import { ComplaintReasonDialog } from '../components/ComplaintReasonDialog'
import { ComplaintTimeline } from '../components/ComplaintTimeline'
import { SellerResponsePanel } from '../components/SellerResponsePanel'
import { resolveComplaintSla } from '../helpers'

function SellerComplaintDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12" aria-busy="true">
      <div className="space-y-4 lg:col-span-8">
        <Skeleton className="h-52 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
      <div className="space-y-4 lg:col-span-4">
        <Skeleton className="h-44 w-full rounded-lg" />
        <Skeleton className="h-44 w-full rounded-lg" />
      </div>
    </div>
  )
}

/**
 * Trang chi tiết & xử lý khiếu nại dành cho Seller (`/seller/complaints/:id`).
 * Cô lập tuyệt đối theo shopId (403 với khiếu nại shop khác, không hiển thị relatedComplaints).
 * Tích hợp `<SlaCountdownPill />`, dòng thời gian bất biến, phản hồi & đề xuất hoàn tiền một phần.
 */
export function SellerComplaintDetailPage() {
  const { t } = useTranslation('complaints')
  const { id: complaintId = '' } = useParams()
  const session = useAuthSession()
  const queryClient = useQueryClient()

  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [escalateOpen, setEscalateOpen] = useState(false)

  const shopQuery = useQuery({
    queryKey: ['seller', 'shop'],
    queryFn: apiGetSellerShop,
    enabled: Boolean(session.accessToken),
    retry: false,
    staleTime: 5 * 60_000,
  })
  const myShop = shopQuery.data

  const detailQuery = useQuery({
    queryKey: complaintKeys.detail(complaintId),
    queryFn: () => apiGetComplaintDetail(complaintId),
    enabled: Boolean(session.accessToken) && Boolean(complaintId),
    retry: false,
  })

  const detail = detailQuery.data
  const complaint = detail?.complaint

  const isForbiddenShop =
    (detailQuery.error instanceof ApiError && detailQuery.error.status === 403) ||
    Boolean(complaint && myShop?.shopId && complaint.shopId !== myShop.shopId)

  const isNotFound = detailQuery.error instanceof ApiError && detailQuery.error.status === 404

  const sellerOrderQuery = useQuery({
    queryKey: ['seller-orders', 'detail', complaint?.sellerOrderId],
    queryFn: () => apiGetSellerOrderDetail(complaint!.sellerOrderId),
    enabled: Boolean(session.accessToken) && Boolean(complaint?.sellerOrderId) && !isForbiddenShop,
    retry: false,
  })

  function invalidateComplaint() {
    void queryClient.invalidateQueries({ queryKey: complaintKeys.detail(complaintId) })
    void queryClient.invalidateQueries({ queryKey: complaintKeys.lists() })
  }

  const respondMutation = useMutation({
    mutationFn: (input: RespondComplaintInput) => apiRespondToComplaint(complaintId, input),
    onMutate: () => {
      setActionSuccess(null)
    },
    onSuccess: () => {
      setActionSuccess(t('detail.respondSuccess'))
      invalidateComplaint()
    },
  })

  const uploadEvidenceMutation = useMutation({
    mutationFn: (file: File) => apiUploadComplaintEvidence(complaintId, file),
    onMutate: () => {
      setActionSuccess(null)
    },
    onSuccess: () => {
      setActionSuccess(t('detail.evidenceUploadSuccess'))
      invalidateComplaint()
    },
  })

  const escalateMutation = useMutation({
    mutationFn: (reason: string) => apiEscalateComplaint(complaintId, reason),
    onSuccess: () => {
      setActionSuccess(t('detail.escalateSuccess'))
      invalidateComplaint()
    },
  })

  const sla = complaint && !isForbiddenShop ? resolveComplaintSla(complaint) : null

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <Link
            to="/seller/complaints"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            <span>{t('detail.backToSellerList')}</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">{t('detail.title')}</h1>
            {complaint && !isForbiddenShop && (
              <>
                <CopyableId
                  value={complaint.complaintCode}
                  display={complaint.complaintCode}
                  label={t('common.complaintCodeLabel')}
                  className="rounded border border-border bg-card px-2 py-0.5 text-sm font-semibold text-foreground"
                />
                <StatusBadge status={complaint.status} />
              </>
            )}
          </div>
          {complaint && !isForbiddenShop && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {t('detail.createdAt', { datetime: formatDateTime(complaint.createdAt) })}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sla && (
            <SlaCountdownPill
              label={t(sla.labelKey)}
              startedAt={sla.startedAt}
              deadline={sla.deadline}
            />
          )}
          {!isForbiddenShop && !isNotFound && (
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
          )}
        </div>
      </header>

      {isForbiddenShop ? (
        <section
          role="alert"
          className="flex flex-col items-center gap-3 rounded-lg border border-status-danger-border bg-status-danger p-8 text-center text-status-danger-foreground"
        >
          <ShieldAlert aria-hidden="true" className="size-10" />
          <h2 className="text-lg font-semibold">{t('common.forbiddenTitle')}</h2>
          <p className="max-w-md text-sm">{t('common.forbiddenDescription')}</p>
          <Button asChild variant="outline" size="sm" className="mt-1">
            <Link to="/seller/complaints">{t('detail.backToSellerList')}</Link>
          </Button>
        </section>
      ) : detailQuery.isLoading ? (
        <SellerComplaintDetailSkeleton />
      ) : isNotFound ? (
        <section className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-8 text-center shadow-xs">
          <h2 className="text-lg font-semibold">{t('common.notFoundTitle')}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{t('common.notFoundDescription')}</p>
          <Button asChild variant="outline" size="sm" className="mt-1">
            <Link to="/seller/complaints">{t('detail.backToSellerList')}</Link>
          </Button>
        </section>
      ) : detailQuery.isError || !detail || !complaint ? (
        <ServiceFallbackBanner
          message={detailQuery.error instanceof ApiError ? detailQuery.error.message : t('sellerList.loadError')}
          onRetry={() => void detailQuery.refetch()}
          isRetrying={detailQuery.isFetching}
        />
      ) : (
        <>
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

          {complaint.unverifiedFlag && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-status-warning-border bg-status-warning px-4 py-3 text-xs text-status-warning-foreground"
            >
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{t('common.unverifiedNotice')}</span>
            </div>
          )}

          {detail.resolution && (
            <section
              aria-labelledby="seller-resolution-heading"
              className="space-y-3 rounded-lg border border-status-success-border bg-status-success/40 p-4 text-sm sm:p-5"
            >
              <h2 id="seller-resolution-heading" className="flex items-center gap-2 text-base font-semibold text-status-success-foreground">
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
              {(detail.availableActions ?? []).includes('RESPOND') && (
                <SellerResponsePanel
                  requestedResolution={complaint.requestedResolution}
                  requestedRefundAmount={complaint.requestedRefundAmount}
                  maxRefundAmount={sellerOrderQuery.data?.totalAmount}
                  isSubmitting={respondMutation.isPending}
                  onSubmitResponse={async (input) => {
                    await respondMutation.mutateAsync(input)
                  }}
                  onReload={() => void detailQuery.refetch()}
                />
              )}

              <ComplaintTimeline detail={detail} />

              <ComplaintEvidenceSection
                complaintId={complaint.complaintId}
                evidences={detail.evidences ?? []}
                viewerRole="SELLER"
                canUpload={(detail.availableActions ?? []).includes('UPLOAD_EVIDENCE')}
                isUploading={uploadEvidenceMutation.isPending}
                uploadError={uploadEvidenceMutation.error}
                onUploadFile={async (file) => {
                  await uploadEvidenceMutation.mutateAsync(file)
                }}
              />
            </div>

            <aside className="min-w-0 space-y-4 lg:col-span-4">
              {(detail.availableActions ?? []).includes('ESCALATE') && (
                <section
                  aria-labelledby="seller-escalate-heading"
                  className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5"
                >
                  <h2 id="seller-escalate-heading" className="text-base font-semibold">
                    {t('detail.sellerActionsTitle')}
                  </h2>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEscalateOpen(true)}
                    className="w-full justify-start"
                  >
                    <Headset aria-hidden="true" />
                    {t('detail.escalateButton')}
                  </Button>
                </section>
              )}

              <section
                aria-labelledby="seller-complaint-summary-heading"
                className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5"
              >
                <h2 id="seller-complaint-summary-heading" className="text-base font-semibold">
                  {t('detail.summaryTitle')}
                </h2>
                <dl className="space-y-2 text-sm">
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
                  {complaint.requestedRefundAmount !== undefined &&
                    complaint.requestedRefundAmount > 0 && (
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-muted-foreground">{t('detail.requestedRefundLabel')}</dt>
                        <dd className="font-bold text-price tabular-nums">
                          {formatVnd(complaint.requestedRefundAmount)}
                        </dd>
                      </div>
                    )}
                </dl>
              </section>

              <section
                aria-labelledby="seller-package-context-heading"
                className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5"
              >
                <h2 id="seller-package-context-heading" className="flex items-center gap-2 text-base font-semibold">
                  <Package aria-hidden="true" className="size-4 text-primary" />
                  <span>{t('detail.packageContextTitle')}</span>
                </h2>
                {sellerOrderQuery.isLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : sellerOrderQuery.isError ? (
                  <ServiceFallbackBanner
                    message={t('detail.packageLoadFallback')}
                    onRetry={() => void sellerOrderQuery.refetch()}
                    isRetrying={sellerOrderQuery.isFetching}
                  />
                ) : sellerOrderQuery.data ? (
                  <dl className="space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-muted-foreground">{t('common.sellerOrderCodeLabel')}</dt>
                      <dd>
                        <Link
                          to={`/seller/orders/${sellerOrderQuery.data.sellerOrderId}`}
                          className="font-mono text-xs font-semibold text-primary hover:underline"
                        >
                          {sellerOrderQuery.data.sellerOrderCode}
                        </Link>
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-muted-foreground">{t('detail.packageStatusLabel')}</dt>
                      <dd>
                        <StatusBadge status={sellerOrderQuery.data.status} />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-muted-foreground">{t('detail.packageValueLabel')}</dt>
                      <dd className="font-bold text-price tabular-nums">
                        {formatVnd(sellerOrderQuery.data.totalAmount)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-muted-foreground">{t('detail.packageItemsCount', { count: sellerOrderQuery.data.items?.length ?? 0 })}</dt>
                    </div>
                  </dl>
                ) : null}
              </section>
            </aside>
          </div>

          <ComplaintReasonDialog
            open={escalateOpen}
            onOpenChange={setEscalateOpen}
            title={t('dialogs.escalateTitle', { code: complaint.complaintCode })}
            description={t('dialogs.escalateDescription')}
            confirmLabel={t('dialogs.escalateConfirm')}
            onConfirm={async (reason) => {
              await escalateMutation.mutateAsync(reason)
            }}
            onReload={() => void detailQuery.refetch()}
          />
        </>
      )}
    </div>
  )
}
