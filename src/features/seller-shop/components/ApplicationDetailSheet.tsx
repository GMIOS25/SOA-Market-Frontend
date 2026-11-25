import { CircleCheck, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CopyableId } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDateTime } from '@/lib/format'
import type { ApplicationDTO } from '../api'
import { KycDocumentImage } from './KycDocumentImage'

type ApplicationDetailSheetProps = {
  application: ApplicationDTO | null
  onOpenChange: (open: boolean) => void
  onApprove: () => void
  onReject: () => void
}

/** Hồ sơ chi tiết + ảnh KYC qua proxy API (T2-06) — mở từ danh sách `/admin/seller-applications`. */
export function ApplicationDetailSheet({ application, onOpenChange, onApprove, onReject }: ApplicationDetailSheetProps) {
  const { t } = useTranslation('sellerShop')

  return (
    <Sheet open={Boolean(application)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        {application && (
          <>
            <SheetHeader className="border-b border-border">
              <SheetTitle>{t('admin.detail.title', { shopName: application.shopName })}</SheetTitle>
              <SheetDescription>{t('admin.detail.description')}</SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-5 p-4">
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Field label={t('admin.columns.status')}>
                  <StatusBadge status={application.status} />
                </Field>
                <Field label={t('admin.columns.sellerType')}>{t(`sellerType.${application.sellerType}`)}</Field>
                <Field label={t('admin.columns.shop')}>
                  <span className="font-medium">{application.shopName}</span>
                </Field>
                <Field label={t('admin.columns.submittedAt')}>
                  <span className="tabular-nums">{formatDateTime(application.createdAt)}</span>
                </Field>
                <Field label={t('admin.columns.identity')}>
                  <span className="font-mono">{application.identityOrBusinessNumber}</span>
                </Field>
                <Field label={t('admin.columns.taxCode')}>
                  <span className="font-mono">{application.taxCode}</span>
                </Field>
                <Field label={t('admin.detail.applicant')}>
                  <CopyableId
                    value={application.userId}
                    display={application.userId.slice(0, 8).toUpperCase()}
                    label={t('admin.detail.applicant')}
                  />
                </Field>
                <Field label={t('admin.detail.applicationId')}>
                  <CopyableId
                    value={application.applicationId}
                    display={application.applicationId.slice(0, 8).toUpperCase()}
                    label={t('admin.detail.applicationId')}
                  />
                </Field>
                {application.reviewedAt && (
                  <Field label={t('onboarding.status.reviewedAt')}>
                    <span className="tabular-nums">{formatDateTime(application.reviewedAt)}</span>
                  </Field>
                )}
              </dl>

              {application.reviewReason && (
                <div className="rounded-md border border-border bg-background p-3 text-sm">
                  <p className="font-medium">
                    {application.status === 'REJECTED' ? t('onboarding.status.reasonLabel') : t('onboarding.status.noteLabel')}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-muted-foreground">{application.reviewReason}</p>
                </div>
              )}

              <section aria-labelledby="kyc-documents-heading" className="flex flex-col gap-2">
                <h3 id="kyc-documents-heading" className="text-sm font-semibold">
                  {t('admin.detail.documents')}
                </h3>
                {(application.documents ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('admin.detail.noDocuments')}</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(application.documents ?? []).map((document) => (
                      <KycDocumentImage
                        key={document.type}
                        applicationId={application.applicationId}
                        shopName={application.shopName}
                        document={document}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>

            {application.status === 'PENDING' && (
              <SheetFooter className="sticky bottom-0 flex-row justify-end gap-2 border-t border-border bg-card">
                <Button type="button" variant="destructive-outline" onClick={onReject}>
                  <XCircle aria-hidden="true" />
                  {t('admin.detail.reject')}
                </Button>
                <Button type="button" onClick={onApprove}>
                  <CircleCheck aria-hidden="true" />
                  {t('admin.detail.approve')}
                </Button>
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
