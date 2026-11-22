import type { ReactElement, ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '@/lib/auth/session-store'
import { hasAnyRole, homePathFor, type Role } from '@/lib/auth/roles'
import { ForbiddenPage } from '@/pages/ForbiddenPage'
import { loginPathFor, safeRedirect } from './redirects'

/** Route cần đăng nhập: chưa có phiên → /login?redirect=<currentPath> (03-App-Flow §2). */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const session = useSession()
  const location = useLocation()
  if (!session) return <Navigate to={loginPathFor(location)} replace />
  return children ?? <Outlet />
}

/**
 * Route theo vai trò: chưa đăng nhập → /login; sai vai trò → trang 403 kèm nút về cổng hợp lệ.
 * Chỉ là lớp UX — backend vẫn tự kiểm tra RBAC & IDOR ở từng dịch vụ (SOA-R11).
 */
export function RequireRole({ roles, children }: { roles: readonly Role[]; children?: ReactNode }) {
  const session = useSession()
  const location = useLocation()
  if (!session) return <Navigate to={loginPathFor(location)} replace />
  if (!hasAnyRole(session.roles, roles)) return <ForbiddenPage />
  return children ?? <Outlet />
}

/** Trang chỉ dành cho khách (login/register): đã đăng nhập → về `redirect` hoặc trang chủ. */
export function GuestOnly({ children }: { children?: ReactNode }) {
  const session = useSession()
  const location = useLocation()
  if (session) return <Navigate to={safeRedirect(new URLSearchParams(location.search).get('redirect'))} replace />
  return children ?? <Outlet />
}

/** `/admin`: Quản trị viên thấy Dashboard; CSKH không có Dashboard → chuyển thẳng tới hàng chờ khiếu nại. */
export function AdminIndexGate({ dashboard }: { dashboard: ReactElement }) {
  const roles = useSession()?.roles ?? []
  return roles.includes('ADMINISTRATOR') ? dashboard : <Navigate to={homePathFor(roles)} replace />
}
