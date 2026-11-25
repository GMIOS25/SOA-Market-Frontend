import { lazy, Suspense, useEffect, useRef } from 'react'
import { Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router'
import { loginPathFor } from '@/app/redirects'
import { TooltipProvider } from '@/components/ui/tooltip'
import { getAuthSession, subscribeAuthSession } from '@/lib/auth/session'
import { env } from '@/lib/env'
import { queryClient } from '@/lib/query-client'

const MockControlPanel = lazy(async () => ({
  default: (await import('@/features/payment-shipping/MockControlPanel')).MockControlPanel,
}))

/**
 * Phản ứng toàn cục khi phiên thay đổi:
 *  - Bị khóa (authFetch gọi lockoutAuthSession, kể cả đang ở trang công khai) → về /login?redirect=...,
 *    LoginPage hiện banner đỏ từ `lockNotice` (FR-ACC-006). Hết phiên thường do RequireAuth tự đưa về /login.
 *  - Đổi người dùng / đăng xuất → xóa cache TanStack Query để không lộ dữ liệu của phiên trước.
 */
function SessionWatcher() {
  const navigate = useNavigate()
  const location = useLocation()
  const locationRef = useRef(location)

  useEffect(() => {
    locationRef.current = location
  }, [location])

  useEffect(() => {
    let previous = getAuthSession()
    return subscribeAuthSession(() => {
      const next = getAuthSession()
      if (previous.user?.userId !== next.user?.userId || (previous.accessToken && !next.accessToken)) queryClient.clear()

      const lockedOut = Boolean(previous.accessToken) && !next.accessToken && Boolean(next.lockNotice)
      previous = next
      if (lockedOut && locationRef.current.pathname !== '/login') {
        void navigate(loginPathFor(locationRef.current), { replace: true })
      }
    })
  }, [navigate])

  return null
}

export function RootLayout() {
  return (
    <TooltipProvider delayDuration={300}>
      <SessionWatcher />
      <ScrollRestoration />
      <Outlet />
      {env.demoMode && <Suspense fallback={null}><MockControlPanel /></Suspense>}
    </TooltipProvider>
  )
}
