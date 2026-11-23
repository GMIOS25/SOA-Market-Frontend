import { ADMIN_NAV, navForRoles } from '@/app/navigation'
import { homePathFor, rolesOf } from '@/lib/auth/roles'
import { useAuthSession } from '@/lib/auth/session'
import { OpsLayout } from './OpsLayout'

/** Cổng Quản trị – CSKH (`/admin/*`) — menu lọc theo vai trò (CS chỉ thấy Vận hành + CSKH). */
export function AdminLayout() {
  const { user } = useAuthSession()
  return <OpsLayout portal="admin" homePath={homePathFor(user)} nav={navForRoles(ADMIN_NAV, rolesOf(user))} />
}
