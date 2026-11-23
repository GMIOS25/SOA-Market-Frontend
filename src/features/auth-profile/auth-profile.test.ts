import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import i18n from '@/lib/i18n'
import { parseApiError } from './api'
import { AuthAuditReasonModal } from './components/AuthAuditReasonModal'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import {
  addressSchema,
  auditReasonSchema,
  passwordSchema,
  registerSchema,
  verifyOtpSchema,
} from './schemas'
import {
  clearAuthSession,
  clearLockNotice,
  getAuthSession,
  hasRole,
  lockoutAuthSession,
  setAuthSession,
  updateSessionUser,
} from './session'

function renderWithProviders(element: React.ReactElement, initialEntries = ['/']) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(
        I18nextProvider,
        { i18n },
        createElement(MemoryRouter, { initialEntries }, element),
      ),
    ),
  )
}

describe('auth-profile session store', () => {
  it('handles login, profile update, lockout notice, and role checks', () => {
    clearAuthSession()
    expect(getAuthSession().accessToken).toBeNull()

    setAuthSession({
      accessToken: 'jwt-abc',
      refreshToken: 'rt-123',
      user: {
        userId: 'u-1',
        email: 'cuong@example.com',
        fullName: 'Tran Thanh Cuong',
        phone: '0901234567',
        status: 'ACTIVE',
        roles: ['BUYER', 'ADMINISTRATOR'],
        createdAt: '2026-11-23T00:00:00Z',
      },
    })

    expect(getAuthSession().accessToken).toBe('jwt-abc')
    expect(hasRole(getAuthSession().user, 'administrator')).toBe(true)
    expect(hasRole(getAuthSession().user, 'SELLER')).toBe(false)

    updateSessionUser({
      ...getAuthSession().user!,
      fullName: 'Cuong Updated',
    })
    expect(getAuthSession().user?.fullName).toBe('Cuong Updated')

    lockoutAuthSession('Tài khoản bị khóa vì kiểm tra bảo mật.')
    expect(getAuthSession().accessToken).toBeNull()
    expect(getAuthSession().lockNotice).toBe('Tài khoản bị khóa vì kiểm tra bảo mật.')

    clearLockNotice()
    expect(getAuthSession().lockNotice).toBeNull()
  })
})

describe('auth-profile Zod schemas (NĐ 13/2023, password, BR-GEN-04)', () => {
  it('enforces password complexity and privacy consent', () => {
    expect(passwordSchema.safeParse('short1').success).toBe(false)
    expect(passwordSchema.safeParse('onlyletters').success).toBe(false)
    expect(passwordSchema.safeParse('12345678').success).toBe(false)
    expect(passwordSchema.safeParse('StrongPass123').success).toBe(true)

    const missingConsent = registerSchema.safeParse({
      fullName: 'Nguyen Van A',
      email: 'a@example.com',
      phone: '0901 234 567',
      password: 'StrongPass123',
      confirmPassword: 'StrongPass123',
      privacyConsented: false,
    })
    expect(missingConsent.success).toBe(false)

    const validReg = registerSchema.safeParse({
      fullName: 'Nguyen Van A',
      email: 'a@example.com',
      phone: '0901-234-567',
      password: 'StrongPass123',
      confirmPassword: 'StrongPass123',
      privacyConsented: true,
    })
    expect(validReg.success).toBe(true)
    if (validReg.success) {
      expect(validReg.data.phone).toBe('0901234567')
    }
  })

  it('validates 6-digit OTP, address fields, and 10-char audit reason', () => {
    expect(verifyOtpSchema.safeParse({ email: 'a@b.com', code: '12345' }).success).toBe(false)
    expect(verifyOtpSchema.safeParse({ email: 'a@b.com', code: '123456' }).success).toBe(true)

    expect(auditReasonSchema.safeParse({ reason: 'qua ngan' }).success).toBe(false)
    expect(auditReasonSchema.safeParse({ reason: 'Khóa tài khoản do vi phạm quy định sàn' }).success).toBe(
      true,
    )

    expect(
      addressSchema.safeParse({
        receiver: 'Nguyen Van B',
        phone: '0912345678',
        line: '01 Vo Van Ngan',
        ward: 'Linh Chieu',
        district: 'Thu Duc',
        province: 'TP.HCM',
        isDefault: true,
      }).success,
    ).toBe(true)
  })
})

describe('API error parser and SSR component rendering', () => {
  it('parses Huma APIError with Retry-After and correlationId', () => {
    const res = new Response(null, {
      status: 429,
      headers: { 'Retry-After': '45' },
    })
    const parsed = parseApiError(
      {
        code: 'OTP_COOLDOWN',
        message: 'Vui lòng chờ 45 giây.',
        details: [{ field: 'email', reason: 'Quá nhanh' }],
        correlationId: 'corr-xyz',
      },
      res,
    )
    expect(parsed.status).toBe(429)
    expect(parsed.code).toBe('OTP_COOLDOWN')
    expect(parsed.retryAfterSeconds).toBe(45)
    expect(parsed.correlationId).toBe('corr-xyz')
    expect(parsed.details).toHaveLength(1)
  })

  it('renders RegisterPage with unchecked consent and disabled submit by default', () => {
    clearAuthSession()
    const html = renderWithProviders(createElement(RegisterPage), ['/register'])
    expect(html).toContain('Nghị định 13/2023/NĐ-CP')
    expect(html).not.toContain('id="reg-consent" checked')
    expect(html).toContain('disabled=""')
  })

  it('renders LoginPage lockout banner after ACCOUNT_LOCKED revocation', () => {
    lockoutAuthSession('Tài khoản của bạn đã bị khóa bởi quản trị viên.')
    const html = renderWithProviders(createElement(LoginPage), ['/login'])
    expect(html).toContain('Tài khoản của bạn đã bị khóa bởi quản trị viên.')
    clearAuthSession()
  })

  it('renders AuthAuditReasonModal with audit log warning', () => {
    const html = renderWithProviders(
      createElement(AuthAuditReasonModal, {
        open: true,
        title: 'Khóa tài khoản',
        onClose: () => {},
        onConfirm: () => {},
      }),
    )
    expect(html).toContain('Nhật ký kiểm toán bất biến')
    expect(html).toContain('Cần thêm 10 ký tự')
  })
})
