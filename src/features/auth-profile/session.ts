import { useSyncExternalStore } from 'react'
import type { SvcIdn } from '@/api/generated'

export type SessionUser = SvcIdn.components['schemas']['UserSummary']

export type AuthSessionState = {
  accessToken: string | null
  refreshToken: string | null
  user: SessionUser | null
  lockNotice: string | null
}

const STORAGE_KEY = 'soa_market_auth_session'

const EMPTY_STATE: AuthSessionState = {
  accessToken: null,
  refreshToken: null,
  user: null,
  lockNotice: null,
}

let currentState: AuthSessionState = readStoredSession()
const listeners = new Set<() => void>()

function readStoredSession(): AuthSessionState {
  if (typeof globalThis.localStorage === 'undefined') {
    return EMPTY_STATE
  }
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_STATE
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

function persistAndNotify(next: AuthSessionState) {
  currentState = next
  if (typeof globalThis.localStorage !== 'undefined') {
    if (!next.accessToken && !next.refreshToken && !next.user && !next.lockNotice) {
      globalThis.localStorage.removeItem(STORAGE_KEY)
    } else {
      globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    }
  }
  for (const listener of listeners) {
    listener()
  }
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

export function setAuthSession(payload: { accessToken: string; refreshToken: string; user?: SessionUser | null }) {
  persistAndNotify({
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: payload.user ?? currentState.user,
    lockNotice: null,
  })
}

export function updateSessionUser(user: SessionUser) {
  persistAndNotify({
    ...currentState,
    user,
  })
}

export function clearAuthSession() {
  persistAndNotify(EMPTY_STATE)
}

export function lockoutAuthSession(message = 'Tài khoản của bạn đã bị khóa bởi quản trị viên.') {
  persistAndNotify({
    accessToken: null,
    refreshToken: null,
    user: null,
    lockNotice: message,
  })
}

export function clearLockNotice() {
  if (!currentState.lockNotice) return
  persistAndNotify({
    ...currentState,
    lockNotice: null,
  })
}

export function hasRole(user: SessionUser | null | undefined, role: string): boolean {
  if (!user || !Array.isArray(user.roles)) return false
  const target = role.toUpperCase()
  return user.roles.some((r) => r.toUpperCase() === target)
}
