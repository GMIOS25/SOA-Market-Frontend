import { createBrowserRouter } from 'react-router'
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
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PortalPlaceholder } from '@/pages/PortalPlaceholder'

// 1 SPA – 3 vùng route (03-App-Flow.md §1). TV1 (auth-profile) gắn các route Phase 1 tại đây.
export const router = createBrowserRouter([
  { path: '/', element: <PortalPlaceholder portal="buyer" /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/verify-otp', element: <VerifyOtpPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/account/profile', element: <ProfilePage /> },
  { path: '/account/addresses', element: <AddressesPage /> },
  { path: '/seller/*', element: <PortalPlaceholder portal="seller" /> },
  { path: '/admin/users', element: <AdminUsersPage /> },
  { path: '/admin/*', element: <PortalPlaceholder portal="admin" /> },
  { path: '*', element: <NotFoundPage /> },
])
