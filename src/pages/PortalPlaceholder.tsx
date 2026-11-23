import { useTranslation } from 'react-i18next'

type PortalPlaceholderProps = {
  portal: 'buyer' | 'seller' | 'admin'
}

/** Tạm thời cho T2-01 — được thay bằng BuyerLayout/SellerLayout/AdminLayout ở T2-03. */
export function PortalPlaceholder({ portal }: PortalPlaceholderProps) {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex min-h-dvh max-w-7xl flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-sm font-medium text-primary">{t('appName')}</p>
      <h1 className="text-2xl font-bold">{t(`portal.${portal}`)}</h1>
      <p className="text-muted-foreground">{t('placeholder.underConstruction')}</p>
    </main>
  )
}
