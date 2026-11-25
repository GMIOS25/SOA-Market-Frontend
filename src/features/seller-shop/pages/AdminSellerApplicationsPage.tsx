import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, CircleCheck, Inbox, RotateCcw, TriangleAlert, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/errors'
import { AuditReasonDialog, CopyableId, ServiceFallbackBanner } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  apiAdminApproveApplication,
  apiAdminListApplications,
  apiAdminRejectApplication,
  sellerShopKeys,
  type ApplicationDTO,
  type ApplicationStatus,
} from '../api'
import { ApplicationDetailSheet } from '../components/ApplicationDetailSheet'
import { ApproveApplicationDialog } from '../components/ApproveApplicationDialog'

type StatusTab = ApplicationStatus | 'ALL'
const TABS: StatusTab[] = ['PENDING', 'APPROVED', 'REJECTED', 'ALL']
const PAGE_SIZE = 20

type Notice =
  | { kind: 'success'; message: string; applicationId: string }
  | { kind: 'conflict'; message: string }

/** A2 `/admin/seller-applications` — hàng chờ duyệt hồ sơ nhà bán (FR-SEL-002, TC-SEL-02). */
export function AdminSellerApplicationsPage() {
  const { t } = useTranslation('sellerShop')
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<StatusTab>('PENDING')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const params = { page, pageSize: PAGE_SIZE, ...(tab === 'ALL' ? {} : { status: tab }) }
  const listQuery = useQuery({
    queryKey: sellerShopKeys.adminApplicationList(params),
    queryFn: () => apiAdminListApplications(params),
    placeholderData: keepPreviousData,
  })

  const applications = listQuery.data?.data ?? []
  const pagination = listQuery.data?.pagination
  // Giữ bản đã mở để panel không biến mất khi danh sách tải lại (VD đổi tab sau khi duyệt).
  const [selectedSnapshot, setSelectedSnapshot] = useState<ApplicationDTO | null>(null)
  const selected = applications.find((a) => a.applicationId === selectedId) ?? (selectedId ? selectedSnapshot : null)

  function openDetail(application: ApplicationDTO) {
    setSelectedSnapshot(application)
    setSelectedId(application.applicationId)
  }

  function closeDetail() {
    setSelectedId(null)
    setDialog(null)
  }

  function changeTab(next: StatusTab) {
    setTab(next)
    setPage(1)
  }

  /**
   * Gọi API duyệt/từ chối. 409 `APPLICATION_ALREADY_DECIDED` (Admin khác vừa xử lý — AC3) → đóng dialog,
   * tải lại danh sách và báo xung đột; lỗi khác → ném lại để dialog giữ nguyên & hiện lỗi.
   */
  async function decide(application: ApplicationDTO, action: () => Promise<ApplicationDTO>, successKey: 'approved' | 'rejected') {
    try {
      await action()
      setNotice({
        kind: 'success',
        message: t(`admin.${successKey}`, { shopName: application.shopName }),
        applicationId: application.applicationId,
      })
      closeDetail()
    } catch (error) {
      if (error instanceof ApiError && error.code === 'APPLICATION_ALREADY_DECIDED') {
        setNotice({ kind: 'conflict', message: t('admin.conflict') })
        closeDetail()
        return
      }
      throw error
    } finally {
      void queryClient.invalidateQueries({ queryKey: sellerShopKeys.adminApplications })
    }
  }

  const listError = listQuery.isError && !listQuery.data

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('admin.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('admin.subtitle')}</p>
      </header>

      {notice && (
        <div
          role="status"
          className={cn(
            'flex items-start gap-3 rounded-md border p-3 text-sm',
            notice.kind === 'success'
              ? 'border-status-success-border bg-status-success text-status-success-foreground'
              : 'border-status-warning-border bg-status-warning text-status-warning-foreground',
          )}
        >
          {notice.kind === 'success' ? (
            <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          ) : (
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          )}
          <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium">{notice.message}</span>
            {notice.kind === 'success' && (
              <CopyableId
                value={notice.applicationId}
                display={notice.applicationId.slice(0, 8).toUpperCase()}
                label={t('admin.detail.applicationId')}
              />
            )}
            {notice.kind === 'conflict' && (
              <Button type="button" variant="outline" size="xs" onClick={() => void listQuery.refetch()}>
                <RotateCcw aria-hidden="true" />
                {t('admin.reload')}
              </Button>
            )}
          </div>
          <Button type="button" variant="ghost" size="icon-xs" aria-label={t('admin.dismiss')} onClick={() => setNotice(null)}>
            <X aria-hidden="true" />
          </Button>
        </div>
      )}

      <div role="tablist" aria-label={t('admin.tabs.label')} className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => changeTab(value)}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              tab === value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`admin.tabs.${value}`)}
          </button>
        ))}
      </div>

      <section role="tabpanel" aria-busy={listQuery.isFetching} className="flex flex-col gap-4">
        {listQuery.isPending && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}

        {listError && (
          <ServiceFallbackBanner
            message={t('admin.loadError')}
            onRetry={() => void listQuery.refetch()}
            isRetrying={listQuery.isFetching}
          />
        )}

        {listQuery.data && applications.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            <Inbox aria-hidden="true" className="size-8" />
            {tab === 'PENDING' ? t('admin.empty.PENDING') : t('admin.empty.other')}
          </div>
        )}

        {applications.length > 0 && (
          <>
            {/* ≥ 768px: bảng; < 768px: stacked card list (Brief §5.2). */}
            <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
              <table className="w-full text-sm">
                <thead className="bg-background text-left text-xs text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">{t('admin.columns.shop')}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t('admin.columns.sellerType')}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t('admin.columns.identity')}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t('admin.columns.taxCode')}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t('admin.columns.submittedAt')}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t('admin.columns.status')}</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      <span className="sr-only">{t('admin.columns.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {applications.map((application) => (
                    <tr key={application.applicationId} className="hover:bg-background">
                      <td className="px-4 py-3 font-medium">{application.shopName}</td>
                      <td className="px-4 py-3">{t(`sellerType.${application.sellerType}`)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{application.identityOrBusinessNumber}</td>
                      <td className="px-4 py-3 font-mono text-xs">{application.taxCode}</td>
                      <td className="px-4 py-3 tabular-nums">{formatDateTime(application.createdAt)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={application.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button type="button" variant="outline" size="sm" onClick={() => openDetail(application)}>
                          {t('admin.view')}
                          <span className="sr-only">: {application.shopName}</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="flex flex-col gap-3 md:hidden">
              {applications.map((application) => (
                <li key={application.applicationId} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{application.shopName}</p>
                    <StatusBadge status={application.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(`sellerType.${application.sellerType}`)} · {formatDateTime(application.createdAt)}
                  </p>
                  <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => openDetail(application)}>
                    {t('admin.view')}
                    <span className="sr-only">: {application.shopName}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}

        {pagination && pagination.totalPages > 1 && (
          <nav className="flex items-center justify-between gap-3 text-sm" aria-label={t('admin.pagination.summary', pagination)}>
            <span className="text-muted-foreground tabular-nums">{t('admin.pagination.summary', pagination)}</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || listQuery.isFetching}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft aria-hidden="true" />
                {t('admin.pagination.prev')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages || listQuery.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('admin.pagination.next')}
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </nav>
        )}
      </section>

      <ApplicationDetailSheet
        application={selected}
        onOpenChange={(open) => !open && closeDetail()}
        onApprove={() => setDialog('approve')}
        onReject={() => setDialog('reject')}
      />

      {selected && (
        <>
          <ApproveApplicationDialog
            open={dialog === 'approve'}
            onOpenChange={(open) => !open && setDialog(null)}
            shopName={selected.shopName}
            onConfirm={(note) =>
              decide(selected, () => apiAdminApproveApplication(selected.applicationId, note), 'approved')
            }
          />
          <AuditReasonDialog
            open={dialog === 'reject'}
            onOpenChange={(open) => !open && setDialog(null)}
            title={t('admin.rejectDialog.title', { shopName: selected.shopName })}
            description={t('admin.rejectDialog.description')}
            confirmLabel={t('admin.rejectDialog.confirm')}
            variant="destructive"
            onConfirm={(reason) =>
              decide(selected, () => apiAdminRejectApplication(selected.applicationId, reason), 'rejected')
            }
          />
        </>
      )}
    </div>
  )
}
