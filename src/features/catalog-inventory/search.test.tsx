// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: { apiBaseUrl: 'http://api.test', demoMode: false, mediaBaseUrl: 'http://media.test/public-products' },
}))

import { ProductSearchPage } from './pages/ProductSearchPage'
import {
  CATEGORY_LEAF_ID,
  makeCategories,
  makeProductSummary,
  makeSearchPage,
} from './test-fixtures'
import { LocationProbe, errorResponse, jsonResponse, renderAt, requestOf } from './test-utils'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const route = (
  <>
    <Route
      path="/products"
      element={
        <>
          <ProductSearchPage />
          <LocationProbe />
        </>
      }
    />
  </>
)

function mockSearch(responder: (url: URL) => Response) {
  const calls: URL[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const req = requestOf(input, init)
    if (req.url.pathname === '/v1/categories') return jsonResponse({ data: makeCategories() })
    if (req.url.pathname === '/v1/products' && req.method === 'GET') {
      calls.push(req.url)
      return responder(req.url)
    }
    return errorResponse(404, 'NOT_FOUND', 'Not found')
  })
  return calls
}

type PageMeta = { page: number; pageSize: number; totalItems: number; totalPages: number }

function resultPage(items = defaultItems(), pagination?: PageMeta) {
  return jsonResponse(makeSearchPage(items, pagination ? { pagination } : {}))
}

function defaultItems() {
  return [
    makeProductSummary(),
    makeProductSummary({ productId: 'prod-b', name: 'Quần short kaki' }),
  ]
}

