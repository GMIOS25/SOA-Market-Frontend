/** `/login?redirect=<currentPath>` — dùng cho route guard & khi phiên bị thu hồi (03-App-Flow §2). */
export function loginPathFor(location: { pathname: string; search: string }): string {
  return `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`
}

/** Chỉ cho phép redirect nội bộ — chặn open redirect kiểu `?redirect=//evil.com` hoặc `https://...`. */
export function safeRedirect(target: string | null): string {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return '/'
  return target
}
