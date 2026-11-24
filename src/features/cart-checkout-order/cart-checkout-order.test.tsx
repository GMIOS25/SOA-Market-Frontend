// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: {
    apiBaseUrl: 'http://api.test',
    demoMode: false,
  },
}))

import '@/lib/dayjs'
import '@/lib/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { clearAuthSession, setAuthSession } from '@/lib/auth/session'
import type {
  AddressDTO,
  CartView,
  CheckoutResult,
  CheckoutSummaryView,
  PublicShopDTO,
} from './api'
import { CartPage } from './pages/CartPage'
import { CheckoutPage } from './pages/CheckoutPage'

const SHOP_1_ID = '11111111-1111-4111-8111-111111111111'
const SHOP_2_ID = '22222222-2222-4222-8222-222222222222'
const BUYER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ADDR_1_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ADDR_2_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function makeMultiShopCart(overrides: Partial<CartView> = {}): CartView {
  return {
    cartId: 'cart-1',
    buyerId: BUYER_ID,
    totalItemCount: 3,
    selectedCount: 2,
    selectedItemsTotal: 340_000,
    canCheckout: true,
    prdDegraded: false,
    shopGroups: [
      {
        shopId: SHOP_1_ID,
        shopStatus: 'ACTIVE',
        shopSubtotal: 240_000,
        selectedCount: 2,
        items: [
          {
            cartItemId: 'ci-1',
            variantId: 'var-1',
            productId: 'prd-1',
            shopId: SHOP_1_ID,
            productName: 'Áo thun Cotton Compact',
            variantLabel: 'Trắng / L',
            quantity: 2,
            selected: true,
            available: true,
            availableQuantity: 10,
            unitPrice: 120_000,
            lineSubtotal: 240_000,
            priceChanged: true,
            previousPrice: 100_000,
            currentPrice: 120_000,
            warnings: [
              {
                code: 'PRICE_CHANGED',
                message: 'Giá đã thay đổi từ 100.000 ₫ → 120.000 ₫',
              },
            ],
          },
          {
            cartItemId: 'ci-2',
            variantId: 'var-2',
            productId: 'prd-2',
            shopId: SHOP_1_ID,
            productName: 'Quần short kaki',
            variantLabel: 'Xám / M',
            quantity: 1,
            selected: false,
            available: false,
            availableQuantity: 0,
            unitPrice: 180_000,
            lineSubtotal: 180_000,
            priceChanged: false,
            warnings: [{ code: 'OUT_OF_STOCK', message: 'Sản phẩm đã hết hàng.' }],
          },
        ],
      },
      {
        shopId: SHOP_2_ID,
        shopStatus: 'ACTIVE',
        shopSubtotal: 100_000,
        selectedCount: 1,
        items: [
          {
            cartItemId: 'ci-3',
            variantId: 'var-3',
            productId: 'prd-3',
            shopId: SHOP_2_ID,
            productName: 'Cáp sạc USB-C 2m',
            variantLabel: 'Đen',
            quantity: 1,
            selected: true,
            available: true,
            availableQuantity: 5,
            unitPrice: 100_000,
            lineSubtotal: 100_000,
            priceChanged: false,
          },
        ],
      },
    ],
    ...overrides,
  }
}

function makeDefaultAddress(overrides: Partial<AddressDTO> = {}): AddressDTO {
  return {
    addressId: ADDR_1_ID,
    userId: BUYER_ID,
    receiver: 'Nguyễn Khánh Dương',
    phone: '0901234567',
    line: '01 Võ Văn Ngân',
    ward: 'Phường Linh Chiểu',
    district: 'TP. Thủ Đức',
    province: 'TP. Hồ Chí Minh',
    isDefault: true,
    createdAt: '2026-11-20T00:00:00Z',
    updatedAt: '2026-11-20T00:00:00Z',
    ...overrides,
  }
}

