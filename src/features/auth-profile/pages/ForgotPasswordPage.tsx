import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AuthAccountShell } from '../components/AuthAccountShell'
import { AuthApiError, apiForgotPassword } from '../api'
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '../schemas'

export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      const res = await apiForgotPassword({ email: values.email })
      setSuccessMsg(res.message)
    } catch (err) {
      if (err instanceof AuthApiError) {
        setErrorMsg(err.parsed.message)
      } else {
        setErrorMsg('Không thể gửi yêu cầu lúc này. Vui lòng thử lại sau.')
      }
    }
  }

  return (
    <AuthAccountShell>
      <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 shadow-xs">
        <h1 className="text-2xl font-bold">{t('authProfile.forgotPassword.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('authProfile.forgotPassword.subtitle')}</p>

        {successMsg && (
          <div className="mt-4 rounded-md border border-status-success-border bg-status-success px-3 py-2 text-sm text-status-success-foreground">
            {successMsg}
          </div>
        )}

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
            <label htmlFor="fp-email" className="block text-sm font-medium">
              Email đã đăng ký
            </label>
            <input
              id="fp-email"
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {isSubmitting ? 'Đang gửi...' : t('authProfile.forgotPassword.submit')}
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
