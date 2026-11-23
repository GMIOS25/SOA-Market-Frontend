import type { ReactElement, ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { hasAnyRole, hasRole, homePathFor, type Role } from '@/lib/auth/roles'
import { useAuthSession } from '@/lib/auth/session'
import { ForbiddenPage } from '@/pages/ForbiddenPage'
import { loginPathFor } from './redirects'

/** Route cần đăng nhập: chưa có phiên → /login?redirect=<currentPath> (03-App-Flow §2). */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { accessToken } = useAuthSession()
  const location = useLocation()
  if (!accessToken) return <Navigate to={loginPathFor(location)} replace />
  return children ?? <Outlet />
}

/**
 * Route theo vai trò: chưa đăng nhập → /login; sai vai trò → trang 403 kèm nút về cổng hợp lệ.
 * Chỉ là lớp UX — backend vẫn tự kiểm tra RBAC & IDOR ở từng dịch vụ (SOA-R11).
 */
export function RequireRole({ roles, children }: { roles: readonly Role[]; children?: ReactNode }) {
  const { accessToken, user } = useAuthSession()
  const location = useLocation()
  if (!accessToken) return <Navigate to={loginPathFor(location)} replace />
  if (!hasAnyRole(user, roles)) return <ForbiddenPage />
  return children ?? <Outlet />
}

/** `/admin`: Quản trị viên thấy Dashboard; CSKH không có Dashboard → chuyển thẳng tới hàng chờ khiếu nại. */
export function AdminIndexGate({ dashboard }: { dashboard: ReactElement }) {
  const { user } = useAuthSession()
  return hasRole(user, 'ADMINISTRATOR') ? dashboard : <Navigate to={homePathFor(user)} replace />
}
