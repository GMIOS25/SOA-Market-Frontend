import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { MapPin, User } from 'lucide-react'
import { useAuthSession } from '../session'

type AuthAccountShellProps = {
  children: ReactNode
  title?: string
  subtitle?: string
}

/**
 * Khung nội dung của các trang auth-profile. Header/Sidebar, `<main>` và kiểm tra đăng nhập / vai trò
 * do BuyerLayout / AdminLayout và RequireAuth / RequireRole trong router đảm nhận (T2-03).
 */
export function AuthAccountShell({ children, title, subtitle }: AuthAccountShellProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const { accessToken } = useAuthSession()
  const showAccountNav = Boolean(accessToken) && location.pathname.startsWith('/account/')

  return (
    <>
      {(title || subtitle) && (
        <header className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {title && <h1 className="text-2xl font-bold tracking-tight">{title}</h1>}
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {showAccountNav && (
            <nav aria-label={t('authProfile.nav.profile')} className="flex flex-wrap items-center gap-2">
              <Link
                to="/account/profile"
                aria-current={location.pathname === '/account/profile' ? 'page' : undefined}
                className={navPillClass(location.pathname === '/account/profile')}
              >
                <User className="size-4" aria-hidden="true" />
                <span>{t('authProfile.nav.profile')}</span>
              </Link>
              <Link
                to="/account/addresses"
                aria-current={location.pathname === '/account/addresses' ? 'page' : undefined}
                className={navPillClass(location.pathname === '/account/addresses')}
              >
                <MapPin className="size-4" aria-hidden="true" />
                <span>{t('authProfile.nav.addresses')}</span>
              </Link>
            </nav>
          )}
        </header>
      )}

      {children}
    </>
  )
}

function navPillClass(active: boolean) {
  return [
    'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    active ? 'border-primary bg-primary-soft text-primary' : 'border-input bg-card text-foreground hover:bg-muted',
  ].join(' ')
}
