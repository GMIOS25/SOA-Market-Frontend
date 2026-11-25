import { ApiError } from '@/api/errors'
import type { Category, ProductVariant, SearchProductsParams, SearchSort } from './api'

export const SEARCH_PAGE_SIZE = 20
export const HOME_SECTION_SIZE = 20
export const SEARCH_QUERY_MAX_LENGTH = 100

const SORTS: readonly SearchSort[] = ['newest', 'popular', 'price_asc', 'price_desc']
const RATINGS = ['4', '3'] as const

/** Giá trị lọc điểm sao: rỗng = tất cả. */
export type MinRating = (typeof RATINGS)[number] | ''

/** Trạng thái tìm kiếm. URL của `/products` là nguồn duy nhất của nó (D1). */
export type SearchState = {
  q: string
  categoryId: string
  minPrice: string
  maxPrice: string
  minRating: MinRating
  inStock: boolean
  sort: SearchSort
  page: number
}

export const DEFAULT_SEARCH: SearchState = {
  q: '',
  categoryId: '',
  minPrice: '',
  maxPrice: '',
  minRating: '',
  inStock: false,
  sort: 'newest',
  page: 1,
}

/** Chỉ giữ chữ số: người mua gõ "1.000.000" vẫn thành 1000000. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/** Đọc trạng thái tìm kiếm từ URL; giá trị lạ rơi về mặc định. */
export function searchFromParams(params: URLSearchParams): SearchState {
  const sort = params.get('sort')
  const rating = params.get('minRating')
  const page = Number(params.get('page') ?? 1)
  return {
    q: (params.get('q') ?? '').trim().slice(0, SEARCH_QUERY_MAX_LENGTH),
    categoryId: params.get('categoryId')?.trim() ?? '',
    minPrice: digitsOnly(params.get('minPrice') ?? ''),
    maxPrice: digitsOnly(params.get('maxPrice') ?? ''),
    minRating: RATINGS.find((value) => value === rating) ?? '',
    inStock: params.get('inStock') === 'true',
    sort: SORTS.find((value) => value === sort) ?? 'newest',
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  }
}

/** Chuyển trạng thái thành query string của URL; giá trị mặc định bị bỏ để URL ngắn. */
export function searchToParams(state: SearchState): URLSearchParams {
  const params = new URLSearchParams()
  if (state.q) params.set('q', state.q)
  if (state.categoryId) params.set('categoryId', state.categoryId)
  if (state.minPrice) params.set('minPrice', state.minPrice)
  if (state.maxPrice) params.set('maxPrice', state.maxPrice)
  if (state.minRating) params.set('minRating', state.minRating)
  if (state.inStock) params.set('inStock', 'true')
  if (state.sort !== 'newest') params.set('sort', state.sort)
  if (state.page > 1) params.set('page', String(state.page))
  return params
}

export type PriceRangeCheck = { minPrice?: number; maxPrice?: number; inverted: boolean }

/** Kiểm tra khoảng giá trước khi gửi: `maxPrice` bằng 0 hoặc bỏ trống nghĩa là không giới hạn trên (hợp đồng). */
export function checkPriceRange(minPrice: string, maxPrice: string): PriceRangeCheck {
  const min = Number(digitsOnly(minPrice)) || undefined
  const max = Number(digitsOnly(maxPrice)) || undefined
  return {
    minPrice: min,
    maxPrice: max,
    inverted: min !== undefined && max !== undefined && min > max,
  }
}

/** Tham số gửi lên `GET /v1/products`; `null` khi khoảng giá bị đảo ngược (không gửi request). */
export function toSearchQuery(state: SearchState): SearchProductsParams | null {
  const price = checkPriceRange(state.minPrice, state.maxPrice)
  if (price.inverted) return null
  return {
    q: state.q || undefined,
    categoryId: state.categoryId || undefined,
    minPrice: price.minPrice,
    maxPrice: price.maxPrice,
    minRating: state.minRating ? Number(state.minRating) : undefined,
    inStock: state.inStock || undefined,
    sort: state.sort,
    page: state.page,
    pageSize: SEARCH_PAGE_SIZE,
  }
}

