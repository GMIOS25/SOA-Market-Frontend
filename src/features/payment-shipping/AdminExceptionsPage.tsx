import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Info, TriangleAlert, Wallet, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyableId } from '@/components/shared'
import { hasRole } from '@/lib/auth/roles'
import { useAuthSession } from '@/lib/auth/session'
import { cn } from '@/lib/utils'
import { paymentShippingKeys, type Refund } from './api'
import { ExceptionsSection } from './ExceptionsSection'
import { ManualRefundDialog } from './ManualRefundDialog'
import { PayablesSection } from './PayablesSection'

type MainTab = 'exceptions' | 'payables'

/**
 * A10 `/admin/exceptions` — Quản trị ngoại lệ (4 nhóm), Xác nhận hoàn tiền thủ công
 * (`mark-manual-success`) & Tab Khoản phải trả nhà bán (`/v1/admin/payables`) [T5-09].
 */
export function AdminExceptionsPage() {
  const { t } = useTranslation('paymentShipping')
  const { user } = useAuthSession()
  const queryClient = useQueryClient()
  const isAdmin = hasRole(user, 'ADMINISTRATOR')

  const [tab, setTab] = useState<MainTab>('exceptions')
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null)
  const [confirmedRefund, setConfirmedRefund] = useState<Refund | null>(null)

  const activeTab: MainTab = isAdmin ? tab : 'exceptions'

  function handleManualSuccess(updated: Refund) {
    setConfirmedRefund(updated)
    setSelectedRefund(null)
    void queryClient.invalidateQueries({ queryKey: paymentShippingKeys.all })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('exceptions.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('exceptions.subtitle')}</p>
        </div>

        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'exceptions'}
            onClick={() => setTab('exceptions')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'exceptions'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <TriangleAlert aria-hidden="true" className="size-4" />
            {t('exceptions.tabs.exceptions')}
          </button>
          {isAdmin && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'payables'}
              onClick={() => setTab('payables')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === 'payables'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Wallet aria-hidden="true" className="size-4" />
              {t('exceptions.tabs.payables')}
            </button>
          )}
        </div>
      </header>

      {!isAdmin && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-status-info-border bg-status-info p-3 text-xs text-status-info-foreground"
        >
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{t('exceptions.csNotice')}</span>
        </div>
      )}

      {confirmedRefund && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-lg border border-status-success-border bg-status-success p-4 text-sm text-status-success-foreground"
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold">{t('exceptions.refunds.successTitle')}</p>
              <p className="text-xs">
                {t('exceptions.refunds.successDesc', {
                  refundId: confirmedRefund.refundId,
                  bankRef: confirmedRefund.manualBankRef ?? '—',
                })}
              </p>
              <div className="flex items-center gap-1 text-xs">
                {t('exceptions.refunds.refundId')}:{' '}
                <CopyableId value={confirmedRefund.refundId} label={t('exceptions.refunds.refundId')} />
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label={t('exceptions.filters.clear')}
            onClick={() => setConfirmedRefund(null)}
            className="rounded p-1 hover:bg-card/50"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      )}

      {activeTab === 'exceptions' ? (
        <ExceptionsSection isAdmin={isAdmin} onSelectRefund={(refund) => setSelectedRefund(refund)} />
      ) : (
        <PayablesSection />
      )}

      <ManualRefundDialog
        key={selectedRefund?.refundId ?? 'closed'}
        refund={selectedRefund}
        open={Boolean(selectedRefund)}
        onOpenChange={(open) => {
          if (!open) setSelectedRefund(null)
        }}
        onSuccess={handleManualSuccess}
      />
    </div>
  )
}
