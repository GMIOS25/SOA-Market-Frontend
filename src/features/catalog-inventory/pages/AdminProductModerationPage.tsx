import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, CircleCheck, PackageSearch, RotateCw, Search, ShieldAlert, TriangleAlert } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/errors'
import { AuditReasonDialog, CopyableId } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatVnd } from '@/lib/format'
import {
  apiAdminDecideProduct,
  apiAdminListCategories,
  apiAdminListReviewQueue,
  apiGetProduct,
  apiSearchProducts,
  catalogKeys,
  type Product,
  type ProductSummary,
} from '../api'
import { productImageUrl } from '../media'
import { findCategoryName } from '../management-helpers'

type ModerationTab = 'queue' | 'active'

type DecisionTarget = {
  decision: 'REJECT' | 'TAKEDOWN'
  productId: string
  name: string
  version: number
}

/** A6 `/admin/moderation/products` — hàng chờ kiểm duyệt & gỡ sản phẩm đang bán (FR-PRD-009). */
export function AdminProductModerationPage() {
  const { t } = useTranslation('catalog')
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<ModerationTab>('queue')
  const [page, setPage] = useState(1)
  const [activeQueryInput, setActiveQueryInput] = useState('')
  const [activeSearchText, setActiveSearchText] = useState('')
  const [decisionTarget, setDecisionTarget] = useState<DecisionTarget | null>(null)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; message: string; isConflict?: boolean } | null>(null)

  const categoriesQuery = useQuery({
    queryKey: catalogKeys.adminCategories,
    queryFn: apiAdminListCategories,
  })
  const queueQuery = useQuery({
    queryKey: catalogKeys.adminReviewQueue({ page, pageSize: 20 }),
    queryFn: () => apiAdminListReviewQueue({ page, pageSize: 20 }),
    enabled: tab === 'queue',
  })
  const activeProductsQuery = useQuery({
    queryKey: catalogKeys.search({ q: activeSearchText || undefined, page: 1, pageSize: 20, sort: 'newest' }),
    queryFn: () => apiSearchProducts({ q: activeSearchText || undefined, page: 1, pageSize: 20, sort: 'newest' }),
    enabled: tab === 'active',
  })

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data])

  async function refreshAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: catalogKeys.adminReviewQueueRoot }),
      queryClient.invalidateQueries({ queryKey: ['catalog', 'search'] }),
    ])
  }

  function handleConflictOrError(error: unknown) {
    if (error instanceof ApiError && (error.code === 'VERSION_CONFLICT' || error.code === 'ALREADY_DECIDED')) {
      setNotice({ kind: 'error', message: t('adminModeration.conflictNotice'), isConflict: true })
      void refreshAll()
      return true
    }
    return false
  }

  const approveMutation = useMutation({
    mutationFn: (product: Product) =>
      apiAdminDecideProduct(product.productId, { decision: 'APPROVE', version: product.version }),
    onSuccess: (updated) => {
      setNotice({ kind: 'success', message: t('adminModeration.approvedSuccess', { name: updated.name }) })
      void refreshAll()
    },
    onError: (error) => {
      if (handleConflictOrError(error)) return
      setNotice({ kind: 'error', message: error instanceof Error ? error.message : t('adminModeration.loadError') })
    },
  })

  async function confirmReasonDecision(reason: string) {
    if (!decisionTarget) return
    try {
      const updated = await apiAdminDecideProduct(decisionTarget.productId, {
        decision: decisionTarget.decision,
        version: decisionTarget.version,
        reason,
      })
      setNotice({
        kind: 'success',
        message: t(
          decisionTarget.decision === 'REJECT' ? 'adminModeration.rejectedSuccess' : 'adminModeration.takedownSuccess',
          { name: updated.name },
        ),
      })
      await refreshAll()
    } catch (error) {
      if (handleConflictOrError(error)) {
        setDecisionTarget(null)
        return
      }
      throw error
    }
  }

  async function openTakedownForSummary(summary: ProductSummary) {
    try {
      const latest = await apiGetProduct(summary.productId)
      setDecisionTarget({
        decision: 'TAKEDOWN',
        productId: latest.productId,
        name: latest.name,
        version: latest.version,
      })
    } catch (error) {
      setNotice({ kind: 'error', message: error instanceof Error ? error.message : t('adminModeration.loadError') })
    }
  }

  function handleActiveSearch(event: FormEvent) {
    event.preventDefault()
    setActiveSearchText(activeQueryInput.trim())
  }

  const queueItems = queueQuery.data?.data ?? []
  const queuePagination = queueQuery.data?.pagination
  const activeItems = activeProductsQuery.data?.data ?? []

  return (
    <div className="flex flex-col gap-5">
      <header className="space-y-1 border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('adminModeration.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('adminModeration.subtitle')}</p>
      </header>

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${
            notice.kind === 'error'
              ? 'border-status-danger-border bg-status-danger text-status-danger-foreground'
              : 'border-status-success-border bg-status-success text-status-success-foreground'
          }`}
        >
          <p className="flex items-center gap-2">
            {notice.kind === 'error' ? (
              <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
            ) : (
              <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
            )}
            {notice.message}
          </p>
          {notice.isConflict && (
            <Button type="button" size="sm" variant="outline" onClick={() => void refreshAll()}>
              <RotateCw aria-hidden="true" className="size-3.5" />
              {t('adminModeration.reload')}
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('adminModeration.title')}>
        <Button
          type="button"
          role="tab"
          aria-selected={tab === 'queue'}
          variant={tab === 'queue' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('queue')}
        >
          {t('adminModeration.tabs.queue')}
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={tab === 'active'}
          variant={tab === 'active' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('active')}
        >
          {t('adminModeration.tabs.active')}
        </Button>
      </div>

      {tab === 'queue' && (
        <>
          {queueQuery.isPending && (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          )}

          {queueQuery.isError && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-status-danger-border bg-status-danger p-4 text-sm text-status-danger-foreground">
              <p>{queueQuery.error instanceof Error ? queueQuery.error.message : t('adminModeration.loadError')}</p>
              <Button type="button" size="sm" variant="outline" onClick={() => void queueQuery.refetch()}>
                {t('adminModeration.reload')}
              </Button>
            </div>
          )}

          {!queueQuery.isPending && !queueQuery.isError && queueItems.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card p-8 text-center">
              <PackageSearch aria-hidden="true" className="size-10 text-muted-foreground" />
              <p className="text-sm font-medium">{t('adminModeration.emptyQueue')}</p>
            </div>
          )}

          {!queueQuery.isPending && !queueQuery.isError && queueItems.length > 0 && (
            <ul className="flex flex-col gap-3">
              {queueItems.map((item) => {
                const imgSrc = productImageUrl(item.images?.[0])
                return (
                  <li key={item.productId} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-1 gap-3">
                      {imgSrc && <img src={imgSrc} alt={item.name} className="size-16 shrink-0 rounded-lg object-cover" />}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-foreground">{item.name}</h2>
                          <StatusBadge status={item.status} />
                          <CopyableId value={item.productId} label="ID" />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            {t('adminModeration.categoryLabel')}: {findCategoryName(categories, item.categoryId)}
                          </span>
                          <span className="flex items-center gap-1">
                            {t('adminModeration.shopLabel')}: <CopyableId value={item.shopId} label="Shop" />
                          </span>
                          <span className="font-medium text-foreground tabular-nums">
                            {item.minPrice === item.maxPrice
                              ? formatVnd(item.minPrice)
                              : `${formatVnd(item.minPrice)} – ${formatVnd(item.maxPrice)}`}
                          </span>
                        </div>
                        {item.moderationReason && (
                          <p className="text-xs text-status-warning-foreground">
                            {t('adminModeration.moderationReasonLabel')}: {item.moderationReason}
                          </p>
                        )}
                        <ul className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {(item.variants ?? []).map((v) => (
                            <li key={v.variantId} className="rounded bg-muted px-2 py-0.5 font-mono">
                              {t('adminModeration.skuPreview', {
                                sku: v.sku,
                                weight: v.weightGram,
                                price: formatVnd(v.price),
                              })}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={approveMutation.isPending}
                        onClick={() => approveMutation.mutate(item)}
                      >
                        {t('adminModeration.approveButton')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          setDecisionTarget({
                            decision: 'REJECT',
                            productId: item.productId,
                            name: item.name,
                            version: item.version,
                          })
                        }
                      >
                        {t('adminModeration.rejectButton')}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {queuePagination && queuePagination.totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
              <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft aria-hidden="true" className="size-4" />
              </Button>
              <span className="tabular-nums">
                {queuePagination.page} / {queuePagination.totalPages}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page >= queuePagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {tab === 'active' && (
        <>
          <form onSubmit={handleActiveSearch} className="flex flex-wrap gap-2">
            <label className="relative flex flex-1 items-center sm:max-w-md">
              <span className="sr-only">{t('adminModeration.searchActiveLabel')}</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
              <input
                type="search"
                value={activeQueryInput}
                onChange={(event) => setActiveQueryInput(event.target.value)}
                placeholder={t('adminModeration.searchActivePlaceholder')}
                className="h-9 w-full rounded-md border border-input bg-card pr-3 pl-9 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              />
            </label>
            <Button type="submit" size="sm" variant="outline">
              {t('adminModeration.searchButton')}
            </Button>
          </form>

          {activeProductsQuery.isPending && <Skeleton className="h-24 w-full rounded-xl" />}

          {!activeProductsQuery.isPending && !activeProductsQuery.isError && activeItems.length === 0 && (
            <p className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              {t('adminModeration.emptyActive')}
            </p>
          )}

          {!activeProductsQuery.isPending && !activeProductsQuery.isError && activeItems.length > 0 && (
            <ul className="flex flex-col gap-3">
              {activeItems.map((item) => (
                <li key={item.productId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{item.name}</span>
                      <CopyableId value={item.productId} label="ID" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {findCategoryName(categories, item.categoryId)} ·{' '}
                      <span className="font-medium text-foreground tabular-nums">{formatVnd(item.minPrice)}</span>
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => void openTakedownForSummary(item)}
                  >
                    <ShieldAlert aria-hidden="true" className="size-3.5" />
                    {t('adminModeration.takedownButton')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <AuditReasonDialog
        open={decisionTarget !== null}
        onOpenChange={(open) => !open && setDecisionTarget(null)}
        variant="destructive"
        title={
          decisionTarget?.decision === 'TAKEDOWN'
            ? t('adminModeration.takedownDialogTitle')
            : t('adminModeration.rejectDialogTitle')
        }
        description={
          decisionTarget
            ? t(
                decisionTarget.decision === 'TAKEDOWN'
                  ? 'adminModeration.takedownDialogDesc'
                  : 'adminModeration.rejectDialogDesc',
                { name: decisionTarget.name },
              )
            : ''
        }
        confirmLabel={
          decisionTarget?.decision === 'TAKEDOWN'
            ? t('adminModeration.takedownConfirmLabel')
            : t('adminModeration.rejectConfirmLabel')
        }
        onConfirm={confirmReasonDecision}
      />
    </div>
  )
}
