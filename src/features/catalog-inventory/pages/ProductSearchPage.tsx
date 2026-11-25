import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { SearchX, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { ApiError } from '@/api/errors'
import { CopyableId, ServiceFallbackBanner } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  apiListPublicCategories,
  apiSearchProducts,
  catalogKeys,
  type SearchProductsParams,
  type SearchSort,
} from '../api'
import { ProductCard } from '../components/ProductCard'
import { ProductGrid, ProductGridSkeleton } from '../components/ProductGrid'
import { SearchFilterPanel } from '../components/SearchFilterPanel'
import { StorefrontMessage } from '../components/StorefrontState'
import { textFieldClass } from '../components/form-field'
import {
  CLEAR_SEARCH_CRITERIA,
  CLEAR_SEARCH_FILTERS,
  countActiveFilters,
  hasSearchCriteria,
  searchFromParams,
  searchToParams,
  toSearchQuery,
  type SearchState,
} from '../storefront-helpers'

const SORT_LABEL_KEYS = {
  newest: 'search.sort.newest',
  popular: 'search.sort.popular',
  price_asc: 'search.sort.price_asc',
  price_desc: 'search.sort.price_desc',
} as const satisfies Record<SearchSort, string>

function ClearButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onPress}>
      {label}
    </Button>
  )
}

