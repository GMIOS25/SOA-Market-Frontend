// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: { apiBaseUrl: 'http://api.test', demoMode: false, mediaBaseUrl: 'http://media.test/public-products' },
}))

import { AdminCategoriesPage } from './pages/AdminCategoriesPage'
import { AdminProductModerationPage } from './pages/AdminProductModerationPage'
import {
  CATEGORY_LEAF_ID,
  CATEGORY_ROOT_ID,
  PRODUCT_ID,
  makeCategories,
  makeProduct,
  makeProductSummary,
} from './test-fixtures'
import { errorResponse, jsonResponse, renderAt, requestOf } from './test-utils'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AdminCategoriesPage & AdminProductModerationPage (T3-07)', () => {
  it('renders 2-level categories without L3 child creation and surfaces 409 CATEGORY_IN_USE', async () => {
    const categories = makeCategories()
    const createdBodies: Array<Record<string, unknown>> = []

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = requestOf(input, init)
      if (req.url.pathname === '/v1/admin/categories' && req.method === 'GET') {
        return jsonResponse({ data: categories })
      }
      if (req.url.pathname === '/v1/admin/categories' && req.method === 'POST') {
        const body = JSON.parse(await req.bodyText) as Record<string, unknown>
        createdBodies.push(body)
        return jsonResponse(
          {
            categoryId: '99999999-9999-4999-8999-999999999999',
            name: String(body.name),
            level: Number(body.level ?? 2),
            parentId: String(body.parentId ?? ''),
            sortOrder: Number(body.sortOrder ?? 0),
            status: 'VISIBLE',
            children: [],
          },
          201,
        )
      }
      if (req.url.pathname === `/v1/admin/categories/${CATEGORY_LEAF_ID}` && req.method === 'DELETE') {
        return errorResponse(409, 'CATEGORY_IN_USE', 'Không thể xóa danh mục vì vẫn còn sản phẩm.')
      }
      return errorResponse(404, 'NOT_FOUND', 'Not found')
    })

    const user = userEvent.setup()
    renderAt('/admin/categories', <Route path="/admin/categories" element={<AdminCategoriesPage />} />)

    expect(await screen.findByText('Thời trang')).toBeTruthy()
    expect(screen.getByText('Áo')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Thêm cấp 2' })).toHaveLength(2)

    await user.click(screen.getAllByRole('button', { name: 'Thêm cấp 2' })[0]!)
    await user.type(screen.getByLabelText('Tên danh mục'), 'Áo khoác')
    await user.click(screen.getByRole('button', { name: 'Lưu danh mục' }))

    expect(await screen.findByText('Đã tạo danh mục "Áo khoác".')).toBeTruthy()
    expect(createdBodies[0]).toMatchObject({
      name: 'Áo khoác',
      level: 2,
      parentId: CATEGORY_ROOT_ID,
    })

    const deleteButtons = screen.getAllByRole('button', { name: 'Xóa' })
    await user.click(deleteButtons[1]!)
    await user.click(screen.getByRole('button', { name: 'Xóa danh mục' }))
    expect(await screen.findByText('Không thể xóa danh mục vì vẫn còn sản phẩm.')).toBeTruthy()
  })

  it('approves queued product, rejects with AuditReasonDialog, and supports ACTIVE takedown (FR-PRD-009)', async () => {
    const decisions: Array<{ productId: string; body: Record<string, unknown> }> = []

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const req = requestOf(input, init)
      if (req.url.pathname === '/v1/admin/categories') {
        return jsonResponse({ data: makeCategories() })
      }
      if (req.url.pathname === '/v1/admin/products/review-queue') {
        return jsonResponse({
          data: [
            makeProduct({
              productId: 'queued-1',
              name: 'Sản phẩm chờ duyệt 1',
              status: 'PENDING_REVIEW',
              moderationReason: 'Chứa từ nhạy cảm cần kiểm tra',
              version: 2,
            }),
            makeProduct({
              productId: 'queued-2',
              name: 'Sản phẩm chờ duyệt 2',
              status: 'PENDING_REVIEW',
              version: 3,
            }),
          ],
          pagination: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
        })
      }
      if (req.url.pathname === '/v1/products' && req.method === 'GET') {
        return jsonResponse({
          data: [makeProductSummary({ productId: PRODUCT_ID, name: 'Áo thun đang bán' })],
          pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
        })
      }
      if (req.url.pathname === `/v1/products/${PRODUCT_ID}` && req.method === 'GET') {
        return jsonResponse(makeProduct({ productId: PRODUCT_ID, name: 'Áo thun đang bán', version: 9 }))
      }
      if (req.url.pathname.startsWith('/v1/admin/products/') && req.url.pathname.endsWith('/decision')) {
        const productId = req.url.pathname.split('/')[4]!
        const body = JSON.parse(await req.bodyText) as Record<string, unknown>
        decisions.push({ productId, body })
        return jsonResponse(
          makeProduct({
            productId,
            name: productId === 'queued-1' ? 'Sản phẩm chờ duyệt 1' : productId === 'queued-2' ? 'Sản phẩm chờ duyệt 2' : 'Áo thun đang bán',
          }),
        )
      }
      return errorResponse(404, 'NOT_FOUND', 'Not found')
    })

    const user = userEvent.setup()
    renderAt('/admin/moderation/products', <Route path="/admin/moderation/products" element={<AdminProductModerationPage />} />)

    expect(await screen.findByText('Sản phẩm chờ duyệt 1')).toBeTruthy()
    await user.click(screen.getAllByRole('button', { name: 'Phê duyệt' })[0]!)
    expect(await screen.findByText('Đã phê duyệt sản phẩm "Sản phẩm chờ duyệt 1".')).toBeTruthy()
    expect(decisions[0]).toEqual({ productId: 'queued-1', body: { decision: 'APPROVE', version: 2 } })

    await user.click(screen.getAllByRole('button', { name: 'Từ chối' })[1]!)
    await user.type(screen.getByLabelText(/^Lý do/), 'Hình ảnh mờ không đúng mô tả sản phẩm.')
    await user.click(screen.getByRole('button', { name: 'Xác nhận từ chối' }))

    await waitFor(() =>
      expect(decisions[1]).toEqual({
        productId: 'queued-2',
        body: { decision: 'REJECT', version: 3, reason: 'Hình ảnh mờ không đúng mô tả sản phẩm.' },
      }),
    )

    await user.click(screen.getByRole('tab', { name: 'Gỡ sản phẩm đang bán' }))
    expect(await screen.findByText('Áo thun đang bán')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Gỡ sản phẩm' }))
    await user.type(screen.getByLabelText(/^Lý do/), 'Sản phẩm vi phạm chính sách thương hiệu.')
    await user.click(screen.getByRole('button', { name: 'Xác nhận gỡ sản phẩm' }))

    await waitFor(() =>
      expect(decisions[2]).toEqual({
        productId: PRODUCT_ID,
        body: { decision: 'TAKEDOWN', version: 9, reason: 'Sản phẩm vi phạm chính sách thương hiệu.' },
      }),
    )
  })
})
