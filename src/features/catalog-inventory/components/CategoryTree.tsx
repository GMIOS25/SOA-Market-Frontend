import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import type { Category } from '../api'
import { categoryHref } from '../storefront-helpers'

const rootLinkClass =
  'rounded-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
const childLinkClass =
  'block truncate rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

/** Cây danh mục 2 cấp ở Trang chủ: mỗi danh mục cấp 1 một thẻ, danh mục con là link ra trang tìm kiếm. */
export function CategoryShowcase({ categories }: { categories: Category[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {categories.map((root) => {
        const children = root.children ?? []
        return (
          <li key={root.categoryId} className="min-w-0 rounded-lg border border-border bg-card p-4">
            <Link to={categoryHref(root.categoryId)} className={rootLinkClass}>
              {root.name}
            </Link>
            {children.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {children.map((child) => (
                  <li key={child.categoryId}>
                    <Link to={categoryHref(child.categoryId)} className={childLinkClass}>
                      {child.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export type CategoryFilterTreeProps = {
  categories: Category[]
  selectedId: string
  onSelect: (categoryId: string) => void
}

function rowClass(active: boolean, className?: string) {
  return cn(
    'inline-flex min-h-9 items-center rounded-md px-3 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
    active ? 'bg-primary-soft font-medium text-primary' : 'text-foreground',
    className,
  )
}

/** Danh mục trong bộ lọc tìm kiếm: "Tất cả" + 2 cấp. Chọn danh mục cấp 1 đã gồm cả danh mục con (hợp đồng BE). */
export function CategoryFilterTree({ categories, selectedId, onSelect }: CategoryFilterTreeProps) {
  const { t } = useTranslation('catalog')
  // Ghi đè trạng thái mở/đóng của từng nhánh sau khi người dùng bấm; mặc định mở nhánh đang được chọn.
  const [expandedOverride, setExpandedOverride] = useState<Record<string, boolean>>({})

  return (
    <div role="group" aria-label={t('search.filters.categoryLabel')} className="space-y-1">
      <button type="button" aria-pressed={selectedId === ''} onClick={() => onSelect('')} className={rowClass(selectedId === '')}>
        {t('search.filters.allCategories')}
      </button>
      <ul className="space-y-1">
        {categories.map((root) => {
          const children = root.children ?? []
          const selected = selectedId === root.categoryId
          const childSelected = children.some((child) => child.categoryId === selectedId)
          const expanded = expandedOverride[root.categoryId] ?? (selected || childSelected)
          return (
            <li key={root.categoryId}>
              <div className="flex items-center">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(root.categoryId)}
                  className={rowClass(selected, 'min-w-0 flex-1')}
                >
                  {root.name}
                </button>
                {children.length > 0 && (
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-label={
                      expanded
                        ? t('search.filters.collapseCategory', { name: root.name })
                        : t('search.filters.expandCategory', { name: root.name })
                    }
                    onClick={() => setExpandedOverride((prev) => ({ ...prev, [root.categoryId]: !expanded }))}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <ChevronDown aria-hidden="true" className={cn('size-4 transition-transform', expanded && 'rotate-180')} />
                  </button>
                )}
              </div>
              {children.length > 0 && (
                <ul hidden={!expanded} className="ml-4 space-y-1 border-l border-border pl-2">
                  {children.map((child) => (
                    <li key={child.categoryId}>
                      <button
                        type="button"
                        aria-pressed={child.categoryId === selectedId}
                        onClick={() => onSelect(child.categoryId)}
                        className={rowClass(child.categoryId === selectedId)}
                      >
                        {child.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
