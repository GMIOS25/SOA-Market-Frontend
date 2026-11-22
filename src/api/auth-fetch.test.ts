import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createUnsignedDevToken } from '@/lib/auth/dev-token'

const API = 'http://api.test'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  }
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const tokenA = createUnsignedDevToken({ userId: 'u-1', roles: ['BUYER'] })
const tokenB = createUnsignedDevToken({ userId: 'u-1', roles: ['BUYER', 'SELLER'], ttlSeconds: 7200 })

async function setup() {
  vi.resetModules()
  vi.stubEnv('VITE_API_BASE_URL', API)
  vi.stubGlobal('localStorage', memoryStorage())
  const fetchMock = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetchMock)
  const { sessionStore } = await import('@/lib/auth/session-store')
  const { authFetch, logout } = await import('./auth-fetch')
  sessionStore.signIn({ accessToken: tokenA, refreshToken: 'refresh-A' })
  return { fetchMock, sessionStore, authFetch, logout }
}

function authHeader(call: unknown[] | undefined): string | null {
  return (call?.[0] as Request).headers.get('Authorization')
}

describe('authFetch', () => {
  beforeEach(() => vi.useRealTimers())
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('attaches the Bearer access token', async () => {
    const { fetchMock, authFetch } = await setup()
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }))

    const res = await authFetch(new Request(`${API}/v1/cart`))

    expect(res.status).toBe(200)
    expect(authHeader(fetchMock.mock.calls[0])).toBe(`Bearer ${tokenA}`)
  })

  it('never sends Bearer to public /v1/auth/* endpoints', async () => {
    const { fetchMock, authFetch } = await setup()
    fetchMock.mockResolvedValueOnce(json(401, { code: 'INVALID_CREDENTIALS', message: 'x' }))

    const res = await authFetch(new Request(`${API}/v1/auth/login`, { method: 'POST', body: '{}' }))

    expect(res.status).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(authHeader(fetchMock.mock.calls[0])).toBeNull()
  })

  it('refreshes ONCE for concurrent 401s and retries each request with the new token', async () => {
    const { fetchMock, sessionStore, authFetch } = await setup()
    let refreshCalls = 0
    fetchMock.mockImplementation(async (input) => {
      const request = input as Request | string
      const url = typeof request === 'string' ? request : request.url
      if (url.endsWith('/v1/auth/token/refresh')) {
        refreshCalls++
        await new Promise((r) => setTimeout(r, 10))
        return json(200, { accessToken: tokenB, refreshToken: 'refresh-B' })
      }
      const auth = (request as Request).headers.get('Authorization')
      return auth === `Bearer ${tokenB}` ? json(200, { ok: true }) : json(401, { code: 'TOKEN_EXPIRED', message: 'x' })
    })

    const results = await Promise.all(
      ['/v1/cart', '/v1/orders', '/v1/users/me'].map((path) => authFetch(new Request(`${API}${path}`))),
    )

    expect(results.map((r) => r.status)).toEqual([200, 200, 200])
    expect(refreshCalls).toBe(1)
    expect(sessionStore.getSession()?.refreshToken).toBe('refresh-B')
    expect(sessionStore.getSession()?.roles).toEqual(['BUYER', 'SELLER'])
  })

  it('replays the original request body after refresh', async () => {
    const { fetchMock, authFetch } = await setup()
    const bodies: string[] = []
    fetchMock.mockImplementation(async (input) => {
      const request = input as Request | string
      if (typeof request === 'string') return json(200, { accessToken: tokenB, refreshToken: 'refresh-B' })
      bodies.push(await request.text())
      return request.headers.get('Authorization') === `Bearer ${tokenB}`
        ? json(201, {})
        : json(401, { code: 'TOKEN_EXPIRED', message: 'x' })
    })

    const res = await authFetch(new Request(`${API}/v1/cart/items`, { method: 'POST', body: '{"variantId":"v1"}' }))

    expect(res.status).toBe(201)
    expect(bodies).toEqual(['{"variantId":"v1"}', '{"variantId":"v1"}'])
  })

  it('ends the session as "expired" when the refresh token is rejected', async () => {
    const { fetchMock, sessionStore, authFetch } = await setup()
    fetchMock
      .mockResolvedValueOnce(json(401, { code: 'TOKEN_EXPIRED', message: 'x' }))
      .mockResolvedValueOnce(json(401, { code: 'REFRESH_TOKEN_REUSED', message: 'x' }))

    const res = await authFetch(new Request(`${API}/v1/orders`))

    expect(res.status).toBe(401)
    expect(sessionStore.getState()).toEqual({ session: null, endReason: 'expired' })
    expect(localStorage.getItem('soa-market.session')).toBeNull()
  })

  it('keeps the session when refresh fails because of the network', async () => {
    const { fetchMock, sessionStore, authFetch } = await setup()
    fetchMock
      .mockResolvedValueOnce(json(401, { code: 'TOKEN_EXPIRED', message: 'x' }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const res = await authFetch(new Request(`${API}/v1/orders`))

    expect(res.status).toBe(401)
    expect(sessionStore.getSession()?.refreshToken).toBe('refresh-A')
  })

  it('ends the session as "locked" on ACCOUNT_LOCKED without trying to refresh', async () => {
    const { fetchMock, sessionStore, authFetch } = await setup()
    fetchMock.mockResolvedValueOnce(json(403, { code: 'ACCOUNT_LOCKED', message: 'Tài khoản đã bị khóa' }))

    await authFetch(new Request(`${API}/v1/orders`))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sessionStore.getState().endReason).toBe('locked')
  })

  it('does not refresh on a plain 403 (missing role / IDOR)', async () => {
    const { fetchMock, sessionStore, authFetch } = await setup()
    fetchMock.mockResolvedValueOnce(json(403, { code: 'FORBIDDEN', message: 'x' }))

    const res = await authFetch(new Request(`${API}/v1/admin/users`))

    expect(res.status).toBe(403)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sessionStore.getSession()).not.toBeNull()
  })

  it('logout clears the local session even if the API is down', async () => {
    const { fetchMock, sessionStore, logout } = await setup()
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await logout({ allDevices: true })

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      refreshToken: 'refresh-A',
      allDevices: true,
    })
    expect(sessionStore.getState()).toEqual({ session: null, endReason: 'logout' })
  })
})
