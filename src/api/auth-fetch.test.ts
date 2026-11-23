import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

const tokenA = 'access-A'
const tokenB = 'access-B'
const STORAGE_KEY = 'soa_market_auth_session'

function user(roles: string[]) {
  return { userId: 'u-1', email: 'a@b.vn', fullName: 'A', phone: '0900000000', createdAt: '', status: 'ACTIVE', roles }
}

async function setup() {
  vi.resetModules()
  vi.stubEnv('VITE_API_BASE_URL', API)
  vi.stubGlobal('localStorage', memoryStorage())
  const fetchMock = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetchMock)
  const session = await import('@/lib/auth/session')
  const { authFetch, logout } = await import('./auth-fetch')
  session.setAuthSession({ accessToken: tokenA, refreshToken: 'refresh-A', user: user(['BUYER']) })
  return { fetchMock, session, authFetch, logout }
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
    const { fetchMock, session, authFetch } = await setup()
    let refreshCalls = 0
    fetchMock.mockImplementation(async (input) => {
      const request = input as Request | string
      const url = typeof request === 'string' ? request : request.url
      if (url.endsWith('/v1/auth/token/refresh')) {
        refreshCalls++
        await new Promise((r) => setTimeout(r, 10))
        return json(200, { accessToken: tokenB, refreshToken: 'refresh-B', user: user(['BUYER', 'SELLER']) })
      }
      const auth = (request as Request).headers.get('Authorization')
      return auth === `Bearer ${tokenB}` ? json(200, { ok: true }) : json(401, { code: 'TOKEN_EXPIRED', message: 'x' })
    })

    const results = await Promise.all(
      ['/v1/cart', '/v1/orders', '/v1/users/me'].map((path) => authFetch(new Request(`${API}${path}`))),
    )

    expect(results.map((r) => r.status)).toEqual([200, 200, 200])
    expect(refreshCalls).toBe(1)
    expect(session.getAuthSession().refreshToken).toBe('refresh-B')
    expect(session.getAuthSession().user?.roles).toEqual(['BUYER', 'SELLER'])
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

  it('clears the session when the refresh token is rejected', async () => {
    const { fetchMock, session, authFetch } = await setup()
    fetchMock
      .mockResolvedValueOnce(json(401, { code: 'TOKEN_EXPIRED', message: 'x' }))
      .mockResolvedValueOnce(json(401, { code: 'REFRESH_TOKEN_REUSED', message: 'x' }))

    const res = await authFetch(new Request(`${API}/v1/orders`))

    expect(res.status).toBe(401)
    expect(session.getAuthSession()).toEqual({ accessToken: null, refreshToken: null, user: null, lockNotice: null })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('keeps the session when refresh fails because of the network', async () => {
    const { fetchMock, session, authFetch } = await setup()
    fetchMock
      .mockResolvedValueOnce(json(401, { code: 'TOKEN_EXPIRED', message: 'x' }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const res = await authFetch(new Request(`${API}/v1/orders`))

    expect(res.status).toBe(401)
    expect(session.getAuthSession().refreshToken).toBe('refresh-A')
  })

  it('revokes the session with a lock notice on ACCOUNT_LOCKED without trying to refresh', async () => {
    const { fetchMock, session, authFetch } = await setup()
    fetchMock.mockResolvedValueOnce(json(403, { code: 'ACCOUNT_LOCKED', message: 'Tài khoản đã bị khóa' }))

    await authFetch(new Request(`${API}/v1/orders`))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(session.getAuthSession().accessToken).toBeNull()
    expect(session.getAuthSession().lockNotice).toBe('Tài khoản đã bị khóa')
  })

  it('does not refresh on a plain 403 (missing role / IDOR)', async () => {
    const { fetchMock, session, authFetch } = await setup()
    fetchMock.mockResolvedValueOnce(json(403, { code: 'FORBIDDEN', message: 'x' }))

    const res = await authFetch(new Request(`${API}/v1/admin/users`))

    expect(res.status).toBe(403)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(session.getAuthSession().accessToken).toBe(tokenA)
  })

  it('logout clears the local session even if the API is down', async () => {
    const { fetchMock, session, logout } = await setup()
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await logout({ allDevices: true })

    const sent = fetchMock.mock.calls[0]?.[0] as Request
    expect(sent.url).toBe(`${API}/v1/auth/logout`)
    expect(sent.headers.get('Authorization')).toBe(`Bearer ${tokenA}`)
    expect(await sent.json()).toEqual({ refreshToken: 'refresh-A', allDevices: true })
    expect(session.getAuthSession().accessToken).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