function makeCheckoutSummary(overrides: Partial<CheckoutSummaryView> = {}): CheckoutSummaryView {
  return {
    deliveryAddress: {
      contactName: 'Nguyễn Khánh Dương',
      phone: '0901234567',
      line: '01 Võ Văn Ngân',
      ward: 'Phường Linh Chiểu',
      district: 'TP. Thủ Đức',
      province: 'TP. Hồ Chí Minh',
    },
    packages: [
      {
        shopId: SHOP_1_ID,
        shopName: 'Thời Trang Tối Giản',
        items: [
          {
            cartItemId: 'ci-1',
            productId: 'prd-1',
            variantId: 'var-1',
            productName: 'Áo thun Cotton Compact',
            variantLabel: 'Trắng / L',
            unitPrice: 120_000,
            quantity: 2,
            weightGram: 400,
            lineTotal: 240_000,
          },
        ],
        itemsAmount: 240_000,
        shippingFee: 25_000,
        discountAmount: 0,
        totalAmount: 265_000,
        carrier: 'GHN',
        serviceable: true,
        isFallbackRate: false,
        estimatedDeliveryAt: '2026-11-26T00:00:00Z',
      },
      {
        shopId: SHOP_2_ID,
        shopName: 'Phụ Kiện Số B',
        items: [
          {
            cartItemId: 'ci-3',
            productId: 'prd-3',
            variantId: 'var-3',
            productName: 'Cáp sạc USB-C 2m',
            variantLabel: 'Đen',
            unitPrice: 100_000,
            quantity: 1,
            weightGram: 150,
            lineTotal: 100_000,
          },
        ],
        itemsAmount: 100_000,
        shippingFee: 32_000,
        discountAmount: 0,
        totalAmount: 132_000,
        carrier: 'GHN',
        serviceable: true,
        isFallbackRate: true,
        estimatedDeliveryAt: '2026-11-27T00:00:00Z',
      },
    ],
    itemsTotal: 340_000,
    shippingTotal: 57_000,
    grandTotal: 397_000,
    canCheckout: true,
    cacheHit: false,
    quoteExpiresAt: '2026-11-23T12:05:00Z',
    ...overrides,
  }
}

function makeCheckoutResult(): CheckoutResult {
  return {
    orderId: 'ord-1',
    orderCode: 'ORD-20261123-ABC123',
    status: 'PENDING_PAYMENT',
    itemsTotal: 340_000,
    shippingTotal: 57_000,
    grandTotal: 397_000,
    deliveryAddress: makeCheckoutSummary().deliveryAddress,
    paymentDueAt: '2026-11-23T12:15:00Z',
    sagaStep: 'PAYMENT_INITIATED',
    sellerOrders: [],
    payment: {
      paymentId: 'pay-1',
      gateway: 'MOCK_PAY',
      gatewayRef: 'MOCK-1',
      status: 'PENDING',
      amount: 397_000,
      paymentUrl: 'https://pay.mock.local/session/pay-1',
      expiresAt: '2026-11-23T12:15:00Z',
    },
    idempotentReplay: false,
    createdAt: '2026-11-23T12:00:00Z',
  }
}

function renderFeature(
  initialPath: string,
  options: { onRedirect?: (url: string) => void } = {},
) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage onRedirect={options.onRedirect} />} />
            <Route path="/products" element={<div>Danh sách sản phẩm</div>} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

function mockShopResponse(shopId: string): PublicShopDTO | null {
  if (shopId === SHOP_1_ID) {
    return {
      shopId: SHOP_1_ID,
      name: 'Thời Trang Tối Giản',
      ratingAvg: 4.9,
      ratingCount: 120,
      createdAt: '2026-01-01T00:00:00Z',
    }
  }
  if (shopId === SHOP_2_ID) {
    return {
      shopId: SHOP_2_ID,
      name: 'Phụ Kiện Số B',
      ratingAvg: 4.8,
      ratingCount: 45,
      createdAt: '2026-01-01T00:00:00Z',
    }
  }
  return null
}

