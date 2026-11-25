// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: { apiBaseUrl: 'http://api.test', demoMode: false, mediaBaseUrl: 'http://media.test/public-products' },
}))

import { clearAuthSession, setAuthSession } from '@/lib/auth/session'
import { ProductDetailPage } from './pages/ProductDetailPage'
import {
  BLACK_M_ID,
  PRODUCT_ID,
  SHOP_ID,
  makeCartView,
  makeCategories,
  makeProduct,
  makeVariant,
} from './test-fixtures'
import { LocationProbe, errorResponse, jsonResponse, renderAt, requestOf, vndText } from './test-utils'

afterEach(() => {
  cleanup()
  clearAuthSession()
  vi.restoreAllMocks()
})

const PRODUCT_PATH = `/products/${PRODUCT_ID}`

const route = (
  <>
    <Route
      path="/products/:id"
      element={
        <>
          <ProductDetailPage />
          <LocationProbe />
        </>
      }
    />
  </>
)

function loginAs(roles: string[]) {
  setAuthSession({
    accessToken: 'jwt-test',
    refreshToken: 'rt-test',
    user: {
      userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      email: 'buyer@soa.vn',
      fullName: 'Người Mua',
      phone: '0901234567',
      status: 'ACTIVE',
      roles,
      createdAt: '2026-01-01T00:00:00Z',
    },
  })
}

type MockOptions = {
  /** `null` = backend trả 404 cho sản phẩm. */
  product?: ReturnType<typeof makeProduct> | null
  addToCart?: Response
  /** Mô phỏng mất kết nối khi thêm vào giỏ (fetch ném lỗi). */
  addToCartThrows?: boolean
  reviews?: Response
  /** `null` = người bán chưa có gian hàng (403). */
  myShopId?: string | null
}

function mockBackend(options: MockOptions = {}) {
  const calls: ReturnType<typeof requestOf>[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const req = requestOf(input, init)
    calls.push(req)
    const { pathname } = req.url
    if (pathname === '/v1/categories') return jsonResponse({ data: makeCategories() })
    if (pathname === `/v1/products/${PRODUCT_ID}` && req.method === 'GET') {
      return options.product === null
        ? errorResponse(404, 'PRODUCT_NOT_FOUND', 'Sản phẩm không tồn tại.')
        : jsonResponse(options.product ?? makeProduct())
    }
    if (pathname === `/v1/products/${PRODUCT_ID}/reviews`) {
      return options.reviews ?? errorResponse(404, 'ROUTE_NOT_FOUND', 'Not found')
    }
    if (pathname === `/v1/shops/${SHOP_ID}`) {
      return jsonResponse({ shopId: SHOP_ID, name: 'SOA Basics Store', status: 'ACTIVE' })
    }
    if (pathname === '/v1/seller/shop') {
      return options.myShopId === null
        ? errorResponse(403, 'SHOP_NOT_ACTIVE', 'Người bán chưa có gian hàng ACTIVE.')
        : jsonResponse({ shopId: options.myShopId ?? SHOP_ID, name: 'SOA Basics Store', status: 'ACTIVE' })
    }
    if (pathname === '/v1/cart/items' && req.method === 'POST') {
      if (options.addToCartThrows) throw new TypeError('Failed to fetch')
      return options.addToCart ?? jsonResponse(makeCartView(1))
    }
    return errorResponse(404, 'NOT_FOUND', 'Not found')
  })
  return calls
}

function addButton() {
  return screen.getByRole('button', { name: 'Thêm vào giỏ' }) as HTMLButtonElement
}