/** Số nhóm bộ lọc đang bật (danh mục, khoảng giá, điểm sao, còn hàng) — không tính từ khóa. */
export function countActiveFilters(state: SearchState): number {
  // Giá bằng 0 nghĩa là không giới hạn (xem `checkPriceRange`) nên không tính là bộ lọc đang bật.
  const price = checkPriceRange(state.minPrice, state.maxPrice)
  return (
    Number(Boolean(state.categoryId)) +
    Number(price.minPrice !== undefined || price.maxPrice !== undefined) +
    Number(Boolean(state.minRating)) +
    Number(state.inStock)
  )
}

export function hasSearchCriteria(state: SearchState): boolean {
  return countActiveFilters(state) > 0 || Boolean(state.q)
}

/** Bản vá xóa mọi bộ lọc (giữ từ khóa và cách sắp xếp) rồi về trang đầu — dùng chung bởi trang tìm kiếm và bảng bộ lọc. */
export const CLEAR_SEARCH_FILTERS: Pick<
  SearchState,
  'categoryId' | 'minPrice' | 'maxPrice' | 'minRating' | 'inStock' | 'page'
> = { categoryId: '', minPrice: '', maxPrice: '', minRating: '', inStock: false, page: 1 }

/** Như `CLEAR_SEARCH_FILTERS` nhưng xóa cả từ khóa. */
export const CLEAR_SEARCH_CRITERIA: Pick<SearchState, keyof typeof CLEAR_SEARCH_FILTERS | 'q'> = {
  ...CLEAR_SEARCH_FILTERS,
  q: '',
}

/** Link tới trang tìm kiếm của một danh mục (cấp 1 đã gồm cả danh mục con theo hợp đồng BE). */
export function categoryHref(categoryId: string): string {
  const params = categoryId ? searchToParams({ ...DEFAULT_SEARCH, categoryId }).toString() : ''
  return params ? `/products?${params}` : '/products'
}

/** Đường dẫn từ gốc tới danh mục (gốc trước); mảng rỗng nếu không có trong cây. */
export function findCategoryPath(categories: Category[], categoryId: string): Category[] {
  for (const node of categories) {
    if (node.categoryId === categoryId) return [node]
    const below = findCategoryPath(node.children ?? [], categoryId)
    if (below.length > 0) return [node, ...below]
  }
  return []
}

// ---------------------------------------------------------------------------
// Chọn biến thể theo thuộc tính (D6)
// ---------------------------------------------------------------------------

export type VariantSelection = Partial<Record<string, string>>
export type VariantOption = { value: string; disabled: boolean; outOfStock: boolean }
export type VariantPicker = { mode: 'attributes' | 'list'; keys: string[]; selection: VariantSelection }

export function activeVariants(variants: ProductVariant[]): ProductVariant[] {
  return variants.filter((variant) => variant.isActive)
}

/** Nhãn biến thể: giá trị thuộc tính nối bằng " / " sắp theo tên thuộc tính (như `variantLabel` của BE); không có thuộc tính thì dùng SKU. */
export function variantLabel(variant: Pick<ProductVariant, 'attributes' | 'sku'>): string {
  const values = Object.entries(variant.attributes)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, value]) => value)
  return values.length > 0 ? values.join(' / ') : variant.sku
}

/**
 * Mọi biến thể đang bán có cùng một tập khóa thuộc tính thì chọn theo từng thuộc tính; nếu không
 * (tập khóa lệch nhau, hoặc nhiều biến thể không có thuộc tính) thì liệt kê từng biến thể.
 */
export function createVariantPicker(variants: ProductVariant[]): VariantPicker {
  const active = activeVariants(variants)
  const keys: string[] = []
  for (const variant of active) {
    for (const key of Object.keys(variant.attributes)) {
      if (!keys.includes(key)) keys.push(key)
    }
  }
  const sameKeys = active.every((variant) => Object.keys(variant.attributes).length === keys.length)
  if (active.length === 0 || (active.length > 1 && keys.length === 0) || !sameKeys) {
    return { mode: 'list', keys: [], selection: {} }
  }
  const selection: VariantSelection = {}
  for (const key of keys) {
    const values = new Set(active.map((variant) => variant.attributes[key]))
    if (values.size === 1) selection[key] = values.values().next().value
  }
  return { mode: 'attributes', keys, selection }
}

function matchesSelection(variant: ProductVariant, selection: VariantSelection): boolean {
  return Object.entries(selection).every(([key, value]) => value === undefined || variant.attributes[key] === value)
}

