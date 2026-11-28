import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Info, Pencil, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/errors'
import { AuditReasonDialog, ServiceFallbackBanner, SyncTimestampBadge } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/format'
import { adminReportsKeys, listBusinessParams, updateBusinessParam, type BusinessParamView } from './api'

type ParamValueValidation = { valid: true } | { valid: false; error: string }

function validateParamDraft(
  param: BusinessParamView,
  draftValue: string,
  allParams: readonly BusinessParamView[],
  t: ReturnType<typeof useTranslation<'adminReports'>>['t'],
): ParamValueValidation {
  const trimmed = draftValue.trim()
  if (!trimmed) return { valid: false, error: t('params.dialog.errors.required') }

  if (param.unit === 'bool') {
    const lower = trimmed.toLowerCase()
    if (lower !== 'true' && lower !== 'false') {
      return { valid: false, error: t('params.dialog.errors.boolInvalid') }
    }
    return { valid: true }
  }

  if (param.unit === 'ratio') {
    const num = Number(trimmed)
    if (!Number.isFinite(num)) return { valid: false, error: t('params.dialog.errors.numberInvalid') }
    if (param.minValue !== undefined && num < Number(param.minValue)) {
      return { valid: false, error: t('params.dialog.errors.belowMin', { min: param.minValue }) }
    }
    if (param.maxValue !== undefined && num > Number(param.maxValue)) {
      return { valid: false, error: t('params.dialog.errors.aboveMax', { max: param.maxValue }) }
    }
    return { valid: true }
  }

  if (!/^-?\d+$/.test(trimmed)) {
    return { valid: false, error: t('params.dialog.errors.integerInvalid') }
  }
  const intVal = Number.parseInt(trimmed, 10)
  if (param.minValue !== undefined && intVal < Number.parseInt(param.minValue, 10)) {
    return { valid: false, error: t('params.dialog.errors.belowMin', { min: param.minValue }) }
  }
  if (param.maxValue !== undefined && intVal > Number.parseInt(param.maxValue, 10)) {
    return { valid: false, error: t('params.dialog.errors.aboveMax', { max: param.maxValue }) }
  }

  if (param.name === 'T_RESERVE') {
    const tPay = allParams.find((item) => item.name === 'T_PAY')
    if (tPay && intVal < Number.parseInt(tPay.value, 10)) {
      return { valid: false, error: t('params.dialog.errors.reserveLtPay', { reserve: intVal, pay: tPay.value }) }
    }
  }
  if (param.name === 'T_PAY') {
    const tReserve = allParams.find((item) => item.name === 'T_RESERVE')
    if (tReserve && intVal > Number.parseInt(tReserve.value, 10)) {
      return { valid: false, error: t('params.dialog.errors.payGtReserve', { pay: intVal, reserve: tReserve.value }) }
    }
  }

  return { valid: true }
}

/**
 * A11 `/admin/config/params` — Quản lý 21 tham số nghiệp vụ động PRM-01..21 (Consul KV + `config.changed`).
 */
