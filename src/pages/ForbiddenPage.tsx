import { ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useSession } from '@/lib/auth/session-store'
import { homePathFor } from '@/lib/auth/roles'

/** 403 — truy cập route sai vai trò (03-App-Flow §2 Route Guard). */
export function ForbiddenPage() {
  const { t } = useTranslation()
  const session = useSession()

  return (
    <main
      id="main"
      className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <ShieldAlert aria-hidden="true" className="size-10 text-status-danger-foreground" />
      <p className="font-mono text-sm text-muted-foreground">403</p>
      <h1 className="text-2xl font-bold">{t('error.forbiddenTitle')}</h1>
      <p className="text-muted-foreground">{t('error.forbiddenDescription')}</p>
      <Button asChild>
        <Link to={session ? homePathFor(session.roles) : '/'}>{t('error.backToPortal')}</Link>
      </Button>
    </main>
  )
}
