import { useSyncExternalStore } from 'react'
import type { SvcIdn } from '@/api/generated'

/*
 * Nguồn DUY NHẤT của phiên đăng nhập cho toàn SPA (layouts, guards, API client, mọi feature).
 * Chuyển từ features/auth-profile/session.ts (T1-06) lên lib/ ở T2-03; file cũ re-export lại để không vỡ import.
 *
 * Lưu ở localStorage để giữ đăng nhập khi tải lại trang & đồng bộ giữa các tab. Đánh đổi: XSS đọc được token
 * dễ hơn cookie HttpOnly — chấp nhận ở phạm vi đồ án, kèm CSP ở Nginx/Traefik.
 */

export type SessionUser = SvcIdn.components['schemas']['UserSummary']

export type AuthSessionState = {
  accessToken: string | null
  refreshToken: string | null
  user: SessionUser | null
  /** Thông điệp hiển thị trên /login khi phiên bị thu hồi do tài khoản bị khóa (FR-ACC-006). */
  lockNotice: string | null
}

export const AUTH_SESSION_STORAGE_KEY = 'soa_market_auth_session'

const EMPTY_STATE: AuthSessionState = {
  accessToken: null,
  refreshToken: null,
  user: null,
  lockNotice: null,
}

function getStorage(): Storage | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage
  } catch {
    return null
  }
}

function readStoredSession(): AuthSessionState {
  const raw = getStorage()?.getItem(AUTH_SESSION_STORAGE_KEY)
  if (!raw) return EMPTY_STATE
  try {
    const parsed = JSON.parse(raw) as Partial<AuthSessionState>
    return {
      accessToken: typeof parsed.accessToken === 'string' ? parsed.accessToken : null,
      refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : null,
      user: parsed.user ?? null,
      lockNotice: typeof parsed.lockNotice === 'string' ? parsed.lockNotice : null,
    }
  } catch {
    return EMPTY_STATE
  }
}

let currentState: AuthSessionState = readStoredSession()
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

function persistAndNotify(next: AuthSessionState) {
  currentState = next
  const storage = getStorage()
  if (storage) {
    if (!next.accessToken && !next.refreshToken && !next.user && !next.lockNotice) {
      storage.removeItem(AUTH_SESSION_STORAGE_KEY)
    } else {
      storage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(next))
    }
  }
  notify()
}

export function getAuthSession(): AuthSessionState {
  return currentState
}

export function subscribeAuthSession(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useAuthSession(): AuthSessionState {
  return useSyncExternalStore(subscribeAuthSession, getAuthSession, getAuthSession)
}

export function isAuthenticated(state: AuthSessionState = currentState): boolean {
  return Boolean(state.accessToken)
}

export function setAuthSession(payload: { accessToken: string; refreshToken: string; user?: SessionUser | null }) {
  persistAndNotify({
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: payload.user ?? currentState.user,
    lockNotice: null,
  })
}

export function updateSessionUser(user: SessionUser) {
  persistAndNotify({ ...currentState, user })
}

export function clearAuthSession() {
  persistAndNotify(EMPTY_STATE)
}

export function lockoutAuthSession(message = 'Tài khoản của bạn đã bị khóa bởi quản trị viên.') {
  persistAndNotify({ accessToken: null, refreshToken: null, user: null, lockNotice: message })
}

export function clearLockNotice() {
  if (!currentState.lockNotice) return
  persistAndNotify({ ...currentState, lockNotice: null })
}

/** Đọc lại storage khi tab khác vừa đăng nhập / refresh / đăng xuất. */
export function syncAuthSessionFromStorage() {
  const next = readStoredSession()
  if (
    next.accessToken === currentState.accessToken &&
    next.refreshToken === currentState.refreshToken &&
    next.lockNotice === currentState.lockNotice
  ) {
    return
  }
  currentState = next
  notify()
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === AUTH_SESSION_STORAGE_KEY || event.key === null) syncAuthSessionFromStorage()
  })
}

export { hasRole } from './roles'