export function AdminParamsPage() {
  const { t } = useTranslation('adminReports')
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<BusinessParamView | null>(null)
  const [draftValue, setDraftValue] = useState('')
  const [updatedBanner, setUpdatedBanner] = useState<BusinessParamView | null>(null)

  const paramsQuery = useQuery({
    queryKey: adminReportsKeys.params(),
    queryFn: ({ signal }) => listBusinessParams(signal),
    retry: false,
  })

  const allParams = useMemo(() => paramsQuery.data?.data ?? [], [paramsQuery.data?.data])
  const filteredParams = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allParams
    return allParams.filter(
      (item) =>
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q),
    )
  }, [allParams, search])

  const validation = useMemo(
    () => (editing ? validateParamDraft(editing, draftValue, allParams, t) : { valid: true as const }),
    [allParams, draftValue, editing, t],
  )

  function openEditDialog(param: BusinessParamView) {
    setEditing(param)
    setDraftValue(param.value)
  }

  async function handleConfirmUpdate(reason: string) {
    if (!editing) return
    try {
      const updated = await updateBusinessParam(editing.name, { value: draftValue.trim(), reason })
      setUpdatedBanner(updated)
      setEditing(null)
      await queryClient.invalidateQueries({ queryKey: adminReportsKeys.params() })
      await queryClient.invalidateQueries({ queryKey: [...adminReportsKeys.all, 'audit-logs'] })
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: adminReportsKeys.params() })
      }
      throw error
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('params.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('params.subtitle')}</p>
        </div>
        <SyncTimestampBadge
          syncedAt={paramsQuery.data?.syncedAt ?? null}
          onRefresh={() => void paramsQuery.refetch()}
          isRefreshing={paramsQuery.isFetching}
        />
      </header>

      <div
        role="status"
        className="flex items-start gap-2 rounded-lg border border-status-info-border bg-status-info p-3 text-xs text-status-info-foreground"
      >
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>{t('params.hotReloadNotice')}</span>
      </div>

      {updatedBanner && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-lg border border-status-success-border bg-status-success p-4 text-sm text-status-success-foreground"
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <div className="space-y-0.5">
              <p className="font-semibold">
                {t('params.updateSuccessTitle', { name: updatedBanner.name, version: updatedBanner.version })}
              </p>
              <p className="text-xs">
                {t('params.updateSuccessDesc', { value: `${updatedBanner.value} ${updatedBanner.unit}` })}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label={t('common.hide')}
            onClick={() => setUpdatedBanner(null)}
            className="rounded p-1 hover:bg-card/50"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      )}

      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="relative max-w-md">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label={t('params.searchPlaceholder')}
            placeholder={t('params.searchPlaceholder')}
            className="h-9 w-full rounded-md border border-input bg-background pr-3 pl-9 text-sm"
          />
        </div>

        {paramsQuery.isError ? (
          <ServiceFallbackBanner
            message={t('params.loadError')}
            onRetry={() => void paramsQuery.refetch()}
            isRetrying={paramsQuery.isFetching}
          />
        ) : paramsQuery.isPending ? (
          <div className="space-y-2.5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : filteredParams.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('params.empty')}</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">{t('params.cols.code')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('params.cols.value')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('params.cols.range')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('params.cols.version')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('params.cols.description')}</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{t('params.cols.action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredParams.map((param) => (
                    <tr key={param.name} className="hover:bg-muted/30">
                      <td className="px-4 py-3 align-top">
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground">
                          {param.code}
                        </span>
                        <p className="mt-1 font-mono text-xs font-semibold text-primary">{param.name}</p>
                      </td>
                      <td className="px-4 py-3 align-top tabular-nums">
                        <span className="font-mono text-base font-bold text-foreground">{param.value}</span>{' '}
                        <span className="text-xs text-muted-foreground">{param.unit}</span>
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground tabular-nums">
                        {t('params.bounds', {
                          min: param.minValue ?? t('common.none'),
                          max: param.maxValue ?? t('common.none'),
                        })}
                      </td>
                      <td className="px-4 py-3 align-top text-xs tabular-nums">
                        <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-mono font-medium">
                          {t('params.versionTag', { version: param.version })}
                        </span>
                        <p className="mt-1 text-muted-foreground">{formatDateTime(param.effectiveFrom)}</p>
                      </td>
                      <td className="max-w-sm px-4 py-3 align-top text-xs">
                        <p className="text-foreground">{param.description}</p>
                        <p className="mt-0.5 text-muted-foreground">{param.reason}</p>
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <Button type="button" size="xs" variant="outline" onClick={() => openEditDialog(param)}>
                          <Pencil aria-hidden="true" className="size-3.5" />
                          {t('params.editBtn')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {filteredParams.map((param) => (
                <article key={param.name} className="space-y-2 rounded-lg border border-border p-3.5 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{param.code}</span>
                      <p className="mt-1 font-mono text-xs font-semibold text-primary">{param.name}</p>
                    </div>
                    <Button type="button" size="xs" variant="outline" onClick={() => openEditDialog(param)}>
                      {t('params.editBtn')}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-xs tabular-nums">
                    <span>
                      <strong className="font-mono text-sm text-foreground">{param.value}</strong> {param.unit}
                    </span>
                    <span className="text-muted-foreground">
                      {t('params.versionTag', { version: param.version })} ·{' '}
                      {t('params.bounds', { min: param.minValue ?? '—', max: param.maxValue ?? '—' })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{param.description}</p>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <AuditReasonDialog
        key={editing?.name ?? 'closed'}
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        title={editing ? t('params.dialog.title', { name: editing.name, code: editing.code }) : ''}
        description={
          editing
            ? t('params.dialog.description', {
                version: editing.version,
                currentValue: editing.value,
                unit: editing.unit,
                description: editing.description,
              })
            : undefined
        }
        confirmLabel={t('params.dialog.confirmBtn')}
        confirmDisabled={!validation.valid}
        onConfirm={handleConfirmUpdate}
      >
        {editing && (
          <div className="space-y-1.5">
            <Label htmlFor="param-new-value">{t('params.dialog.valueLabel', { unit: editing.unit })}</Label>
            {editing.unit === 'bool' ? (
              <select
                id="param-new-value"
                value={draftValue.toLowerCase()}
                onChange={(event) => setDraftValue(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-sm"
              >
                <option value="true">{t('params.dialog.boolTrue')}</option>
                <option value="false">{t('params.dialog.boolFalse')}</option>
              </select>
            ) : (
              <input
                id="param-new-value"
                type="text"
                value={draftValue}
                onChange={(event) => setDraftValue(event.target.value)}
                aria-invalid={!validation.valid || undefined}
                className="h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-sm"
              />
            )}
            <p className="text-xs text-muted-foreground">
              {t('params.dialog.allowedHint', {
                min: editing.minValue ?? t('common.none'),
                max: editing.maxValue ?? t('common.none'),
              })}
            </p>
            {!validation.valid && <p className="text-xs text-status-danger-foreground">{validation.error}</p>}
          </div>
        )}
      </AuditReasonDialog>
    </div>
  )
}
