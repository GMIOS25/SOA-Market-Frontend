import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Lock, Search, Shield, Unlock } from 'lucide-react'
import type { SvcIdn } from '@/api/generated'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDateTime } from '@/lib/format'
import { AuthAccountShell } from '../components/AuthAccountShell'
import { AuthAuditReasonModal } from '../components/AuthAuditReasonModal'
import {
  AuthApiError,
  apiAdminListUsers,
  apiAdminLockUser,
  apiAdminUnlockUser,
  apiAdminUpdateUserRoles,
} from '../api'
import { useAuthSession } from '../session'

type AdminUser = SvcIdn.components['schemas']['UserSummary']

const ALL_ROLES = ['BUYER', 'SELLER', 'CS', 'ADMINISTRATOR'] as const

type PendingAction =
  | { kind: 'lock'; user: AdminUser }
  | { kind: 'unlock'; user: AdminUser }
  | { kind: 'roles'; user: AdminUser }
  | null

export function AdminUsersPage() {
  const { t } = useTranslation()
  const session = useAuthSession()
  const queryClient = useQueryClient()

  const [searchInput, setSearchInput] = useState('')
  const [queryText, setQueryText] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)

  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [modalError, setModalError] = useState<string | null>(null)

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', { page, q: queryText, status: statusFilter, role: roleFilter }],
    queryFn: () =>
      apiAdminListUsers({
        page,
        pageSize: 20,
        q: queryText || undefined,
        status: statusFilter || undefined,
        role: roleFilter || undefined,
      }),
    enabled: Boolean(session.accessToken),
  })

  const actionMutation = useMutation({
    mutationFn: async ({ action, reason }: { action: Exclude<PendingAction, null>; reason: string }) => {
      if (action.kind === 'lock') {
        return apiAdminLockUser(action.user.userId, { reason })
      }
      if (action.kind === 'unlock') {
        return apiAdminUnlockUser(action.user.userId, { reason })
      }
      return apiAdminUpdateUserRoles(action.user.userId, { roles: selectedRoles, reason })
    },
    onSuccess: () => {
      setPendingAction(null)
      setModalError(null)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
    onError: (err) => {
      setModalError(err instanceof AuthApiError ? err.parsed.message : 'Thao tác quản trị thất bại.')
    },
  })

  const openActionModal = (action: Exclude<PendingAction, null>) => {
    setModalError(null)
    if (action.kind === 'roles') {
      setSelectedRoles(action.user.roles ?? ['BUYER'])
    }
    setPendingAction(action)
  }

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    )
  }

  const users = usersQuery.data?.data ?? []
  const pagination = usersQuery.data?.pagination

  return (
    <AuthAccountShell
      title={t('authProfile.adminUsers.title')}
      subtitle={t('authProfile.adminUsers.subtitle')}
    >
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setPage(1)
            setQueryText(searchInput.trim())
          }}
          className="flex flex-1 gap-2"
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo email, họ tên hoặc SĐT..."
              aria-label="Tìm kiếm tài khoản"
              className="h-10 w-full rounded-md border border-input bg-card pr-3 pl-9 text-sm focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            Tìm
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Lọc theo trạng thái"
            value={statusFilter}
            onChange={(e) => {
              setPage(1)
              setStatusFilter(e.target.value)
            }}
            className="h-10 rounded-md border border-input bg-card px-3 text-sm"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="PENDING_VERIFICATION">Chờ xác thực</option>
            <option value="LOCKED">Bị khóa</option>
          </select>

          <select
            aria-label="Lọc theo vai trò"
            value={roleFilter}
            onChange={(e) => {
              setPage(1)
              setRoleFilter(e.target.value)
            }}
            className="h-10 rounded-md border border-input bg-card px-3 text-sm"
          >
            <option value="">Tất cả vai trò</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {usersQuery.isLoading ? (
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-lg bg-muted" />
          <div className="h-16 animate-pulse rounded-lg bg-muted" />
          <div className="h-16 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Không tìm thấy tài khoản nào khớp bộ lọc.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Tài khoản</th>
                  <th className="px-4 py-3">Vai trò</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Ngày tạo</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.userId} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{u.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.email} • <span className="font-mono">{u.phone}</span>
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(u.roles ?? []).map((r) => (
                          <span
                            key={r}
                            className="rounded-full border border-status-info-border bg-status-info px-2 py-0.5 text-xs font-medium text-status-info-foreground"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDateTime(u.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openActionModal({ kind: 'roles', user: u })}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-card px-2.5 text-xs font-medium hover:bg-muted"
                        >
                          <Shield className="size-3.5" aria-hidden="true" />
                          Phân quyền
                        </button>
                        {u.status === 'LOCKED' ? (
                          <button
                            type="button"
                            onClick={() => openActionModal({ kind: 'unlock', user: u })}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-status-success-border bg-status-success px-2.5 text-xs font-medium text-status-success-foreground hover:opacity-90"
                          >
                            <Unlock className="size-3.5" aria-hidden="true" />
                            Mở khóa
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={u.userId === session.user?.userId || u.status === 'ANONYMIZED'}
                            onClick={() => openActionModal({ kind: 'lock', user: u })}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-status-danger-border bg-status-danger px-2.5 text-xs font-medium text-status-danger-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Lock className="size-3.5" aria-hidden="true" />
                            Khóa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked cards (360px safe) */}
          <div className="space-y-3 md:hidden">
            {users.map((u) => (
              <article key={u.userId} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{u.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <StatusBadge status={u.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(u.roles ?? []).map((r) => (
                    <span
                      key={r}
                      className="rounded-full border border-status-info-border bg-status-info px-2 py-0.5 text-xs font-medium text-status-info-foreground"
                    >
                      {r}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={() => openActionModal({ kind: 'roles', user: u })}
                    className="inline-flex h-9 items-center gap-1 rounded-md border border-input bg-card px-3 text-xs font-medium"
                  >
                    Phân quyền
                  </button>
                  {u.status === 'LOCKED' ? (
                    <button
                      type="button"
                      onClick={() => openActionModal({ kind: 'unlock', user: u })}
                      className="inline-flex h-9 items-center gap-1 rounded-md border border-status-success-border bg-status-success px-3 text-xs font-medium text-status-success-foreground"
                    >
                      Mở khóa
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={u.userId === session.user?.userId || u.status === 'ANONYMIZED'}
                      onClick={() => openActionModal({ kind: 'lock', user: u })}
                      className="inline-flex h-9 items-center gap-1 rounded-md border border-status-danger-border bg-status-danger px-3 text-xs font-medium text-status-danger-foreground disabled:opacity-40"
                    >
                      Khóa tài khoản
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Trang {pagination.page} / {pagination.totalPages} ({pagination.totalItems} tài khoản)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 rounded-md border border-input bg-card px-3 font-medium text-foreground disabled:opacity-40"
                >
                  Trước
                </button>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 rounded-md border border-input bg-card px-3 font-medium text-foreground disabled:opacity-40"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <AuthAuditReasonModal
        open={Boolean(pendingAction)}
        title={
          pendingAction?.kind === 'lock'
            ? `Khóa tài khoản ${pendingAction.user.email}`
            : pendingAction?.kind === 'unlock'
              ? `Mở khóa tài khoản ${pendingAction.user.email}`
              : `Phân quyền tài khoản ${pendingAction?.user.email ?? ''}`
        }
        description={
          pendingAction?.kind === 'lock'
            ? 'Access token hiện tại của người dùng sẽ bị thu hồi ngay lập tức qua NATS KV.'
            : undefined
        }
        destructive={pendingAction?.kind === 'lock'}
        loading={actionMutation.isPending}
        errorMessage={modalError}
        onClose={() => {
          setPendingAction(null)
          setModalError(null)
        }}
        onConfirm={(reason) => {
          if (!pendingAction) return
          if (pendingAction.kind === 'roles' && selectedRoles.length === 0) {
            setModalError('Phải chọn ít nhất 1 vai trò cho người dùng.')
            return
          }
          actionMutation.mutate({ action: pendingAction, reason })
        }}
      >
        {pendingAction?.kind === 'roles' && (
          <fieldset>
            <legend className="text-sm font-medium">Chọn danh sách vai trò RBAC</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {ALL_ROLES.map((role) => (
                <label
                  key={role}
                  className="flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="size-4 rounded border-input"
                  />
                  <span>{role}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </AuthAuditReasonModal>
    </AuthAccountShell>
  )
}
