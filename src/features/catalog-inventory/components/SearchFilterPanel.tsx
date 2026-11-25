import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { Category } from '../api'
import {
  checkPriceRange,
  CLEAR_SEARCH_FILTERS,
  countActiveFilters,
  digitsOnly,
  type MinRating,
  type SearchState,
} from '../storefront-helpers'
import { CategoryFilterTree } from './CategoryTree'
import { textFieldClass } from './form-field'

export type SearchFilterPanelProps = {
  categories: Category[]
  value: SearchState
  /** Gọi khi một bộ lọc đổi; kèm `page: 1` để quay về trang đầu. */
  onChange: (patch: Partial<SearchState>) => void
  /** Gọi sau khi khoảng giá hợp lệ được áp dụng hoặc khi xóa bộ lọc (dùng để đóng bottom sheet trên mobile). */
  onApplied?: () => void
}

const RATING_LABEL_KEYS = {
  '': 'search.filters.rating.all',
  '4': 'search.filters.rating.from4',
  '3': 'search.filters.rating.from3',
} as const satisfies Record<MinRating, string>

type PriceRangeFormProps = {
  minPrice: string
  maxPrice: string
  onApply: (minPrice: string, maxPrice: string) => void
}

/**
 * Hai ô giá giữ bản nháp riêng và chỉ gửi lên URL khi bấm "Áp dụng" (tránh gửi request sau mỗi phím).
 * Cha truyền `key` theo giá đã áp dụng nên khi URL đổi (Back, "Xóa tất cả bộ lọc") hai ô theo URL.
 */
function PriceRangeForm({ minPrice, maxPrice, onApply }: PriceRangeFormProps) {
  const { t } = useTranslation('catalog')
  const baseId = useId()
  const [min, setMin] = useState(minPrice)
  const [max, setMax] = useState(maxPrice)
  const [hasError, setHasError] = useState(false)
  const errorId = `${baseId}-error`

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextMin = min.trim()
    const nextMax = max.trim()
    // FR-PRD-006 E1: khoảng giá đảo ngược báo lỗi tại chỗ, không gọi API.
    if (checkPriceRange(nextMin, nextMax).inverted) {
      setHasError(true)
      return
    }
    onApply(nextMin, nextMax)
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="mb-2 text-sm font-semibold text-foreground">{t('search.filters.priceLabel')}</h2>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${baseId}-min`} className="text-xs text-muted-foreground">
            {t('search.filters.minPrice')}
          </Label>
          <input
            id={`${baseId}-min`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={min}
            onChange={(event) => {
              setMin(digitsOnly(event.target.value))
              setHasError(false)
            }}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : undefined}
            className={textFieldClass}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${baseId}-max`} className="text-xs text-muted-foreground">
            {t('search.filters.maxPrice')}
          </Label>
          <input
            id={`${baseId}-max`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={max}
            onChange={(event) => {
              setMax(digitsOnly(event.target.value))
              setHasError(false)
            }}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : undefined}
            className={textFieldClass}
          />
        </div>
      </div>
      {hasError && (
        <p id={errorId} role="alert" className="mt-2 text-xs text-status-danger-foreground">
          {t('search.filters.priceRangeInvalid')}
        </p>
      )}
      <Button type="submit" variant="outline" size="sm" className="mt-3 w-full">
        {t('search.filters.applyPrice')}
      </Button>
    </form>
  )
}

/** Bộ lọc tìm kiếm: danh mục, khoảng giá, điểm sao, còn hàng. Dùng trong sidebar (desktop) và bottom sheet (mobile). */
export function SearchFilterPanel({ categories, value, onChange, onApplied }: SearchFilterPanelProps) {
  const { t } = useTranslation('catalog')
  const baseId = useId()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">{t('search.filters.categoryLabel')}</h2>
        <CategoryFilterTree
          categories={categories}
          selectedId={value.categoryId}
          onSelect={(categoryId) => onChange({ categoryId, page: 1 })}
        />
      </div>

      <PriceRangeForm
        key={`${value.minPrice}:${value.maxPrice}`}
        minPrice={value.minPrice}
        maxPrice={value.maxPrice}
        onApply={(minPrice, maxPrice) => {
          onChange({ minPrice, maxPrice, page: 1 })
          onApplied?.()
        }}
      />

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-foreground">{t('search.filters.ratingLabel')}</legend>
        <div className="space-y-1">
          {(Object.keys(RATING_LABEL_KEYS) as MinRating[]).map((rating) => (
            <label
              key={rating || 'all'}
              className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-3 text-sm text-foreground hover:bg-muted"
            >
              <input
                type="radio"
                name={`${baseId}-rating`}
                value={rating}
                checked={value.minRating === rating}
                onChange={() => onChange({ minRating: rating, page: 1 })}
                className="size-4 accent-primary"
              />
              {t(RATING_LABEL_KEYS[rating])}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-3 text-sm text-foreground hover:bg-muted">
        <input
          type="checkbox"
          checked={value.inStock}
          onChange={(event) => onChange({ inStock: event.target.checked, page: 1 })}
          className="size-4 accent-primary"
        />
        {t('search.filters.inStock')}
      </label>

      {countActiveFilters(value) > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            onChange(CLEAR_SEARCH_FILTERS)
            onApplied?.()
          }}
        >
          {t('search.filters.clearAll')}
        </Button>
      )}
    </div>
  )
}
