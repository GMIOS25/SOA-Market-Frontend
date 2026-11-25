import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ServiceFallbackBanner } from '@/components/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { apiGetMyApplication, sellerShopKeys } from '../api'
import { ApplicationStatusCard } from '../components/ApplicationStatusCard'
import { SellerApplicationForm } from '../components/SellerApplicationForm'

/**
 * B16 `/seller-onboarding` (FR-SEL-001): chưa có hồ sơ → form đăng ký; đã có → màn hình trạng thái.
 * REJECTED được nộp hồ sơ mới; PENDING không hiện form (BE cũng chặn 409 — TC-SEL-01).
 */
export function SellerOnboardingPage() {
  const { t } = useTranslation('sellerShop')
  const [resubmitting, setResubmitting] = useState(false)

  const query = useQuery({
    queryKey: sellerShopKeys.myApplication,
    queryFn: apiGetMyApplication,
    retry: false,
  })
  const application = query.data

  // Nộp lại thành công → cache có hồ sơ PENDING mới → tự quay về màn hình trạng thái.
  const showForm = !query.isPending && !query.isError && (!application || (resubmitting && application.status === 'REJECTED'))

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('onboarding.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('onboarding.subtitle')}</p>
      </header>

      {query.isPending && (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      )}

      {query.isError && (
        <ServiceFallbackBanner
          message={t('onboarding.loadError')}
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
      )}

      {showForm && (
        <section className="rounded-lg border border-border bg-card p-5 shadow-xs">
          <SellerApplicationForm
            previousRejectionReason={application?.status === 'REJECTED' ? application.reviewReason : undefined}
            onCancel={application ? () => setResubmitting(false) : undefined}
          />
        </section>
      )}

      {application && !showForm && (
        <ApplicationStatusCard application={application} onResubmit={() => setResubmitting(true)} />
      )}
    </div>
  )
}
