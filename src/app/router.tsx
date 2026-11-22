import type { ReactElement } from 'react'
import type { RouteObject } from 'react-router'
import { AdminLayout } from '@/layouts/AdminLayout'
import { BuyerLayout } from '@/layouts/BuyerLayout'
import { RootLayout } from '@/layouts/RootLayout'
import { SellerLayout } from '@/layouts/SellerLayout'
import { OPS_ROLES } from '@/lib/auth/roles'
import { ComingSoonPage, type NavTitleKey } from '@/pages/ComingSoonPage'
import { LoginPlaceholderPage } from '@/pages/LoginPlaceholderPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { AdminIndexGate, GuestOnly, RequireAuth, RequireRole } from './guards'
import { ADMIN_NAV, SELLER_NAV, type NavGroup, type NavItemId } from './navigation'

/*
 * Bản đồ route đầy đủ của 03-App-Flow §1 (B1–B16, S1–S7, A1–A13).
 * Mỗi thành viên thay `soon(...)` bằng màn hình thật trong src/features/<module>/ theo mã task.
 */

const soon = (title: NavTitleKey, task: string) => <ComingSoonPage title={title} task={task} />

/**
 * Route của Seller/Admin sinh từ cấu hình menu: `roles` của mục menu chính là route guard,
 * nên menu và quyền truy cập không thể lệch nhau. Record bắt buộc khai báo màn hình cho mọi mục menu.
 */
function routesFromNav(base: string, groups: NavGroup[], pages: Partial<Record<NavItemId, ReactElement>>) {
  return groups
    .flatMap((group) => group.items)
    .map((item): RouteObject => {
      const page = pages[item.id]
      if (!page) throw new Error(`router: mục menu "${item.id}" (${item.to}) chưa khai báo màn hình`)
      const element = <RequireRole roles={item.roles}>{page}</RequireRole>
      return item.to === base ? { index: true, element } : { path: item.to.slice(base.length + 1), element }
    })
}

const SELLER_PAGES: Partial<Record<NavItemId, ReactElement>> = {
  sellerDashboard: soon('items.sellerDashboard', 'T1-11'),
  sellerShop: soon('items.sellerShop', 'T2-07'),
  sellerProducts: soon('items.sellerProducts', 'T3-07'),
  sellerInventory: soon('items.sellerInventory', 'T3-07'),
  sellerOrders: soon('items.sellerOrders', 'T4-08'),
  sellerReviews: soon('items.sellerReviews', 'T2-11'),
  sellerComplaints: soon('items.sellerComplaints', 'T4-11'),
}

const ADMIN_PAGES: Partial<Record<NavItemId, ReactElement>> = {
  adminDashboard: soon('items.adminDashboard', 'T1-11'),
  adminSellerApplications: soon('items.adminSellerApplications', 'T2-06'),
  adminOrders: soon('items.adminOrders', 'T1-11'),
  adminTransactions: soon('items.adminTransactions', 'T1-11'),
  adminExceptions: soon('items.adminExceptions', 'T5-09'),
  adminCategories: soon('items.adminCategories', 'T3-07'),
  adminUsers: soon('items.adminUsers', 'T1-06'),
  adminShops: soon('items.adminShops', 'T2-07'),
  adminModerationProducts: soon('items.adminModerationProducts', 'T3-07'),
  adminModerationReviews: soon('items.adminModerationReviews', 'T2-11'),
  adminComplaintsQueue: soon('items.adminComplaintsQueue', 'T4-12'),
  adminParams: soon('items.adminParams', 'T1-11'),
  adminAuditLogs: soon('items.adminAuditLogs', 'T1-11'),
  adminSystem: soon('items.adminSystem', 'T1-11'),
}

