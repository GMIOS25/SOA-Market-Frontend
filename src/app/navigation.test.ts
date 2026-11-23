import { isValidElement } from 'react'
import { matchRoutes, type RouteObject } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ADMIN_NAV, SELLER_NAV, findActiveNav, navForRoles } from './navigation'
import { safeRedirect } from './redirects'
import { routes } from './router'
import { AdminIndexGate, RequireRole } from './guards'

const allItems = [...SELLER_NAV, ...ADMIN_NAV].flatMap((group) => group.items)

/** Vai trò của RequireRole sâu nhất bao quanh route khớp `path`. */
function guardRolesFor(path: string): readonly string[] | undefined {
  const matches = matchRoutes(routes, path) ?? []
  let roles: readonly string[] | undefined
  for (const { route } of matches as { route: RouteObject }[]) {
    let element = route.element
    // AdminIndexGate bọc RequireRole của Dashboard trong prop `dashboard`.
    if (isValidElement<{ dashboard?: unknown }>(element) && element.type === AdminIndexGate) {
      element = element.props.dashboard as typeof element
    }
    if (isValidElement<{ roles: readonly string[] }>(element) && element.type === RequireRole) {
      roles = element.props.roles
    }
  }
  return roles
}

describe('navigation ↔ router', () => {
  it.each(allItems.map((item) => [item.to, item] as const))('%s is a registered route guarded by its menu roles', (to, item) => {
    const matches = matchRoutes(routes, to) ?? []
    expect(matches.at(-1)?.route.path).not.toBe('*')
    expect(guardRolesFor(to)).toEqual(item.roles)
  })

  it('unknown paths fall through to 404', () => {
    expect(matchRoutes(routes, '/khong-ton-tai')?.at(-1)?.route.path).toBe('*')
  })
})

describe('navForRoles', () => {
  it('CS only sees Operations (orders, transactions, exceptions) and Support', () => {
    const groups = navForRoles(ADMIN_NAV, ['CS'])
    expect(groups.map((g) => g.id)).toEqual(['operations', 'support'])
    expect(groups.flatMap((g) => g.items.map((i) => i.id))).toEqual([
      'adminOrders',
      'adminTransactions',
      'adminExceptions',
      'adminComplaintsQueue',
    ])
  })

  it('admin menu stays within 2 levels and 4 groups (NFR-USA-006)', () => {
    expect(navForRoles(ADMIN_NAV, ['ADMINISTRATOR'])).toHaveLength(4)
  })
})

describe('findActiveNav', () => {
  it('matches detail pages to their section and the index only exactly', () => {
    expect(findActiveNav(SELLER_NAV, '/seller/orders/abc')?.item.id).toBe('sellerOrders')
    expect(findActiveNav(SELLER_NAV, '/seller')?.item.id).toBe('sellerDashboard')
    expect(findActiveNav(ADMIN_NAV, '/admin/complaints/queue')?.item.id).toBe('adminComplaintsQueue')
  })
})

describe('safeRedirect', () => {
  it.each([
    ['/account/orders?page=2', '/account/orders?page=2'],
    [null, '/'],
    ['https://evil.example', '/'],
    ['//evil.example', '/'],
    ['/\\evil.example', '/'],
  ])('%s → %s', (input, expected) => {
    expect(safeRedirect(input)).toBe(expected)
  })
})
