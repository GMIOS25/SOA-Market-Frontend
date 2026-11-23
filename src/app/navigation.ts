import {
  Activity,
  ArrowLeftRight,
  Boxes,
  ChartColumn,
  ClipboardList,
  FolderTree,
  Headset,
  LayoutDashboard,
  MessageSquareText,
  MessageSquareWarning,
  Package,
  PackageSearch,
  ScrollText,
  ShoppingBag,
  SlidersHorizontal,
  Star,
  Store,
  TriangleAlert,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type nav from '@/locales/vi/nav.json'
import type { Role } from '@/lib/auth/roles'

export type NavItemId = keyof typeof nav.items
export type NavGroupId = keyof typeof nav.groups

export type NavItem = {
  id: NavItemId
  to: string
  icon: LucideIcon
  /** Vai trò được thấy mục menu & vào route (03-App-Flow §1.3). */
  roles: readonly Role[]
  /** Chỉ active khi khớp chính xác (trang index). */
  end?: boolean
}

export type NavGroup = {
  id: NavGroupId
  items: NavItem[]
}

const SELLER = ['SELLER'] as const
const ADMIN = ['ADMINISTRATOR'] as const
const ADMIN_CS = ['ADMINISTRATOR', 'CS'] as const

/** Cổng Nhà bán — S1..S7. */
export const SELLER_NAV: NavGroup[] = [
  {
    id: 'shop',
    items: [
      { id: 'sellerDashboard', to: '/seller', icon: LayoutDashboard, roles: SELLER, end: true },
      { id: 'sellerShop', to: '/seller/shop', icon: Store, roles: SELLER },
      { id: 'sellerProducts', to: '/seller/products', icon: Package, roles: SELLER },
      { id: 'sellerInventory', to: '/seller/inventory', icon: Boxes, roles: SELLER },
      { id: 'sellerOrders', to: '/seller/orders', icon: ClipboardList, roles: SELLER },
      { id: 'sellerReviews', to: '/seller/reviews', icon: Star, roles: SELLER },
      { id: 'sellerComplaints', to: '/seller/complaints', icon: MessageSquareWarning, roles: SELLER },
    ],
  },
]

/** Cổng Quản trị – CSKH — 4 nhóm, 2 cấp menu (NFR-USA-006, Brief §5.1). */
export const ADMIN_NAV: NavGroup[] = [
  {
    id: 'operations',
    items: [
      { id: 'adminSellerApplications', to: '/admin/seller-applications', icon: UserCheck, roles: ADMIN },
      { id: 'adminOrders', to: '/admin/orders', icon: ShoppingBag, roles: ADMIN_CS },
      { id: 'adminTransactions', to: '/admin/transactions', icon: ArrowLeftRight, roles: ADMIN_CS },
      { id: 'adminExceptions', to: '/admin/exceptions', icon: TriangleAlert, roles: ADMIN_CS },
    ],
  },
  {
    id: 'catalog',
    items: [
      { id: 'adminCategories', to: '/admin/categories', icon: FolderTree, roles: ADMIN },
      { id: 'adminUsers', to: '/admin/users', icon: Users, roles: ADMIN },
      { id: 'adminShops', to: '/admin/shops', icon: Store, roles: ADMIN },
      { id: 'adminModerationProducts', to: '/admin/moderation/products', icon: PackageSearch, roles: ADMIN },
      { id: 'adminModerationReviews', to: '/admin/moderation/reviews', icon: MessageSquareText, roles: ADMIN },
    ],
  },
  {
    id: 'support',
    items: [{ id: 'adminComplaintsQueue', to: '/admin/complaints/queue', icon: Headset, roles: ADMIN_CS }],
  },
  {
    id: 'system',
    items: [
      { id: 'adminDashboard', to: '/admin', icon: ChartColumn, roles: ADMIN, end: true },
      { id: 'adminParams', to: '/admin/config/params', icon: SlidersHorizontal, roles: ADMIN },
      { id: 'adminAuditLogs', to: '/admin/audit-logs', icon: ScrollText, roles: ADMIN },
      { id: 'adminSystem', to: '/admin/system', icon: Activity, roles: ADMIN },
    ],
  },
]

/** Lọc menu theo vai trò; bỏ nhóm rỗng (CS chỉ thấy Vận hành + CSKH). */
export function navForRoles(groups: NavGroup[], roles: readonly Role[]): NavGroup[] {
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.roles.some((r) => roles.includes(r))) }))
    .filter((group) => group.items.length > 0)
}

/** Mục menu khớp đường dẫn hiện tại (khớp dài nhất) — cho breadcrumb. */
export function findActiveNav(groups: NavGroup[], pathname: string): { group: NavGroup; item: NavItem } | null {
  let best: { group: NavGroup; item: NavItem } | null = null
  for (const group of groups) {
    for (const item of group.items) {
      const matches = item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`)
      if (matches && (!best || item.to.length > best.item.to.length)) best = { group, item }
    }
  }
  return best
}
