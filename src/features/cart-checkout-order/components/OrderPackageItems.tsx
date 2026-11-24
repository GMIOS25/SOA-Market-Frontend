import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { DisclosurePanel } from '@/components/ui/disclosure-panel'

const PREVIEW_SIZE = 2

export function OrderPackageItems({ items }: { items: ReactElement[] }) {
  const { t } = useTranslation('orders')
  const remaining = items.slice(PREVIEW_SIZE)

  return (
    <>
      {items.slice(0, PREVIEW_SIZE)}
      {remaining.length > 0 && (
        <li className="px-4 py-2.5">
          <DisclosurePanel title={t('detail.moreProducts', { count: remaining.length })}>
            <ul className="-mx-3.5 divide-y divide-border">{remaining}</ul>
          </DisclosurePanel>
        </li>
      )}
    </>
  )
}
