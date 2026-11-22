import { Info, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSessionState } from '@/lib/auth/session-store'
import { cn } from '@/lib/utils'

/**
 * Banner trên /login giải thích vì sao phiên kết thúc (03-App-Flow §2):
 * bị Admin khóa (đỏ, FR-ACC-006) hoặc hết hạn/bị thu hồi refresh token (xanh).
 */
export function SessionNotice({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { endReason } = useSessionState()
  if (endReason !== 'locked' && endReason !== 'expired') return null

  const locked = endReason === 'locked'
  const Icon = locked ? ShieldAlert : Info

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4 text-sm',
        locked
          ? 'border-status-danger-border bg-status-danger text-status-danger-foreground'
          : 'border-status-info-border bg-status-info text-status-info-foreground',
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <p className="font-medium">{t(locked ? 'session.locked' : 'session.expired')}</p>
    </div>
  )
}
