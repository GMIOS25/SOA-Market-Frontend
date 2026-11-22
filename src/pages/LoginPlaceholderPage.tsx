import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { createUnsignedDevToken } from '@/lib/auth/dev-token'
import type { Role } from '@/lib/auth/roles'
import { sessionStore } from '@/lib/auth/session-store'
import { ComingSoonPage } from './ComingSoonPage'
import { SessionNotice } from '@/components/shared/session-notice'

const DEV_PERSONAS: Role[][] = [['BUYER'], ['BUYER', 'SELLER'], ['CS'], ['ADMINISTRATOR']]

/**
 * Giữ chỗ cho /login đến khi TV1 làm form thật (T1-06). Form thật cần giữ <SessionNotice /> ở đầu trang
 * và gọi `sessionStore.signIn(tokens)` sau `POST /v1/auth/login`.
 */
export function LoginPlaceholderPage() {
  const { t } = useTranslation()

  // Banner chỉ hiện 1 lần: rời trang thì xóa lý do kết thúc phiên.
  useEffect(() => () => sessionStore.clearEndReason(), [])

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <SessionNotice />
      <ComingSoonPage title="pages.login" task="T1-06" />
      {import.meta.env.DEV && (
        <section className="flex flex-col gap-2 rounded-lg border border-input bg-card p-4">
          <h2 className="font-semibold">{t('session.devLoginTitle')}</h2>
          <p className="text-xs text-muted-foreground">{t('session.devLoginHint')}</p>
          {DEV_PERSONAS.map((roles) => (
            <Button
              key={roles.join('+')}
              variant="outline"
              onClick={() =>
                sessionStore.signIn({
                  accessToken: createUnsignedDevToken({ userId: `dev-${roles.join('-').toLowerCase()}`, roles }),
                  refreshToken: 'dev-refresh-token',
                })
              }
            >
              {t('session.devLoginAs', { roles: roles.map((r) => t(`roles.${r}`)).join(' + ') })}
            </Button>
          ))}
        </section>
      )}
    </div>
  )
}
