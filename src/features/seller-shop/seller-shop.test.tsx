// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({ env: { apiBaseUrl: 'http://api.test', demoMode: false } }))

import '@/lib/dayjs'
import '@/lib/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { clearAuthSession, getAuthSession, setAuthSession } from '@/lib/auth/session'
import type { ApplicationDTO } from './api'
import { AdminSellerApplicationsPage } from './pages/AdminSellerApplicationsPage'
import { SellerOnboardingPage } from './pages/SellerOnboardingPage'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const APP_ID = '22222222-2222-4222-8222-222222222222'

function user(roles: string[]) {
  return { userId: USER_ID, email: 'khanh@soa.vn', fullName: 'Khánh', phone: '0900000000', createdAt: '', status: 'ACTIVE', roles }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function apiError(status: number, code: string, message: string, details: unknown[] = []) {
  return json({ code, message, details, correlationId: 'corr-1' }, status)
}

function makeApplication(overrides: Partial<ApplicationDTO> = {}): ApplicationDTO {
  return {
    applicationId: APP_ID,
    userId: USER_ID,
    sellerType: 'INDIVIDUAL',
    shopName: 'Shop Nhật Khánh',
    identityOrBusinessNumber: '012345678901',
    taxCode: '0101234567',
    status: 'PENDING',
    version: 1,
    createdAt: '2026-11-20T03:00:00Z',
    updatedAt: '2026-11-20T03:00:00Z',
    documents: [
      { type: 'CCCD_FRONT', mimeType: 'image/png', size: 3, uploadedAt: '2026-11-20T03:00:00Z' },
      { type: 'CCCD_BACK', mimeType: 'image/png', size: 3, uploadedAt: '2026-11-20T03:00:00Z' },
    ],
    ...overrides,
  }
}

type Handler = (request: Request) => Response | Promise<Response>
let handlers: Array<{ method: string; path: string | RegExp; handle: Handler }>
let calls: Request[]

function on(method: string, path: string | RegExp, handle: Handler) {
  handlers.unshift({ method, path, handle })
}

beforeEach(() => {
  handlers = []
  calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(String(input), init)
      calls.push(request)
      const { pathname } = new URL(request.url)
      const match = handlers.find(
        (h) => h.method === request.method && (typeof h.path === 'string' ? h.path === pathname : h.path.test(pathname)),
      )
      if (!match) throw new Error(`Unhandled ${request.method} ${pathname}`)
      return match.handle(request)
    }),
  )
})