beforeEach(() => {
  setAuthSession({
    accessToken: 'jwt-buyer-test',
    refreshToken: 'rt-buyer-test',
    user: {
      userId: BUYER_ID,
      email: 'buyer@soa.vn',
      fullName: 'Nguyễn Khánh Dương',
      phone: '0901234567',
      status: 'ACTIVE',
      roles: ['BUYER'],
      createdAt: '2026-11-01T00:00:00Z',
    },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  clearAuthSession()
  cleanup()
})

describe('T4-06: Multi-Seller Cart (/cart)', () => {
  it('groups items by shop using <ShopPackageCard />, shows price change & out-of-stock warnings, and keeps unavailable items unchecked/dimmed', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const req = input as Request
      const path = new URL(req.url, 'http://localhost').pathname
      if (path === '/v1/cart' && req.method === 'GET') {
        return jsonResponse(makeMultiShopCart())
      }
      if (path.startsWith('/v1/shops/')) {
        const shopId = path.replace('/v1/shops/', '')
        const shop = mockShopResponse(shopId)
        return shop ? jsonResponse(shop) : jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Unhandled' }, 404)
    })

    renderFeature('/cart')

    const shopCard1 = await screen.findByRole('article', { name: /Thời Trang Tối Giản/ })
    const shopCard2 = await screen.findByRole('article', { name: /Phụ Kiện Số B/ })

    expect(shopCard1).toBeTruthy()
    expect(shopCard2).toBeTruthy()

    // Price change warning badge
    expect(within(shopCard1).getByText('Giá đã thay đổi từ 100.000 ₫ → 120.000 ₫')).toBeTruthy()

    // Out-of-stock item is dimmed, unchecked, and disabled
    expect(within(shopCard1).getByText('Sản phẩm đã hết hàng.')).toBeTruthy()
    const unavailableItemCheckbox = screen.getByRole('checkbox', {
      name: 'Chọn Quần short kaki',
    }) as HTMLInputElement
    expect(unavailableItemCheckbox.checked).toBe(false)
    expect(unavailableItemCheckbox.disabled).toBe(true)

    const itemRows = within(shopCard1).getAllByRole('listitem')
    expect(itemRows[1]?.className).toContain('opacity-60')

    // Mobile sticky bar is present and configured for 360px
    const mobileBar = screen.getByTestId('mobile-sticky-bar')
    expect(mobileBar.className).toContain('fixed')
    expect(mobileBar.className).toContain('bottom-0')
    expect(within(mobileBar).getByText('340.000 ₫')).toBeTruthy()
  })

  it('automatically unchecks stale unavailable items that arrive selected=true', async () => {
    const staleCart = makeMultiShopCart()
    staleCart.shopGroups![0]!.items![1]!.selected = true

    const updateCalls: Array<{ path: string; body: unknown }> = []

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const req = input as Request
      const path = new URL(req.url, 'http://localhost').pathname
      if (path === '/v1/cart' && req.method === 'GET') {
        return jsonResponse(staleCart)
      }
      if (path === '/v1/cart/items/ci-2' && req.method === 'PUT') {
        const body = await req.clone().json()
        updateCalls.push({ path, body })
        return jsonResponse(makeMultiShopCart())
      }
      if (path.startsWith('/v1/shops/')) {
        const shop = mockShopResponse(path.replace('/v1/shops/', ''))
        return shop ? jsonResponse(shop) : jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Unhandled' }, 404)
    })

    renderFeature('/cart')

    await waitFor(() => {
      expect(updateCalls).toEqual([{ path: '/v1/cart/items/ci-2', body: { selected: false } }])
    })
  })

  it('blocks checkout when SVC-PRD is degraded while still displaying saved cart items and retry banner', async () => {
    const degradedCart = makeMultiShopCart({
      canCheckout: false,
      prdDegraded: true,
      degradedWarning:
        'Giá và tồn kho chưa được cập nhật do dịch vụ sản phẩm tạm gián đoạn. Vui lòng làm mới giỏ hàng trước khi đặt hàng.',
    })
    let getCartCalls = 0

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const req = input as Request
      const path = new URL(req.url, 'http://localhost').pathname
      if (path === '/v1/cart' && req.method === 'GET') {
        getCartCalls += 1
        return jsonResponse(degradedCart)
      }
      if (path.startsWith('/v1/shops/')) {
        const shop = mockShopResponse(path.replace('/v1/shops/', ''))
        return shop ? jsonResponse(shop) : jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Unhandled' }, 404)
    })

    const user = userEvent.setup()
    renderFeature('/cart')

    const bannerText = await screen.findByText(/dịch vụ sản phẩm tạm gián đoạn/)
    expect(bannerText).toBeTruthy()
    expect(screen.getByText('Áo thun Cotton Compact')).toBeTruthy()

    const desktopCheckoutBtn = screen.getByRole('button', { name: /Tiếp tục đặt hàng/ }) as HTMLButtonElement
    const mobileCheckoutBtn = within(screen.getByTestId('mobile-sticky-bar')).getByRole('button', {
      name: /Đặt hàng/,
    }) as HTMLButtonElement

    expect(desktopCheckoutBtn.disabled).toBe(true)
    expect(mobileCheckoutBtn.disabled).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Thử tải lại khối này' }))
    await waitFor(() => expect(getCartCalls).toBe(2))
  })

  it('updates item quantity and removes items via cart API', async () => {
    const initialCart = makeMultiShopCart()
    const putPayloads: unknown[] = []
    const deletedPaths: string[] = []

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const req = input as Request
      const path = new URL(req.url, 'http://localhost').pathname
      if (path === '/v1/cart' && req.method === 'GET') {
        return jsonResponse(initialCart)
      }
      if (path === '/v1/cart/items/ci-3' && req.method === 'PUT') {
        putPayloads.push(await req.clone().json())
        const next = makeMultiShopCart({ selectedCount: 3, selectedItemsTotal: 440_000 })
        next.shopGroups![1]!.items![0]!.quantity = 2
        next.shopGroups![1]!.items![0]!.lineSubtotal = 200_000
        next.shopGroups![1]!.shopSubtotal = 200_000
        return jsonResponse(next)
      }
      if (path === '/v1/cart/items/ci-2' && req.method === 'DELETE') {
        deletedPaths.push(path)
        const next = makeMultiShopCart()
        next.shopGroups![0]!.items = [next.shopGroups![0]!.items![0]!]
        return jsonResponse(next)
      }
      if (path.startsWith('/v1/shops/')) {
        const shop = mockShopResponse(path.replace('/v1/shops/', ''))
        return shop ? jsonResponse(shop) : jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Unhandled' }, 404)
    })

    const user = userEvent.setup()
    renderFeature('/cart')

    await screen.findByText('Cáp sạc USB-C 2m')
    await user.click(screen.getByRole('button', { name: 'Tăng số lượng Cáp sạc USB-C 2m' }))
    await waitFor(() => expect(putPayloads).toEqual([{ quantity: 2 }]))

    await user.click(screen.getByRole('button', { name: 'Xóa Quần short kaki khỏi giỏ hàng' }))
    await waitFor(() => expect(deletedPaths).toEqual(['/v1/cart/items/ci-2']))
  })
})

