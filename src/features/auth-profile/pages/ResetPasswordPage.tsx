import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AuthAccountShell } from '../components/AuthAccountShell'
import { AuthApiError, apiResetPassword } from '../api'
import { resetPasswordSchema, type ResetPasswordFormValues } from '../schemas'

export function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tokenParam = searchParams.get('token') ?? ''
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: tokenParam,
      newPassword: '',
      confirmPassword: '',
    },
  })

  const onSubmit = async (values: ResetPasswordFormValues) => {
    setErrorMsg(null)
    try {
      await apiResetPassword({
        token: values.token,
        newPassword: values.newPassword,
      })
      void navigate('/login?reset=1', { replace: true })
    } catch (err) {
      if (err instanceof AuthApiError) {
        setErrorMsg(err.parsed.message)
      } else {
        setErrorMsg('Không thể đặt lại mật khẩu lúc này.')
      }
    }
  }

  return (
    <AuthAccountShell>
      <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 shadow-xs">
        <h1 className="text-2xl font-bold">{t('authProfile.resetPassword.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('authProfile.resetPassword.subtitle')}</p>

        {errorMsg && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-status-danger-border bg-status-danger px-3 py-2 text-sm text-status-danger-foreground"
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="mt-5 space-y-4" noValidate>
          <div>
            <label htmlFor="rp-token" className="block text-sm font-medium">
              Mã đặt lại mật khẩu (Token)
            </label>
            <input
              id="rp-token"
              type="text"
              aria-invalid={Boolean(errors.token)}
              {...register('token')}
              className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 font-mono text-xs focus-visible:ring-2 focus-visible:ring-ring"
            />
            {errors.token && (
              <p className="mt-1 text-xs text-status-danger-foreground">{errors.token.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="rp-newPassword" className="block text-sm font-medium">
              Mật khẩu mới
            </label>
            <input
              id="rp-newPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.newPassword)}
              {...register('newPassword')}
              className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
            />
            {errors.newPassword && (
              <p className="mt-1 text-xs text-status-danger-foreground">{errors.newPassword.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="rp-confirmPassword" className="block text-sm font-medium">
              Xác nhận mật khẩu mới
            </label>
            <input
              id="rp-confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirmPassword)}
              {...register('confirmPassword')}
              className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-status-danger-foreground">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {isSubmitting ? 'Đang cập nhật...' : t('authProfile.resetPassword.submit')}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          <Link to="/login" className="font-medium text-primary hover:underline">
            Quay lại đăng nhập
          </Link>
        </p>
      </div>
    </AuthAccountShell>
  )
}
