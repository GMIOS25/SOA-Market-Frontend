import type { ReactElement } from 'react'
import type { RouteObject } from 'react-router'
import {
  AddressesPage,
  AdminUsersPage,
  ForgotPasswordPage,
  LoginPage,
  ProfilePage,
  RegisterPage,
  ResetPasswordPage,
  VerifyOtpPage,
} from '@/features/auth-profile'
import {
  BuyerOrderDetailPage,
  BuyerOrdersPage,
  CartPage,
  CheckoutPage,
  SellerOrderDetailPage,
  SellerOrdersPage,
} from '@/features/cart-checkout-order'
import { CheckoutResultPage } from '@/features/payment-shipping/CheckoutResultPage'
import { AdminComplaintsQueuePage, AdminComplaintWorkspacePage } from '@/features/complaints'
import { AdminSellerApplicationsPage, SellerOnboardingPage } from '@/features/seller-shop'
import { AdminLayout } from '@/layouts/AdminLayout'
import { BuyerLayout } from '@/layouts/BuyerLayout'
import { RootLayout } from '@/layouts/RootLayout'
import { SellerLayout } from '@/layouts/SellerLayout'
import { OPS_ROLES } from '@/lib/auth/roles'
import { ComingSoonPage, type NavTitleKey } from '@/pages/ComingSoonPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { AdminIndexGate, RequireAuth, RequireRole } from './guards'
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
  sellerOrders: <SellerOrdersPage />,
  sellerReviews: soon('items.sellerReviews', 'T2-11'),
  sellerComplaints: soon('items.sellerComplaints', 'T4-11'),
}

const ADMIN_PAGES: Partial<Record<NavItemId, ReactElement>> = {
  adminDashboard: soon('items.adminDashboard', 'T1-11'),
  adminSellerApplications: <AdminSellerApplicationsPage />,
  adminOrders: soon('items.adminOrders', 'T1-11'),
  adminTransactions: soon('items.adminTransactions', 'T1-11'),
  adminExceptions: soon('items.adminExceptions', 'T5-09'),
  adminCategories: soon('items.adminCategories', 'T3-07'),
  adminUsers: <AdminUsersPage />,
  adminShops: soon('items.adminShops', 'T2-07'),
  adminModerationProducts: soon('items.adminModerationProducts', 'T3-07'),
  adminModerationReviews: soon('items.adminModerationReviews', 'T2-11'),
  adminComplaintsQueue: <AdminComplaintsQueuePage />,
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

          // Cụm xác thực (T1-06) — LoginPage tự điều hướng sau khi đăng nhập nên không bọc guard "chỉ cho khách".
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
          { path: 'verify-otp', element: <VerifyOtpPage /> },
          { path: 'forgot-password', element: <ForgotPasswordPage /> },
          { path: 'reset-password', element: <ResetPasswordPage /> },

          {
            element: <RequireAuth />,
            children: [
              { path: 'account/profile', element: <ProfilePage /> },
              { path: 'account/addresses', element: <AddressesPage /> },
              { path: 'account/notifications', element: soon('pages.notifications', 'T3-10') },
            ],
          },

          {
            // Không có giỏ hàng khách vãng lai (ASM-09): giỏ & đơn yêu cầu vai trò BUYER.
            element: <RequireRole roles={['BUYER']} />,
            children: [
              { path: 'cart', element: <CartPage /> },
              { path: 'checkout', element: <CheckoutPage /> },
              { path: 'checkout/result', element: <CheckoutResultPage /> },
              { path: 'account/orders', element: <BuyerOrdersPage /> },
              { path: 'account/orders/:id', element: <BuyerOrderDetailPage /> },
              { path: 'account/reviews', element: soon('pages.reviews', 'T2-11') },
              { path: 'account/complaints', element: soon('pages.complaints', 'T4-11') },
              { path: 'account/complaints/:id', element: soon('pages.complaintDetail', 'T4-11') },
              { path: 'seller-onboarding', element: <SellerOnboardingPage /> },
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
          { path: 'orders/:id', element: <SellerOrderDetailPage /> },
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
            element: (
              <RequireRole roles={OPS_ROLES}>
                <AdminComplaintWorkspacePage />
              </RequireRole>
            ),
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
