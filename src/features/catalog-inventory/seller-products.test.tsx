// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: { apiBaseUrl: 'http://api.test', demoMode: false, mediaBaseUrl: 'http://media.test/public-products' },
}))

import type { SellerInventoryEntry } from './api'
import { SellerProductFormPage } from './pages/SellerProductFormPage'
import { SellerProductsPage } from './pages/SellerProductsPage'
import {
  CATEGORY_LEAF_ID,
  PRODUCT_ID,
  SHOP_ID,
  WHITE_L_ID,
  WHITE_M_ID,
  makeCategories,
  makeProduct,
} from './test-fixtures'
import { LocationProbe, errorResponse, jsonResponse, renderAt, requestOf } from './test-utils'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function makeInventoryEntries(): SellerInventoryEntry[] {
  return [
    {
      variantId: WHITE_M_ID,
      productId: PRODUCT_ID,
      productName: 'Áo thun Cotton Compact',
      productStatus: 'ACTIVE',
      sku: 'AO-THUN-TRANG-M',
      attributes: { Màu: 'Trắng', Cỡ: 'M' },
      price: 120_000,
      isActive: true,
      onHand: 15,
      reserved: 5,
      available: 10,
      version: 2,
    },
    {
      variantId: WHITE_L_ID,
      productId: PRODUCT_ID,
      productName: 'Áo thun Cotton Compact',
      productStatus: 'ACTIVE',
      sku: 'AO-THUN-TRANG-L',
      attributes: { Màu: 'Trắng', Cỡ: 'L' },
      price: 150_000,
      isActive: true,
      onHand: 3,
      reserved: 3,
      available: 0,
      version: 1,
    },
    {
      variantId: '77777777-7777-4777-8777-777777777777',
      productId: '88888888-8888-4888-8888-888888888888',
      productName: 'Quần short Kaki',
      productStatus: 'DRAFT',
      sku: 'QUAN-SHORT-M',
      attributes: { Cỡ: 'M' },
      price: 220_000,
      isActive: true,
      onHand: 20,
      reserved: 0,
      available: 20,
      version: 1,
    },
  ]
}

const sellerRoutes = (
  <>
    <Route
      path="/seller/products"
      element={
        <>
          <SellerProductsPage />
          <LocationProbe />
        </>
      }
    />
    <Route
      path="/seller/products/new"
      element={
        <>
          <SellerProductFormPage />
          <LocationProbe />
        </>
      }
    />
    <Route
      path="/seller/products/:id/edit"
      element={
        <>
          <SellerProductFormPage />
          <LocationProbe />
        </>
      }
    />
  </>
)