const adminRoutes = routesFromNav('/admin', ADMIN_NAV, ADMIN_PAGES).map((route) =>
  route.index ? { index: true, element: <AdminIndexGate dashboard={route.element as ReactElement} /> } : route,
)

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      // ---------- Cổng Người mua & Khách (B1–B16) ----------
      {
        element: <BuyerLayout />,
        children: [
          { index: true, element: soon('pages.home', 'T3-06') },
          { path: 'products', element: soon('pages.products', 'T3-06') },
          { path: 'products/:id', element: soon('pages.productDetail', 'T3-06') },
          { path: 'shops/:id', element: soon('pages.shop', 'T2-07') },

          {
            element: <GuestOnly />,
            children: [
              { path: 'login', element: <LoginPlaceholderPage /> },
              { path: 'register', element: soon('pages.register', 'T1-06') },
              { path: 'verify-otp', element: soon('pages.verifyOtp', 'T1-06') },
              { path: 'forgot-password', element: soon('pages.forgotPassword', 'T1-06') },
              { path: 'reset-password', element: soon('pages.resetPassword', 'T1-06') },
            ],
          },

          {
            element: <RequireAuth />,
            children: [
              { path: 'account/profile', element: soon('pages.profile', 'T1-06') },
              { path: 'account/addresses', element: soon('pages.addresses', 'T1-06') },
              { path: 'account/notifications', element: soon('pages.notifications', 'T3-10') },
            ],
          },

          {
            // Không có giỏ hàng khách vãng lai (ASM-09): giỏ & đơn yêu cầu vai trò BUYER.
            element: <RequireRole roles={['BUYER']} />,
            children: [
              { path: 'cart', element: soon('pages.cart', 'T4-06') },
              { path: 'checkout', element: soon('pages.checkout', 'T4-06') },
              { path: 'checkout/result', element: soon('pages.checkoutResult', 'T5-08') },
              { path: 'account/orders', element: soon('pages.orders', 'T4-07') },
              { path: 'account/orders/:id', element: soon('pages.orderDetail', 'T4-07') },
              { path: 'account/reviews', element: soon('pages.reviews', 'T2-11') },
              { path: 'account/complaints', element: soon('pages.complaints', 'T4-11') },
              { path: 'account/complaints/:id', element: soon('pages.complaintDetail', 'T4-11') },
              { path: 'seller-onboarding', element: soon('pages.sellerOnboarding', 'T2-06') },
            ],
          },
        ],
      },

      // ---------- Cổng Nhà bán (S1–S7) ----------
      {
        path: 'seller',
        element: (
          <RequireRole roles={['SELLER']}>
            <SellerLayout />
          </RequireRole>
        ),
        children: [
          ...routesFromNav('/seller', SELLER_NAV, SELLER_PAGES),
          { path: 'products/new', element: soon('pages.sellerProductNew', 'T3-07') },
          { path: 'products/:id/edit', element: soon('pages.sellerProductEdit', 'T3-07') },
          { path: 'orders/:id', element: soon('pages.sellerOrderDetail', 'T4-08') },
          { path: 'complaints/:id', element: soon('pages.sellerComplaintDetail', 'T4-11') },
        ],
      },

      // ---------- Cổng Quản trị – CSKH (A1–A13) ----------
      {
        path: 'admin',
        element: (
          <RequireRole roles={OPS_ROLES}>
            <AdminLayout />
          </RequireRole>
        ),
        children: [
          ...adminRoutes,
          {
            path: 'complaints/:id',
            element: <RequireRole roles={OPS_ROLES}>{soon('pages.adminComplaintDetail', 'T4-12')}</RequireRole>,
          },
        ],
      },

      // Preview 6 component dùng chung (T2-04) — chỉ ở `npm run dev`, bị loại khỏi bản build production.
      ...(import.meta.env.DEV
        ? [
            {
              path: 'dev/components',
              lazy: async () => ({
                Component: (await import('@/pages/dev/ComponentsPreviewPage')).ComponentsPreviewPage,
              }),
            } satisfies RouteObject,
          ]
        : []),

      {
        element: <BuyerLayout />,
        children: [{ path: '*', element: <NotFoundPage /> }],
      },
    ],
  },
]
