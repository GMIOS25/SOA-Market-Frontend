import { renderToString } from 'react-dom/server'
import { StaticRouterProvider, createStaticHandler, createStaticRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import '@/lib/i18n'
import type { Role } from '@/lib/auth/roles'
import { clearAuthSession, lockoutAuthSession, setAuthSession } from '@/lib/auth/session'
import { routes } from './router'

/** Smoke test: render thật từng cổng theo vai trò để bắt lỗi runtime của layout/guard. */
async function render(path: string, roles?: Role[]): Promise<string> {
  if (roles) {
    setAuthSession({
      accessToken: 'access-test',
      refreshToken: 'r',
      user: { userId: 'u-test', email: 'test@soa.vn', fullName: 'Test', phone: '', createdAt: '', status: 'ACTIVE', roles },
    })
  }
  const handler = createStaticHandler(routes)
  const context = await handler.query(new Request(`http://localhost${path}`))
  if (context instanceof Response) throw new Error(`unexpected redirect ${context.status}`)
  const router = createStaticRouter(handler.dataRoutes, context)
  return renderToString(<StaticRouterProvider router={router} context={context} hydrate={false} />)
}

const FORBIDDEN = 'Không có quyền truy cập'

describe('portal rendering by role', () => {
  afterEach(() => clearAuthSession())

  it('guest sees the buyer shell with login/register', async () => {
    const html = await render('/')
    expect(html).toContain('Tìm kiếm sản phẩm')
    expect(html).toContain('Đăng nhập')
    expect(html).toContain('T3-06')
  })

  it('guest is not shown protected content', async () => {
    const html = await render('/account/orders')
    expect(html).not.toContain('Đơn hàng của tôi')
  })

  it('buyer without SELLER gets 403 on the seller portal', async () => {
    expect(await render('/seller', ['BUYER'])).toContain(FORBIDDEN)
  })

  it('buyer can open the cart (BUYER-only route)', async () => {
    const html = await render('/cart', ['BUYER'])
    expect(html).toContain('Giỏ hàng')
    expect(html).not.toContain(FORBIDDEN)
  })

  it('seller gets the seller workspace with breadcrumb and portal switch', async () => {
    const html = await render('/seller/orders/so-1', ['BUYER', 'SELLER'])
    expect(html).toContain('Kênh Người bán')
    expect(html).toContain('Về sàn mua sắm')
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('T4-08')
  })

  it('CS can open orders but not admin-only pages, and never sees admin-only menu items', async () => {
    const orders = await render('/admin/orders', ['CS'])
    expect(orders).not.toContain(FORBIDDEN)
    expect(orders).toContain('Hàng chờ khiếu nại')
    expect(orders).not.toContain('Tham số nghiệp vụ')

    expect(await render('/admin/users', ['CS'])).toContain(FORBIDDEN)
  })

  it('administrator sees all 4 admin menu groups', async () => {
    const html = await render('/admin/system', ['ADMINISTRATOR'])
    for (const group of ['Vận hành', 'Danh mục &amp; Kiểm duyệt', 'CSKH', 'Báo cáo &amp; Hệ thống']) {
      expect(html).toContain(group)
    }
  })

  it('login page explains a forced logout because the account was locked', async () => {
    lockoutAuthSession('Tài khoản của bạn đã bị khóa bởi quản trị viên.')
    expect(await render('/login')).toContain('Tài khoản của bạn đã bị khóa bởi quản trị viên')
  })

  it('unknown route renders 404 inside the buyer shell', async () => {
    expect(await render('/khong-ton-tai')).toContain('Không tìm thấy trang')
  })
})
