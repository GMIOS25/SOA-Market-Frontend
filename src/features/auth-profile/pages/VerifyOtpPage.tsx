import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AuthAccountShell } from '../components/AuthAccountShell'
import { AuthApiError, apiResendOtp, apiVerifyOtp } from '../api'
import { verifyOtpSchema, type VerifyOtpFormValues } from '../schemas'

export function VerifyOtpPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const emailParam = searchParams.get('email') ?? ''
  const mailWarn = searchParams.get('mailWarn') === '1'

  const [otpSecondsLeft, setOtpSecondsLeft] = useState(300)
  const [resendCooldown, setResendCooldown] = useState(mailWarn ? 0 : 60)
  const [resending, setResending] = useState(false)
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [bannerInfo, setBannerInfo] = useState<string | null>(
    mailWarn ? t('authProfile.verifyOtp.mailWarn') : null,
  )

  useEffect(() => {
    const timer = window.setInterval(() => {
      setOtpSecondsLeft((s) => (s > 0 ? s - 1 : 0))
      setResendCooldown((c) => (c > 0 ? c - 1 : 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<VerifyOtpFormValues>({
    resolver: zodResolver(verifyOtpSchema),
    defaultValues: {
      email: emailParam,
      code: '',
    },
  })

  const onSubmit = async (values: VerifyOtpFormValues) => {
    setBannerError(null)
    setBannerInfo(null)
    try {
      await apiVerifyOtp({ email: values.email, code: values.code })
      void navigate('/login?verified=1', { replace: true })
    } catch (err) {
      if (err instanceof AuthApiError) {
        setBannerError(err.parsed.message)
      } else {
        setBannerError('Không thể xác thực OTP lúc này.')
      }
    }
  }

  const handleResend = async () => {
    const email = getValues('email').trim()
    if (!email) {
      setBannerError('Vui lòng nhập địa chỉ email cần nhận lại OTP.')
      return
    }
    setBannerError(null)
    setBannerInfo(null)
    setResending(true)
    try {
      const res = await apiResendOtp({ email })
      setOtpSecondsLeft(res.otpExpiresInSeconds)
      setResendCooldown(res.cooldownSeconds)
      setBannerInfo('Đã gửi lại mã OTP mới tới email của bạn.')
    } catch (err) {
      if (err instanceof AuthApiError) {
        if (err.parsed.retryAfterSeconds) {
          setResendCooldown(err.parsed.retryAfterSeconds)
        }
        setBannerError(err.parsed.message)
      } else {
        setBannerError('Không thể gửi lại mã OTP lúc này.')
      }
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthAccountShell>
      <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 shadow-xs">
        <h1 className="text-2xl font-bold">{t('authProfile.verifyOtp.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('authProfile.verifyOtp.subtitle')}</p>

        <div className="mt-4 flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Thời hạn OTP ước tính:</span>
          <span className="font-mono font-semibold">
            {Math.floor(otpSecondsLeft / 60)}:{String(otpSecondsLeft % 60).padStart(2, '0')}
          </span>
        </div>

        {bannerInfo && (
          <div className="mt-4 rounded-md border border-status-warning-border bg-status-warning px-3 py-2 text-sm text-status-warning-foreground">
            {bannerInfo}
          </div>
        )}

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
            <label htmlFor="otp-email" className="block text-sm font-medium">
              Email đã đăng ký
            </label>
            <input
              id="otp-email"
              type="email"
              aria-invalid={Boolean(errors.email)}
              {...register('email')}
              className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-status-danger-foreground">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="otp-code" className="block text-sm font-medium">
              Mã OTP (6 chữ số)
            </label>
            <input
              id="otp-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              aria-invalid={Boolean(errors.code)}
              {...register('code')}
              className="mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-center font-mono text-lg tracking-widest focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="000000"
            />
            {errors.code && (
              <p className="mt-1 text-xs text-status-danger-foreground">{errors.code.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-cta px-4 text-sm font-semibold text-cta-foreground hover:bg-cta-hover focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {isSubmitting ? 'Đang xác thực...' : t('authProfile.verifyOtp.submit')}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={resendCooldown > 0 || resending}
            onClick={() => void handleResend()}
            className="font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
          >
            {resending
              ? t('authProfile.verifyOtp.resending')
              : resendCooldown > 0
                ? `${t('authProfile.verifyOtp.resend')} (${resendCooldown}s)`
                : t('authProfile.verifyOtp.resend')}
          </button>
          <Link to="/login" className="text-muted-foreground hover:text-foreground">
            {t('authProfile.nav.login')}
          </Link>
        </div>
      </div>
    </AuthAccountShell>
  )
}
