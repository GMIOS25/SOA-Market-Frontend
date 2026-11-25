import { CircleCheck, Clock, Loader2, RotateCcw, Store, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { refreshAccessToken } from '@/api/auth-fetch'
import { CopyableId } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { getAuthSession } from '@/lib/auth/session'
import { hasRole } from '@/lib/auth/roles'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ApplicationDTO } from '../api'

const STATUS_STYLE = {
  PENDING: { Icon: Clock, box: 'border-status-warning-border bg-status-warning text-status-warning-foreground' },
  APPROVED: { Icon: CircleCheck, box: 'border-status-success-border bg-status-success text-status-success-foreground' },
  REJECTED: { Icon: XCircle, box: 'border-status-danger-border bg-status-danger text-status-danger-foreground' },
} as const

type ApplicationStatusCardProps = {
  application: ApplicationDTO
  onResubmit: () => void
}

/** Màn hình trạng thái hồ sơ PENDING / APPROVED / REJECTED (03-App-Flow §4.4). */
export function ApplicationStatusCard({ application, onResubmit }: ApplicationStatusCardProps) {
  const { t } = useTranslation('sellerShop')
  const navigate = useNavigate()
  const [activating, setActivating] = useState(false)
  const [roleNotReady, setRoleNotReady] = useState(false)
  const { Icon, box } = STATUS_STYLE[application.status]

  /**
   * Access token hiện tại được cấp trước khi duyệt nên chưa có role SELLER (FR-ACC-005 AC3):
   * refresh để nhận token mới từ SVC-IDN rồi mới vào /seller, nếu không RequireRole sẽ trả 403.
   */
  async function goToSeller() {
    setRoleNotReady(false)
    if (!hasRole(getAuthSession().user, 'SELLER')) {
      setActivating(true)
      await refreshAccessToken()
      setActivating(false)
      if (!hasRole(getAuthSession().user, 'SELLER')) {
        // Consumer `seller.approved` của SVC-IDN xử lý bất đồng bộ — có thể trễ vài giây.
        setRoleNotReady(true)
        return
      }
    }
    void navigate('/seller')
  }

  return (
    <section aria-labelledby="application-status-title" className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-xs">
      <div className={cn('flex items-start gap-3 rounded-md border p-4', box)}>
        <Icon aria-hidden="true" className="mt-0.5 size-6 shrink-0" />
        <div className="flex flex-col gap-1">
          <h2 id="application-status-title" className="text-lg font-semibold">
            {t(`onboarding.status.${application.status}.title`)}
          </h2>
          <p className="text-sm">{t(`onboarding.status.${application.status}.description`)}</p>
        </div>
      </div>

      {application.status === 'REJECTED' && application.reviewReason && (
        <div className="rounded-md border border-border bg-background p-3 text-sm">
          <p className="font-medium">{t('onboarding.status.reasonLabel')}</p>
          <p className="mt-1 whitespace-pre-line text-muted-foreground">{application.reviewReason}</p>
        </div>
      )}
      {application.status === 'APPROVED' && application.reviewReason && (
        <div className="rounded-md border border-border bg-background p-3 text-sm">
          <p className="font-medium">{t('onboarding.status.noteLabel')}</p>
          <p className="mt-1 whitespace-pre-line text-muted-foreground">{application.reviewReason}</p>
        </div>
      )}

      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">{t('admin.columns.shop')}</dt>
          <dd className="font-medium">{application.shopName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('admin.columns.status')}</dt>
          <dd>
            <StatusBadge status={application.status} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('admin.columns.sellerType')}</dt>
          <dd>{t(`sellerType.${application.sellerType}`)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('onboarding.status.submittedAt')}</dt>
          <dd className="tabular-nums">{formatDateTime(application.createdAt)}</dd>
        </div>
        {application.reviewedAt && (
          <div>
            <dt className="text-muted-foreground">{t('onboarding.status.reviewedAt')}</dt>
            <dd className="tabular-nums">{formatDateTime(application.reviewedAt)}</dd>
          </div>
        )}
        <div>
          <dt className="text-muted-foreground capitalize">{t('onboarding.status.applicationCode')}</dt>
          <dd>
            <CopyableId
              value={application.applicationId}
              display={application.applicationId.slice(0, 8).toUpperCase()}
              label={t('onboarding.status.applicationCode')}
            />
          </dd>
        </div>
      </dl>

      {roleNotReady && (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {t('onboarding.status.roleNotReady')}
        </p>
      )}

      {application.status !== 'PENDING' && (
        <div className="flex justify-end">
          {application.status === 'APPROVED' ? (
            <Button type="button" disabled={activating} onClick={() => void goToSeller()}>
              {activating ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Store aria-hidden="true" />}
              {activating ? t('onboarding.status.activating') : t('onboarding.status.goToSeller')}
            </Button>
          ) : (
            <Button type="button" onClick={onResubmit}>
              <RotateCcw aria-hidden="true" />
              {t('onboarding.status.resubmit')}
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