describe('ProductSearchPage (T3-06)', () => {
  it('sends the URL state to GET /v1/products and lists the results (D1)', async () => {
    const calls = mockSearch(() => resultPage())
    renderAt('/products?q=ao%20thun&minRating=4&inStock=true&sort=price_asc', route)

    expect(await screen.findByText('Áo thun Cotton Compact')).toBeTruthy()
    expect(screen.getByText('Quần short kaki')).toBeTruthy()

    const params = calls[0]!.searchParams
    expect(params.get('q')).toBe('ao thun')
    expect(params.get('minRating')).toBe('4')
    expect(params.get('inStock')).toBe('true')
    expect(params.get('sort')).toBe('price_asc')
    expect(params.get('page')).toBe('1')
    expect(params.get('pageSize')).toBe('20')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Kết quả tìm kiếm cho "ao thun"')
    expect(screen.getByText('2 sản phẩm')).toBeTruthy()
  })

  it('writes sort and category changes to the URL and goes back to the first page', async () => {
    const calls = mockSearch(() => resultPage())
    const user = userEvent.setup()
    renderAt('/products?page=2', route)
    await screen.findByText('Áo thun Cotton Compact')
    const location = screen.getByTestId('location')

    await user.selectOptions(screen.getByLabelText('Sắp xếp theo'), 'popular')
    await waitFor(() => expect(location.textContent).toBe('/products?sort=popular'))

    await user.click(screen.getByRole('button', { name: 'Mở rộng danh mục Thời trang' }))
    await user.click(screen.getByRole('button', { name: 'Áo' }))
    await waitFor(() =>
      expect(location.textContent).toBe(`/products?categoryId=${CATEGORY_LEAF_ID}&sort=popular`),
    )
    await waitFor(() => expect(calls.at(-1)?.searchParams.get('categoryId')).toBe(CATEGORY_LEAF_ID))
    expect(calls.at(-1)?.searchParams.get('page')).toBe('1')
  })

  it('reports an inverted price range in place and sends nothing (D2)', async () => {
    const calls = mockSearch(() => resultPage())
    const user = userEvent.setup()
    renderAt('/products', route)
    await screen.findByText('Áo thun Cotton Compact')
    const callsBefore = calls.length

    await user.type(screen.getByLabelText('Giá từ'), '500000')
    await user.type(screen.getByLabelText('Giá đến'), '100000')
    await user.click(screen.getByRole('button', { name: 'Áp dụng khoảng giá' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Giá tối thiểu không được lớn hơn giá tối đa.')
    expect(screen.getByTestId('location').textContent).toBe('/products')
    expect(calls).toHaveLength(callsBefore)
  })

  it('does not call the API while the URL carries an inverted price range', async () => {
    const calls = mockSearch(() => resultPage())
    renderAt('/products?minPrice=500000&maxPrice=100000', route)

    expect(await screen.findByText('Giá tối thiểu không được lớn hơn giá tối đa.')).toBeTruthy()
    expect(calls).toHaveLength(0)
  })

  it('shows the backend suggestion and clears filters when nothing matches (FR-PRD-006 A1)', async () => {
    const suggestion = 'Không tìm thấy sản phẩm phù hợp. Hãy thử bỏ bớt bộ lọc hoặc đổi từ khóa.'
    mockSearch(() => jsonResponse(makeSearchPage([], { suggestion })))
    const user = userEvent.setup()
    renderAt(`/products?categoryId=${CATEGORY_LEAF_ID}`, route)

    expect(await screen.findByText(suggestion)).toBeTruthy()
    const message = screen.getByText('Không tìm thấy sản phẩm phù hợp với bộ lọc hiện tại').closest('div')
    await user.click(within(message as HTMLElement).getByRole('button', { name: 'Xóa tất cả bộ lọc' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/products'))
  })

  it('shows the retry banner when search is unavailable and retries (FR-PRD-006 E2)', async () => {
    let failing = true
    const calls = mockSearch(() =>
      failing ? errorResponse(503, 'SERVICE_UNAVAILABLE', 'Vui lòng thử lại sau') : resultPage(),
    )
    const user = userEvent.setup()
    renderAt('/products', route)

    const retry = await screen.findByRole('button', { name: 'Thử tải lại khối này' })
    expect(screen.getByText('Hệ thống tìm kiếm đang tạm gián đoạn. Vui lòng thử lại sau ít phút.')).toBeTruthy()
    failing = false
    await user.click(retry)

    expect(await screen.findByText('Áo thun Cotton Compact')).toBeTruthy()
    expect(calls.length).toBeGreaterThanOrEqual(2)
  })

  it('paginates through the URL', async () => {
    mockSearch(() =>
      resultPage(defaultItems(), { page: 2, pageSize: 20, totalItems: 30, totalPages: 2 }),
    )
    const user = userEvent.setup()
    renderAt('/products', route)
    await screen.findByText('Áo thun Cotton Compact')

    expect(screen.getByText('Trang 2 / 2')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Trang sau' }) as HTMLButtonElement).disabled).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Trang trước' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/products'))
  })

  it('explains a rejected search (422) with field reasons and a way to clear the keyword (FR-PRD-006 E1)', async () => {
    mockSearch(() =>
      errorResponse(422, 'VALIDATION_ERROR', 'Dữ liệu kiểm tra không hợp lệ.', [
        { field: 'q', reason: 'Từ khóa phải chứa ít nhất một chữ cái hoặc số.' },
      ]),
    )
    const user = userEvent.setup()
    renderAt('/products?q=%2A%2A%2A', route)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Từ khóa phải chứa ít nhất một chữ cái hoặc số.')
    expect(alert.textContent).toContain('corr-test-1')
    expect(screen.queryByRole('button', { name: 'Thử tải lại khối này' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc và từ khóa' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/products'))
  })

  it('offers to clear the keyword when a keyword alone matches nothing', async () => {
    mockSearch(() => jsonResponse(makeSearchPage([], { suggestion: 'Hãy thử từ khóa khác.' })))
    const user = userEvent.setup()
    renderAt('/products?q=khong-ton-tai', route)

    expect(await screen.findByText('Không tìm thấy sản phẩm nào cho từ khóa này')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Xóa từ khóa' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/products'))
  })

  it('shows a plain empty state without filters or keyword', async () => {
    mockSearch(() => jsonResponse(makeSearchPage([])))
    renderAt('/products', route)

    expect(await screen.findByText('Chưa có sản phẩm nào đang bán')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Xóa tất cả bộ lọc' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Xóa từ khóa' })).toBeNull()
  })

  it('offers to go back to the first page when a bookmarked page is past the last one', async () => {
    mockSearch(() => jsonResponse(makeSearchPage([])))
    const user = userEvent.setup()
    renderAt('/products?page=9', route)

    expect(await screen.findByText('Trang này không còn sản phẩm')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Về trang đầu' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/products'))
  })

  it('opens the filter sheet from the toolbar button', async () => {
    mockSearch(() => resultPage())
    const user = userEvent.setup()
    renderAt('/products', route)
    await screen.findByText('Áo thun Cotton Compact')

    await user.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    expect(await screen.findByRole('dialog')).toBeTruthy()
  })
})
