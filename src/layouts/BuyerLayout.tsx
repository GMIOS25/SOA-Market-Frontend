import { LayoutDashboard, Search, ShoppingCart, Store } from 'lucide-react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { hasAnyRole, hasRole, OPS_ROLES } from '@/lib/auth/roles'
import { useAuthSession } from '@/lib/auth/session'
import { cn } from '@/lib/utils'
import { BrandLogo, SkipToContent } from './shared'
import { UserMenu } from './UserMenu'

function SearchBox({ className }: { className?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const currentQuery = params.get('q') ?? ''

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const q = String(new FormData(event.currentTarget).get('q') ?? '').trim()
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products')
  }

  return (
    <form role="search" onSubmit={handleSubmit} className={cn('flex w-full', className)}>
      <label htmlFor="header-search" className="sr-only">
        {t('header.searchLabel')}
      </label>
      <input
        key={currentQuery}
        id="header-search"
        name="q"
        type="search"
        defaultValue={currentQuery}
        placeholder={t('header.searchPlaceholder')}
        className="h-10 min-w-0 flex-1 rounded-l-md border border-r-0 border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      />
      <Button type="submit" className="h-10 rounded-l-none" aria-label={t('header.searchSubmit')}>
        <Search aria-hidden="true" />
      </Button>
    </form>
  )
}

/** Cổng Người mua (`/`): thoáng, header tìm kiếm luôn sẵn sàng cả desktop lẫn mobile (Brief §1.1, §5.2). */
export function BuyerLayout() {
  const { t } = useTranslation()
  const { accessToken, user } = useAuthSession()
  const isSeller = hasRole(user, 'SELLER')
  const isOps = hasAnyRole(user, OPS_ROLES)

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipToContent />
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <BrandLogo to="/" />
          <SearchBox className="order-last basis-full md:order-none md:max-w-2xl md:flex-1 md:basis-auto" />
          <nav aria-label={t('header.mainNav')} className="ml-auto flex items-center gap-1">
            {isSeller && (
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link to="/seller">
                  <Store aria-hidden="true" />
                  {t('portal.toSeller')}
                </Link>
              </Button>
            )}
            {isOps && (
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link to="/admin">
                  <LayoutDashboard aria-hidden="true" />
                  {t('portal.toAdmin')}
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="icon" aria-label={t('header.cart')}>
              <Link to="/cart">
                <ShoppingCart aria-hidden="true" />
              </Link>
            </Button>
            {accessToken ? (
              <UserMenu user={user} variant="buyer" />
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/login">{t('account.login')}</Link>
                </Button>
                <Button asChild size="sm" className="hidden sm:inline-flex">
                  <Link to="/register">{t('account.register')}</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {t('appName')} — {t('footer.tagline')}
        </div>
      </footer>
    </div>
  )
}