describe('SellerProductsPage & SellerProductFormPage (T3-07)', () => {
  it('groups seller inventory rows by product, filters by status, and hides with fresh product version', async () => {
    const requests: Array<{ method: string; path: string; body: string }> = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = requestOf(input, init)
      const body = await req.bodyText
      requests.push({ method: req.method, path: req.url.pathname, body })

      if (req.url.pathname === '/v1/seller/inventory') {
        return jsonResponse({
          data: makeInventoryEntries(),
          pagination: { page: 1, pageSize: 100, totalItems: 3, totalPages: 1 },
        })
      }
      if (req.url.pathname === `/v1/products/${PRODUCT_ID}` && req.method === 'GET') {
        return jsonResponse(makeProduct({ version: 7 }))
      }
      if (req.url.pathname === `/v1/products/${PRODUCT_ID}/hide`) {
        return errorResponse(404, 'NOT_FOUND', 'wrong path')
      }
      if (req.url.pathname === `/v1/seller/products/${PRODUCT_ID}/hide` && req.method === 'POST') {
        return jsonResponse(makeProduct({ status: 'HIDDEN', version: 8 }))
      }
      return errorResponse(404, 'NOT_FOUND', 'Not found')
    })

    const user = userEvent.setup()
    renderAt('/seller/products', sellerRoutes)

    expect(await screen.findByText('Áo thun Cotton Compact')).toBeTruthy()
    expect(screen.getByText('Quần short Kaki')).toBeTruthy()
    expect(screen.getByText('2 biến thể')).toBeTruthy()

    await user.click(screen.getByRole('tab', { name: 'Nháp' }))
    expect(screen.queryByText('Áo thun Cotton Compact')).toBeNull()
    expect(screen.getByText('Quần short Kaki')).toBeTruthy()

    await user.click(screen.getByRole('tab', { name: 'Tất cả' }))
    await user.click(screen.getByRole('button', { name: 'Ẩn' }))

    expect(await screen.findByText('Đã ẩn sản phẩm "Áo thun Cotton Compact".')).toBeTruthy()
    const hideCall = requests.find((r) => r.path === `/v1/seller/products/${PRODUCT_ID}/hide`)
    expect(JSON.parse(hideCall!.body)).toEqual({ version: 7 })
  })

  it('creates a multi-SKU product with image upload and weightGram (FR-PRD-001)', async () => {
    const submittedBodies: Array<Record<string, unknown>> = []
    let uploadContentType: string | null = null
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = requestOf(input, init)
      if (req.url.pathname === '/v1/categories') {
        return jsonResponse({ data: makeCategories() })
      }
      if (req.url.pathname === '/v1/seller/products/images' && req.method === 'POST') {
        uploadContentType = req.headers.get('Content-Type')
        return jsonResponse({ imageRef: `products/${SHOP_ID}/uploaded.png` }, 201)
      }
      if (req.url.pathname === '/v1/seller/products' && req.method === 'POST') {
        submittedBodies.push(JSON.parse(await req.bodyText) as Record<string, unknown>)
        return jsonResponse(makeProduct({ productId: 'new-prod-1', name: 'Áo sơ mi Linen' }), 201)
      }
      if (req.url.pathname === '/v1/seller/inventory') {
        return jsonResponse({ data: [], pagination: { page: 1, pageSize: 100, totalItems: 0, totalPages: 1 } })
      }
      return errorResponse(404, 'NOT_FOUND', 'Not found')
    })

    const user = userEvent.setup()
    renderAt('/seller/products/new', sellerRoutes)

    await screen.findByRole('option', { name: 'Thời trang > Áo' })
    await user.type(screen.getByLabelText('Tên sản phẩm'), 'Áo sơ mi Linen')
    await user.selectOptions(screen.getByLabelText('Danh mục lá'), CATEGORY_LEAF_ID)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const pngFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'shirt.png', { type: 'image/png' })
    await user.upload(fileInput, pngFile)
    expect(await screen.findByAltText('Áo sơ mi Linen 1')).toBeTruthy()
    expect(uploadContentType).not.toBe('application/json')

    await user.type(screen.getByLabelText('Mã SKU'), 'LINEN-TRANG-M')
    await user.type(screen.getByLabelText('Giá bán (₫)'), '250000')
    await user.clear(screen.getByLabelText('Khối lượng (gam)'))
    await user.type(screen.getByLabelText('Khối lượng (gam)'), '350')
    await user.type(screen.getByPlaceholderText('Giá trị (VD: Trắng)'), 'Trắng')

    await user.click(screen.getByRole('button', { name: 'Tạo sản phẩm' }))

    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/seller/products'))
    expect(submittedBodies).toHaveLength(1)
    expect(submittedBodies[0]).toMatchObject({
      name: 'Áo sơ mi Linen',
      categoryId: CATEGORY_LEAF_ID,
      status: 'ACTIVE',
      images: [`products/${SHOP_ID}/uploaded.png`],
      variants: [
        {
          sku: 'LINEN-TRANG-M',
          price: 250_000,
          weightGram: 350,
          initialStock: 10,
          attributes: { Màu: 'Trắng' },
        },
      ],
    })
  })

  it('handles 409 VERSION_CONFLICT on edit and reloads latest product version', async () => {
    let productGetCount = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = requestOf(input, init)
      if (req.url.pathname === '/v1/categories') return jsonResponse({ data: makeCategories() })
      if (req.url.pathname === `/v1/products/${PRODUCT_ID}` && req.method === 'GET') {
        productGetCount += 1
        return jsonResponse(makeProduct({ version: productGetCount === 1 ? 3 : 4, name: productGetCount === 1 ? 'Tên cũ' : 'Tên mới đồng bộ' }))
      }
      if (req.url.pathname === `/v1/products/${PRODUCT_ID}`) return errorResponse(404, 'NOT_FOUND', 'unused')
      if (req.url.pathname === `/v1/seller/products/${PRODUCT_ID}` && req.method === 'PUT') {
        const payload = JSON.parse(await req.bodyText) as { version?: number }
        if (payload.version === 3) {
          return errorResponse(409, 'VERSION_CONFLICT', 'Phiên bản sản phẩm đã thay đổi.')
        }
        return jsonResponse(makeProduct({ version: 5, name: 'Tên đã lưu' }))
      }
      if (req.url.pathname === '/v1/seller/inventory') {
        return jsonResponse({ data: [], pagination: { page: 1, pageSize: 100, totalItems: 0, totalPages: 1 } })
      }
      return errorResponse(404, 'NOT_FOUND', 'Not found')
    })

    const user = userEvent.setup()
    renderAt(`/seller/products/${PRODUCT_ID}/edit`, sellerRoutes)

    await waitFor(() => expect((screen.getByLabelText('Tên sản phẩm') as HTMLInputElement).value).toBe('Tên cũ'))
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    expect(await screen.findByText('Phiên bản sản phẩm đã thay đổi.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Tải lại sản phẩm mới nhất' }))

    await waitFor(() => expect((screen.getByLabelText('Tên sản phẩm') as HTMLInputElement).value).toBe('Tên mới đồng bộ'))
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/seller/products'))
  })
})
