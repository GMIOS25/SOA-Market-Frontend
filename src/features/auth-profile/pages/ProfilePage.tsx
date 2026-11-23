import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDateTime } from '@/lib/format'
import { AuthAccountShell } from '../components/AuthAccountShell'
import {
  AuthApiError,
  apiChangePassword,
  apiGetMe,
  apiLogout,
  apiUpdateMe,
} from '../api'
import {
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordFormValues,
  type UpdateProfileFormValues,
} from '../schemas'
import { clearAuthSession, updateSessionUser, useAuthSession } from '../session'

export function ProfilePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const session = useAuthSession()

  const [profileMsg, setProfileMsg] = useState<string | null>(null)
  const [profileErr, setProfileErr] = useState<string | null>(null)
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [pwErr, setPwErr] = useState<string | null>(null)

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: apiGetMe,
    enabled: Boolean(session.accessToken),
  })

  const profileForm = useForm<UpdateProfileFormValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      fullName: session.user?.fullName ?? '',
      phone: session.user?.phone ?? '',
    },
  })

  const passwordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  useEffect(() => {
    if (meQuery.data) {
      updateSessionUser(meQuery.data)
      profileForm.reset({
        fullName: meQuery.data.fullName,
        phone: meQuery.data.phone,
      })
    }
  }, [meQuery.data, profileForm])

  const updateProfileMutation = useMutation({
    mutationFn: apiUpdateMe,
    onSuccess: (updated) => {
      updateSessionUser(updated)
      setProfileErr(null)
      setProfileMsg('Đã cập nhật thông tin hồ sơ.')
    },
    onError: (err) => {
      setProfileMsg(null)
      setProfileErr(err instanceof AuthApiError ? err.parsed.message : 'Cập nhật hồ sơ thất bại.')
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: apiChangePassword,
    onSuccess: () => {
      setPwErr(null)
      setPwMsg('Đổi mật khẩu thành công. Các phiên đăng nhập cũ đã được thu hồi.')
      passwordForm.reset()
    },
    onError: (err) => {
      setPwMsg(null)
      setPwErr(err instanceof AuthApiError ? err.parsed.message : 'Đổi mật khẩu thất bại.')
    },
  })

  const handleLogoutAll = async () => {
    try {
      await apiLogout({ allDevices: true })
    } catch {
      // ignore
    } finally {
      clearAuthSession()
      void navigate('/login', { replace: true })
    }
  }

  const user = meQuery.data ?? session.user

  return (
    <AuthAccountShell
      requireAuth
      title={t('authProfile.profile.title')}
      subtitle="Quản lý thông tin tài khoản, đồng ý dữ liệu cá nhân và bảo mật phiên đăng nhập."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
            <div>
              <h2 className="text-lg font-semibold">Thông tin cá nhân</h2>
              {user && <p className="font-mono text-xs text-muted-foreground">{user.userId}</p>}
            </div>
            {user && <StatusBadge status={user.status} />}
          </div>

          {meQuery.isLoading ? (
            <div className="mt-4 space-y-3">
              <div className="h-10 animate-pulse rounded-md bg-muted" />
              <div className="h-10 animate-pulse rounded-md bg-muted" />
            </div>
          ) : (
            <form
              onSubmit={(e) =>
                void profileForm.handleSubmit((values) => updateProfileMutation.mutate(values))(e)
              }
              className="mt-4 space-y-4"
            >
              <div>
                <label htmlFor="prof-email" className="block text-sm font-medium">
                  Email
                </label>
                <input
                  id="prof-email"
                  type="email"
                  disabled
                  value={user?.email ?? ''}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground"
                />
              </div>

              <div>
                <label htmlFor="prof-fullName" className="block text-sm font-medium">
                  Họ và tên
                </label>
                <input
                  id="prof-fullName"
                  type="text"
                  {...profileForm.register('fullName')}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                />
                {profileForm.formState.errors.fullName && (
                  <p className="mt-1 text-xs text-status-danger-foreground">
                    {profileForm.formState.errors.fullName.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="prof-phone" className="block text-sm font-medium">
                  Số điện thoại
                </label>
                <input
                  id="prof-phone"
                  type="tel"
                  {...profileForm.register('phone')}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                />
                {profileForm.formState.errors.phone && (
                  <p className="mt-1 text-xs text-status-danger-foreground">
                    {profileForm.formState.errors.phone.message}
                  </p>
                )}
              </div>

              {user && (
                <div className="space-y-1.5 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>Vai trò:</span>
                    {(user.roles ?? []).map((r) => (
                      <span
                        key={r}
                        className="rounded-full border border-status-info-border bg-status-info px-2 py-0.5 font-medium text-status-info-foreground"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                  {user.privacyConsentedAt && (
                    <p>
                      Đồng ý NĐ 13/2023 ({user.privacyPolicyVersion ?? 'v1'}) lúc{' '}
                      <span className="font-medium text-foreground">
                        {formatDateTime(user.privacyConsentedAt)}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {profileMsg && (
                <p className="rounded-md border border-status-success-border bg-status-success px-3 py-2 text-xs text-status-success-foreground">
                  {profileMsg}
                </p>
              )}
              {profileErr && (
                <p
                  role="alert"
                  className="rounded-md border border-status-danger-border bg-status-danger px-3 py-2 text-xs text-status-danger-foreground"
                >
                  {profileErr}
                </p>
              )}

              <button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                {updateProfileMutation.isPending ? 'Đang lưu...' : t('authProfile.profile.saveProfile')}
              </button>
            </form>
          )}
        </section>

        <section className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
            <h2 className="border-b border-border pb-4 text-lg font-semibold">
              {t('authProfile.profile.changePasswordTitle')}
            </h2>

            <form
              onSubmit={(e) =>
                void passwordForm.handleSubmit((values) =>
                  changePasswordMutation.mutate({
                    currentPassword: values.currentPassword,
                    newPassword: values.newPassword,
                  }),
                )(e)
              }
              className="mt-4 space-y-4"
            >
              <div>
                <label htmlFor="pw-current" className="block text-sm font-medium">
                  Mật khẩu hiện tại
                </label>
                <input
                  id="pw-current"
                  type="password"
                  autoComplete="current-password"
                  {...passwordForm.register('currentPassword')}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                />
                {passwordForm.formState.errors.currentPassword && (
                  <p className="mt-1 text-xs text-status-danger-foreground">
                    {passwordForm.formState.errors.currentPassword.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="pw-new" className="block text-sm font-medium">
                  Mật khẩu mới
                </label>
                <input
                  id="pw-new"
                  type="password"
                  autoComplete="new-password"
                  {...passwordForm.register('newPassword')}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                />
                {passwordForm.formState.errors.newPassword && (
                  <p className="mt-1 text-xs text-status-danger-foreground">
                    {passwordForm.formState.errors.newPassword.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="pw-confirm" className="block text-sm font-medium">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  id="pw-confirm"
                  type="password"
                  autoComplete="new-password"
                  {...passwordForm.register('confirmPassword')}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                />
                {passwordForm.formState.errors.confirmPassword && (
                  <p className="mt-1 text-xs text-status-danger-foreground">
                    {passwordForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {pwMsg && (
                <p className="rounded-md border border-status-success-border bg-status-success px-3 py-2 text-xs text-status-success-foreground">
                  {pwMsg}
                </p>
              )}
              {pwErr && (
                <p
                  role="alert"
                  className="rounded-md border border-status-danger-border bg-status-danger px-3 py-2 text-xs text-status-danger-foreground"
                >
                  {pwErr}
                </p>
              )}

              <button
                type="submit"
                disabled={changePasswordMutation.isPending}
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                {changePasswordMutation.isPending
                  ? 'Đang đổi mật khẩu...'
                  : t('authProfile.profile.changePasswordBtn')}
              </button>
            </form>
          </div>

          <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
            <h2 className="text-base font-semibold">Quản lý phiên đăng nhập</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Thu hồi toàn bộ Refresh Token đang hoạt động trên mọi trình duyệt và thiết bị khác.
            </p>
            <button
              type="button"
              onClick={() => void handleLogoutAll()}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-status-danger-border bg-status-danger px-4 text-sm font-medium text-status-danger-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t('authProfile.nav.logoutAll')}
            </button>
          </div>
        </section>
      </div>
    </AuthAccountShell>
  )
}
