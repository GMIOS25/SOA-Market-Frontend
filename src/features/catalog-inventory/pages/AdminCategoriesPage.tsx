import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, FolderTree, Pencil, Plus, RotateCw, Trash2, TriangleAlert } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
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
import {
  apiAdminCreateCategory,
  apiAdminDeleteCategory,
  apiAdminListCategories,
  apiAdminUpdateCategory,
  catalogKeys,
  type Category,
} from '../api'
import { textFieldClass } from '../components/form-field'

type FormState = {
  mode: 'create' | 'edit'
  categoryId?: string
  level: 1 | 2
  parentId: string
  name: string
  sortOrder: string
  status: 'VISIBLE' | 'HIDDEN'
}

/** A5 `/admin/categories` — quản lý cây danh mục tối đa 2 cấp (FR-PRD-005). */
export function AdminCategoriesPage() {
  const { t } = useTranslation('catalog')
  const queryClient = useQueryClient()
  const fieldId = useId()

  const categoriesQuery = useQuery({
    queryKey: catalogKeys.adminCategories,
    queryFn: apiAdminListCategories,
  })

  const [formState, setFormState] = useState<FormState | null>(null)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  async function invalidateCategories() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: catalogKeys.adminCategories }),
      queryClient.invalidateQueries({ queryKey: catalogKeys.categories }),
    ])
  }

  const saveMutation = useMutation({
    mutationFn: async (state: FormState) => {
      const sortOrder = Number(state.sortOrder)
      const body = {
        name: state.name.trim(),
        level: state.level,
        ...(state.level === 2 && state.parentId ? { parentId: state.parentId } : {}),
        sortOrder: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0,
        status: state.status,
      }
      if (state.mode === 'edit' && state.categoryId) {
        return apiAdminUpdateCategory(state.categoryId, body)
      }
      return apiAdminCreateCategory(body)
    },
    onSuccess: (saved, state) => {
      setFormState(null)
      setFormError('')
      setNotice({
        kind: 'success',
        message: t(state.mode === 'edit' ? 'adminCategories.updatedSuccess' : 'adminCategories.createdSuccess', {
          name: saved.name,
        }),
      })
      void invalidateCategories()
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : t('adminCategories.loadError'))
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (cat: Category) =>
      apiAdminUpdateCategory(cat.categoryId, {
        name: cat.name,
        level: cat.level === 2 ? 2 : 1,
        ...(cat.parentId ? { parentId: cat.parentId } : {}),
        sortOrder: cat.sortOrder,
        status: cat.status === 'VISIBLE' ? 'HIDDEN' : 'VISIBLE',
      }),
    onSuccess: (saved) => {
      setNotice({ kind: 'success', message: t('adminCategories.updatedSuccess', { name: saved.name }) })
      void invalidateCategories()
    },
    onError: (error) => {
      setNotice({ kind: 'error', message: error instanceof Error ? error.message : t('adminCategories.loadError') })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (cat: Category) => apiAdminDeleteCategory(cat.categoryId),
    onSuccess: (_res, cat) => {
      setDeleteTarget(null)
      setNotice({ kind: 'success', message: t('adminCategories.deletedSuccess', { name: cat.name }) })
      void invalidateCategories()
    },
    onError: (error) => {
      setDeleteTarget(null)
      setNotice({ kind: 'error', message: error instanceof Error ? error.message : t('adminCategories.loadError') })
    },
  })

  function openCreateRoot() {
    setFormError('')
    setFormState({ mode: 'create', level: 1, parentId: '', name: '', sortOrder: '0', status: 'VISIBLE' })
  }

  function openCreateChild(parent: Category) {
    setFormError('')
    setFormState({
      mode: 'create',
      level: 2,
      parentId: parent.categoryId,
      name: '',
      sortOrder: '0',
      status: 'VISIBLE',
    })
  }

  function openEdit(cat: Category) {
    setFormError('')
    setFormState({
      mode: 'edit',
      categoryId: cat.categoryId,
      level: cat.level === 2 ? 2 : 1,
      parentId: cat.parentId ?? '',
      name: cat.name,
      sortOrder: String(cat.sortOrder),
      status: cat.status === 'HIDDEN' ? 'HIDDEN' : 'VISIBLE',
    })
  }

  function submitForm(event: FormEvent) {
    event.preventDefault()
    if (!formState) return
    setFormError('')
    saveMutation.mutate(formState)
  }

  const tree = categoriesQuery.data ?? []

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('adminCategories.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('adminCategories.subtitle')}</p>
        </div>
        <Button type="button" onClick={openCreateRoot}>
          <Plus aria-hidden="true" className="size-4" />
          {t('adminCategories.addRootButton')}
        </Button>
      </header>

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${
            notice.kind === 'error'
              ? 'border-status-danger-border bg-status-danger text-status-danger-foreground'
              : 'border-status-success-border bg-status-success text-status-success-foreground'
          }`}
        >
          {notice.kind === 'error' ? (
            <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
          ) : (
            <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
          )}
          {notice.message}
        </div>
      )}

      {categoriesQuery.isPending && (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      )}

      {categoriesQuery.isError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-status-danger-border bg-status-danger p-4 text-sm text-status-danger-foreground">
          <p>{categoriesQuery.error instanceof Error ? categoriesQuery.error.message : t('adminCategories.loadError')}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void categoriesQuery.refetch()}>
            <RotateCw aria-hidden="true" className="size-3.5" />
            {t('sellerProducts.reload')}
          </Button>
        </div>
      )}

      {!categoriesQuery.isPending && !categoriesQuery.isError && tree.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <FolderTree aria-hidden="true" className="size-10 text-muted-foreground" />
          <p className="text-sm font-medium">{t('adminCategories.emptyTitle')}</p>
        </div>
      )}

      {!categoriesQuery.isPending && !categoriesQuery.isError && tree.length > 0 && (
        <ul className="flex flex-col gap-3">
          {tree.map((parent) => {
            const children = parent.children ?? []
            return (
              <li key={parent.categoryId} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{parent.name}</span>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {t('adminCategories.levelLabel', { level: parent.level })}
                    </span>
                    <StatusBadge status={parent.status} />
                    <span className="text-xs text-muted-foreground">
                      {t('adminCategories.sortOrderLabel', { order: parent.sortOrder })}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => openCreateChild(parent)}>
                      <Plus aria-hidden="true" className="size-3.5" />
                      {t('adminCategories.addChildButton')}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => openEdit(parent)}>
                      <Pencil aria-hidden="true" className="size-3.5" />
                      {t('adminCategories.editButton')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={toggleMutation.isPending}
                      onClick={() => toggleMutation.mutate(parent)}
                    >
                      {parent.status === 'VISIBLE' ? t('adminCategories.hideButton') : t('adminCategories.showButton')}
                    </Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => setDeleteTarget(parent)}>
                      <Trash2 aria-hidden="true" className="size-3.5" />
                      {t('adminCategories.deleteButton')}
                    </Button>
                  </div>
                </div>

                {children.length > 0 && (
                  <ul className="mt-3 space-y-2 border-l-2 border-border pl-4">
                    {children.map((child) => (
                      <li
                        key={child.categoryId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{child.name}</span>
                          <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {t('adminCategories.levelLabel', { level: child.level })}
                          </span>
                          <StatusBadge status={child.status} />
                          <span className="text-xs text-muted-foreground">
                            {t('adminCategories.sortOrderLabel', { order: child.sortOrder })}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => openEdit(child)}>
                            {t('adminCategories.editButton')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={toggleMutation.isPending}
                            onClick={() => toggleMutation.mutate(child)}
                          >
                            {child.status === 'VISIBLE' ? t('adminCategories.hideButton') : t('adminCategories.showButton')}
                          </Button>
                          <Button type="button" size="sm" variant="destructive" onClick={() => setDeleteTarget(child)}>
                            {t('adminCategories.deleteButton')}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={formState !== null} onOpenChange={(open) => !open && !saveMutation.isPending && setFormState(null)}>
        <DialogContent>
          <form onSubmit={(event) => submitForm(event)} noValidate className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>
                {formState?.mode === 'edit' ? t('adminCategories.dialogEditTitle') : t('adminCategories.dialogCreateTitle')}
              </DialogTitle>
            </DialogHeader>

            {formError && (
              <p role="alert" className="rounded-md border border-status-danger-border bg-status-danger px-3 py-2 text-sm text-status-danger-foreground">
                {formError}
              </p>
            )}

            {formState?.level === 2 && (
              <div className="space-y-1.5">
                <Label htmlFor={`${fieldId}-parent`}>{t('adminCategories.parentLabel')}</Label>
                <select
                  id={`${fieldId}-parent`}
                  value={formState.parentId}
                  onChange={(event) => setFormState((prev) => (prev ? { ...prev, parentId: event.target.value } : prev))}
                  className={textFieldClass}
                >
                  {tree.map((p) => (
                    <option key={p.categoryId} value={p.categoryId}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-name`}>{t('adminCategories.nameLabel')}</Label>
              <input
                id={`${fieldId}-name`}
                type="text"
                maxLength={100}
                value={formState?.name ?? ''}
                onChange={(event) => setFormState((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
                className={textFieldClass}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${fieldId}-sort`}>{t('adminCategories.sortInputLabel')}</Label>
                <input
                  id={`${fieldId}-sort`}
                  type="number"
                  value={formState?.sortOrder ?? '0'}
                  onChange={(event) => setFormState((prev) => (prev ? { ...prev, sortOrder: event.target.value } : prev))}
                  className={textFieldClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${fieldId}-status`}>{t('adminCategories.statusLabel')}</Label>
                <select
                  id={`${fieldId}-status`}
                  value={formState?.status ?? 'VISIBLE'}
                  onChange={(event) =>
                    setFormState((prev) => (prev ? { ...prev, status: event.target.value as 'VISIBLE' | 'HIDDEN' } : prev))
                  }
                  className={textFieldClass}
                >
                  <option value="VISIBLE">{t('adminCategories.statusVisible')}</option>
                  <option value="HIDDEN">{t('adminCategories.statusHidden')}</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" disabled={saveMutation.isPending} onClick={() => setFormState(null)}>
                {t('adminCategories.cancel')}
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? t('adminCategories.saving') : t('adminCategories.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && !deleteMutation.isPending && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('adminCategories.deleteConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {deleteTarget ? t('adminCategories.deleteConfirmDesc', { name: deleteTarget.name }) : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={deleteMutation.isPending} onClick={() => setDeleteTarget(null)}>
              {t('adminCategories.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending || !deleteTarget}
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget)
              }}
            >
              {t('adminCategories.deleteConfirmSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
