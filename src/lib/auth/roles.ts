/** 4 vai trò RBAC trong JWT claim `roles` (01-PRD §3.1). Guest = không có phiên. */
export const ROLES = ['BUYER', 'SELLER', 'CS', 'ADMINISTRATOR'] as const
export type Role = (typeof ROLES)[number]

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export function hasAnyRole(userRoles: readonly Role[], required: readonly Role[]): boolean {
  return required.some((role) => userRoles.includes(role))
}

/** Vai trò được vào cổng Quản trị – CSKH. */
export const OPS_ROLES = ['ADMINISTRATOR', 'CS'] as const satisfies readonly Role[]

/** Vai trò cao nhất để hiển thị (Role badge trên Topbar / menu tài khoản). */
export function primaryRole(roles: readonly Role[]): Role {
  return (['ADMINISTRATOR', 'CS', 'SELLER', 'BUYER'] as const).find((r) => roles.includes(r)) ?? 'BUYER'
}

/** Trang chủ hợp lệ theo vai trò cao nhất — dùng cho nút "Về cổng của bạn" ở trang 403. */
export function homePathFor(roles: readonly Role[]): string {
  if (roles.includes('ADMINISTRATOR')) return '/admin'
  if (roles.includes('CS')) return '/admin/complaints/queue'
  if (roles.includes('SELLER')) return '/seller'
  return '/'
}
