import { zodResolver } from '@hookform/resolvers/zod'
import { useQueries, useQuery } from '@tanstack/react-query'
import { CheckCircle2, Info, Loader2, Paperclip, Split, Upload, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ApiError } from '@/api/errors'
import { useIdempotencyKey } from '@/api/idempotency'
import { CopyableId, ServiceFallbackBanner } from '@/components/shared'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import {
  apiGetOrder,
  apiGetPublicShop,
  apiListOrders,
  fallbackShopName,
} from '@/features/cart-checkout-order/api'
import { formatDateTime, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  apiCreateComplaints,
  apiUploadComplaintEvidence,
  type CreateComplaintsResult,
} from '../api'
import {
  ACCEPTED_EVIDENCE_MIMES,
  COMPLAINT_TYPES,
  MAX_EVIDENCE_PER_PARTY,
  REQUESTED_RESOLUTIONS,
  formatFileSize,
  isSellerOrderComplaintEligible,
  validateEvidenceFile,
} from '../helpers'
import { createComplaintSchema, type CreateComplaintFormValues } from '../schemas'
import { ComplaintActionErrorAlert } from './ComplaintActionErrorAlert'

export type CreateComplaintDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialOrderId?: string
  initialSellerOrderId?: string
  onCreated?: (result: CreateComplaintsResult) => void
}

type CreatedSummaryState = {
  result: CreateComplaintsResult
  uploadedFilesCount: number
  evidenceErrors: string[]
}

type CreateComplaintFormProps = Omit<CreateComplaintDialogProps, 'open'> & {
  onBusyChange: (busy: boolean) => void
}

