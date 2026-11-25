import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, CircleCheck, Inbox, RotateCcw, Search, Star, TriangleAlert, X } from 'lucide-react'
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
  apiAdminListShops,
  apiAdminUpdateShopStatus,
  sellerShopKeys,
  type ShopDTO,
  type ShopStatus,
} from '../api'
import { AdminShopDetailSheet } from '../components/AdminShopDetailSheet'

type StatusTab = ShopStatus | 'ALL'
const TABS: StatusTab[] = ['ALL', 'ACTIVE', 'SUSPENDED', 'LOCKED']
const PAGE_SIZE = 20

type Notice =
  | { kind: 'success'; message: string; shopId: string }
  | { kind: 'conflict'; message: string }

/** A4 `/admin/shops` — Quản lý trạng thái gian hàng trên toàn sàn (`FR-SEL-004`, `TC-SEL-04`, T2-07). */
export function AdminShopsPage() {
  const { t } = useTranslation('sellerShop')
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<StatusTab>('ALL')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedSnapshot, setSelectedSnapshot] = useState<ShopDTO | null>(null)
  const [targetStatus, setTargetStatus] = useState<ShopStatus | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const trimmedQuery = searchQuery.trim()
  const params = {
    page,
    pageSize: PAGE_SIZE,
    ...(tab === 'ALL' ? {} : { status: tab }),
    ...(trimmedQuery ? { q: trimmedQuery } : {}),
  }

  const listQuery = useQuery({
    queryKey: sellerShopKeys.adminShopList(params),
    queryFn: () => apiAdminListShops(params),
    placeholderData: keepPreviousData,
  })

  const shops = listQuery.data?.data ?? []
  const pagination = listQuery.data?.pagination
  const selected = shops.find((s) => s.shopId === selectedId) ?? (selectedId ? selectedSnapshot : null)

  function openDetail(shop: ShopDTO) {
    setSelectedSnapshot(shop)
    setSelectedId(shop.shopId)
  }

  function closeDetail() {
    setSelectedId(null)
    setTargetStatus(null)
  }

  function changeTab(next: StatusTab) {
    setTab(next)
    setPage(1)
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSearchQuery(searchInput)
    setPage(1)
  }

  function clearSearch() {
    setSearchInput('')
    setSearchQuery('')
    setPage(1)
  }

  async function applyStatusChange(shop: ShopDTO, nextStatus: ShopStatus, reason: string) {
    try {
      await apiAdminUpdateShopStatus(shop.shopId, nextStatus, reason)
      setNotice({
        kind: 'success',
        message: t('adminShops.updated', { shopName: shop.name }),
        shopId: shop.shopId,
      })
      closeDetail()
    } catch (error) {
      if (error instanceof ApiError && (error.code === 'SHOP_STATUS_CONFLICT' || error.code === 'SHOP_VERSION_CONFLICT')) {
        setNotice({ kind: 'conflict', message: t('adminShops.conflict') })
        closeDetail()
        return
      }
      throw error
    } finally {
      void queryClient.invalidateQueries({ queryKey: sellerShopKeys.adminShops })
    }
  }

  const listError = listQuery.isError && !listQuery.data
  const hasFilters = tab !== 'ALL' || Boolean(trimmedQuery)

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('adminShops.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('adminShops.subtitle')}</p>
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
                value={notice.shopId}
                display={notice.shopId.slice(0, 8).toUpperCase()}
                label={t('adminShops.detail.shopId')}
              />
            )}
            {notice.kind === 'conflict' && (
              <Button type="button" variant="outline" size="xs" onClick={() => void listQuery.refetch()}>
                <RotateCcw aria-hidden="true" />
                {t('adminShops.reload')}
              </Button>
            )}
          </div>
          <Button type="button" variant="ghost" size="icon-xs" aria-label={t('adminShops.dismiss')} onClick={() => setNotice(null)}>
            <X aria-hidden="true" />
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label={t('adminShops.tabs.label')} className="flex gap-1 overflow-x-auto border-b border-border">
          {TABS.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => changeTab(value)}
              className={cn(
                '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                tab === value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`adminShops.tabs.${value}`)}
            </button>
          ))}
        </div>

        <form onSubmit={submitSearch} className="flex items-center gap-2" role="search">
          <div className="relative flex-1 sm:w-64">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label={t('adminShops.searchLabel')}
              placeholder={t('adminShops.searchPlaceholder')}
              className="h-9 w-full rounded-md border border-input bg-card pr-3 pl-8 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            {t('adminShops.searchSubmit')}
          </Button>
          {(searchInput || trimmedQuery) && (
            <Button type="button" variant="ghost" size="sm" onClick={clearSearch}>
              {t('adminShops.clearSearch')}
            </Button>
          )}
        </form>
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
            message={t('adminShops.loadError')}
            onRetry={() => void listQuery.refetch()}
            isRetrying={listQuery.isFetching}
          />
        )}

        {listQuery.data && shops.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            <Inbox aria-hidden="true" className="size-8" />
            {hasFilters ? t('adminShops.empty.filtered') : t('adminShops.empty.all')}
          </div>
        )}

        {shops.length > 0 && (
          <>
            <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
              <table className="w-full text-sm">
                <thead className="bg-background text-left text-xs text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">{t('adminShops.columns.shop')}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t('adminShops.columns.rating')}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t('adminShops.columns.status')}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t('adminShops.columns.changedBy')}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t('adminShops.columns.updatedAt')}</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      <span className="sr-only">{t('adminShops.columns.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shops.map((shop) => (
                    <tr key={shop.shopId} className="hover:bg-background">
                      <td className="px-4 py-3">
                        <p className="font-medium">{shop.name}</p>
                        {shop.statusReason && (
                          <p className="max-w-xs truncate text-xs text-muted-foreground">{shop.statusReason}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Star aria-hidden="true" className="size-3.5 text-status-warning-foreground" />
                          {shop.ratingAvg.toFixed(1)} ({shop.ratingCount})
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={shop.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {shop.statusChangedBy
                          ? t(`adminShops.changedBy.${shop.statusChangedBy}`)
                          : t('adminShops.changedBy.none')}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{formatDateTime(shop.updatedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button type="button" variant="outline" size="sm" onClick={() => openDetail(shop)}>
                          {t('adminShops.view')}
                          <span className="sr-only">: {shop.name}</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="flex flex-col gap-3 md:hidden">
              {shops.map((shop) => (
                <li key={shop.shopId} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{shop.name}</p>
                    <StatusBadge status={shop.status} />
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {shop.ratingAvg.toFixed(1)} ★ ({shop.ratingCount}) · {formatDateTime(shop.updatedAt)}
                  </p>
                  <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => openDetail(shop)}>
                    {t('adminShops.view')}
                    <span className="sr-only">: {shop.name}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}

        {pagination && pagination.totalPages > 1 && (
          <nav className="flex items-center justify-between gap-3 text-sm" aria-label={t('adminShops.pagination.summary', pagination)}>
            <span className="text-muted-foreground tabular-nums">{t('adminShops.pagination.summary', pagination)}</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || listQuery.isFetching}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft aria-hidden="true" />
                {t('adminShops.pagination.prev')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages || listQuery.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('adminShops.pagination.next')}
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </nav>
        )}
      </section>

      <AdminShopDetailSheet
        shop={selected}
        onOpenChange={(open) => !open && closeDetail()}
        onChangeStatus={(next) => setTargetStatus(next)}
      />

      {selected && targetStatus && (
        <AuditReasonDialog
          open={Boolean(targetStatus)}
          onOpenChange={(open) => !open && setTargetStatus(null)}
          title={t(`adminShops.dialog.${targetStatus}.title`, { shopName: selected.name })}
          description={t(`adminShops.dialog.${targetStatus}.description`)}
          confirmLabel={t(`adminShops.dialog.${targetStatus}.confirm`)}
          variant={targetStatus === 'ACTIVE' ? 'default' : 'destructive'}
          onConfirm={(reason) => applyStatusChange(selected, targetStatus, reason)}
        />
      )}
    </div>
  )
}