/**
 * Các giá trị của một thuộc tính. Giá trị không có biến thể nào khớp với các thuộc tính khác đã chọn thì
 * `disabled`; giá trị chỉ còn biến thể hết hàng thì `outOfStock`.
 */
export function variantOptions(
  variants: ProductVariant[],
  keys: readonly string[],
  key: string,
  selection: VariantSelection,
): VariantOption[] {
  const active = activeVariants(variants)
  // Chỉ các thuộc tính khác trong `keys` mới ràng buộc; khóa lạ trong `selection` bị bỏ qua.
  const others: VariantSelection = {}
  for (const [otherKey, value] of Object.entries(selection)) {
    if (otherKey !== key && keys.includes(otherKey)) others[otherKey] = value
  }
  const base = active.filter((variant) => matchesSelection(variant, others))
  const values = new Set(active.map((variant) => variant.attributes[key]))
  return Array.from(values, (value) => {
    const combos = base.filter((variant) => variant.attributes[key] === value)
    return {
      value: value ?? '',
      disabled: combos.length === 0,
      outOfStock: combos.length > 0 && combos.every((variant) => variant.availableQuantity <= 0),
    }
  })
}

/** Biến thể khớp khi đã chọn đủ mọi thuộc tính; ưu tiên biến thể còn hàng. */
export function pickVariant(
  variants: ProductVariant[],
  picker: VariantPicker,
  selection: VariantSelection,
): ProductVariant | null {
  if (picker.mode !== 'attributes' || picker.keys.some((key) => !selection[key])) return null
  const matches = activeVariants(variants).filter((variant) => matchesSelection(variant, selection))
  return matches.find((variant) => variant.availableQuantity > 0) ?? matches[0] ?? null
}

export function findVariant(variants: ProductVariant[], variantId: string): ProductVariant | null {
  return activeVariants(variants).find((variant) => variant.variantId === variantId) ?? null
}

/** Chế độ liệt kê: chọn sẵn khi sản phẩm chỉ có đúng một biến thể đang bán. */
export function defaultVariantId(variants: ProductVariant[]): string {
  const active = activeVariants(variants)
  return active.length === 1 ? (active[0]?.variantId ?? '') : ''
}

/**
 * Sau khi đổi thuộc tính `changedKey`: thuộc tính khác giữ giá trị nếu vẫn còn tổ hợp, tự nhận giá trị
 * duy nhất còn lại, và bị bỏ khi không còn giá trị nào.
 */
export function reconcileSelection(
  variants: ProductVariant[],
  picker: VariantPicker,
  selection: VariantSelection,
  changedKey: string,
): VariantSelection {
  if (picker.mode !== 'attributes') return selection
  // Chọn lại ô trống của một thuộc tính thì chỉ bỏ thuộc tính đó, không đụng các thuộc tính khác.
  if (!selection[changedKey]) {
    const withoutChanged: VariantSelection = { ...selection }
    delete withoutChanged[changedKey]
    return withoutChanged
  }
  const next: VariantSelection = { ...selection }
  for (const key of picker.keys) {
    if (key === changedKey) continue
    const options = variantOptions(variants, picker.keys, key, { [changedKey]: selection[changedKey] })
    const current = options.find((option) => option.value === selection[key])
    if (current && !current.disabled) continue
    const enabled = options.filter((option) => !option.disabled)
    if (enabled.length === 1) next[key] = enabled[0]?.value
    else delete next[key]
  }
  return next
}

/**
 * Số lượng tối đa còn thêm được từ lỗi 409 `INSUFFICIENT_STOCK` của SVC-ORD: `details[].reason` ghi
 * "Tối đa có thể thêm N"; nếu thiếu thì lấy số đầu tiên của thông điệp. `null` khi không đọc được.
 */
export function parseMaxAddable(error: ApiError): number | null {
  const reason = error.details.find((detail) => detail.field === 'quantity')?.reason
  const source = reason ?? error.message
  const match = /tối đa có thể thêm[:\s]*(\d+)/i.exec(source) ?? /(\d+)/.exec(source)
  if (!match?.[1]) return null
  const value = Number(match[1])
  return Number.isInteger(value) && value >= 0 ? value : null
}
