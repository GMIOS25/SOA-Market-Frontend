import { createBrowserRouter } from 'react-router'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PortalPlaceholder } from '@/pages/PortalPlaceholder'

// 1 SPA – 3 vùng route (03-App-Flow.md §1). Layouts + RoleGuard được bổ sung ở T2-03.
export const router = createBrowserRouter([
  { path: '/', element: <PortalPlaceholder portal="buyer" /> },
  { path: '/seller/*', element: <PortalPlaceholder portal="seller" /> },
  { path: '/admin/*', element: <PortalPlaceholder portal="admin" /> },
  { path: '*', element: <NotFoundPage /> },
])
