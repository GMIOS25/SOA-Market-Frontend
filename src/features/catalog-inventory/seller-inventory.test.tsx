// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: { apiBaseUrl: 'http://api.test', demoMode: false, mediaBaseUrl: 'http://media.test/public-products' },
}))

import type { SellerInventoryEntry } from './api'
import { SellerInventoryPage } from './pages/SellerInventoryPage'
import { PRODUCT_ID, WHITE_M_ID } from './test-fixtures'
import { errorResponse, jsonResponse, renderAt, requestOf, vndText } from './test-utils'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const inventoryRoute = <Route path="/seller/inventory" element={<SellerInventoryPage />} />

function makeEntry(overrides: Partial<SellerInventoryEntry> = {}): SellerInventoryEntry {
  return {
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
    version: 3,
    ...overrides,
  }
}

describe('SellerInventoryPage (T3-07)', () => {
  it('shows onHand/reserved/available, validates onHand >= reserved, and handles 409 reload (FR-PRD-007)', async () => {
    let currentEntry = makeEntry()
    let failConflictOnce = true
    const sentBodies: Array<Record<string, unknown>> = []

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = requestOf(input, init)
      if (req.url.pathname === '/v1/seller/inventory' && req.method === 'GET') {
        return jsonResponse({
          data: [currentEntry],
          pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
        })
      }
      if (req.url.pathname === `/v1/seller/variants/${WHITE_M_ID}/stock` && req.method === 'PUT') {
        const payload = JSON.parse(await req.bodyText) as { onHand: number; version: number; reason?: string }
        sentBodies.push(payload)
        if (failConflictOnce) {
          failConflictOnce = false
          currentEntry = makeEntry({ onHand: 18, reserved: 5, available: 13, version: 4 })
          return errorResponse(409, 'VERSION_CONFLICT', 'Phiên bản tồn kho đã thay đổi.')
        }
        currentEntry = makeEntry({ onHand: payload.onHand, reserved: 5, available: payload.onHand - 5, version: 5 })
        return jsonResponse({
          variantId: WHITE_M_ID,
          onHand: payload.onHand,
          reserved: 5,
          available: payload.onHand - 5,
          version: 5,
        })
      }
      return errorResponse(404, 'NOT_FOUND', 'Not found')
    })

    const user = userEvent.setup()
    renderAt('/seller/inventory', inventoryRoute)

    expect(await screen.findByText('Áo thun Cotton Compact')).toBeTruthy()
    expect(screen.getByText(vndText(120_000))).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Chỉnh tồn' }))

    const input = screen.getByLabelText('Tồn vật lý mới (onHand)') as HTMLInputElement
    await user.clear(input)
    await user.type(input, '3')
    await user.click(screen.getByRole('button', { name: 'Lưu tồn kho' }))
    expect(await screen.findByText('Tồn vật lý mới không được nhỏ hơn số đang giữ chỗ (5).')).toBeTruthy()

    await user.clear(input)
    await user.type(input, '25')
    await user.type(screen.getByLabelText('Lý do điều chỉnh (tùy chọn)'), 'Nhập thêm hàng')
    await user.click(screen.getByRole('button', { name: 'Lưu tồn kho' }))

    expect(await screen.findByText('Số liệu tồn kho vừa thay đổi (409). Vui lòng tải lại số liệu mới nhất.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Tải lại số liệu tồn kho' }))

    await waitFor(() => expect((screen.getByLabelText('Tồn vật lý mới (onHand)') as HTMLInputElement).value).toBe('18'))

    await user.clear(screen.getByLabelText('Tồn vật lý mới (onHand)'))
    await user.type(screen.getByLabelText('Tồn vật lý mới (onHand)'), '30')
    await user.click(screen.getByRole('button', { name: 'Lưu tồn kho' }))

    expect(await screen.findByText('Đã cập nhật tồn kho SKU AO-THUN-TRANG-M: khả dụng 25.')).toBeTruthy()
    expect(sentBodies.at(-1)).toEqual({ onHand: 30, version: 4, reason: 'Nhập thêm hàng' })
  })
})
