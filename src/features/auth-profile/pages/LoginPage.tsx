import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AuthAccountShell } from '../components/AuthAccountShell'
import { AuthApiError, apiLogin } from '../api'
import { loginSchema, type LoginFormValues } from '../schemas'
import { clearLockNotice, hasRole, setAuthSession, useAuthSession } from '../session'

function resolveSafeRedirect(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null
  return raw
}

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const session = useAuthSession()

  const verifiedSuccess = searchParams.get('verified') === '1'
  const resetSuccess = searchParams.get('reset') === '1'
  const redirectParam = resolveSafeRedirect(searchParams.get('redirect'))

  const [bannerError, setBannerError] = useState<string | null>(null)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (values: LoginFormValues) => {
    setBannerError(null)
    setUnverifiedEmail(null)
    clearLockNotice()

    try {
      const res = await apiLogin({
        email: values.email,
        password: values.password,
      })
      setAuthSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user ?? null,
      })
      if (redirectParam) {
        void navigate(redirectParam, { replace: true })
        return
      }
      if (hasRole(res.user, 'ADMINISTRATOR')) {
        void navigate('/admin/users', { replace: true })
      } else {
        void navigate('/account/profile', { replace: true })
      }
    } catch (err) {
      if (err instanceof AuthApiError) {
        if (err.parsed.code === 'EMAIL_NOT_VERIFIED') {
          setUnverifiedEmail(values.email)
        }
        setBannerError(
          err.parsed.retryAfterSeconds
            ? `${err.parsed.message} (Thử lại sau ${err.parsed.retryAfterSeconds} giây)`
            : err.parsed.message,
        )
        return
      }
      setBannerError('Không thể đăng nhập lúc này. Vui lòng thử lại sau.')
    }
  }

  return (
    <AuthAccountShell>
      <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 shadow-xs">
        <h1 className="text-2xl font-bold">{t('authProfile.login.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('authProfile.login.subtitle')}</p>

        {session.lockNotice && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-status-danger-border bg-status-danger px-3 py-2 text-sm font-medium text-status-danger-foreground"
          >
            {session.lockNotice}
          </div>
        )}

        {verifiedSuccess && (
          <div className="mt-4 rounded-md border border-status-success-border bg-status-success px-3 py-2 text-sm text-status-success-foreground">
            Kích hoạt tài khoản thành công! Vui lòng đăng nhập.
          </div>
        )}

        {resetSuccess && (
          <div className="mt-4 rounded-md border border-status-success-border bg-status-success px-3 py-2 text-sm text-status-success-foreground">
            Đặt lại mật khẩu thành công! Vui lòng đăng nhập bằng mật khẩu mới.
          </div>
        )}

        {bannerError && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-status-danger-border bg-status-danger px-3 py-2 text-sm text-status-danger-foreground"
          >
            <p>{bannerError}</p>
            {unverifiedEmail && (
              <Link
                to={`/verify-otp?email=${encodeURIComponent(unverifiedEmail)}`}
                className="mt-1 inline-block font-semibold underline"
              >
                Đi tới trang xác thực OTP ngay
              </Link>
            )}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="mt-5 space-y-4" noValidate>
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              {...register('email')}
              className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="ban@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-status-danger-foreground">{errors.email.message}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="block text-sm font-medium">
                Mật khẩu
              </label>
              <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                {t('authProfile.login.forgotLink')}
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              {...register('password')}
              className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-status-danger-foreground">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-cta px-4 text-sm font-semibold text-cta-foreground hover:bg-cta-hover focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {isSubmitting ? t('authProfile.login.submitting') : t('authProfile.login.submit')}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {t('authProfile.login.noAccount')}{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            {t('authProfile.nav.register')}
          </Link>
        </p>
      </div>
    </AuthAccountShell>
  )
}
