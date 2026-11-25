// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: { apiBaseUrl: 'http://api.test', demoMode: false, mediaBaseUrl: 'http://media.test/public-products' },
}))

import { CategoryFilterTree, CategoryShowcase } from './components/CategoryTree'
import { ProductCard } from './components/ProductCard'
import { RatingStars } from './components/RatingStars'
import { SearchFilterPanel } from './components/SearchFilterPanel'
import { DEFAULT_SEARCH } from './storefront-helpers'
import {
  CATEGORY_LEAF_ID,
  CATEGORY_ROOT_ID,
  FIRST_IMAGE_REF,
  PRODUCT_ID,
  makeCategories,
  makeProductSummary,
} from './test-fixtures'
import { renderWithProviders, vndText } from './test-utils'

afterEach(cleanup)

function renderPanel(value: Partial<typeof DEFAULT_SEARCH> = {}) {
  const onChange = vi.fn()
  const onApplied = vi.fn()
  renderWithProviders(
    <SearchFilterPanel
      categories={makeCategories()}
      value={{ ...DEFAULT_SEARCH, ...value }}
      onChange={onChange}
      onApplied={onApplied}
    />,
  )
  return { onChange, onApplied }
}

describe('ProductCard', () => {
  it('renders name, price range, rating, sold count and the product link (Brief §4.1)', () => {
    const { container } = renderWithProviders(
      <ul>
        <ProductCard product={makeProductSummary()} />
      </ul>,
    )
    expect(screen.getByRole('link').getAttribute('href')).toBe(`/products/${PRODUCT_ID}`)
    expect(screen.getByRole('heading', { name: 'Áo thun Cotton Compact' })).toBeTruthy()
    expect(screen.getByText(`${vndText(120_000)} – ${vndText(150_000)}`)).toBeTruthy()
    expect(screen.getByRole('img', { name: '4.8 trên 5 từ 124 đánh giá' })).toBeTruthy()
    expect(screen.getByText('Đã bán 321')).toBeTruthy()
    const image = container.querySelector('img')
    expect(image?.getAttribute('src')).toBe(`http://media.test/public-products/${FIRST_IMAGE_REF}`)
    expect(image?.getAttribute('alt')).toBe('')
  })

  it('shows a single price, the out-of-stock label and a placeholder when there is no image', () => {
    const { container } = renderWithProviders(
      <ul>
        <ProductCard
          product={makeProductSummary({
            images: null,
            minPrice: 99_000,
            maxPrice: 99_000,
            inStock: false,
            ratingCount: 0,
            soldCount: 0,
          })}
        />
      </ul>,
    )
    expect(screen.getByText(vndText(99_000))).toBeTruthy()
    expect(screen.getByText('Hết hàng')).toBeTruthy()
    expect(screen.getByText('Chưa có đánh giá')).toBeTruthy()
    expect(screen.queryByText(/Đã bán/)).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })
})

describe('RatingStars', () => {
  it('describes the rating for screen readers', () => {
    renderWithProviders(<RatingStars average={4.8} count={124} />)
    expect(screen.getByRole('img', { name: '4.8 trên 5 từ 124 đánh giá' })).toBeTruthy()
  })
})

describe('categories', () => {
  it('links every category of the home showcase to the search page', () => {
    renderWithProviders(<CategoryShowcase categories={makeCategories()} />)
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      `/products?categoryId=${CATEGORY_ROOT_ID}`,
      `/products?categoryId=${CATEGORY_LEAF_ID}`,
      '/products?categoryId=77777777-7777-4777-8777-777777777777',
      '/products?categoryId=88888888-8888-4888-8888-888888888888',
    ])
  })

  it('selects a root category and expands its children on demand', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    renderWithProviders(
      <CategoryFilterTree categories={makeCategories()} selectedId="" onSelect={onSelect} />,
    )
    expect(screen.queryByRole('button', { name: 'Áo' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Mở rộng danh mục Thời trang' }))
    await user.click(screen.getByRole('button', { name: 'Áo' }))
    expect(onSelect).toHaveBeenLastCalledWith(CATEGORY_LEAF_ID)
    // Chọn danh mục cấp 1 (đã gồm cả danh mục con theo hợp đồng BE).
    await user.click(screen.getByRole('button', { name: 'Thời trang' }))
    expect(onSelect).toHaveBeenLastCalledWith(CATEGORY_ROOT_ID)
    await user.click(screen.getByRole('button', { name: 'Tất cả danh mục' }))
    expect(onSelect).toHaveBeenLastCalledWith('')
  })

  it('expands the branch of the selected category by default', () => {
    renderWithProviders(
      <CategoryFilterTree categories={makeCategories()} selectedId={CATEGORY_LEAF_ID} onSelect={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'Áo' }).getAttribute('aria-pressed')).toBe('true')
  })
})

describe('SearchFilterPanel', () => {
  it('applies a valid price range and goes back to the first page', async () => {
    const user = userEvent.setup()
    const { onChange, onApplied } = renderPanel()
    await user.type(screen.getByLabelText('Giá từ'), '100000')
    await user.type(screen.getByLabelText('Giá đến'), '500000')
    await user.click(screen.getByRole('button', { name: 'Áp dụng khoảng giá' }))
    expect(onChange).toHaveBeenCalledWith({ minPrice: '100000', maxPrice: '500000', page: 1 })
    expect(onApplied).toHaveBeenCalledTimes(1)
  })

  it('reports an inverted price range in place and sends nothing (FR-PRD-006 E1)', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPanel()
    await user.type(screen.getByLabelText('Giá từ'), '1.000.000')
    await user.type(screen.getByLabelText('Giá đến'), '100000')
    await user.click(screen.getByRole('button', { name: 'Áp dụng khoảng giá' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Giá tối thiểu không được lớn hơn giá tối đa.',
    )
    expect(onChange).not.toHaveBeenCalled()
  })

  it('changes rating and stock filters immediately and clears everything on request', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPanel({ categoryId: CATEGORY_ROOT_ID })
    await user.click(screen.getByLabelText('Từ 4 sao'))
    expect(onChange).toHaveBeenLastCalledWith({ minRating: '4', page: 1 })
    await user.click(screen.getByLabelText('Chỉ hiện sản phẩm còn hàng'))
    expect(onChange).toHaveBeenLastCalledWith({ inStock: true, page: 1 })
    await user.click(screen.getByRole('button', { name: 'Xóa tất cả bộ lọc' }))
    expect(onChange).toHaveBeenLastCalledWith({
      categoryId: '',
      minPrice: '',
      maxPrice: '',
      minRating: '',
      inStock: false,
      page: 1,
    })
  })
})