afterEach(() => {
  cleanup()
  clearAuthSession()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function renderAt(path: string, element: React.ReactElement, extraRoutes: React.ReactElement | null = null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={path} element={element} />
            {extraRoutes}
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

const png = (name: string) => new File(['png'], name, { type: 'image/png' })

describe('SellerOnboardingPage (/seller-onboarding — FR-SEL-001)', () => {
  beforeEach(() => setAuthSession({ accessToken: 'access-buyer', refreshToken: 'refresh-1', user: user(['BUYER']) }))

  async function openEmptyForm() {
    on('GET', '/v1/seller-applications/me', () => apiError(404, 'APPLICATION_NOT_FOUND', 'Bạn chưa nộp hồ sơ.'))
    renderAt('/seller-onboarding', <SellerOnboardingPage />)
    await screen.findByRole('button', { name: 'Nộp hồ sơ' })
  }

  async function fillValidIndividual(u: ReturnType<typeof userEvent.setup>) {
    await u.type(screen.getByLabelText(/Tên gian hàng/), 'Shop Nhật Khánh')
    await u.type(screen.getByLabelText(/Số CCCD/), '012345678901')
    await u.type(screen.getByLabelText(/Mã số thuế/), '0101234567')
    await u.upload(screen.getByLabelText(/CCCD mặt trước/), png('front.png'))
    await u.upload(screen.getByLabelText(/CCCD mặt sau/), png('back.png'))
  }

  it('shows the form when the user has never applied (404 → null)', async () => {
    await openEmptyForm()
    expect(screen.getByLabelText(/CCCD mặt trước/)).toBeTruthy()
    expect(screen.queryByLabelText(/Giấy chứng nhận ĐKKD/)).toBeNull()
  })

  it('switches documents and identity label for ORGANIZATION', async () => {
    const u = userEvent.setup()
    await openEmptyForm()
    await u.click(screen.getByText('Tổ chức / Doanh nghiệp'))

    expect(screen.getByLabelText(/Mã số doanh nghiệp/)).toBeTruthy()
    expect(screen.getByLabelText(/Giấy chứng nhận ĐKKD/)).toBeTruthy()
    expect(screen.getByLabelText(/CCCD người đại diện — mặt trước/)).toBeTruthy()
    expect(screen.queryByLabelText(/^CCCD mặt trước/)).toBeNull()
  })

  it('reports every invalid field at once and does not call the API', async () => {
    const u = userEvent.setup()
    await openEmptyForm()
    await u.type(screen.getByLabelText(/Số CCCD/), '123')
    await u.click(screen.getByRole('button', { name: 'Nộp hồ sơ' }))

    expect(await screen.findByText('Tên gian hàng tối thiểu 2 ký tự')).toBeTruthy()
    expect(screen.getByText('Số CCCD phải gồm đúng 12 chữ số')).toBeTruthy()
    expect(screen.getByText(/Mã số thuế gồm 10 chữ số/)).toBeTruthy()
    expect(screen.getAllByText('Tài liệu bắt buộc')).toHaveLength(2)
    expect(calls.filter((r) => r.method === 'POST')).toHaveLength(0)
  })

  it('rejects wrong file types and files over 5MB right after choosing them', async () => {
    const u = userEvent.setup({ applyAccept: false })
    await openEmptyForm()
    await u.upload(screen.getByLabelText(/CCCD mặt trước/), new File(['gif'], 'a.gif', { type: 'image/gif' }))
    expect(await screen.findByText('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP')).toBeTruthy()

    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' })
    await u.upload(screen.getByLabelText(/CCCD mặt sau/), big)
    expect(await screen.findByText('Tệp vượt quá dung lượng tối đa 5MB')).toBeTruthy()
  })

  it('submits multipart with only the documents of the chosen type, then shows PENDING', async () => {
    const u = userEvent.setup()
    const setSpy = vi.spyOn(FormData.prototype, 'set')
    await openEmptyForm()
    on('POST', '/v1/seller-applications', () => json(makeApplication(), 201))

    await fillValidIndividual(u)
    await u.click(screen.getByRole('button', { name: 'Nộp hồ sơ' }))

    expect(await screen.findByRole('heading', { name: 'Hồ sơ đang chờ duyệt' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Nộp hồ sơ' })).toBeNull()

    const post = calls.find((r) => r.method === 'POST')!
    expect(post.headers.get('Authorization')).toBe('Bearer access-buyer')
    expect(post.headers.get('Content-Type')).toMatch(/^multipart\/form-data; boundary=/)
    const fields = Object.fromEntries(setSpy.mock.calls.map(([name, value]) => [name, value instanceof File ? value.name : value]))
    expect(fields).toEqual({
      sellerType: 'INDIVIDUAL',
      shopName: 'Shop Nhật Khánh',
      identityOrBusinessNumber: '012345678901',
      taxCode: '0101234567',
      cccdFront: 'front.png',
      cccdBack: 'back.png',
    })
  })

  it('TC-SEL-01: a second submission while PENDING gets 409 and the page switches to the status screen', async () => {
    const u = userEvent.setup()
    await openEmptyForm()
    on('POST', '/v1/seller-applications', () =>
      apiError(409, 'APPLICATION_ALREADY_EXISTS', 'Bạn đã có hồ sơ đang chờ duyệt.'),
    )
    on('GET', '/v1/seller-applications/me', () => json(makeApplication()))

    await fillValidIndividual(u)
    await u.click(screen.getByRole('button', { name: 'Nộp hồ sơ' }))

    expect(await screen.findByRole('heading', { name: 'Hồ sơ đang chờ duyệt' })).toBeTruthy()
  })

  it('maps SHOP_NAME_TAKEN and 422 field details onto the matching inputs', async () => {
    const u = userEvent.setup()
    await openEmptyForm()
    on('POST', '/v1/seller-applications', () =>
      apiError(409, 'SHOP_NAME_TAKEN', 'Tên gian hàng đã được sử dụng. Vui lòng chọn tên khác.'),
    )
    await fillValidIndividual(u)
    await u.click(screen.getByRole('button', { name: 'Nộp hồ sơ' }))
    expect(await screen.findByText('Tên gian hàng đã được sử dụng. Vui lòng chọn tên khác.')).toBeTruthy()
    expect(screen.getByLabelText(/Tên gian hàng/).getAttribute('aria-invalid')).toBe('true')

    on('POST', '/v1/seller-applications', () =>
      apiError(422, 'VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ.', [{ field: 'cccdFront', reason: 'Ảnh bị mờ' }]),
    )
    await u.click(screen.getByRole('button', { name: 'Nộp hồ sơ' }))
    expect(await screen.findByText('Ảnh bị mờ')).toBeTruthy()
  })

  it('REJECTED shows the reason and lets the user resubmit with it as context', async () => {
    const u = userEvent.setup()
    on('GET', '/v1/seller-applications/me', () =>
      json(makeApplication({ status: 'REJECTED', reviewReason: 'Ảnh CCCD bị mờ, vui lòng chụp lại.' })),
    )
    renderAt('/seller-onboarding', <SellerOnboardingPage />)

    expect(await screen.findByRole('heading', { name: 'Hồ sơ bị từ chối' })).toBeTruthy()
    expect(screen.getByText('Ảnh CCCD bị mờ, vui lòng chụp lại.')).toBeTruthy()

    await u.click(screen.getByRole('button', { name: 'Nộp hồ sơ mới' }))
    expect(screen.getByRole('button', { name: 'Nộp hồ sơ' })).toBeTruthy()
    expect(screen.getByText('Hồ sơ trước bị từ chối với lý do:')).toBeTruthy()

    await u.click(screen.getByRole('button', { name: 'Quay lại trạng thái hồ sơ' }))
    expect(screen.getByRole('heading', { name: 'Hồ sơ bị từ chối' })).toBeTruthy()
  })

  it('PENDING hides every submit action', async () => {
    on('GET', '/v1/seller-applications/me', () => json(makeApplication()))
    renderAt('/seller-onboarding', <SellerOnboardingPage />)
    expect(await screen.findByRole('heading', { name: 'Hồ sơ đang chờ duyệt' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Nộp hồ sơ/ })).toBeNull()
  })

  it('APPROVED refreshes the token to pick up the SELLER role before entering /seller', async () => {
    const u = userEvent.setup()
    on('GET', '/v1/seller-applications/me', () => json(makeApplication({ status: 'APPROVED', shopId: 'shop-1' })))
    on('POST', '/v1/auth/token/refresh', () =>
      json({ accessToken: 'access-seller', refreshToken: 'refresh-2', user: user(['BUYER', 'SELLER']) }),
    )
    renderAt('/seller-onboarding', <SellerOnboardingPage />, <Route path="/seller" element={<p>SELLER PORTAL</p>} />)

    await u.click(await screen.findByRole('button', { name: 'Vào Kênh Người bán' }))

    expect(await screen.findByText('SELLER PORTAL')).toBeTruthy()
    expect(getAuthSession().accessToken).toBe('access-seller')
  })

  it('APPROVED but role not granted yet → stays and explains instead of hitting a 403', async () => {
    const u = userEvent.setup()
    on('GET', '/v1/seller-applications/me', () => json(makeApplication({ status: 'APPROVED' })))
    on('POST', '/v1/auth/token/refresh', () =>
      json({ accessToken: 'access-2', refreshToken: 'refresh-2', user: user(['BUYER']) }),
    )
    renderAt('/seller-onboarding', <SellerOnboardingPage />, <Route path="/seller" element={<p>SELLER PORTAL</p>} />)

    await u.click(await screen.findByRole('button', { name: 'Vào Kênh Người bán' }))

    expect(await screen.findByText(/đang cấp quyền Nhà bán/)).toBeTruthy()
    expect(screen.queryByText('SELLER PORTAL')).toBeNull()
  })
})

describe('AdminSellerApplicationsPage (/admin/seller-applications — FR-SEL-002)', () => {
  beforeEach(() => {
    setAuthSession({ accessToken: 'access-admin', refreshToken: 'refresh-a', user: user(['ADMINISTRATOR']) })
    on('GET', /^\/v1\/admin\/seller-applications\/[^/]+\/documents\/[A-Z_]+$/, () =>
      new Response(new Uint8Array([137, 80, 78, 71]), { status: 200, headers: { 'Content-Type': 'image/png' } }),
    )
  })

  function listWith(applications: ApplicationDTO[]) {
    on('GET', '/v1/admin/seller-applications', () =>
      json({ data: applications, pagination: { page: 1, pageSize: 20, totalItems: applications.length, totalPages: 1 } }),
    )
  }

  async function openDetail(u: ReturnType<typeof userEvent.setup>) {
    renderAt('/admin/seller-applications', <AdminSellerApplicationsPage />)
    const [viewButton] = await screen.findAllByRole('button', { name: /Xem hồ sơ/ })
    await u.click(viewButton!)
    return screen.findByRole('dialog')
  }

  it('loads the PENDING queue first and loads KYC images through the authorised proxy', async () => {
    const u = userEvent.setup()
    listWith([makeApplication()])
    const sheet = await openDetail(u)

    const listCall = calls.find((r) => new URL(r.url).pathname === '/v1/admin/seller-applications')!
    expect(new URL(listCall.url).searchParams.get('status')).toBe('PENDING')

    await waitFor(() => expect(within(sheet).getAllByRole('img')).toHaveLength(2))
    const docCalls = calls.filter((r) => r.url.includes('/documents/'))
    expect(docCalls.map((r) => new URL(r.url).pathname.split('/').pop()).sort()).toEqual(['CCCD_BACK', 'CCCD_FRONT'])
    expect(docCalls.every((r) => r.headers.get('Authorization') === 'Bearer access-admin')).toBe(true)
  })

  it('TC-SEL-02: reject requires an audit reason (≥ 10 chars) and sends it', async () => {
    const u = userEvent.setup()
    listWith([makeApplication()])
    let body: unknown
    on('POST', `/v1/admin/seller-applications/${APP_ID}/reject`, async (request) => {
      body = await request.json()
      return json(makeApplication({ status: 'REJECTED', reviewReason: 'Ảnh CCCD bị mờ quá' }))
    })
    const sheet = await openDetail(u)
    await u.click(within(sheet).getByRole('button', { name: 'Từ chối' }))

    const dialog = await screen.findByRole('dialog', { name: /Từ chối hồ sơ Shop Nhật Khánh/ })
    const confirm = within(dialog).getByRole('button', { name: 'Từ chối hồ sơ' })
    await u.type(within(dialog).getByRole('textbox'), 'quá ngắn')
    expect(confirm.hasAttribute('disabled')).toBe(true)

    await u.type(within(dialog).getByRole('textbox'), ' — ảnh CCCD bị mờ')
    await u.click(confirm)

    expect(await screen.findByText('Đã từ chối hồ sơ Shop Nhật Khánh.')).toBeTruthy()
    expect(body).toEqual({ reason: 'quá ngắn — ảnh CCCD bị mờ' })
  })

  it('TC-SEL-02: approve sends the optional note and confirms with a copyable application id', async () => {
    const u = userEvent.setup()
    listWith([makeApplication()])
    let body: unknown
    on('POST', `/v1/admin/seller-applications/${APP_ID}/approve`, async (request) => {
      body = await request.json()
      return json(makeApplication({ status: 'APPROVED', shopId: 'shop-1' }))
    })
    const sheet = await openDetail(u)
    await u.click(within(sheet).getByRole('button', { name: 'Duyệt hồ sơ' }))

    const dialog = await screen.findByRole('dialog', { name: /Duyệt hồ sơ Shop Nhật Khánh/ })
    await u.type(within(dialog).getByRole('textbox'), 'Thông tin khớp CCCD')
    await u.click(within(dialog).getByRole('button', { name: 'Duyệt & tạo gian hàng' }))

    expect(await screen.findByText('Đã duyệt hồ sơ Shop Nhật Khánh — gian hàng đã được tạo.')).toBeTruthy()
    expect(body).toEqual({ note: 'Thông tin khớp CCCD' })
  })

  it('409 APPLICATION_ALREADY_DECIDED (another admin won) closes the dialog and reloads the list', async () => {
    const u = userEvent.setup()
    listWith([makeApplication()])
    on('POST', `/v1/admin/seller-applications/${APP_ID}/approve`, () =>
      apiError(409, 'APPLICATION_ALREADY_DECIDED', 'Hồ sơ đã được xử lý trước đó.'),
    )
    const sheet = await openDetail(u)
    await u.click(within(sheet).getByRole('button', { name: 'Duyệt hồ sơ' }))
    const listCallsBefore = calls.filter((r) => new URL(r.url).pathname === '/v1/admin/seller-applications').length
    await u.click(await screen.findByRole('button', { name: 'Duyệt & tạo gian hàng' }))

    expect(await screen.findByText(/đã được Quản trị viên khác xử lý/)).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() =>
      expect(calls.filter((r) => new URL(r.url).pathname === '/v1/admin/seller-applications').length).toBeGreaterThan(
        listCallsBefore,
      ),
    )
  })

  it('other approve errors (SHOP_NAME_TAKEN) stay inside the dialog', async () => {
    const u = userEvent.setup()
    listWith([makeApplication()])
    on('POST', `/v1/admin/seller-applications/${APP_ID}/approve`, () =>
      apiError(409, 'SHOP_NAME_TAKEN', 'Tên gian hàng đã được sử dụng.'),
    )
    const sheet = await openDetail(u)
    await u.click(within(sheet).getByRole('button', { name: 'Duyệt hồ sơ' }))
    const dialog = await screen.findByRole('dialog', { name: /Duyệt hồ sơ Shop Nhật Khánh/ })
    await u.click(within(dialog).getByRole('button', { name: 'Duyệt & tạo gian hàng' }))

    expect(await within(dialog).findByText('Tên gian hàng đã được sử dụng.')).toBeTruthy()
    expect(within(dialog).getByText('corr-1')).toBeTruthy()
  })

  it('decided applications have no approve/reject actions; empty queue shows an empty state', async () => {
    const u = userEvent.setup()
    listWith([makeApplication({ status: 'APPROVED' })])
    const sheet = await openDetail(u)
    expect(within(sheet).queryByRole('button', { name: 'Duyệt hồ sơ' })).toBeNull()
    expect(within(sheet).queryByRole('button', { name: 'Từ chối' })).toBeNull()

    cleanup()
    listWith([])
    renderAt('/admin/seller-applications', <AdminSellerApplicationsPage />)
    expect(await screen.findByText('Không còn hồ sơ nào chờ duyệt.')).toBeTruthy()
  })

  it('switching tabs filters by status and resets paging', async () => {
    const u = userEvent.setup()
    listWith([])
    renderAt('/admin/seller-applications', <AdminSellerApplicationsPage />)
    await screen.findByText('Không còn hồ sơ nào chờ duyệt.')

    await u.click(screen.getByRole('tab', { name: 'Đã từ chối' }))
    await u.click(screen.getByRole('tab', { name: 'Tất cả' }))
    await screen.findByText('Không có hồ sơ nào.')

    const statuses = calls
      .filter((r) => new URL(r.url).pathname === '/v1/admin/seller-applications')
      .map((r) => new URL(r.url).searchParams.get('status'))
    expect(statuses).toEqual(['PENDING', 'REJECTED', null])
  })
})
