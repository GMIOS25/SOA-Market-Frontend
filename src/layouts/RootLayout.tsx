import { useEffect, useRef } from 'react'
import { Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router'
import { loginPathFor } from '@/app/redirects'
import { TooltipProvider } from '@/components/ui/tooltip'
import { sessionStore } from '@/lib/auth/session-store'
import { queryClient } from '@/lib/query-client'

/**
 * Phản ứng toàn cục khi phiên thay đổi:
 *  - Bị khóa / hết hạn (từ authFetch, kể cả đang ở trang công khai) → về /login?redirect=... kèm banner (FR-ACC-006).
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
    let previous = sessionStore.getState()
    return sessionStore.subscribe(() => {
      const next = sessionStore.getState()
      if (previous.session?.userId !== next.session?.userId) queryClient.clear()

      const forcedOut = previous.session && !next.session && (next.endReason === 'locked' || next.endReason === 'expired')
      previous = next
      if (forcedOut && locationRef.current.pathname !== '/login') {
        navigate(loginPathFor(locationRef.current), { replace: true })
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
    </TooltipProvider>
  )
}
