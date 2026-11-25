// File tiện ích chỉ dùng cho test (không thuộc bản build): được phép xuất cả hàm lẫn component.
/* eslint-disable react-refresh/only-export-components */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter, Routes, useLocation } from 'react-router'
import { TooltipProvider } from '@/components/ui/tooltip'
import { formatVnd } from '@/lib/format'
import '@/lib/dayjs'
import '@/lib/i18n'

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Lỗi theo Huma Error Model của backend, kèm correlationId để test phần hiển thị mã tra cứu. */
export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: Array<{ field: string; reason: string }>,
): Response {
  return jsonResponse({ code, message, details: details ?? null, correlationId: 'corr-test-1' }, status)
}

/**
 * `formatVnd` đặt NBSP (U+00A0) trước `₫`, mà Testing Library chuẩn hóa khoảng trắng của node (NBSP → dấu cách)
 * trước khi so khớp, nên chuỗi mong đợi cũng phải chuẩn hóa cùng một kiểu.
 */
export function vndText(amount: number): string {
  return formatVnd(amount).replace(/\s/g, ' ')
}

export type SentRequest = {
  url: URL
  method: string
  headers: Headers
  /** Promise của body (chuỗi rỗng với GET). */
  bodyText: Promise<string>
}

/** Đọc request mà openapi-fetch / authFetch gửi đi (Request object hoặc URL + init). */
export function requestOf(input: RequestInfo | URL, init?: RequestInit): SentRequest {
  if (input instanceof Request) {
    return {
      url: new URL(input.url),
      method: input.method.toUpperCase(),
      headers: new Headers(input.headers),
      bodyText: input.clone().text(),
    }
  }
  return {
    url: new URL(String(input), 'http://localhost'),
    method: (init?.method ?? 'GET').toUpperCase(),
    headers: new Headers(init?.headers),
    bodyText: Promise.resolve(typeof init?.body === 'string' ? init.body : ''),
  }
}

/** Hiện URL hiện tại để test assert trạng thái nằm trên URL. */
export function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

function TestProviders({ children, path }: { children: ReactNode; path: string }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

/** Render một component đơn lẻ (không route) trong các provider của app. */
export function renderWithProviders(element: ReactElement) {
  return render(<TestProviders path="/">{element}</TestProviders>)
}

/** Render một trang theo URL, với `<Routes>`/`<Route>` do test khai báo (mẫu của cart-checkout-order). */
export function renderAt(path: string, routeTree: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>{routeTree}</Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  )
  return { ...view, queryClient }
}
