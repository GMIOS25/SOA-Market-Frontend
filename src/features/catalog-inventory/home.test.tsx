// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react'
import { Route } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: { apiBaseUrl: 'http://api.test', demoMode: false, mediaBaseUrl: 'http://media.test/public-products' },
}))

import { HomePage } from './pages/HomePage'
import { CATEGORY_ROOT_ID, makeCategories, makeProductSummary, makeSearchPage } from './test-fixtures'
import { errorResponse, jsonResponse, renderAt, requestOf } from './test-utils'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function mockCatalog(options: { failSort?: 'newest' | 'popular' } = {}) {
  const searchCalls: string[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const req = requestOf(input, init)
    if (req.url.pathname === '/v1/categories') return jsonResponse({ data: makeCategories() })
    if (req.url.pathname === '/v1/products' && req.method === 'GET') {
      const sort = req.url.searchParams.get('sort') ?? 'newest'
      searchCalls.push(`${sort}:${req.url.searchParams.get('pageSize')}`)
      if (sort === options.failSort) return errorResponse(503, 'SERVICE_UNAVAILABLE', 'Vui lòng thử lại sau')
      return jsonResponse(
        makeSearchPage([
          makeProductSummary({ productId: 'prod-a', name: `Sản phẩm ${sort} A` }),
          makeProductSummary({ productId: 'prod-b', name: `Sản phẩm ${sort} B` }),
        ]),
      )
    }
    return errorResponse(404, 'NOT_FOUND', 'Not found')
  })
  return { searchCalls }
}

const route = <Route path="/" element={<HomePage />} />

describe('HomePage (T3-06)', () => {
  it('renders the category tree and one grid per section, each from its own search query (D5)', async () => {
    const { searchCalls } = mockCatalog()
    renderAt('/', route)

    const newest = (await screen.findByRole('heading', { name: 'Sản phẩm mới nhất' })).closest('section')
    const popular = screen.getByRole('heading', { name: 'Bán chạy' }).closest('section')
    expect(newest).toBeTruthy()
    expect(popular).toBeTruthy()

    expect(await within(newest as HTMLElement).findByText('Sản phẩm newest A')).toBeTruthy()
    expect(await within(popular as HTMLElement).findByText('Sản phẩm popular B')).toBeTruthy()
    expect(within(newest as HTMLElement).queryByText('Sản phẩm popular A')).toBeNull()

    expect(screen.getByRole('link', { name: 'Thời trang' }).getAttribute('href')).toBe(
      `/products?categoryId=${CATEGORY_ROOT_ID}`,
    )
    expect(screen.getAllByRole('link', { name: 'Xem tất cả' }).map((link) => link.getAttribute('href'))).toEqual([
      '/products',
      '/products?sort=popular',
    ])
    expect([...new Set(searchCalls)].sort()).toEqual(['newest:20', 'popular:20'])
  })

  it('degrades only the failing section (NFR-REL-005)', async () => {
    mockCatalog({ failSort: 'popular' })
    renderAt('/', route)

    const banner = await screen.findByText('Hệ thống tìm kiếm đang tạm gián đoạn. Vui lòng thử lại sau ít phút.')
    const section = banner.closest('section')
    expect(within(section as HTMLElement).getByRole('heading', { name: 'Bán chạy' })).toBeTruthy()
    expect(await screen.findByText('Sản phẩm newest A')).toBeTruthy()
    expect(screen.queryByText('Sản phẩm popular A')).toBeNull()
  })
})