describe('ProductDetailPage (T3-06)', () => {
  it('shows the product and sends a guest to login, keeping the product as the redirect target (FR-CRT-001 A1)', async () => {
    clearAuthSession()
    mockBackend()
    renderAt(PRODUCT_PATH, route)

    expect(await screen.findByRole('heading', { level: 1, name: 'Áo thun Cotton Compact' })).toBeTruthy()
    // Tên gian hàng đến từ một query riêng (SVC-SEL) nên phải chờ nó trả về.
    expect(await screen.findByText('SOA Basics Store')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Xem gian hàng' }).getAttribute('href')).toBe(`/shops/${SHOP_ID}`)
    expect(screen.getByRole('link', { name: 'Thời trang' }).getAttribute('href')).toContain('/products?categoryId=')
    expect(document.querySelector('img[src^="http://media.test/public-products/"]')).toBeTruthy()

    const login = screen.getByRole('link', { name: 'Đăng nhập để mua hàng' })
    expect(login.getAttribute('href')).toBe(`/login?redirect=${encodeURIComponent(PRODUCT_PATH)}`)
    expect(screen.queryByRole('button', { name: 'Thêm vào giỏ' })).toBeNull()
  })

  it('requires every attribute, marks out-of-stock combinations and blocks adding them (FR-PRD-004 AC2)', async () => {
    loginAs(['BUYER'])
    mockBackend()
    const user = userEvent.setup()
    renderAt(PRODUCT_PATH, route)

    expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy()
    expect(addButton().disabled).toBe(true)
    expect(screen.getByText('Vui lòng chọn đầy đủ phân loại sản phẩm.')).toBeTruthy()

    await user.selectOptions(screen.getByLabelText('Màu'), 'Trắng')
    await user.selectOptions(screen.getByLabelText('Cỡ'), 'L')
    expect(await screen.findByText('Hết hàng')).toBeTruthy()
    expect(addButton().disabled).toBe(true)

    await user.selectOptions(screen.getByLabelText('Cỡ'), 'M')
    expect(await screen.findByText('Còn 10 sản phẩm')).toBeTruthy()
    expect(addButton().disabled).toBe(false)
  })

  it('adds the chosen variant to the cart and updates the shared cart query (FR-CRT-001)', async () => {
    loginAs(['BUYER'])
    const calls = mockBackend()
    const user = userEvent.setup()
    const { queryClient } = renderAt(PRODUCT_PATH, route)
    await screen.findByRole('heading', { level: 1 })

    await user.selectOptions(screen.getByLabelText('Màu'), 'Đen')
    await user.click(screen.getByRole('button', { name: 'Tăng số lượng' }))
    await user.click(addButton())

    expect(await screen.findByText('Đã thêm 2 sản phẩm vào giỏ hàng.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Xem giỏ hàng' }).getAttribute('href')).toBe('/cart')
    const post = calls.find((call) => call.url.pathname === '/v1/cart/items' && call.method === 'POST')
    expect(post).toBeTruthy()
    expect(JSON.parse(await post!.bodyText)).toEqual({ variantId: BLACK_M_ID, quantity: 2 })
    expect(post!.headers.get('Authorization')).toBe('Bearer jwt-test')
    expect(queryClient.getQueryData(['cart'])).toMatchObject({ totalItemCount: 1 })
  })

  it('explains a stock overflow and lowers the quantity to what can still be added (FR-CRT-001 E1)', async () => {
    loginAs(['BUYER'])
    mockBackend({
      addToCart: errorResponse(
        409,
        'INSUFFICIENT_STOCK',
        'Số lượng yêu cầu vượt tồn kho khả dụng (khả dụng: 10, tối đa có thể thêm: 3).',
        [{ field: 'quantity', reason: 'Tối đa có thể thêm 3 sản phẩm' }],
      ),
    })
    const user = userEvent.setup()
    renderAt(PRODUCT_PATH, route)
    await screen.findByRole('heading', { level: 1 })

    await user.selectOptions(screen.getByLabelText('Màu'), 'Trắng')
    await user.selectOptions(screen.getByLabelText('Cỡ'), 'M')
    await user.click(screen.getByRole('button', { name: 'Tăng số lượng' }))
    await user.click(addButton())

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Số lượng yêu cầu vượt tồn kho khả dụng (khả dụng: 10, tối đa có thể thêm: 3).',
    )
    expect((screen.getByLabelText('Số lượng') as HTMLInputElement).value).toBe('3')
  })

  it('lets the shop owner preview a hidden product but not buy it (FR-PRD-004 A1, BR-SEL-05)', async () => {
    loginAs(['BUYER', 'SELLER'])
    mockBackend({ product: makeProduct({ status: 'HIDDEN' }) })
    renderAt(PRODUCT_PATH, route)

    expect(
      await screen.findByText('Chế độ xem trước của Nhà bán: sản phẩm này chưa hiển thị với người mua.'),
    ).toBeTruthy()
    expect(screen.getByText('Đã ẩn')).toBeTruthy()
    expect(await screen.findByText('Bạn không thể mua sản phẩm của chính gian hàng mình.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Thêm vào giỏ' })).toBeNull()
  })

  it('blocks an ACTIVE product of the own shop of the viewer (BR-SEL-05)', async () => {
    loginAs(['BUYER', 'SELLER'])
    mockBackend()
    renderAt(PRODUCT_PATH, route)

    expect(await screen.findByText('Bạn không thể mua sản phẩm của chính gian hàng mình.')).toBeTruthy()
    expect(addButton().disabled).toBe(true)
  })

  it('shows the product not-found page when the product is invisible to the buyer (FR-PRD-004 E1)', async () => {
    clearAuthSession()
    mockBackend({ product: null })
    renderAt(PRODUCT_PATH, route)

    expect(await screen.findByText('Sản phẩm không tồn tại hoặc đã ngừng kinh doanh')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Tìm sản phẩm khác' }).getAttribute('href')).toBe('/products')
  })

  it('keeps the product usable when the review service fails (NFR-REL-005)', async () => {
    clearAuthSession()
    const calls = mockBackend({ reviews: errorResponse(503, 'SERVICE_UNAVAILABLE', 'Unavailable') })
    renderAt(PRODUCT_PATH, route)

    expect(await screen.findByText('Tạm thời không thể tải danh sách đánh giá.')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Áo thun Cotton Compact' })).toBeTruthy()
    expect(calls.some((call) => call.url.pathname.endsWith('/reviews'))).toBe(true)
  })

  it('shows an empty note when the review service answers but the product has no reviews', async () => {
    clearAuthSession()
    mockBackend({ product: makeProduct({ ratingCount: 0, ratingAvg: 0 }), reviews: jsonResponse({ data: [] }) })
    renderAt(PRODUCT_PATH, route)

    expect(await screen.findByText('Chưa có đánh giá nào cho sản phẩm này.')).toBeTruthy()
  })

  it('offers a retry when the product cannot be loaded', async () => {
    clearAuthSession()
    let failing = true
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = requestOf(input, init)
      if (req.url.pathname === `/v1/products/${PRODUCT_ID}` && req.method === 'GET') {
        return failing
          ? errorResponse(503, 'SERVICE_UNAVAILABLE', 'Vui lòng thử lại sau')
          : jsonResponse(makeProduct())
      }
      return errorResponse(404, 'NOT_FOUND', 'Not found')
    })
    renderAt(PRODUCT_PATH, route)

    const retry = await screen.findByRole('button', { name: 'Thử tải lại khối này' })
    failing = false
    await userEvent.setup().click(retry)

    expect(await screen.findByRole('heading', { level: 1, name: 'Áo thun Cotton Compact' })).toBeTruthy()
  })

  it('reloads the product when it has just become unavailable (409 ITEM_UNAVAILABLE)', async () => {
    loginAs(['BUYER'])
    const calls = mockBackend({
      addToCart: errorResponse(409, 'ITEM_UNAVAILABLE', 'Sản phẩm không tồn tại hoặc ngừng kinh doanh.'),
    })
    const user = userEvent.setup()
    renderAt(PRODUCT_PATH, route)
    await screen.findByRole('heading', { level: 1 })
    const productLoads = () =>
      calls.filter((call) => call.url.pathname === `/v1/products/${PRODUCT_ID}` && call.method === 'GET')
        .length
    const loadsBefore = productLoads()

    await user.selectOptions(screen.getByLabelText('Màu'), 'Trắng')
    await user.selectOptions(screen.getByLabelText('Cỡ'), 'M')
    await user.click(addButton())

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Sản phẩm không tồn tại hoặc ngừng kinh doanh.',
    )
    await waitFor(() => expect(productLoads()).toBe(loadsBefore + 1))
  })

  it('shows the backend message for a suspended shop and keeps the page (409 SHOP_NOT_ACTIVE)', async () => {
    loginAs(['BUYER'])
    const calls = mockBackend({
      addToCart: errorResponse(409, 'SHOP_NOT_ACTIVE', 'Gian hàng hiện đang tạm ngưng hoặc bị khóa.'),
    })
    const user = userEvent.setup()
    renderAt(PRODUCT_PATH, route)
    await screen.findByRole('heading', { level: 1 })
    const productLoads = () =>
      calls.filter((call) => call.url.pathname === `/v1/products/${PRODUCT_ID}` && call.method === 'GET')
        .length
    const loadsBefore = productLoads()

    await user.selectOptions(screen.getByLabelText('Màu'), 'Trắng')
    await user.selectOptions(screen.getByLabelText('Cỡ'), 'M')
    await user.click(addButton())

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Gian hàng hiện đang tạm ngưng hoặc bị khóa.',
    )
    expect(productLoads()).toBe(loadsBefore)
    expect(screen.getByRole('heading', { level: 1, name: 'Áo thun Cotton Compact' })).toBeTruthy()
  })

  it('shows the backend message and the correlation id for a refused request (403)', async () => {
    loginAs(['BUYER'])
    mockBackend({
      addToCart: errorResponse(
        403,
        'SELF_PURCHASE_FORBIDDEN',
        'Bạn không thể mua sản phẩm của chính gian hàng mình.',
      ),
    })
    const user = userEvent.setup()
    renderAt(PRODUCT_PATH, route)
    await screen.findByRole('heading', { level: 1 })

    await user.selectOptions(screen.getByLabelText('Màu'), 'Đen')
    await user.click(addButton())

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Bạn không thể mua sản phẩm của chính gian hàng mình.')
    expect(alert.textContent).toContain('corr-test-1')
  })

  it('keeps the chosen variant and quantity when the cart cannot be reached (network error)', async () => {
    loginAs(['BUYER'])
    mockBackend({ addToCartThrows: true })
    const user = userEvent.setup()
    renderAt(PRODUCT_PATH, route)
    await screen.findByRole('heading', { level: 1 })

    await user.selectOptions(screen.getByLabelText('Màu'), 'Đen')
    await user.click(screen.getByRole('button', { name: 'Tăng số lượng' }))
    await user.click(addButton())

    expect((await screen.findByRole('alert')).textContent).toContain('Không thể kết nối tới máy chủ')
    expect((screen.getByLabelText('Màu') as HTMLSelectElement).value).toBe('Đen')
    expect((screen.getByLabelText('Số lượng') as HTMLInputElement).value).toBe('2')
    expect(addButton().disabled).toBe(false)
  })

  it('lets a seller buy from another shop', async () => {
    loginAs(['BUYER', 'SELLER'])
    mockBackend({ myShopId: '99999999-9999-4999-8999-999999999999' })
    const user = userEvent.setup()
    renderAt(PRODUCT_PATH, route)
    await screen.findByRole('heading', { level: 1 })

    await user.selectOptions(screen.getByLabelText('Màu'), 'Đen')
    expect(await screen.findByText('Còn 4 sản phẩm')).toBeTruthy()
    expect(screen.queryByText('Bạn không thể mua sản phẩm của chính gian hàng mình.')).toBeNull()
    await waitFor(() => expect(addButton().disabled).toBe(false))
  })

  it('lets a seller who owns no shop buy normally', async () => {
    loginAs(['BUYER', 'SELLER'])
    mockBackend({ myShopId: null })
    const user = userEvent.setup()
    renderAt(PRODUCT_PATH, route)
    await screen.findByRole('heading', { level: 1 })

    await user.selectOptions(screen.getByLabelText('Màu'), 'Đen')
    expect(await screen.findByText('Còn 4 sản phẩm')).toBeTruthy()
    await waitFor(() => expect(addButton().disabled).toBe(false))
  })

  it('shows a fallback shop name when the shop cannot be loaded (D11)', async () => {
    clearAuthSession()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = requestOf(input, init)
      if (req.url.pathname === `/v1/products/${PRODUCT_ID}` && req.method === 'GET') {
        return jsonResponse(makeProduct())
      }
      if (req.url.pathname === `/v1/shops/${SHOP_ID}`) {
        return errorResponse(404, 'SHOP_NOT_FOUND', 'Gian hàng không khả dụng.')
      }
      return errorResponse(404, 'NOT_FOUND', 'Not found')
    })
    renderAt(PRODUCT_PATH, route)

    expect(await screen.findByText(`Gian hàng #${SHOP_ID.slice(0, 8).toUpperCase()}`)).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Áo thun Cotton Compact' })).toBeTruthy()
  })

  it('lists variants by label when their attributes cannot be grouped (D6)', async () => {
    loginAs(['BUYER'])
    mockBackend({
      product: makeProduct({
        variants: [
          makeVariant({ attributes: {} }),
          makeVariant({
            variantId: BLACK_M_ID,
            sku: 'AO-THUN-DEN',
            attributes: { Màu: 'Đen' },
            price: 135_000,
          }),
        ],
      }),
    })
    const user = userEvent.setup()
    renderAt(PRODUCT_PATH, route)
    await screen.findByRole('heading', { level: 1 })

    const select = screen.getByLabelText('Phân loại sản phẩm') as HTMLSelectElement
    expect(addButton().disabled).toBe(true)
    await user.selectOptions(select, BLACK_M_ID)
    expect(addButton().disabled).toBe(false)
    expect(screen.getByText(vndText(135_000))).toBeTruthy()
  })

  it('lets the buyer clear the quantity field and type a new value', async () => {
    loginAs(['BUYER'])
    const calls = mockBackend()
    const user = userEvent.setup()
    renderAt(PRODUCT_PATH, route)
    await screen.findByRole('heading', { level: 1 })

    await user.selectOptions(screen.getByLabelText('Màu'), 'Đen')
    const input = screen.getByLabelText('Số lượng') as HTMLInputElement
    await user.type(input, '{selectall}{backspace}')
    expect(input.value).toBe('')
    await user.type(input, '3')
    expect(input.value).toBe('3')

    await user.click(addButton())
    await screen.findByText('Đã thêm 3 sản phẩm vào giỏ hàng.')
    const post = calls.find((call) => call.url.pathname === '/v1/cart/items' && call.method === 'POST')
    expect(JSON.parse(await post!.bodyText)).toEqual({ variantId: BLACK_M_ID, quantity: 3 })
  })
})
