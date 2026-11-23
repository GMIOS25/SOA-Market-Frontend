import { ShoppingBag } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { SELLER_NAV } from '@/app/navigation'
import { Button } from '@/components/ui/button'
import { OpsLayout } from './OpsLayout'

/** Cổng Nhà bán (`/seller/*`) — route đã được bọc RequireRole(['SELLER']). */
export function SellerLayout() {
  const { t } = useTranslation()

  return (
    <OpsLayout
      portal="seller"
      homePath="/seller"
      nav={SELLER_NAV}
      portalSwitch={
        <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
          <Link to="/">
            <ShoppingBag aria-hidden="true" />
            {t('portal.toBuyer')}
          </Link>
        </Button>
      }
    />
  )
}
