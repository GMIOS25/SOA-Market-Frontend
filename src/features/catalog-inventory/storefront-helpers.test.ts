import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/errors'
import {
  CATEGORY_LEAF_ID,
  CATEGORY_ROOT_ID,
  BLACK_M_ID,
  makeCategories,
  makeVariant,
  WHITE_L_ID,
  WHITE_M_ID,
} from './test-fixtures'
import {
  categoryHref,
  checkPriceRange,
  countActiveFilters,
  createVariantPicker,
  DEFAULT_SEARCH,
  defaultVariantId,
  findCategoryPath,
  findVariant,
  hasSearchCriteria,
  parseMaxAddable,
  pickVariant,
  reconcileSelection,
  searchFromParams,
  searchToParams,
  toSearchQuery,
  variantLabel,
  variantOptions,
} from './storefront-helpers'

const WHITE_M = makeVariant()
const WHITE_L = makeVariant({
  variantId: WHITE_L_ID,
  sku: 'AO-THUN-TRANG-L',
  attributes: { Màu: 'Trắng', 'Cỡ': 'L' },
  price: 150_000,
  availableQuantity: 0,
})
const BLACK_M = makeVariant({
  variantId: BLACK_M_ID,
  sku: 'AO-THUN-DEN-M',
  attributes: { Màu: 'Đen', 'Cỡ': 'M' },
  price: 130_000,
  availableQuantity: 4,
})
const TSHIRT = [WHITE_M, WHITE_L, BLACK_M]

describe('searchFromParams / searchToParams (D1)', () => {
  it('defaults to the newest first page when the URL has no search state', () => {
    expect(searchFromParams(new URLSearchParams())).toEqual(DEFAULT_SEARCH)
    expect(searchToParams(DEFAULT_SEARCH).toString()).toBe('')
  })

  it('round-trips every filter and drops defaults from the URL', () => {
    const state = {
      q: 'áo thun',
      categoryId: CATEGORY_LEAF_ID,
      minPrice: '100000',
      maxPrice: '500000',
      minRating: '4' as const,
      inStock: true,
      sort: 'price_asc' as const,
      page: 3,
    }
    const params = searchToParams(state)
    expect([...params.keys()]).toEqual(['q', 'categoryId', 'minPrice', 'maxPrice', 'minRating', 'inStock', 'sort', 'page'])
    expect(searchFromParams(params)).toEqual(state)
  })

  it('falls back on unknown sort, rating and page values and keeps only digits in prices', () => {
    const state = searchFromParams(
      new URLSearchParams('sort=cheapest&minRating=5&page=-3&minPrice=1.000.000&q=%20%20ao%20'),
    )
    expect(state.sort).toBe('newest')
    expect(state.minRating).toBe('')
    expect(state.page).toBe(1)
    expect(state.minPrice).toBe('1000000')
    expect(state.q).toBe('ao')
  })
})

describe('price range (FR-PRD-006 E1)', () => {
  it('accepts an empty or one-sided range and treats max 0 as unbounded', () => {
    expect(checkPriceRange('', '')).toEqual({ minPrice: undefined, maxPrice: undefined, inverted: false })
    expect(checkPriceRange('100000', '')).toEqual({ minPrice: 100000, maxPrice: undefined, inverted: false })
    expect(checkPriceRange('', '0')).toEqual({ minPrice: undefined, maxPrice: undefined, inverted: false })
  })

  it('flags an inverted range and blocks the request', () => {
    expect(checkPriceRange('500000', '100000').inverted).toBe(true)
    expect(toSearchQuery({ ...DEFAULT_SEARCH, minPrice: '500000', maxPrice: '100000' })).toBeNull()
  })

  it('maps the URL state onto the search API parameters', () => {
    expect(
      toSearchQuery({ ...DEFAULT_SEARCH, q: 'ao', minRating: '3', inStock: true, sort: 'popular', page: 2 }),
    ).toEqual({
      q: 'ao',
      categoryId: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      minRating: 3,
      inStock: true,
      sort: 'popular',
      page: 2,
      pageSize: 20,
    })
  })
})

describe('filter counters', () => {
  it('counts filter groups, not the keyword', () => {
    const state = {
      ...DEFAULT_SEARCH,
      q: 'ao',
      categoryId: CATEGORY_ROOT_ID,
      minPrice: '1',
      maxPrice: '9',
      minRating: '4' as const,
      inStock: true,
    }
    expect(countActiveFilters(state)).toBe(4)
    expect(hasSearchCriteria({ ...DEFAULT_SEARCH, q: 'ao' })).toBe(true)
    expect(hasSearchCriteria(DEFAULT_SEARCH)).toBe(false)
  })

  it('does not count a zero price bound as an active filter', () => {
    expect(countActiveFilters({ ...DEFAULT_SEARCH, minPrice: '0', maxPrice: '0' })).toBe(0)
  })
})

describe('categories', () => {
  it('links a category to the search page and finds its path', () => {
    expect(categoryHref(CATEGORY_LEAF_ID)).toBe(`/products?categoryId=${CATEGORY_LEAF_ID}`)
    expect(categoryHref('')).toBe('/products')
    expect(findCategoryPath(makeCategories(), CATEGORY_LEAF_ID).map((c) => c.name)).toEqual(['Thời trang', 'Áo'])
    expect(findCategoryPath(makeCategories(), 'missing')).toEqual([])
  })
})

