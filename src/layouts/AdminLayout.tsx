import { ADMIN_NAV, navForRoles } from '@/app/navigation'
import { homePathFor } from '@/lib/auth/roles'
import { useSession } from '@/lib/auth/session-store'
import { OpsLayout } from './OpsLayout'

/** Cổng Quản trị – CSKH (`/admin/*`) — menu lọc theo vai trò (CS chỉ thấy Vận hành + CSKH). */
export function AdminLayout() {
  const roles = useSession()?.roles ?? []
  return <OpsLayout portal="admin" homePath={homePathFor(roles)} nav={navForRoles(ADMIN_NAV, roles)} />
}
