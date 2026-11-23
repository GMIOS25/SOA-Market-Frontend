import { Bell, ChevronRight, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { findActiveNav, type NavGroup } from '@/app/navigation'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { primaryRole } from '@/lib/auth/roles'
import { useAuthSession } from '@/lib/auth/session'
import { cn } from '@/lib/utils'
import { BrandLogo, SkipToContent } from './shared'
import { UserMenu } from './UserMenu'

type SidebarNavProps = {
  groups: NavGroup[]
  /** `rail` = chỉ icon (64px); `auto` = icon ở tablet, đầy đủ ở desktop; `full` = luôn đầy đủ (drawer mobile). */
  mode: 'rail' | 'auto' | 'full'
  onNavigate?: () => void
}

function SidebarNav({ groups, mode, onNavigate }: SidebarNavProps) {
  const { t } = useTranslation('nav')
  const { t: tCommon } = useTranslation()
  const labelClass = mode === 'full' ? '' : mode === 'auto' ? 'hidden lg:inline' : 'sr-only'
  const headingClass = mode === 'full' ? '' : mode === 'auto' ? 'hidden lg:block' : 'sr-only'

  return (
    <nav aria-label={tCommon('header.mainNav')} className="flex flex-col gap-4 p-2">
      {groups.map((group) => (
        <div key={group.id} className="flex flex-col gap-1">
          {groups.length > 1 && (
            <p className={cn('px-3 pt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase', headingClass)}>
              {t(`groups.${group.id}`)}
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const label = t(`items.${item.id}`)
              const link = (
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      mode === 'rail' && 'justify-center px-0',
                      mode === 'auto' && 'justify-center px-0 lg:justify-start lg:px-3',
                      isActive
                        ? 'bg-primary-soft text-primary'
                        : 'text-muted-foreground hover:bg-background hover:text-foreground',
                    )
                  }
                >
                  <item.icon aria-hidden="true" className="size-5 shrink-0" />
                  <span className={labelClass}>{label}</span>
                </NavLink>
              )
              return (
                <li key={item.id}>
                  {mode === 'full' ? (
                    link
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right" className={cn(mode === 'auto' && 'lg:hidden')}>
                        {label}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

type OpsLayoutProps = {
  portal: 'seller' | 'admin'
  homePath: string
  nav: NavGroup[]
  /** Nút chuyển cổng trên Topbar (VD: "Về sàn mua sắm"). */
  portalSwitch?: ReactNode
}

/**
 * Workspace mật độ cao kiểu Stripe/Linear cho Seller & Admin–CSKH (Brief §1.1, §5.1):
 * Sidebar 240px (≥1024px) → icon rail 64px (768–1023px, hoặc khi thu gọn) → drawer (<768px); Topbar 56px.
 */
export function OpsLayout({ portal, homePath, nav, portalSwitch }: OpsLayoutProps) {
  const { t } = useTranslation()
  const { t: tNav } = useTranslation('nav')
  const { accessToken, user } = useAuthSession()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const active = findActiveNav(nav, location.pathname)

  return (
    <div className="flex min-h-dvh bg-background">
      <SkipToContent />

      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-card md:flex',
          collapsed ? 'w-16' : 'w-16 lg:w-60',
        )}
      >
        <div className={cn('flex h-14 items-center border-b border-border px-4', collapsed && 'justify-center px-0')}>
          <BrandLogo to={homePath} compact={collapsed} className={cn(!collapsed && '[&>span]:hidden lg:[&>span]:inline')} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav groups={nav} mode={collapsed ? 'rail' : 'auto'} />
        </div>
        <div className="hidden border-t border-border p-2 lg:block">
          <Button
            variant="ghost"
            size="sm"
            className={cn('w-full', collapsed ? 'justify-center' : 'justify-start')}
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? t('header.expandSidebar') : t('header.collapseSidebar')}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
            {!collapsed && <span>{t('header.collapseSidebar')}</span>}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card px-4">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label={t('header.openMenu')}>
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="border-b border-border">
                <SheetTitle>{t(`portal.${portal}`)}</SheetTitle>
                <SheetDescription className="sr-only">{t('header.mainNav')}</SheetDescription>
              </SheetHeader>
              <SidebarNav groups={nav} mode="full" onNavigate={() => setDrawerOpen(false)} />
            </SheetContent>
          </Sheet>

          <nav aria-label={t('header.breadcrumb')} className="min-w-0 flex-1">
            <ol className="flex items-center gap-1 truncate text-sm text-muted-foreground">
              <li className="hidden sm:block">
                <Link to={homePath} className="hover:text-foreground">
                  {t(`portal.${portal}`)}
                </Link>
              </li>
              {active && nav.length > 1 && (
                <li className="hidden items-center gap-1 sm:flex">
                  <ChevronRight aria-hidden="true" className="size-4" />
                  {tNav(`groups.${active.group.id}`)}
                </li>
              )}
              {active && (
                <li aria-current="page" className="flex min-w-0 items-center gap-1 font-medium text-foreground">
                  <ChevronRight aria-hidden="true" className="hidden size-4 sm:block" />
                  <span className="truncate">{tNav(`items.${active.item.id}`)}</span>
                </li>
              )}
            </ol>
          </nav>

          {accessToken && (
            <span className="hidden rounded-full border border-status-info-border bg-status-info px-2.5 py-0.5 text-xs font-medium text-status-info-foreground sm:inline">
              {t(`roles.${primaryRole(user)}`)}
            </span>
          )}
          {portalSwitch}
          <Button asChild variant="ghost" size="icon" aria-label={t('header.notifications')}>
            <Link to="/account/notifications">
              <Bell aria-hidden="true" />
            </Link>
          </Button>
          {accessToken && <UserMenu user={user} variant="ops" />}
        </header>

        <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