describe('variant picker (D6)', () => {
  it('groups variants by attribute in first-seen order', () => {
    const picker = createVariantPicker(TSHIRT)
    expect(picker.mode).toBe('attributes')
    expect(picker.keys).toEqual(['Màu', 'Cỡ'])
    expect(picker.selection).toEqual({})
  })

  it('disables a value that has no variant with the other chosen values', () => {
    const picker = createVariantPicker(TSHIRT)
    expect(variantOptions(TSHIRT, picker.keys, 'Cỡ', { Màu: 'Đen' })).toEqual([
      { value: 'M', disabled: false, outOfStock: false },
      { value: 'L', disabled: true, outOfStock: false },
    ])
  })

  it('marks a value whose variants are all out of stock', () => {
    const picker = createVariantPicker(TSHIRT)
    expect(variantOptions(TSHIRT, picker.keys, 'Cỡ', { Màu: 'Trắng' })).toEqual([
      { value: 'M', disabled: false, outOfStock: false },
      { value: 'L', disabled: false, outOfStock: true },
    ])
  })

  it('picks a variant only once every attribute is chosen', () => {
    const picker = createVariantPicker(TSHIRT)
    expect(pickVariant(TSHIRT, picker, { Màu: 'Trắng' })).toBeNull()
    expect(pickVariant(TSHIRT, picker, { Màu: 'Đen', 'Cỡ': 'M' })?.variantId).toBe(BLACK_M_ID)
    expect(pickVariant(TSHIRT, picker, { Màu: 'Trắng', 'Cỡ': 'L' })?.variantId).toBe(WHITE_L_ID)
  })

  it('replaces the other attributes that no longer combine with the changed one', () => {
    const variants = [
      WHITE_M,
      WHITE_L,
      makeVariant({
        variantId: '99999999-9999-4999-8999-999999999999',
        sku: 'AO-THUN-DEN-L',
        attributes: { Màu: 'Đen', 'Cỡ': 'L' },
      }),
    ]
    const picker = createVariantPicker(variants)
    // Đang chọn Cỡ M; đổi sang Đen thì M không còn tổ hợp nào và chỉ còn L → tự chuyển sang L.
    expect(reconcileSelection(variants, picker, { Màu: 'Đen', 'Cỡ': 'M' }, 'Màu')).toEqual({ Màu: 'Đen', 'Cỡ': 'L' })
    // Đổi sang Trắng thì M vẫn hợp lệ → giữ nguyên.
    expect(reconcileSelection(variants, picker, { Màu: 'Trắng', 'Cỡ': 'M' }, 'Màu')).toEqual({ Màu: 'Trắng', 'Cỡ': 'M' })
  })

  it('only drops the attribute that was reset to its placeholder', () => {
    const picker = createVariantPicker(TSHIRT)
    expect(reconcileSelection(TSHIRT, picker, { Màu: '', 'Cỡ': 'M' }, 'Màu')).toEqual({ 'Cỡ': 'M' })
  })

  it('falls back to a plain list when variants have different attribute sets', () => {
    const skewed = [makeVariant(), makeVariant({ variantId: BLACK_M_ID, sku: 'AO-THUN-DEN', attributes: { Màu: 'Đen' } })]
    expect(createVariantPicker(skewed).mode).toBe('list')
    expect(variantLabel(skewed[1]!)).toBe('Đen')
  })

  it('auto-selects an attribute that has a single value', () => {
    const picker = createVariantPicker([
      makeVariant(),
      makeVariant({ variantId: BLACK_M_ID, sku: 'AO-THUN-DEN-M', attributes: { Màu: 'Đen', 'Cỡ': 'M' } }),
    ])
    expect(picker.selection).toEqual({ 'Cỡ': 'M' })
    const single = createVariantPicker([makeVariant()])
    expect(single.selection).toEqual({ Màu: 'Trắng', 'Cỡ': 'M' })
    expect(pickVariant([makeVariant()], single, single.selection)?.variantId).toBe(WHITE_M_ID)
  })

  it('falls back to a plain list when variants cannot be grouped by attributes', () => {
    const irregular = [
      makeVariant({ attributes: {} }),
      makeVariant({ variantId: BLACK_M_ID, sku: 'AO-THUN-DEN-M', attributes: {} }),
    ]
    const picker = createVariantPicker(irregular)
    expect(picker.mode).toBe('list')
    expect(defaultVariantId(irregular)).toBe('')
    expect(defaultVariantId([WHITE_M])).toBe(WHITE_M_ID)
    expect(findVariant(irregular, WHITE_M_ID)?.sku).toBe('AO-THUN-TRANG-M')
  })

  it('labels a variant by its attribute values (attribute name order, like the backend) or its SKU', () => {
    expect(variantLabel(WHITE_M)).toBe('M / Trắng')
    expect(variantLabel(makeVariant({ attributes: {}, sku: 'SKU-1' }))).toBe('SKU-1')
  })
})

describe('parseMaxAddable', () => {
  const stockError = (details: Array<{ field: string; reason: string }>, message: string) =>
    new ApiError({ status: 409, code: 'INSUFFICIENT_STOCK', message, details })

  it('reads the maximum addable quantity from the quantity detail', () => {
    expect(parseMaxAddable(stockError([{ field: 'quantity', reason: 'Tối đa có thể thêm: 3' }], 'x'))).toBe(3)
    expect(parseMaxAddable(stockError([{ field: 'quantity', reason: 'Tối đa có thể thêm 7 sản phẩm' }], 'x'))).toBe(7)
  })

  it('falls back to the message and returns null when no number is there', () => {
    expect(parseMaxAddable(stockError([], 'Số lượng khả dụng không đủ (chỉ còn 5 sản phẩm).'))).toBe(5)
    expect(parseMaxAddable(stockError([], 'Không đủ hàng'))).toBeNull()
  })
})
