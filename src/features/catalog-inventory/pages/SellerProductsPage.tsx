import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, CircleCheck, Eye, EyeOff, Package, Pencil, Plus, RotateCw, Search, Trash2, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ApiError } from '@/api/errors'
import { CopyableId } from '@/components/shared'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  apiDeleteProduct,
  apiGetProduct,
  apiHideProduct,
  apiListAllSellerInventory,
  apiUpdateProduct,
  catalogKeys,
} from '../api'
import { groupInventoryByProduct, type SellerProductSummaryRow } from '../management-helpers'

type StatusFilter = 'ALL' | 'ACTIVE' | 'DRAFT' | 'PENDING_REVIEW' | 'HIDDEN' | 'REJECTED'

const STATUS_TABS: readonly StatusFilter[] = ['ALL', 'ACTIVE', 'DRAFT', 'PENDING_REVIEW', 'HIDDEN', 'REJECTED']

type Notice =
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string; isConflict?: boolean }

/** S3 `/seller/products` — quản lý danh sách sản phẩm của nhà bán (FR-PRD-001..003). */
export function SellerProductsPage() {
  const { t } = useTranslation('catalog')
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<SellerProductSummaryRow | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const inventoryQuery = useQuery({
    queryKey: catalogKeys.sellerProductsList,
    queryFn: apiListAllSellerInventory,
  })

  const products = useMemo(
    () => groupInventoryByProduct(inventoryQuery.data ?? []),
    [inventoryQuery.data],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((item) => {
      if (statusFilter !== 'ALL' && item.productStatus !== statusFilter) return false
      if (!q) return true
      return (
        item.productName.toLowerCase().includes(q) ||
        item.skus.some((sku) => sku.toLowerCase().includes(q))
      )
    })
  }, [products, search, statusFilter])

  async function invalidateCatalog() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: catalogKeys.sellerProductsList }),
      queryClient.invalidateQueries({ queryKey: catalogKeys.sellerInventoryRoot }),
    ])
  }

  function handleMutationError(error: unknown) {
    if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') {
      setNotice({ kind: 'error', message: t('sellerProducts.versionConflict'), isConflict: true })
      void invalidateCatalog()
      return
    }
    setNotice({
      kind: 'error',
      message: error instanceof Error ? error.message : t('sellerProducts.loadError'),
    })
  }

  const hideMutation = useMutation({
    mutationFn: async (row: SellerProductSummaryRow) => {
      const latest = await apiGetProduct(row.productId)
      return apiHideProduct(row.productId, latest.version)
    },
    onSuccess: (updated) => {
      setNotice({ kind: 'success', message: t('sellerProducts.hiddenSuccess', { name: updated.name }) })
      void invalidateCatalog()
    },
    onError: handleMutationError,
  })

  const publishMutation = useMutation({
    mutationFn: async (row: SellerProductSummaryRow) => {
      const latest = await apiGetProduct(row.productId)
      return apiUpdateProduct(row.productId, {
        name: latest.name,
        categoryId: latest.categoryId,
        brand: latest.brand ?? undefined,
        description: latest.description ?? undefined,
        images: latest.images ?? [],
        status: 'ACTIVE',
        version: latest.version,
        variants: (latest.variants ?? []).map((variant) => ({
          variantId: variant.variantId,
          sku: variant.sku,
          price: variant.price,
          weightGram: variant.weightGram,
          attributes: variant.attributes ?? {},
          ...(variant.dimensions ? { dimensions: variant.dimensions } : {}),
        })),
      })
    },
    onSuccess: (updated) => {
      setNotice({ kind: 'success', message: t('sellerProducts.publishedSuccess', { name: updated.name }) })
      void invalidateCatalog()
    },
    onError: handleMutationError,
  })

  const deleteMutation = useMutation({
    mutationFn: async (row: SellerProductSummaryRow) => {
      const latest = await apiGetProduct(row.productId)
      return apiDeleteProduct(row.productId, latest.version)
    },
    onSuccess: (_deleted, row) => {
      setDeleteTarget(null)
      setNotice({ kind: 'success', message: t('sellerProducts.deletedSuccess', { name: row.productName }) })
      void invalidateCatalog()
    },
    onError: (error) => {
      setDeleteTarget(null)
      handleMutationError(error)
    },
  })

  const busy = hideMutation.isPending || publishMutation.isPending || deleteMutation.isPending

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('sellerProducts.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('sellerProducts.subtitle')}</p>
        </div>
        <Button asChild>
          <Link to="/seller/products/new">
            <Plus aria-hidden="true" className="size-4" />
            {t('sellerProducts.createButton')}
          </Link>
        </Button>
      </header>

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={cn(
            'flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm',
            notice.kind === 'error'
              ? 'border-status-danger-border bg-status-danger text-status-danger-foreground'
              : 'border-status-success-border bg-status-success text-status-success-foreground',
          )}
        >
          <p className="flex items-center gap-2 font-medium">
            {notice.kind === 'error' ? (
              <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
            ) : (
              <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
            )}
            {notice.message}
          </p>
          {notice.kind === 'error' && notice.isConflict && (
            <Button type="button" size="sm" variant="outline" onClick={() => void inventoryQuery.refetch()}>
              <RotateCw aria-hidden="true" className="size-3.5" />
              {t('sellerProducts.reload')}
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t('sellerProducts.title')}>
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab
            return (
              <Button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                size="sm"
                variant={active ? 'default' : 'outline'}
                onClick={() => setStatusFilter(tab)}
              >
                {t(`sellerProducts.statusTabs.${tab}`)}
              </Button>
            )
          })}
        </div>

        <label className="relative flex w-full items-center sm:max-w-xs">
          <span className="sr-only">{t('sellerProducts.searchLabel')}</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('sellerProducts.searchPlaceholder')}
            className="h-9 w-full rounded-md border border-input bg-card pr-3 pl-9 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
        </label>
      </div>

      {inventoryQuery.isPending && (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      )}

      {inventoryQuery.isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-status-danger-border bg-status-danger p-4 text-sm text-status-danger-foreground"
        >
          <p>
            {inventoryQuery.error instanceof ApiError && inventoryQuery.error.status === 403
              ? inventoryQuery.error.message
              : inventoryQuery.error instanceof Error
                ? inventoryQuery.error.message
                : t('sellerProducts.loadError')}
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => void inventoryQuery.refetch()}>
            <RotateCw aria-hidden="true" className="size-3.5" />
            {t('sellerProducts.reload')}
          </Button>
        </div>
      )}

      {!inventoryQuery.isPending && !inventoryQuery.isError && products.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <Package aria-hidden="true" className="size-10 text-muted-foreground" />
          <h2 className="text-base font-semibold">{t('sellerProducts.emptyTitle')}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{t('sellerProducts.emptyDescription')}</p>
          <Button asChild size="sm">
            <Link to="/seller/products/new">{t('sellerProducts.createButton')}</Link>
          </Button>
        </div>
      )}

      {!inventoryQuery.isPending && !inventoryQuery.isError && products.length > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm font-medium">{t('sellerProducts.emptyFilteredTitle')}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setStatusFilter('ALL')
              setSearch('')
            }}
          >
            {t('sellerProducts.emptyFilteredReset')}
          </Button>
        </div>
      )}

      {!inventoryQuery.isPending && !inventoryQuery.isError && filtered.length > 0 && (
        <ul className="flex flex-col gap-3">
          {filtered.map((row) => {
            const priceLabel =
              row.minPrice === row.maxPrice
                ? formatVnd(row.minPrice)
                : `${formatVnd(row.minPrice)} – ${formatVnd(row.maxPrice)}`
            const canPublish = row.productStatus === 'DRAFT' || row.productStatus === 'HIDDEN' || row.productStatus === 'REJECTED'
            return (
              <li
                key={row.productId}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/products/${row.productId}`}
                      className="font-semibold text-foreground hover:text-primary hover:underline"
                    >
                      {row.productName}
                    </Link>
                    <StatusBadge status={row.productStatus} />
                    <CopyableId value={row.productId} label="ID" />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground tabular-nums">{priceLabel}</span>
                    <span>{t('sellerProducts.skuCount', { count: row.variantCount })}</span>
                    <span className="tabular-nums">
                      {t('sellerProducts.stockSummary', {
                        available: formatNumber(row.totalAvailable),
                        onHand: formatNumber(row.totalOnHand),
                        reserved: formatNumber(row.totalReserved),
                      })}
                    </span>
                  </div>
                  <p className="truncate font-mono text-xs text-muted-foreground">{row.skus.join(', ')}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild type="button" size="sm" variant="outline">
                    <Link to={`/products/${row.productId}`}>
                      <Eye aria-hidden="true" className="size-3.5" />
                      {t('sellerProducts.actions.preview')}
                    </Link>
                  </Button>
                  <Button asChild type="button" size="sm" variant="outline">
                    <Link to={`/seller/products/${row.productId}/edit`}>
                      <Pencil aria-hidden="true" className="size-3.5" />
                      {t('sellerProducts.actions.edit')}
                    </Link>
                  </Button>
                  <Button asChild type="button" size="sm" variant="outline">
                    <Link to={`/seller/inventory?productId=${row.productId}`}>
                      <Boxes aria-hidden="true" className="size-3.5" />
                      {t('sellerProducts.actions.inventory')}
                    </Link>
                  </Button>
                  {row.productStatus === 'ACTIVE' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => hideMutation.mutate(row)}
                    >
                      <EyeOff aria-hidden="true" className="size-3.5" />
                      {t('sellerProducts.actions.hide')}
                    </Button>
                  )}
                  {canPublish && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => publishMutation.mutate(row)}
                    >
                      {t('sellerProducts.actions.publish')}
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => setDeleteTarget(row)}
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                    {t('sellerProducts.actions.delete')}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && !deleteMutation.isPending && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sellerProducts.confirmDeleteTitle')}</DialogTitle>
            <DialogDescription>
              {deleteTarget ? t('sellerProducts.confirmDeleteDesc', { name: deleteTarget.productName }) : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleteMutation.isPending}
              onClick={() => setDeleteTarget(null)}
            >
              {t('sellerProducts.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending || !deleteTarget}
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget)
              }}
            >
              {t('sellerProducts.confirmDeleteSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