describe('T4-06: Checkout (/checkout) & <= 3 Screens Flow', () => {
  it('supports inline Add Address Modal on /checkout and recalculates per-shop shipping fees', async () => {
    const createdAddr = makeDefaultAddress({
      addressId: ADDR_2_ID,
      receiver: 'Trần Minh Anh',
      phone: '0912345678',
      line: '123 Lê Lợi',
      ward: 'Phường Bến Nghé',
      district: 'Quận 1',
      province: 'TP. Hồ Chí Minh',
      isDefault: true,
    })

    const addresses: AddressDTO[] = []
    const summaryBodies: Array<{ addressId?: string; deliveryAddress: { contactName: string } }> = []

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const req = input as Request
      const path = new URL(req.url, 'http://localhost').pathname
      if (path === '/v1/users/me/addresses' && req.method === 'GET') {
        return jsonResponse({ data: [...addresses] })
      }
      if (path === '/v1/users/me/addresses' && req.method === 'POST') {
        addresses.push(createdAddr)
        return jsonResponse(createdAddr, 201)
      }
      if (path === '/v1/checkout/summary' && req.method === 'POST') {
        const body = (await req.clone().json()) as {
          addressId?: string
          deliveryAddress: { contactName: string }
        }
        summaryBodies.push(body)
        return jsonResponse(
          makeCheckoutSummary({
            deliveryAddress: {
              contactName: body.deliveryAddress.contactName,
              phone: createdAddr.phone,
              line: createdAddr.line,
              ward: createdAddr.ward,
              district: createdAddr.district,
              province: createdAddr.province,
            },
          }),
        )
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Unhandled' }, 404)
    })

    const user = userEvent.setup()
    renderFeature('/checkout')

    // Buyer has no address -> open inline modal
    await screen.findByText('Bạn chưa có địa chỉ giao hàng nào')
    await user.click(screen.getByRole('button', { name: 'Thêm địa chỉ giao hàng' }))

    const dialog = await screen.findByRole('dialog')
    const receiverInput = within(dialog).getByLabelText('Người nhận')
    await user.clear(receiverInput)
    await user.type(receiverInput, 'Trần Minh Anh')
    const phoneInput = within(dialog).getByLabelText('Số điện thoại')
    await user.clear(phoneInput)
    await user.type(phoneInput, '0912345678')
    await user.type(within(dialog).getByLabelText('Số nhà, tên đường'), '123 Lê Lợi')
    await user.type(within(dialog).getByLabelText('Phường/Xã'), 'Phường Bến Nghé')
    await user.type(within(dialog).getByLabelText('Quận/Huyện'), 'Quận 1')
    await user.type(within(dialog).getByLabelText('Tỉnh/Thành phố'), 'TP. Hồ Chí Minh')

    await user.click(within(dialog).getByRole('button', { name: 'Lưu & dùng địa chỉ này' }))

    await waitFor(() => {
      expect(summaryBodies).toHaveLength(1)
      expect(summaryBodies[0]?.addressId).toBe(ADDR_2_ID)
      expect(summaryBodies[0]?.deliveryAddress.contactName).toBe('Trần Minh Anh')
    })

    // Per-shop shipping fees rendered separately (including fallback "Phí ước tính" label)
    const pkg1 = await screen.findByRole('article', { name: /Thời Trang Tối Giản/ })
    const pkg2 = await screen.findByRole('article', { name: /Phụ Kiện Số B/ })
    expect(within(pkg1).getByText('25.000 ₫')).toBeTruthy()
    expect(within(pkg2).getByText('32.000 ₫')).toBeTruthy()
    expect(within(pkg2).getByText(/Phí ước tính/)).toBeTruthy()
  })

  it('sends stable Idempotency-Key across retry on 503 and changes key when payload changes', async () => {
    const idempotencyKeys: string[] = []
    let checkoutAttempt = 0
    const onRedirect = vi.fn()

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const req = input as Request
      const path = new URL(req.url, 'http://localhost').pathname
      if (path === '/v1/users/me/addresses' && req.method === 'GET') {
        return jsonResponse({ data: [makeDefaultAddress()] })
      }
      if (path === '/v1/checkout/summary' && req.method === 'POST') {
        return jsonResponse(makeCheckoutSummary())
      }
      if (path === '/v1/checkout' && req.method === 'POST') {
        checkoutAttempt += 1
        idempotencyKeys.push(req.headers.get('Idempotency-Key') ?? '')
        if (checkoutAttempt === 1) {
          return jsonResponse(
            {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Hệ thống đang bận, vui lòng thử lại.',
              correlationId: 'corr-retry-1',
            },
            503,
          )
        }
        return jsonResponse(makeCheckoutResult(), 201)
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Unhandled' }, 404)
    })

    const user = userEvent.setup()
    renderFeature('/checkout', { onRedirect })

    await screen.findByRole('article', { name: /Thời Trang Tối Giản/ })

    const placeOrderBtn = screen.getByRole('button', { name: 'Đặt hàng & Thanh toán' })
    await user.click(placeOrderBtn)

    await screen.findByText('Hệ thống đang bận, vui lòng thử lại.')
    expect(idempotencyKeys[0]).toMatch(/^[0-9a-f-]{36}$/i)

    // Retry with exact same payload -> must reuse identical Idempotency-Key
    await user.click(placeOrderBtn)
    await waitFor(() => expect(onRedirect).toHaveBeenCalledWith('https://pay.mock.local/session/pay-1'))
    expect(idempotencyKeys[1]).toBe(idempotencyKeys[0])

    // Change gateway -> must generate a new Idempotency-Key after reset/payload change
    await user.click(screen.getByRole('radio', { name: /VNPay Sandbox/ }))
    await user.click(placeOrderBtn)
    await waitFor(() => expect(idempotencyKeys).toHaveLength(3))
    expect(idempotencyKeys[2]).not.toBe(idempotencyKeys[0])
  })

  it('opens InsufficientStockDialog on 409 INSUFFICIENT_STOCK and navigates back to /cart', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const req = input as Request
      const path = new URL(req.url, 'http://localhost').pathname
      if (path === '/v1/users/me/addresses' && req.method === 'GET') {
        return jsonResponse({ data: [makeDefaultAddress()] })
      }
      if (path === '/v1/checkout/summary' && req.method === 'POST') {
        return jsonResponse(makeCheckoutSummary())
      }
      if (path === '/v1/checkout' && req.method === 'POST') {
        return jsonResponse(
          {
            code: 'INSUFFICIENT_STOCK',
            message: 'Một số sản phẩm trong giỏ hàng không đủ số lượng tồn kho.',
            correlationId: 'corr-stock-409',
            details: [{ field: 'items[0].variantId', reason: 'Chỉ còn 1 sản phẩm khả dụng' }],
          },
          409,
        )
      }
      if (path === '/v1/cart' && req.method === 'GET') {
        return jsonResponse(makeMultiShopCart())
      }
      if (path.startsWith('/v1/shops/')) {
        const shop = mockShopResponse(path.replace('/v1/shops/', ''))
        return shop ? jsonResponse(shop) : jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Unhandled' }, 404)
    })

    const user = userEvent.setup()
    renderFeature('/checkout')

    await screen.findByRole('article', { name: /Thời Trang Tối Giản/ })
    await user.click(screen.getByRole('button', { name: 'Đặt hàng & Thanh toán' }))

    const modal = await screen.findByRole('dialog')
    expect(within(modal).getByText('Áo thun Cotton Compact')).toBeTruthy()
    expect(within(modal).getByText('Chỉ còn 1 sản phẩm khả dụng')).toBeTruthy()
    expect(within(modal).getByText('corr-stock-409')).toBeTruthy()

    await user.click(within(modal).getByRole('button', { name: 'Quay lại giỏ hàng điều chỉnh' }))
    expect(await screen.findByRole('heading', { name: 'Giỏ hàng' })).toBeTruthy()
  })

  it('completes Cart -> Checkout -> Payment Gateway redirect in <= 3 screens for a buyer with an address', async () => {
    const onRedirect = vi.fn()

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const req = input as Request
      const path = new URL(req.url, 'http://localhost').pathname
      if (path === '/v1/cart' && req.method === 'GET') {
        return jsonResponse(makeMultiShopCart())
      }
      if (path.startsWith('/v1/shops/')) {
        const shop = mockShopResponse(path.replace('/v1/shops/', ''))
        return shop ? jsonResponse(shop) : jsonResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404)
      }
      if (path === '/v1/users/me/addresses' && req.method === 'GET') {
        return jsonResponse({ data: [makeDefaultAddress()] })
      }
      if (path === '/v1/checkout/summary' && req.method === 'POST') {
        return jsonResponse(makeCheckoutSummary())
      }
      if (path === '/v1/checkout' && req.method === 'POST') {
        return jsonResponse(makeCheckoutResult(), 201)
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Unhandled' }, 404)
    })

    const user = userEvent.setup()
    // Screen 1: /cart
    renderFeature('/cart', { onRedirect })

    const proceedBtn = await screen.findByRole('button', { name: /Tiếp tục đặt hàng/ })
    await user.click(proceedBtn)

    // Screen 2: /checkout
    expect(await screen.findByRole('heading', { name: 'Xác nhận & Đặt hàng' })).toBeTruthy()
    await screen.findByRole('article', { name: /Thời Trang Tối Giản/ })

    // Verify 360px sticky bar on /checkout
    const mobileBar = screen.getByTestId('mobile-sticky-bar')
    expect(mobileBar.className).toContain('fixed')
    expect(within(mobileBar).getByText('397.000 ₫')).toBeTruthy()
    const mobileBtn = within(mobileBar).getByRole('button', { name: 'Đặt hàng' })
    expect(mobileBtn.className).toContain('h-11')

    // Click Place Order -> Screen 3: Payment Gateway redirect
    await user.click(screen.getByRole('button', { name: 'Đặt hàng & Thanh toán' }))
    await waitFor(() => {
      expect(onRedirect).toHaveBeenCalledWith('https://pay.mock.local/session/pay-1')
    })
  })

  it('highlights unserviceable shop on /checkout and allows removing its items', async () => {
    const unserviceableSummary = makeCheckoutSummary({
      canCheckout: false,
      shippingTotal: 25_000,
      grandTotal: 265_000,
    })
    unserviceableSummary.packages![1]!.serviceable = false
    unserviceableSummary.packages![1]!.shippingFee = 0
    unserviceableSummary.packages![1]!.totalAmount = 100_000
    unserviceableSummary.packages![1]!.unserviceableReason = 'ĐVVC không hỗ trợ giao tới huyện đảo.'

    const deselectedPaths: string[] = []
    let summaryCalls = 0

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const req = input as Request
      const path = new URL(req.url, 'http://localhost').pathname
      if (path === '/v1/users/me/addresses' && req.method === 'GET') {
        return jsonResponse({ data: [makeDefaultAddress()] })
      }
      if (path === '/v1/checkout/summary' && req.method === 'POST') {
        summaryCalls += 1
        if (summaryCalls === 1) {
          return jsonResponse(unserviceableSummary)
        }
        const singleShopSummary = makeCheckoutSummary({
          packages: [unserviceableSummary.packages![0]!],
          itemsTotal: 240_000,
          shippingTotal: 25_000,
          grandTotal: 265_000,
          canCheckout: true,
        })
        return jsonResponse(singleShopSummary)
      }
      if (path === '/v1/cart/items/ci-3' && req.method === 'PUT') {
        deselectedPaths.push(path)
        return jsonResponse(makeMultiShopCart())
      }
      return jsonResponse({ code: 'NOT_FOUND', message: 'Unhandled' }, 404)
    })

    const user = userEvent.setup()
    renderFeature('/checkout')

    const pkg2 = await screen.findByRole('article', { name: /Phụ Kiện Số B/ })
    expect(within(pkg2).getByText('ĐVVC không hỗ trợ giao tới huyện đảo.')).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Đặt hàng & Thanh toán' }) as HTMLButtonElement).disabled,
    ).toBe(true)

    await user.click(within(pkg2).getByRole('button', { name: 'Bỏ sản phẩm của shop này' }))
    await waitFor(() => {
      expect(deselectedPaths).toEqual(['/v1/cart/items/ci-3'])
      expect(summaryCalls).toBe(2)
    })
    await waitFor(() => {
      expect(
        (screen.getByRole('button', { name: 'Đặt hàng & Thanh toán' }) as HTMLButtonElement).disabled,
      ).toBe(false)
    })
  })
})
