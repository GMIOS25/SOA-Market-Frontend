import { useSyncExternalStore } from 'react'
import type { TokenPair } from '@/api/auth-contract'
import { decodeAccessToken } from './jwt'
import type { Role } from './roles'

export type Session = TokenPair & {
  userId: string
  roles: Role[]
}

/** Vì sao phiên kết thúc — trang /login dùng để hiện banner phù hợp (03-App-Flow §2). */
export type SessionEndReason = 'logout' | 'expired' | 'locked'

export type SessionState = {
  session: Session | null
  endReason: SessionEndReason | null
}

/**
 * Lưu cặp token ở localStorage để giữ đăng nhập khi tải lại trang & đồng bộ giữa các tab.
 * Đánh đổi: dễ bị XSS đọc trộm hơn cookie HttpOnly — chấp nhận ở phạm vi đồ án, cùng với CSP của Nginx/Traefik.
 */
const STORAGE_KEY = 'soa-market.session'

function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function toSession(tokens: TokenPair): Session | null {
  const claims = decodeAccessToken(tokens.accessToken)
  return claims ? { ...tokens, userId: claims.userId, roles: claims.roles } : null
}

function readPersisted(): Session | null {
  const raw = getStorage()?.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<TokenPair>
    if (typeof parsed.accessToken !== 'string' || typeof parsed.refreshToken !== 'string') return null
    return toSession({ accessToken: parsed.accessToken, refreshToken: parsed.refreshToken })
  } catch {
    return null
  }
}

let state: SessionState = { session: readPersisted(), endReason: null }
const listeners = new Set<() => void>()

function setState(next: SessionState) {
  state = next
  listeners.forEach((listener) => listener())
}

export const sessionStore = {
  getState: (): SessionState => state,
  getSession: (): Session | null => state.session,

  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  /** Gọi sau login hoặc refresh thành công. Trả về false nếu access token không đọc được. */
  signIn(tokens: TokenPair): boolean {
    const session = toSession(tokens)
    if (!session) return false
    getStorage()?.setItem(STORAGE_KEY, JSON.stringify(tokens))
    setState({ session, endReason: null })
    return true
  },

  end(reason: SessionEndReason) {
    getStorage()?.removeItem(STORAGE_KEY)
    setState({ session: null, endReason: reason })
  },

  /** Đọc lại từ storage (tab khác vừa refresh/đăng xuất). */
  syncFromStorage() {
    const session = readPersisted()
    if (session?.accessToken === state.session?.accessToken) return
    setState({ session, endReason: session ? null : state.session ? 'logout' : state.endReason })
  },

  /** Banner trên /login đã hiển thị xong. */
  clearEndReason() {
    if (state.endReason) setState({ ...state, endReason: null })
  },
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) sessionStore.syncFromStorage()
  })
}

export function useSessionState(): SessionState {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getState, sessionStore.getState)
}

export function useSession(): Session | null {
  return useSessionState().session
}
