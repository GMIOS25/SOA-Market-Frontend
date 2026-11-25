import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, ChevronLeft, ChevronRight, CircleCheck, RotateCw, TriangleAlert, X } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
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
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatNumber, formatVnd } from '@/lib/format'
import {
  apiListSellerInventory,
  apiUpdateVariantStock,
  catalogKeys,
  type SellerInventoryEntry,
} from '../api'
import { textFieldClass } from '../components/form-field'
import { formatAttributesText } from '../management-helpers'

const PAGE_SIZE = 20

/** S4 `/seller/inventory` — tồn vật lý (`onHand`), giữ chỗ (`reserved`), khả dụng (`available`) (FR-PRD-007). */
export function SellerInventoryPage() {
  const { t } = useTranslation('catalog')
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const productId = searchParams.get('productId')?.trim() || ''
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1)
  const fieldId = useId()

  const inventoryQuery = useQuery({
    queryKey: catalogKeys.sellerInventory({ page, pageSize: PAGE_SIZE, productId: productId || undefined }),
    queryFn: () => apiListSellerInventory({ page, pageSize: PAGE_SIZE, productId: productId || undefined }),
  })

  const [editing, setEditing] = useState<SellerInventoryEntry | null>(null)
  const [onHandInput, setOnHandInput] = useState('')
  const [reasonInput, setReasonInput] = useState('')
  const [dialogError, setDialogError] = useState<{ message: string; isConflict?: boolean } | null>(null)
  const [successNotice, setSuccessNotice] = useState('')

  function openEdit(entry: SellerInventoryEntry) {
    setEditing(entry)
    setOnHandInput(String(entry.onHand))
    setReasonInput('')
    setDialogError(null)
  }

  const updateMutation = useMutation({
    mutationFn: ({ variantId, onHand, version, reason }: { variantId: string; onHand: number; version: number; reason?: string }) =>
      apiUpdateVariantStock(variantId, {
        onHand,
        version,
        ...(reason?.trim() ? { reason: reason.trim() } : {}),
      }),
    onSuccess: async (res) => {
      const sku = editing?.sku ?? res.variantId
      setEditing(null)
      setSuccessNotice(t('sellerInventory.updatedSuccess', { sku, available: formatNumber(res.available) }))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: catalogKeys.sellerInventoryRoot }),
        queryClient.invalidateQueries({ queryKey: catalogKeys.sellerProductsList }),
      ])
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') {
        setDialogError({ message: t('sellerInventory.versionConflict'), isConflict: true })
        return
      }
      setDialogError({ message: error instanceof Error ? error.message : t('sellerInventory.loadError') })
    },
  })

  function handleSaveStock(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    setDialogError(null)
    const parsed = Number(onHandInput)
    if (!Number.isInteger(parsed) || parsed < 0 || parsed < editing.reserved) {
      setDialogError({ message: t('sellerInventory.minReservedError', { reserved: editing.reserved }) })
      return
    }
    updateMutation.mutate({
      variantId: editing.variantId,
      onHand: parsed,
      version: editing.version,
      reason: reasonInput,
    })
  }

  async function reloadInDialog() {
    const res = await inventoryQuery.refetch()
    if (!editing || !res.data?.data) return
    const fresh = res.data.data.find((row) => row.variantId === editing.variantId)
    if (fresh) {
      setEditing(fresh)
      setOnHandInput(String(fresh.onHand))
      setDialogError(null)
    }
  }

  const entries = inventoryQuery.data?.data ?? []
  const pagination = inventoryQuery.data?.pagination

  function goToPage(nextPage: number) {
    const next = new URLSearchParams(searchParams)
    if (nextPage <= 1) next.delete('page')
    else next.set('page', String(nextPage))
    setSearchParams(next)
  }

  function clearProductFilter() {
    const next = new URLSearchParams(searchParams)
    next.delete('productId')
    next.delete('page')
    setSearchParams(next)
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('sellerInventory.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('sellerInventory.subtitle')}</p>
        </div>
        {productId && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs">
            <span>{t('sellerInventory.filterProductLabel')}:</span>
            <CopyableId value={productId} label="Product" />
            <Button type="button" size="sm" variant="ghost" onClick={clearProductFilter}>
              <X aria-hidden="true" className="size-3.5" />
              {t('sellerInventory.clearFilter')}
            </Button>
          </div>
        )}
      </header>

      {successNotice && (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-status-success-border bg-status-success px-4 py-3 text-sm font-medium text-status-success-foreground">
          <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
          {successNotice}
        </div>
      )}

      {inventoryQuery.isPending && (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      )}

      {inventoryQuery.isError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-status-danger-border bg-status-danger p-4 text-sm text-status-danger-foreground">
          <p>{inventoryQuery.error instanceof Error ? inventoryQuery.error.message : t('sellerInventory.loadError')}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void inventoryQuery.refetch()}>
            <RotateCw aria-hidden="true" className="size-3.5" />
            {t('sellerProducts.reload')}
          </Button>
        </div>
      )}

      {!inventoryQuery.isPending && !inventoryQuery.isError && entries.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <Boxes aria-hidden="true" className="size-10 text-muted-foreground" />
          <h2 className="text-base font-semibold">{t('sellerInventory.emptyTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('sellerInventory.emptyDescription')}</p>
        </div>
      )}

      {!inventoryQuery.isPending && !inventoryQuery.isError && entries.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('sellerInventory.columns.productSku')}</th>
                <th className="px-4 py-3 font-medium">{t('sellerInventory.columns.price')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('sellerInventory.columns.onHand')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('sellerInventory.columns.reserved')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('sellerInventory.columns.available')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('sellerInventory.columns.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((entry) => {
                const attrs = formatAttributesText(entry.attributes)
                return (
                  <tr key={entry.variantId} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{entry.productName}</span>
                        <StatusBadge status={entry.productStatus} />
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {entry.sku}
                        {attrs ? ` · ${attrs}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatVnd(entry.price)}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{formatNumber(entry.onHand)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{formatNumber(entry.reserved)}</td>
                    <td className={`px-4 py-3 text-right font-semibold tabular-nums ${entry.available === 0 ? 'text-status-danger-foreground' : 'text-status-success-foreground'}`}>
                      {formatNumber(entry.available)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => openEdit(entry)}>
                        {t('sellerInventory.updateButton')}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
          <span className="tabular-nums">
            {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page >= pagination.totalPages}
            onClick={() => goToPage(page + 1)}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && !updateMutation.isPending && setEditing(null)}>
        <DialogContent>
          <form onSubmit={(event) => handleSaveStock(event)} noValidate className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{t('sellerInventory.dialogTitle')}</DialogTitle>
              <DialogDescription>
                {editing ? t('sellerInventory.dialogDesc', { sku: editing.sku, reserved: editing.reserved }) : ''}
              </DialogDescription>
            </DialogHeader>

            {dialogError && (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-status-danger-border bg-status-danger p-3 text-sm text-status-danger-foreground">
                <p className="flex items-center gap-2">
                  <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
                  {dialogError.message}
                </p>
                {dialogError.isConflict && (
                  <Button type="button" size="sm" variant="outline" onClick={() => void reloadInDialog()}>
                    <RotateCw aria-hidden="true" className="size-3.5" />
                    {t('sellerInventory.reloadLatest')}
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-onhand`}>{t('sellerInventory.newOnHandLabel')}</Label>
              <input
                id={`${fieldId}-onhand`}
                type="number"
                min={editing?.reserved ?? 0}
                value={onHandInput}
                onChange={(event) => setOnHandInput(event.target.value)}
                className={textFieldClass}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-reason`}>{t('sellerInventory.reasonLabel')}</Label>
              <input
                id={`${fieldId}-reason`}
                type="text"
                maxLength={500}
                value={reasonInput}
                onChange={(event) => setReasonInput(event.target.value)}
                placeholder={t('sellerInventory.reasonPlaceholder')}
                className={textFieldClass}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" disabled={updateMutation.isPending} onClick={() => setEditing(null)}>
                {t('sellerInventory.cancel')}
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? t('sellerInventory.savingStock') : t('sellerInventory.saveStock')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
