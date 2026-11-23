import { Construction } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type nav from '@/locales/vi/nav.json'

export type NavTitleKey = `pages.${keyof typeof nav.pages}` | `items.${keyof typeof nav.items}`

/**
 * Placeholder cho route đã đăng ký nhưng chưa có màn hình. Thành viên phụ trách thay `element`
 * trong src/app/router.tsx bằng màn hình thật trong src/features/<module>/.
 */
export function ComingSoonPage({ title, task }: { title: NavTitleKey; task: string }) {
  const { t } = useTranslation()
  const { t: tNav } = useTranslation('nav')

  return (
    <section className="flex min-h-[40dvh] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-card p-8 text-center">
      <Construction aria-hidden="true" className="size-8 text-muted-foreground" />
      <h1 className="text-xl font-semibold">{tNav(title)}</h1>
      <p className="text-muted-foreground">{t('placeholder.underConstruction')}</p>
      <p className="font-mono text-xs text-muted-foreground">{t('placeholder.owner', { task })}</p>
    </section>
  )
}
