import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { LogOut, MapPin, ShieldAlert, ShieldCheck, Store, User } from 'lucide-react'
import { apiLogout } from '../api'
import { clearAuthSession, hasRole, useAuthSession } from '../session'

type AuthAccountShellProps = {
  children: ReactNode
  requireAuth?: boolean
  requireRoles?: string[]
  title?: string
  subtitle?: string
}

export function AuthAccountShell({
  children,
  requireAuth = false,
  requireRoles,
  title,
  subtitle,
}: AuthAccountShellProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const session = useAuthSession()

  useEffect(() => {
    if (requireAuth && session.lockNotice) {
      void navigate('/login', { replace: true })
    }
  }, [requireAuth, session.lockNotice, navigate])

  if (requireAuth && !session.accessToken) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  const isAdmin = hasRole(session.user, 'ADMINISTRATOR')
  const isSeller = hasRole(session.user, 'SELLER')

  if (requireRoles && requireRoles.length > 0) {
    const allowed = requireRoles.some((r) => hasRole(session.user, r))
    if (!allowed) {
      return (
        <div className="min-h-dvh bg-background text-foreground">
          <TopBar isAdmin={isAdmin} isSeller={isSeller} isLoggedIn={Boolean(session.accessToken)} />
          <main className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full border border-status-danger-border bg-status-danger text-status-danger-foreground">
              <ShieldAlert className="size-6" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold">{t('authProfile.adminUsers.forbiddenTitle')}</h1>
            <p className="text-muted-foreground">{t('authProfile.adminUsers.forbiddenDesc')}</p>
            <Link
              to="/account/profile"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {t('authProfile.nav.profile')}
            </Link>
          </main>
        </div>
      )
    }
  }

  const handleLogout = async (allDevices: boolean) => {
    try {
      if (session.accessToken) {
        await apiLogout({
          refreshToken: session.refreshToken ?? undefined,
          allDevices,
        })
      }
    } catch {
      // Clear local session regardless of network failure
    } finally {
      clearAuthSession()
      void navigate('/login', { replace: true })
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopBar
        isAdmin={isAdmin}
        isSeller={isSeller}
        isLoggedIn={Boolean(session.accessToken)}
        userEmail={session.user?.email}
        onLogout={() => void handleLogout(false)}
      />

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        {(title || subtitle) && (
          <header className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              {title && <h1 className="text-2xl font-bold tracking-tight">{title}</h1>}
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {session.accessToken && (
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/account/profile"
                  className={navPillClass(location.pathname === '/account/profile')}
                >
                  <User className="size-4" aria-hidden="true" />
                  <span>{t('authProfile.nav.profile')}</span>
                </Link>
                <Link
                  to="/account/addresses"
                  className={navPillClass(location.pathname === '/account/addresses')}
                >
                  <MapPin className="size-4" aria-hidden="true" />
                  <span>{t('authProfile.nav.addresses')}</span>
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin/users"
                    className={navPillClass(location.pathname === '/admin/users')}
                  >
                    <ShieldCheck className="size-4" aria-hidden="true" />
                    <span>{t('authProfile.nav.adminUsers')}</span>
                  </Link>
                )}
              </div>
            )}
          </header>
        )}

        {children}
      </main>
    </div>
  )
}

function navPillClass(active: boolean) {
  return [
    'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    active
      ? 'border-primary bg-primary-soft text-primary'
      : 'border-input bg-card text-foreground hover:bg-muted',
  ].join(' ')
}

type TopBarProps = {
  isLoggedIn: boolean
  isSeller: boolean
  isAdmin: boolean
  userEmail?: string
  onLogout?: () => void
}

function TopBar({ isLoggedIn, isSeller, isAdmin, userEmail, onLogout }: TopBarProps) {
  const { t } = useTranslation()

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="text-lg font-bold tracking-tight text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {t('appName')}
          </Link>
          <nav aria-label="Cổng hệ thống" className="hidden items-center gap-3 text-sm sm:flex">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              {t('portal.buyer')}
            </Link>
            {isSeller && (
              <Link
                to="/seller"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <Store className="size-3.5" aria-hidden="true" />
                {t('portal.seller')}
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/admin/users"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                {t('authProfile.nav.adminUsers')}
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <>
              {userEmail && (
                <span className="hidden max-w-48 truncate text-xs text-muted-foreground md:inline">
                  {userEmail}
                </span>
              )}
              <Link
                to="/account/profile"
                className="inline-flex h-9 items-center rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-muted"
              >
                {t('authProfile.nav.profile')}
              </Link>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  aria-label={t('authProfile.nav.logoutDevice')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{t('authProfile.nav.logoutDevice')}</span>
                </button>
              )}
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="inline-flex h-9 items-center rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-muted"
              >
                {t('authProfile.nav.login')}
              </Link>
              <Link
                to="/register"
                className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
              >
                {t('authProfile.nav.register')}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
