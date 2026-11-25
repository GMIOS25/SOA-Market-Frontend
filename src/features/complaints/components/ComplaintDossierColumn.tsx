import { AlertTriangle, CreditCard, FileText, Package, Truck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CopyableId, ServiceFallbackBanner } from '@/components/shared'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDateTime, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type {
  ComplaintSummaryView,
  CrossServiceDossierView,
  RelatedComplaintView,
} from '../api'

export type ComplaintDossierColumnProps = {
  complaint: ComplaintSummaryView
  relatedComplaints: RelatedComplaintView[]
  dossier?: CrossServiceDossierView
  isRefetching: boolean
  onRetryDossier: () => void
}

/**
 * Cột 1 Workspace Phân xử — Hồ sơ tổng hợp đa dịch vụ (FR-CPL-006, FR-CPL-009):
 * - Tab chuyển nhanh giữa các khiếu nại có cùng `orderId`
 * - Thông tin khiếu nại
 * - Dữ liệu SVC-ORD, SVC-PAY (hạn mức khả hoàn), SVC-SHP kèm `<ServiceFallbackBanner />` riêng từng khối
 */
export function ComplaintDossierColumn({
  complaint,
  relatedComplaints,
  dossier,
  isRefetching,
  onRetryDossier,
}: ComplaintDossierColumnProps) {
  const { t } = useTranslation('complaints')

  const sellerOrder = dossier?.sellerOrder
  const paymentAllocation = dossier?.paymentAllocation
  const shipment = dossier?.shipment
  const totalInOrder = 1 + relatedComplaints.length

  return (
    <section
      aria-labelledby="workspace-col-dossier"
      className="flex min-w-0 flex-col gap-4"
    >
      <h2 id="workspace-col-dossier" className="text-base font-semibold text-foreground">
        {t('workspace.columns.dossier')}
      </h2>

      {/* Tab các khiếu nại có cùng orderId */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">
            {t('dossier.siblingTabs.title')}
          </span>
          <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
            {t('dossier.siblingTabs.count', { count: totalInOrder })}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{t('dossier.siblingTabs.orderLabel')}:</span>
          <CopyableId value={complaint.orderId} label={t('common.orderIdLabel')} />
        </div>

        <nav
          role="tablist"
          aria-label={t('dossier.siblingTabs.title')}
          className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
        >
          <Link
            to={`/admin/complaints/${complaint.complaintId}`}
            role="tab"
            aria-selected={true}
            aria-current="page"
            className={cn(
              'flex min-w-[165px] shrink-0 flex-col gap-1 rounded-md border px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              'border-primary bg-primary-soft text-primary',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold">{complaint.complaintCode}</span>
              <span className="text-[11px] font-medium">{t('dossier.siblingTabs.currentTag')}</span>
            </div>
            <span className="truncate text-xs text-foreground">
              {t(`common.types.${complaint.type}` as never, { defaultValue: complaint.type }) as string}
            </span>
            <StatusBadge status={complaint.status} className="self-start" />
          </Link>

          {relatedComplaints.map((rel) => (
            <Link
              key={rel.complaintId}
              to={`/admin/complaints/${rel.complaintId}`}
              role="tab"
              aria-selected={false}
              className="flex min-w-[165px] shrink-0 flex-col gap-1 rounded-md border border-border bg-background px-3 py-2 text-left transition-colors hover:border-input hover:bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="font-mono text-xs font-semibold text-foreground">{rel.complaintCode}</span>
              <span className="truncate text-xs text-muted-foreground">
                {t(`common.types.${rel.type}` as never, { defaultValue: rel.type }) as string}
              </span>
              <StatusBadge status={rel.status} className="self-start" />
            </Link>
          ))}
        </nav>

        {relatedComplaints.length === 0 && (
          <p className="text-xs text-muted-foreground">{t('dossier.siblingTabs.noSiblings')}</p>
        )}
      </div>

      {/* Tóm tắt khiếu nại */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-border pb-2.5">
          <FileText aria-hidden="true" className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{t('dossier.summary.title')}</h3>
        </div>

        {complaint.unverifiedFlag && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-md border border-status-warning-border bg-status-warning p-3 text-xs text-status-warning-foreground"
          >
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p>{t('dossier.summary.unverifiedWarning')}</p>
          </div>
        )}

        <dl className="grid grid-cols-1 gap-2.5 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">{t('dossier.summary.type')}</dt>
            <dd className="font-medium text-foreground">
              {t(`common.types.${complaint.type}` as never, { defaultValue: complaint.type }) as string}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t('dossier.summary.requestedResolution')}</dt>
            <dd className="font-medium text-foreground">
              {
                t(`common.resolutions.${complaint.requestedResolution}` as never, {
                  defaultValue: complaint.requestedResolution,
                }) as string
              }
            </dd>
          </div>
          {complaint.requestedRefundAmount !== undefined && (
            <div>
              <dt className="text-xs text-muted-foreground">{t('dossier.summary.requestedRefund')}</dt>
              <dd className="font-semibold text-foreground tabular-nums">
                {formatVnd(complaint.requestedRefundAmount)}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground">{t('dossier.summary.description')}</dt>
            <dd className="whitespace-pre-wrap rounded-md bg-muted/60 p-2.5 text-xs leading-relaxed text-foreground">
              {complaint.description}
            </dd>
          </div>
          {complaint.rejectionReason && (
            <div>
              <dt className="text-xs text-muted-foreground">{t('dossier.summary.rejectionReason')}</dt>
              <dd className="text-xs text-status-danger-foreground">{complaint.rejectionReason}</dd>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
            <dt className="text-xs text-muted-foreground">{t('dossier.summary.buyerId')}</dt>
            <dd>
              <CopyableId value={complaint.buyerId} label={t('common.buyerIdLabel')} />
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-xs text-muted-foreground">{t('dossier.summary.shopId')}</dt>
            <dd>
              <CopyableId value={complaint.shopId} label={t('common.shopIdLabel')} />
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-xs text-muted-foreground">{t('dossier.summary.assignedCsId')}</dt>
            <dd className="text-xs">
              {complaint.assignedCsId ? (
                <CopyableId value={complaint.assignedCsId} label={t('common.csIdLabel')} />
              ) : (
                <span className="text-muted-foreground">{t('dossier.summary.unassigned')}</span>
              )}
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-xs text-muted-foreground">{t('dossier.summary.createdAt')}</dt>
            <dd className="text-xs text-foreground tabular-nums">{formatDateTime(complaint.createdAt)}</dd>
          </div>
        </dl>
      </div>

      {/* Khối SVC-ORD */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-border pb-2.5">
          <Package aria-hidden="true" className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{t('dossier.order.title')}</h3>
        </div>

        {dossier?.orderServiceUnavailable || !sellerOrder ? (
          <ServiceFallbackBanner
            message={t('dossier.order.unavailable')}
            onRetry={onRetryDossier}
            isRetrying={isRefetching}
          />
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <dl className="grid grid-cols-1 gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-xs text-muted-foreground">{t('dossier.order.sellerOrderCode')}</dt>
                <dd>
                  <CopyableId
                    value={sellerOrder.sellerOrderId}
                    display={sellerOrder.sellerOrderCode}
                    label={t('common.sellerOrderIdLabel')}
                  />
                </dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-xs text-muted-foreground">{t('dossier.order.orderCode')}</dt>
                <dd>
                  <CopyableId
                    value={sellerOrder.orderId}
                    display={sellerOrder.orderCode}
                    label={t('common.orderIdLabel')}
                  />
                </dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-xs text-muted-foreground">{t('dossier.order.status')}</dt>
                <dd>
                  <StatusBadge status={sellerOrder.status} />
                </dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-xs text-muted-foreground">{t('dossier.order.refundStatus')}</dt>
                <dd className="text-xs font-medium text-foreground">{sellerOrder.refundStatus}</dd>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border pt-2 tabular-nums">
                <dt className="text-xs text-muted-foreground">{t('dossier.order.itemsAmount')}</dt>
                <dd className="font-medium">{formatVnd(sellerOrder.itemsAmount)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2 tabular-nums">
                <dt className="text-xs text-muted-foreground">{t('dossier.order.shippingFee')}</dt>
                <dd className="font-medium">{formatVnd(sellerOrder.shippingFee)}</dd>
              </div>
              {sellerOrder.discountAmount > 0 && (
                <div className="flex items-center justify-between gap-2 tabular-nums">
                  <dt className="text-xs text-muted-foreground">{t('dossier.order.discountAmount')}</dt>
                  <dd className="font-medium">- {formatVnd(sellerOrder.discountAmount)}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 border-t border-border pt-2 tabular-nums">
                <dt className="text-xs font-semibold text-foreground">{t('dossier.order.totalAmount')}</dt>
                <dd className="font-bold text-foreground">{formatVnd(sellerOrder.totalAmount)}</dd>
              </div>
              {sellerOrder.deliveredAt && (
                <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
                  <dt className="text-muted-foreground">{t('dossier.order.deliveredAt')}</dt>
                  <dd>{formatDateTime(sellerOrder.deliveredAt)}</dd>
                </div>
              )}
              {sellerOrder.completedAt && (
                <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
                  <dt className="text-muted-foreground">{t('dossier.order.completedAt')}</dt>
                  <dd>{formatDateTime(sellerOrder.completedAt)}</dd>
                </div>
              )}
            </dl>

            <div className="border-t border-border pt-2.5">
              <p className="mb-2 text-xs font-semibold text-foreground">
                {t('dossier.order.itemsTitle', { count: sellerOrder.items?.length ?? 0 })}
              </p>
              {!sellerOrder.items || sellerOrder.items.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('dossier.order.noItems')}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {sellerOrder.items.map((item) => (
                    <li
                      key={item.orderItemId}
                      className="rounded-md border border-border bg-background p-2.5 text-xs"
                    >
                      <p className="font-medium text-foreground">{item.productName}</p>
                      <p className="mt-0.5 text-muted-foreground tabular-nums">
                        {t('dossier.order.itemMeta', {
                          variant: item.variantLabel,
                          qty: item.quantity,
                          price: formatVnd(item.unitPrice),
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Khối SVC-PAY */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-border pb-2.5">
          <CreditCard aria-hidden="true" className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{t('dossier.payment.title')}</h3>
        </div>

        {dossier?.paymentServiceUnavailable || !paymentAllocation ? (
          <ServiceFallbackBanner
            message={t('dossier.payment.unavailable')}
            onRetry={onRetryDossier}
            isRetrying={isRefetching}
          />
        ) : (
          <div className="flex flex-col gap-2.5 text-sm">
            <dl className="grid grid-cols-1 gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-xs text-muted-foreground">{t('dossier.payment.allocationId')}</dt>
                <dd>
                  <CopyableId
                    value={paymentAllocation.allocationId}
                    label={t('dossier.payment.allocationId')}
                  />
                </dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-xs text-muted-foreground">{t('dossier.payment.paymentId')}</dt>
                <dd>
                  <CopyableId value={paymentAllocation.paymentId} label={t('dossier.payment.paymentId')} />
                </dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-xs text-muted-foreground">{t('dossier.payment.status')}</dt>
                <dd>
                  <StatusBadge status={paymentAllocation.status} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border pt-2 tabular-nums">
                <dt className="text-xs text-muted-foreground">{t('dossier.payment.paidAmount')}</dt>
                <dd className="font-medium">{formatVnd(paymentAllocation.amount)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2 tabular-nums">
                <dt className="text-xs text-muted-foreground">{t('dossier.payment.refundedAmount')}</dt>
                <dd className="font-medium">{formatVnd(paymentAllocation.refundedAmount)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border border-status-info-border bg-status-info px-3 py-2 tabular-nums">
                <dt className="text-xs font-semibold text-status-info-foreground">
                  {t('dossier.payment.remainingRefundable')}
                </dt>
                <dd className="font-bold text-status-info-foreground">
                  {formatVnd(paymentAllocation.remainingRefundable)}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">{t('dossier.payment.refundLimitHint')}</p>
          </div>
        )}
      </div>

      {/* Khối SVC-SHP */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-border pb-2.5">
          <Truck aria-hidden="true" className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{t('dossier.shipping.title')}</h3>
        </div>

        {dossier?.shippingServiceUnavailable || !shipment ? (
          <ServiceFallbackBanner
            message={t('dossier.shipping.unavailable')}
            onRetry={onRetryDossier}
            isRetrying={isRefetching}
          />
        ) : (
          <dl className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs text-muted-foreground">{t('dossier.shipping.carrier')}</dt>
              <dd className="font-medium text-foreground">{shipment.carrier}</dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-xs text-muted-foreground">{t('dossier.shipping.trackingCode')}</dt>
              <dd>
                <CopyableId value={shipment.trackingCode} label={t('dossier.shipping.trackingCode')} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs text-muted-foreground">{t('dossier.shipping.kind')}</dt>
              <dd className="text-xs font-medium text-foreground">{shipment.kind}</dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-xs text-muted-foreground">{t('dossier.shipping.status')}</dt>
              <dd>
                <StatusBadge status={shipment.status} />
              </dd>
            </div>
            {shipment.deliveredAt && (
              <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
                <dt className="text-muted-foreground">{t('dossier.shipping.deliveredAt')}</dt>
                <dd>{formatDateTime(shipment.deliveredAt)}</dd>
              </div>
            )}
            {shipment.etaAt && (
              <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
                <dt className="text-muted-foreground">{t('dossier.shipping.etaAt')}</dt>
                <dd>{formatDateTime(shipment.etaAt)}</dd>
              </div>
            )}
          </dl>
        )}

        {complaint.returnShipmentId && (
          <div className="flex flex-col gap-1.5 border-t border-border pt-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">{t('dossier.shipping.returnShipmentId')}</span>
              <CopyableId
                value={complaint.returnShipmentId}
                label={t('dossier.shipping.returnShipmentId')}
              />
            </div>
            <p className="font-medium text-foreground">
              {complaint.returnReceivedConfirmed
                ? t('dossier.shipping.returnConfirmed')
                : t('dossier.shipping.returnPending')}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