/** Tìm kiếm, lọc, sắp xếp sản phẩm đang bán (FR-PRD-006). Trạng thái nằm hoàn toàn trên URL (D1). */
export function ProductSearchPage() {
  const { t } = useTranslation('catalog')
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const state = useMemo(() => searchFromParams(params), [params])
  // `null` khi khoảng giá trên URL bị đảo ngược: không gửi request, báo lỗi tại chỗ (D2).
  const query = useMemo(() => toSearchQuery(state), [state])
  const filterCount = countActiveFilters(state)

  const categoriesQuery = useQuery({
    queryKey: catalogKeys.categories,
    queryFn: apiListPublicCategories,
    staleTime: 5 * 60_000,
  })
  const resultsQuery = useQuery({
    queryKey: catalogKeys.search(query),
    // `enabled` bên dưới chặn trường hợp `query` là null.
    queryFn: () => apiSearchProducts(query as SearchProductsParams),
    enabled: query !== null,
    placeholderData: keepPreviousData,
  })

  function update(patch: Partial<SearchState>) {
    setParams(searchToParams({ ...state, ...patch }))
  }

  const page = resultsQuery.data
  const items = page?.data ?? []
  const pagination = page?.pagination
  const error = resultsQuery.error
  // Lỗi 4xx do tham số trên URL (VD từ khóa chỉ có dấu câu): thử lại vô ích, phải nói rõ chỗ sai và cho cách sửa.
  const isRejectedRequest = error instanceof ApiError && error.status >= 400 && error.status < 500

  let content: ReactNode
  if (query === null) {
    content = (
      <StorefrontMessage
        icon={<SearchX aria-hidden="true" />}
        title={t('search.emptyFilteredTitle')}
        description={t('search.filters.priceRangeInvalid')}
        action={<ClearButton label={t('search.clearAllFilters')} onPress={() => update(CLEAR_SEARCH_FILTERS)} />}
      />
    )
  } else if (resultsQuery.isPending) {
    content = <ProductGridSkeleton />
  } else if (error) {
    content = isRejectedRequest ? (
      <div
        role="alert"
        className="space-y-2 rounded-md border border-status-danger-border bg-status-danger p-3 text-sm text-status-danger-foreground"
      >
        <p className="font-medium">{t('search.rejectedTitle')}</p>
        {error instanceof ApiError && error.details.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5">
            {error.details.map((detail, index) => (
              <li key={`${detail.field}-${index}`}>{detail.reason}</li>
            ))}
          </ul>
        )}
        {hasSearchCriteria(state) && (
          <Button type="button" variant="outline" size="xs" onClick={() => update(CLEAR_SEARCH_CRITERIA)}>
            {t('search.clearCriteria')}
          </Button>
        )}
        {error instanceof ApiError && error.correlationId && (
          <p className="flex items-center gap-1 text-xs">
            {t('search.correlationId')}:
            <CopyableId value={error.correlationId} label={t('search.correlationId')} />
          </p>
        )}
      </div>
    ) : (
      <div className="space-y-3">
        <ServiceFallbackBanner
          message={
            error instanceof ApiError && error.isServiceUnavailable ? t('search.unavailable') : error.message
          }
          onRetry={() => void resultsQuery.refetch()}
          isRetrying={resultsQuery.isFetching}
        />
        {filterCount > 0 && (
          <ClearButton label={t('search.clearAllFilters')} onPress={() => update(CLEAR_SEARCH_FILTERS)} />
        )}
      </div>
    )
  } else if (items.length === 0) {
    // Ba kiểu "không có kết quả", mỗi kiểu một cách thoát: còn bộ lọc, chỉ còn từ khóa, hoặc trang cũ đã vượt cuối.
    const filtersActive = filterCount > 0
    const keywordOnly = !filtersActive && Boolean(state.q)
    const pastLastPage = !filtersActive && !keywordOnly && state.page > 1
    let emptyAction: ReactNode
    if (filtersActive) {
      emptyAction = <ClearButton label={t('search.clearAllFilters')} onPress={() => update(CLEAR_SEARCH_FILTERS)} />
    } else if (keywordOnly) {
      emptyAction = <ClearButton label={t('search.clearKeyword')} onPress={() => update(CLEAR_SEARCH_CRITERIA)} />
    } else if (pastLastPage) {
      emptyAction = <ClearButton label={t('search.backToFirstPage')} onPress={() => update({ page: 1 })} />
    }
    content = (
      <StorefrontMessage
        icon={<SearchX aria-hidden="true" />}
        title={
          filtersActive
            ? t('search.emptyFilteredTitle')
            : keywordOnly
              ? t('search.emptyKeywordTitle')
              : pastLastPage
                ? t('search.emptyPageTitle')
                : t('search.emptyTitle')
        }
        description={
          filtersActive || keywordOnly
            ? (page?.suggestion ?? t('search.emptyFilteredDescription'))
            : pastLastPage
              ? t('search.emptyPageDescription')
              : t('search.emptyDescription')
        }
        action={emptyAction}
      />
    )
  } else {
    content = (
      <>
        <ProductGrid>
          {items.map((item) => (
            <ProductCard key={item.productId} product={item} />
          ))}
        </ProductGrid>
        {pagination && pagination.totalPages > 1 && (
          <nav
            aria-label={t('search.pagination.label')}
            className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"
          >
            <span className="tabular-nums">
              {t('search.pagination.summary', { page: pagination.page, totalPages: pagination.totalPages })}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1 || resultsQuery.isFetching}
                onClick={() => update({ page: pagination.page - 1 })}
              >
                {t('search.pagination.prev')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages || resultsQuery.isFetching}
                onClick={() => update({ page: pagination.page + 1 })}
              >
                {t('search.pagination.next')}
              </Button>
            </div>
          </nav>
        )}
      </>
    )
  }

  const filterPanel = (onApplied?: () => void) => (
    <SearchFilterPanel
      categories={categoriesQuery.data ?? []}
      value={state}
      onChange={update}
      onApplied={onApplied}
    />
  )

  return (
    // `SheetTrigger` giữ nút "Bộ lọc" làm nơi trở về focus khi đóng bottom sheet.
    <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
      <div className="space-y-5">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {state.q ? t('search.titleWithQuery', { q: state.q }) : t('search.title')}
          </h1>
        </header>

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
          <aside className="hidden lg:block" aria-label={t('search.filtersLabel')}>
            <div className="rounded-lg border border-border bg-card p-4">{filterPanel()}</div>
          </aside>

          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
                {pagination
                  ? t('search.resultCount', { count: formatNumber(pagination.totalItems) })
                  : resultsQuery.isError
                    ? null
                    : t('search.loading')}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <SheetTrigger asChild>
                  <Button type="button" variant="outline" className="lg:hidden">
                    <SlidersHorizontal aria-hidden="true" />
                    {filterCount > 0
                      ? t('search.filters.openWithCount', { count: filterCount })
                      : t('search.filters.open')}
                  </Button>
                </SheetTrigger>
                <div className="flex items-center gap-2">
                  <Label htmlFor="catalog-sort" className="text-sm text-muted-foreground">
                    {t('search.sortLabel')}
                  </Label>
                  <select
                    id="catalog-sort"
                    value={state.sort}
                    onChange={(event) => update({ sort: event.target.value as SearchSort, page: 1 })}
                    className={cn(textFieldClass, 'w-auto')}
                  >
                    {(Object.keys(SORT_LABEL_KEYS) as SearchSort[]).map((sort) => (
                      <option key={sort} value={sort}>
                        {t(SORT_LABEL_KEYS[sort])}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div aria-busy={resultsQuery.isPlaceholderData}>{content}</div>
          </div>
        </div>
      </div>

      {/* Mobile: cùng một bảng bộ lọc trong bottom sheet (Brief §5.2). */}
      <SheetContent side="bottom" className="max-h-[85dvh] gap-0 overflow-y-auto p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{t('search.filtersLabel')}</SheetTitle>
          <SheetDescription>{t('search.filtersDescription')}</SheetDescription>
        </SheetHeader>
        <div className="p-4">{filterPanel(() => setFiltersOpen(false))}</div>
      </SheetContent>
    </Sheet>
  )
}
