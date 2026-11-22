import { ClipboardList, LogOut, MapPin, Store, User, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { logout } from '@/api/auth-fetch'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { primaryRole } from '@/lib/auth/roles'
import type { Session } from '@/lib/auth/session-store'

type UserMenuProps = {
  session: Session
  /** Buyer: đủ mục mua sắm; ops (Seller/Admin): chỉ hồ sơ + đăng xuất. */
  variant: 'buyer' | 'ops'
}

export function UserMenu({ session, variant }: UserMenuProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const roleLabel = t(`roles.${primaryRole(session.roles)}`)

  async function handleLogout(allDevices: boolean) {
    await logout({ allDevices })
    navigate('/', { replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t('account.menu')}>
          <UserRound aria-hidden="true" />
          <span className="hidden max-w-32 truncate sm:inline">{roleLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col">
          <span>{roleLabel}</span>
          <span className="truncate font-mono text-xs font-normal text-muted-foreground">{session.userId}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account/profile">
            <User aria-hidden="true" />
            {t('account.profile')}
          </Link>
        </DropdownMenuItem>
        {variant === 'buyer' && (
          <>
            <DropdownMenuItem asChild>
              <Link to="/account/addresses">
                <MapPin aria-hidden="true" />
                {t('account.addresses')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/account/orders">
                <ClipboardList aria-hidden="true" />
                {t('account.orders')}
              </Link>
            </DropdownMenuItem>
            {!session.roles.includes('SELLER') && session.roles.includes('BUYER') && (
              <DropdownMenuItem asChild>
                <Link to="/seller-onboarding">
                  <Store aria-hidden="true" />
                  {t('account.becomeSeller')}
                </Link>
              </DropdownMenuItem>
            )}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void handleLogout(false)}>
          <LogOut aria-hidden="true" />
          {t('account.logout')}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => void handleLogout(true)}>
          <LogOut aria-hidden="true" />
          {t('account.logoutAllDevices')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