function CreateComplaintForm({
  onOpenChange,
  initialOrderId,
  initialSellerOrderId,
  onCreated,
  onBusyChange,
}: CreateComplaintFormProps) {
  const { t } = useTranslation('complaints')
  const idempotency = useIdempotencyKey()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedOrderId, setSelectedOrderId] = useState(initialOrderId ?? '')
  const [selectedSellerOrderIds, setSelectedSellerOrderIds] = useState<string[]>(
    initialSellerOrderId ? [initialSellerOrderId] : [],
  )
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<ApiError | Error | null>(null)
  const [createdSummary, setCreatedSummary] = useState<CreatedSummaryState | null>(null)

  const ordersQuery = useQuery({
    queryKey: ['orders', 'buyer', 'for-complaint-dialog'],
    queryFn: () => apiListOrders({ page: 1, limit: 50 }),
    enabled: !initialOrderId,
    retry: false,
  })

  const orderDetailQuery = useQuery({
    queryKey: ['order', 'buyer', selectedOrderId],
    queryFn: () => apiGetOrder(selectedOrderId),
    enabled: Boolean(selectedOrderId),
    retry: false,
  })

  const orderDetail = orderDetailQuery.data
  const sellerOrders = useMemo(() => orderDetail?.sellerOrders ?? [], [orderDetail])

  const shopIds = useMemo(
    () => Array.from(new Set(sellerOrders.filter((so) => !so.shopName).map((so) => so.shopId))),
    [sellerOrders],
  )
  const shopQueries = useQueries({
    queries: shopIds.map((shopId) => ({
      queryKey: ['shop', 'public', shopId],
      queryFn: () => apiGetPublicShop(shopId),
      enabled: shopIds.length > 0,
      retry: false,
      staleTime: 5 * 60_000,
    })),
  })

  const shopNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const so of sellerOrders) {
      if (so.shopName) map.set(so.shopId, so.shopName)
    }
    shopIds.forEach((shopId, idx) => {
      if (!map.has(shopId)) {
        map.set(shopId, shopQueries[idx]?.data?.name || fallbackShopName(shopId))
      }
    })
    return map
  }, [sellerOrders, shopIds, shopQueries])

  const selectedPackages = useMemo(
    () => sellerOrders.filter((so) => selectedSellerOrderIds.includes(so.sellerOrderId)),
    [sellerOrders, selectedSellerOrderIds],
  )

  const maxPartialRefund = useMemo(() => {
    if (selectedPackages.length === 0) return undefined
    return Math.min(...selectedPackages.map((so) => so.totalAmount))
  }, [selectedPackages])

  const schema = useMemo(
    () => createComplaintSchema(t, maxPartialRefund),
    [t, maxPartialRefund],
  )

  const form = useForm<CreateComplaintFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      orderId: initialOrderId ?? '',
      sellerOrderIds: initialSellerOrderId ? [initialSellerOrderId] : [],
      type: 'DAMAGED',
      requestedResolution: 'FULL_REFUND',
      requestedRefundAmount: '',
      description: '',
    },
  })

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = form

  const selectedResolution = useWatch({ control, name: 'requestedResolution' })
  const selectedType = useWatch({ control, name: 'type' })

  function handleSelectOrder(orderId: string) {
    setSelectedOrderId(orderId)
    setSelectedSellerOrderIds([])
    setValue('orderId', orderId, { shouldValidate: true })
    setValue('sellerOrderIds', [], { shouldValidate: true })
  }

  function handleToggleSellerOrder(sellerOrderId: string) {
    const next = selectedSellerOrderIds.includes(sellerOrderId)
      ? selectedSellerOrderIds.filter((id) => id !== sellerOrderId)
      : [...selectedSellerOrderIds, sellerOrderId]
    setSelectedSellerOrderIds(next)
    setValue('sellerOrderIds', next, { shouldValidate: true })
  }

  function handleAttachFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    if (files.length === 0) return

    const nextFiles = [...attachedFiles]
    for (const file of files) {
      if (nextFiles.length >= MAX_EVIDENCE_PER_PARTY) {
        setFileError(t('evidence.quotaReached', { max: MAX_EVIDENCE_PER_PARTY }))
        break
      }
      const check = validateEvidenceFile(file)
      if (!check.ok) {
        setFileError(t(`evidence.validation.${check.code}`))
        return
      }
      nextFiles.push(file)
    }
    setFileError(null)
    setAttachedFiles(nextFiles)
  }

  function handleRemoveFile(index: number) {
    setAttachedFiles((prev) => prev.filter((_, idx) => idx !== index))
    setFileError(null)
  }

  const hasShippingSelected = selectedPackages.some((so) => so.status === 'SHIPPING')

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null)
    onBusyChange(true)
    const refundAmt =
      values.requestedResolution === 'PARTIAL_REFUND'
        ? Number.parseInt(values.requestedRefundAmount.trim(), 10)
        : undefined

    const payload = {
      sellerOrderIds: values.sellerOrderIds,
      type: values.type,
      requestedResolution: values.requestedResolution,
      requestedRefundAmount: refundAmt,
      description: values.description.trim(),
    }

    try {
      const result = await apiCreateComplaints(payload, idempotency.keyFor(payload))
      idempotency.reset()

      const createdComplaints = result.complaints ?? []
      const evidenceErrors: string[] = []
      let uploadedFilesCount = 0

      if (attachedFiles.length > 0 && createdComplaints.length > 0) {
        for (const cpl of createdComplaints) {
          if (cpl.status === 'REJECTED' || cpl.status === 'CLOSED' || cpl.status === 'WITHDRAWN') {
            continue
          }
          for (const file of attachedFiles) {
            try {
              await apiUploadComplaintEvidence(cpl.complaintId, file)
              uploadedFilesCount += 1
            } catch (uploadErr) {
              const reason = uploadErr instanceof Error ? uploadErr.message : file.name
              evidenceErrors.push(`${cpl.complaintCode} (${file.name}): ${reason}`)
            }
          }
        }
      }

      setCreatedSummary({ result, uploadedFilesCount, evidenceErrors })
      onCreated?.(result)
    } catch (err) {
      if (err instanceof ApiError) {
        const refundDetail = err.fieldError('requestedRefundAmount')
        if (refundDetail) {
          setFieldError('requestedRefundAmount', { message: refundDetail })
        }
        const descDetail = err.fieldError('description')
        if (descDetail) {
          setFieldError('description', { message: descDetail })
        }
        setSubmitError(err)
      } else {
        setSubmitError(err instanceof Error ? err : new Error(String(err)))
      }
    } finally {
      onBusyChange(false)
    }
  })

  const availableOrders = useMemo(
    () =>
      (ordersQuery.data?.items ?? []).filter((order) =>
        (order.sellerOrders ?? []).some((so) => isSellerOrderComplaintEligible(so.status)),
      ),
    [ordersQuery.data],
  )

  if (createdSummary) {
    return (
      <div className="space-y-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-status-success-foreground">
            <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />
            <span>
              {t('create.resultTitle', { count: createdSummary.result.splitCount })}
            </span>
          </DialogTitle>
          <DialogDescription>
            {createdSummary.result.splitCount > 1
              ? t('create.resultSplitNote')
              : createdSummary.result.idempotentReplay
                ? t('create.resultIdempotentNote')
                : t('create.subtitle')}
          </DialogDescription>
        </DialogHeader>

        {createdSummary.uploadedFilesCount > 0 && (
          <p className="rounded-md border border-status-success-border bg-status-success px-3 py-2 text-xs font-medium text-status-success-foreground">
            {t('create.resultEvidenceSuccess', { count: createdSummary.uploadedFilesCount })}
          </p>
        )}

        {createdSummary.evidenceErrors.length > 0 && (
          <div
            role="alert"
            className="rounded-md border border-status-warning-border bg-status-warning px-3 py-2 text-xs text-status-warning-foreground"
          >
            {t('create.resultEvidencePartial', {
              errors: createdSummary.evidenceErrors.join('; '),
            })}
          </div>
        )}

        <ul className="space-y-2.5">
          {(createdSummary.result.complaints ?? []).map((cpl) => (
            <li
              key={cpl.complaintId}
              className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CopyableId
                    value={cpl.complaintCode}
                    display={cpl.complaintCode}
                    label={t('common.complaintCodeLabel')}
                    className="font-semibold"
                  />
                  <StatusBadge status={cpl.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {shopNameMap.get(cpl.shopId) ?? fallbackShopName(cpl.shopId)} ·{' '}
                  {t(`types.${cpl.type}` as never, { defaultValue: cpl.type }) as string}
                </p>
                {cpl.rejectionReason && (
                  <p className="text-xs text-status-danger-foreground">
                    {t('create.resultRejectionLabel')}: {cpl.rejectionReason}
                  </p>
                )}
              </div>
              <Button asChild variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                <Link to={`/account/complaints/${cpl.complaintId}`}>
                  {t('create.openComplaint')}
                </Link>
              </Button>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t('create.closeAndRefresh')}
          </Button>
        </DialogFooter>
      </div>
    )
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-5">
      <DialogHeader>
        <DialogTitle>{t('create.title')}</DialogTitle>
        <DialogDescription>{t('create.subtitle')}</DialogDescription>
      </DialogHeader>

      {/* Bước 1: Chọn đơn hàng */}
      <div className="space-y-2">
        <Label htmlFor="create-complaint-order">{t('create.orderStep')}</Label>
        {initialOrderId ? (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            {orderDetail ? (
              <span className="font-medium">
                {orderDetail.orderCode} · {formatDateTime(orderDetail.createdAt)} ·{' '}
                {formatVnd(orderDetail.grandTotal)}
              </span>
            ) : (
              <span className="font-mono text-xs">{initialOrderId}</span>
            )}
          </div>
        ) : ordersQuery.isLoading ? (
          <p className="text-xs text-muted-foreground">{t('create.ordersLoading')}</p>
        ) : ordersQuery.isError ? (
          <ServiceFallbackBanner
            message={t('create.ordersLoadError')}
            onRetry={() => void ordersQuery.refetch()}
            isRetrying={ordersQuery.isFetching}
          />
        ) : availableOrders.length === 0 ? (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {t('create.noOrders')}
          </p>
        ) : (
          <select
            id="create-complaint-order"
            value={selectedOrderId}
            onChange={(event) => handleSelectOrder(event.target.value)}
            className="block h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t('create.orderPlaceholder')}</option>
            {availableOrders.map((order) => (
              <option key={order.orderId} value={order.orderId}>
                {order.orderCode} · {formatDateTime(order.createdAt)} · {formatVnd(order.grandTotal)}
              </option>
            ))}
          </select>
        )}
        {errors.orderId && (
          <p className="text-xs text-status-danger-foreground">{errors.orderId.message}</p>
        )}
      </div>

      {/* Bước 2: Chọn nhiều SellerOrder trong đơn */}
      {selectedOrderId && (
        <div className="space-y-2">
          <Label>{t('create.packagesStep')}</Label>
          {orderDetailQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">{t('create.packagesLoading')}</p>
          ) : orderDetailQuery.isError ? (
            <ServiceFallbackBanner
              message={t('create.packagesLoadError')}
              onRetry={() => void orderDetailQuery.refetch()}
              isRetrying={orderDetailQuery.isFetching}
            />
          ) : (
            <ul className="space-y-2">
              {sellerOrders.map((so) => {
                const eligible = isSellerOrderComplaintEligible(so.status)
                const checked = selectedSellerOrderIds.includes(so.sellerOrderId)
                const shopName = shopNameMap.get(so.shopId) ?? fallbackShopName(so.shopId)

                return (
                  <li key={so.sellerOrderId}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3 transition-colors',
                        checked
                          ? 'border-primary bg-primary-soft/50'
                          : 'border-border bg-card hover:bg-muted/30',
                        !eligible && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      <span className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!eligible}
                          onChange={() => handleToggleSellerOrder(so.sellerOrderId)}
                          className="mt-1 size-4 accent-primary"
                        />
                        <span className="space-y-1">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                            <span>{shopName}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {so.sellerOrderCode}
                            </span>
                            <StatusBadge status={so.status} />
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {eligible ? t('create.packageEligible') : t('create.packageIneligible')}
                          </span>
                        </span>
                      </span>
                      <span className="text-sm font-semibold text-foreground tabular-nums">
                        {formatVnd(so.totalAmount)}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
          {errors.sellerOrderIds && (
            <p className="text-xs text-status-danger-foreground">{errors.sellerOrderIds.message}</p>
          )}

          {selectedPackages.length > 1 && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-md border border-status-info-border bg-status-info px-3 py-2.5 text-xs text-status-info-foreground"
            >
              <Split aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{t('create.multiShopSplitNotice', { count: selectedPackages.length })}</span>
            </div>
          )}

          {hasShippingSelected && selectedType !== 'NOT_RECEIVED' && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-md border border-status-warning-border bg-status-warning px-3 py-2 text-xs text-status-warning-foreground"
            >
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{t('create.shippingOnlyNotReceived')}</span>
            </div>
          )}
        </div>
      )}

      {/* Bước 3: Nội dung & bằng chứng */}
      <div className="space-y-4 border-t border-border pt-4">
        <p className="text-sm font-semibold text-foreground">{t('create.detailsStep')}</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="create-complaint-type">{t('create.typeLabel')}</Label>
            <select
              id="create-complaint-type"
              {...register('type')}
              className="block h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
            >
              {COMPLAINT_TYPES.map((cplType) => (
                <option key={cplType} value={cplType}>
                  {t(`types.${cplType}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-complaint-resolution">{t('create.resolutionLabel')}</Label>
            <select
              id="create-complaint-resolution"
              {...register('requestedResolution')}
              className="block h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
            >
              {REQUESTED_RESOLUTIONS.map((res) => (
                <option key={res} value={res}>
                  {t(`resolutions.${res}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedResolution === 'PARTIAL_REFUND' && (
          <div className="space-y-1.5">
            <Label htmlFor="create-complaint-refund">{t('create.refundAmountLabel')}</Label>
            <input
              id="create-complaint-refund"
              type="number"
              min={1}
              step={1}
              placeholder={t('create.refundAmountPlaceholder')}
              {...register('requestedRefundAmount')}
              className="block h-9 w-full rounded-md border border-input bg-card px-3 text-sm tabular-nums focus-visible:ring-2 focus-visible:ring-ring"
            />
            {maxPartialRefund !== undefined && (
              <p className="text-xs text-muted-foreground">
                {t('create.refundAmountCeiling', { amount: formatVnd(maxPartialRefund) })}
              </p>
            )}
            {errors.requestedRefundAmount && (
              <p className="text-xs text-status-danger-foreground">
                {errors.requestedRefundAmount.message}
              </p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="create-complaint-description">{t('create.descriptionLabel')}</Label>
          <Textarea
            id="create-complaint-description"
            rows={4}
            placeholder={t('create.descriptionPlaceholder')}
            aria-invalid={errors.description ? true : undefined}
            {...register('description')}
          />
          {errors.description && (
            <p className="text-xs text-status-danger-foreground">{errors.description.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>{t('create.evidenceLabel', { max: MAX_EVIDENCE_PER_PARTY })}</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={attachedFiles.length >= MAX_EVIDENCE_PER_PARTY || isSubmitting}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload aria-hidden="true" />
              {t('create.chooseFiles')}
            </Button>
            <span className="text-xs text-muted-foreground">{t('create.evidenceHint')}</span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_EVIDENCE_MIMES.join(',')}
              className="sr-only"
              tabIndex={-1}
              aria-label={t('create.chooseFiles')}
              onChange={handleAttachFiles}
            />
          </div>
          {fileError && (
            <p role="alert" className="text-xs text-status-danger-foreground">
              {fileError}
            </p>
          )}
          {attachedFiles.length > 0 && (
            <ul className="space-y-1.5">
              {attachedFiles.map((file, idx) => (
                <li
                  key={`${file.name}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded border border-border bg-muted/40 px-3 py-1.5 text-xs"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Paperclip aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium text-foreground">{file.name}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      ({formatFileSize(file.size)})
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={t('create.removeFile')}
                    onClick={() => handleRemoveFile(idx)}
                    className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {submitError && <ComplaintActionErrorAlert error={submitError} />}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={() => onOpenChange(false)}
        >
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 aria-hidden="true" className="animate-spin" />}
          {isSubmitting ? t('create.submitting') : t('create.submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * Modal tạo khiếu nại cho Buyer (/account/complaints):
 * - Chọn đơn hàng & một hoặc nhiều SellerOrder trong cùng Order.
 * - Khi chọn ≥ 2 gian hàng, hiển thị thông báo tự động tách thành k khiếu nại độc lập.
 * - Hỗ trợ đính kèm tối đa 5 tệp bằng chứng để tải lên ngay sau khi tạo.
 */
export function CreateComplaintDialog({
  open,
  onOpenChange,
  ...rest
}: CreateComplaintDialogProps) {
  const [busy, setBusy] = useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {open && (
          <CreateComplaintForm
            {...rest}
            onOpenChange={onOpenChange}
            onBusyChange={setBusy}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
