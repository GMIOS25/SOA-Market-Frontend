import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <main
      id="main"
      className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="text-2xl font-bold">{t('error.notFoundTitle')}</h1>
      <p className="text-muted-foreground">{t('error.notFoundDescription')}</p>
      <Button asChild>
        <Link to="/">{t('error.backHome')}</Link>
      </Button>
    </main>
  )
}
