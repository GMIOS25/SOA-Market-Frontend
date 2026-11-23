/** 4 vai trò RBAC trong JWT claim / `UserSummary.roles` (01-PRD §3.1). Khách = không có phiên. */
export const ROLES = ['BUYER', 'SELLER', 'CS', 'ADMINISTRATOR'] as const
export type Role = (typeof ROLES)[number]

/** Vai trò được vào Cổng Quản trị – CSKH (`/admin/*`). */
export const OPS_ROLES = ['ADMINISTRATOR', 'CS'] as const satisfies readonly Role[]

type WithRoles = { roles?: readonly string[] | null } | null | undefined

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

/** Vai trò hợp lệ của user (chuẩn hóa chữ hoa, bỏ giá trị lạ). Chưa đăng nhập → `[]`. */
export function rolesOf(user: WithRoles): Role[] {
  return Array.isArray(user?.roles) ? user.roles.map((r) => r.toUpperCase()).filter(isRole) : []
}

export function hasRole(user: WithRoles, role: string): boolean {
  return rolesOf(user).includes(role.toUpperCase() as Role)
}

export function hasAnyRole(user: WithRoles, required: readonly Role[]): boolean {
  const roles = rolesOf(user)
  return required.some((r) => roles.includes(r))
}

/** Vai trò cao nhất để hiển thị (badge vai trò trên Topbar / menu tài khoản). */
export function primaryRole(user: WithRoles): Role {
  const roles = rolesOf(user)
  return (['ADMINISTRATOR', 'CS', 'SELLER', 'BUYER'] as const).find((r) => roles.includes(r)) ?? 'BUYER'
}

/** Trang chủ hợp lệ theo vai trò cao nhất — dùng cho nút "Về cổng của bạn" ở trang 403 và sau đăng nhập. */
export function homePathFor(user: WithRoles): string {
  if (hasRole(user, 'ADMINISTRATOR')) return '/admin'
  if (hasRole(user, 'CS')) return '/admin/complaints/queue'
  if (hasRole(user, 'SELLER')) return '/seller'
  return '/'
}
