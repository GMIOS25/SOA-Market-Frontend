import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { AuthAccountShell } from '../components/AuthAccountShell'
import { AuthApiError, apiRegister } from '../api'
import { registerSchema, type RegisterFormValues } from '../schemas'

const PRIVACY_POLICY_VERSION = '2026-11-v1'

export function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [bannerError, setBannerError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      privacyConsented: false,
    },
  })

  const privacyConsented = useWatch({ control, name: 'privacyConsented' })

  const onSubmit = async (values: RegisterFormValues) => {
    setBannerError(null)
    try {
      await apiRegister({
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        password: values.password,
        privacyConsented: values.privacyConsented,
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      })
      void navigate(`/verify-otp?email=${encodeURIComponent(values.email)}`)
    } catch (err) {
      if (err instanceof AuthApiError) {
        if (err.parsed.status === 503) {
          void navigate(`/verify-otp?email=${encodeURIComponent(values.email)}&mailWarn=1`)
          return
        }
        for (const d of err.parsed.details) {
          if (
            d.field === 'fullName' ||
            d.field === 'email' ||
            d.field === 'phone' ||
            d.field === 'password' ||
            d.field === 'privacyConsented'
          ) {
            setError(d.field, { message: d.reason })
          }
        }
        setBannerError(
          err.parsed.correlationId
            ? `${err.parsed.message} (Mã tham chiếu: ${err.parsed.correlationId})`
            : err.parsed.message,
        )
        return
      }
      setBannerError('Không thể đăng ký tài khoản lúc này. Vui lòng thử lại sau.')
    }
  }

  return (
    <AuthAccountShell>
      <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 shadow-xs">
        <h1 className="text-2xl font-bold">{t('authProfile.register.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('authProfile.register.subtitle')}</p>

        {bannerError && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-status-danger-border bg-status-danger px-3 py-2 text-sm text-status-danger-foreground"
          >
            {bannerError}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="mt-5 space-y-4" noValidate>
          <div>
            <label htmlFor="reg-fullName" className="block text-sm font-medium">
              Họ và tên
            </label>
            <input
              id="reg-fullName"
              type="text"
              autoComplete="name"
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? 'reg-fullName-err' : undefined}
              {...register('fullName')}
              className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Nguyễn Văn A"
            />
            {errors.fullName && (
              <p id="reg-fullName-err" className="mt-1 text-xs text-status-danger-foreground">
                {errors.fullName.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="reg-email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'reg-email-err' : undefined}
              {...register('email')}
              className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="ban@example.com"
            />
            {errors.email && (
              <p id="reg-email-err" className="mt-1 text-xs text-status-danger-foreground">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="reg-phone" className="block text-sm font-medium">
              Số điện thoại
            </label>
            <input
              id="reg-phone"
              type="tel"
              autoComplete="tel"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? 'reg-phone-err' : undefined}
              {...register('phone')}
              className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="0901234567"
            />
            {errors.phone && (
              <p id="reg-phone-err" className="mt-1 text-xs text-status-danger-foreground">
                {errors.phone.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="reg-password" className="block text-sm font-medium">
              Mật khẩu
            </label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'reg-password-err' : undefined}
              {...register('password')}
              className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Tối thiểu 8 ký tự gồm chữ và số"
            />
            {errors.password && (
              <p id="reg-password-err" className="mt-1 text-xs text-status-danger-foreground">
                {errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="reg-confirmPassword" className="block text-sm font-medium">
              Xác nhận mật khẩu
            </label>
            <input
              id="reg-confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={errors.confirmPassword ? 'reg-confirmPassword-err' : undefined}
              {...register('confirmPassword')}
              className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
            />
            {errors.confirmPassword && (
              <p id="reg-confirmPassword-err" className="mt-1 text-xs text-status-danger-foreground">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <div className="rounded-md border border-border bg-muted/50 p-3">
            <label htmlFor="reg-consent" className="flex items-start gap-2.5 text-xs leading-relaxed">
              <input
                id="reg-consent"
                type="checkbox"
                {...register('privacyConsented')}
                className="mt-0.5 size-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span>{t('authProfile.register.consentLabel')}</span>
            </label>
            {errors.privacyConsented && (
              <p className="mt-1.5 text-xs text-status-danger-foreground">
                {errors.privacyConsented.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!privacyConsented || isSubmitting}
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-cta px-4 text-sm font-semibold text-cta-foreground hover:bg-cta-hover focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? t('authProfile.register.submitting') : t('authProfile.register.submit')}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {t('authProfile.register.hasAccount')}{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t('authProfile.nav.login')}
          </Link>
        </p>
      </div>
    </AuthAccountShell>
  )
}
