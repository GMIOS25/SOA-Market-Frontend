import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Inbox, Lock, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyableId, ServiceFallbackBanner, SyncTimestampBadge } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/format'
import { adminReportsKeys, listAuditLogs, UUID_RE, type AuditLogsFilter } from './api'
import { JsonDiffViewer, PaginationBar } from './components'

const ROLES = ['ADMINISTRATOR', 'CS', 'SELLER', 'BUYER', 'SYSTEM'] as const
const PAGE_SIZE = 20

/**
 * A12 `/admin/audit-logs` — Tra cứu nhật ký kiểm toán bất biến (append-only, DC-19).
 */
export function AdminAuditLogsPage() {
  const { t } = useTranslation('adminReports')

  const [actorInput, setActorInput] = useState('')
  const [role, setRole] = useState('')
  const [actionInput, setActionInput] = useState('')
  const [entityTypeInput, setEntityTypeInput] = useState('')
  const [entityIdInput, setEntityIdInput] = useState('')
  const [corrIdInput, setCorrIdInput] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [uuidError, setUuidError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const [applied, setApplied] = useState<{
    actor?: string
    action?: string
    entityType?: string
    entityId?: string
    correlationId?: string
  }>({})

  const rangeValid = !from || !to || from <= to

  const filter: AuditLogsFilter = {
    ...applied,
    role: role || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize: PAGE_SIZE,
  }

  const auditQuery = useQuery({
    queryKey: adminReportsKeys.auditLogs(filter),
    queryFn: ({ signal }) => listAuditLogs(filter, signal),
    enabled: rangeValid,
    placeholderData: keepPreviousData,
    retry: false,
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const corr = corrIdInput.trim()
    if (corr && !UUID_RE.test(corr)) {
      setUuidError(t('common.invalidUuid'))
      return
    }
    setUuidError(null)
    setApplied({
      actor: actorInput.trim() || undefined,
      action: actionInput.trim() || undefined,
      entityType: entityTypeInput.trim() || undefined,
      entityId: entityIdInput.trim() || undefined,
      correlationId: corr || undefined,
    })
    setPage(1)
  }

  function handleReset() {
    setActorInput('')
    setRole('')
    setActionInput('')
    setEntityTypeInput('')
    setEntityIdInput('')
    setCorrIdInput('')
    setFrom('')
    setTo('')
    setUuidError(null)
    setApplied({})
    setPage(1)
  }

  const logs = auditQuery.data?.data ?? []

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('auditLogs.title')}</h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-status-neutral-border bg-status-neutral px-2.5 py-0.5 text-xs font-medium text-status-neutral-foreground">
              <Lock aria-hidden="true" className="size-3" />
              {t('auditLogs.appendOnlyBadge')}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{t('auditLogs.subtitle')}</p>
        </div>
        <SyncTimestampBadge
          syncedAt={auditQuery.data?.syncedAt ?? null}
          onRefresh={() => void auditQuery.refetch()}
          isRefreshing={auditQuery.isFetching}
        />
      </header>

      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <input
              type="search"
              value={actorInput}
              onChange={(event) => setActorInput(event.target.value)}
              aria-label={t('auditLogs.filters.actor')}
              placeholder={t('auditLogs.filters.actor')}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs"
            />
            <select
              aria-label={t('auditLogs.filters.role')}
              value={role}
              onChange={(event) => {
                setRole(event.target.value)
                setPage(1)
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{`${t('auditLogs.filters.role')}: ${t('common.all')}`}</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              type="search"
              value={actionInput}
              onChange={(event) => setActionInput(event.target.value)}
              aria-label={t('auditLogs.filters.action')}
              placeholder={t('auditLogs.filters.action')}
              className="h-9 rounded-md border border-input bg-background px-3 font-mono text-xs"
            />
            <input
              type="search"
              value={corrIdInput}
              onChange={(event) => {
                setCorrIdInput(event.target.value)
                if (uuidError) setUuidError(null)
              }}
              aria-label={t('auditLogs.filters.correlationId')}
              placeholder={t('auditLogs.filters.correlationId')}
              className="h-9 rounded-md border border-input bg-background px-3 font-mono text-xs"
            />
            <input
              type="search"
              value={entityTypeInput}
              onChange={(event) => setEntityTypeInput(event.target.value)}
              aria-label={t('auditLogs.filters.entityType')}
              placeholder={t('auditLogs.filters.entityType')}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs"
            />
            <input
              type="search"
              value={entityIdInput}
              onChange={(event) => setEntityIdInput(event.target.value)}
              aria-label={t('auditLogs.filters.entityId')}
              placeholder={t('auditLogs.filters.entityId')}
              className="h-9 rounded-md border border-input bg-background px-3 font-mono text-xs"
            />
            <div className="flex gap-1.5">
              <input
                type="date"
                aria-label={t('common.fromDate')}
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value)
                  setPage(1)
                }}
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"
              />
              <input
                type="date"
                aria-label={t('common.toDate')}
                value={to}
                onChange={(event) => {
                  setTo(event.target.value)
                  setPage(1)
                }}
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" variant="default" className="flex-1">
                {t('common.applyFilter')}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={handleReset}>
                <X aria-hidden="true" />
                {t('common.clearFilter')}
              </Button>
            </div>
          </div>

          {uuidError && <p className="text-xs text-status-danger-foreground">{uuidError}</p>}
          {!rangeValid && <p className="text-xs text-status-danger-foreground">{t('common.invalidDateRange')}</p>}
        </form>

        {auditQuery.isError ? (
          <ServiceFallbackBanner
            message={t('auditLogs.loadError')}
            onRetry={() => void auditQuery.refetch()}
            isRetrying={auditQuery.isFetching}
          />
        ) : auditQuery.isPending ? (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <Inbox aria-hidden="true" className="size-8" />
            <p className="font-medium text-foreground">{t('auditLogs.emptyTitle')}</p>
            <p className="text-xs">{t('auditLogs.emptyHint')}</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border border-border lg:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">{t('auditLogs.cols.at')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('auditLogs.cols.actor')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('auditLogs.cols.action')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('auditLogs.cols.entity')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('auditLogs.cols.reason')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('auditLogs.cols.correlationId')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((entry) => (
                    <tr key={entry.auditId} className="hover:bg-muted/30">
                      <td className="px-4 py-3 align-top text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                        {formatDateTime(entry.at)}
                      </td>
                      <td className="px-4 py-3 align-top text-xs">
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono font-medium">{entry.role}</span>
                        <div className="mt-1">
                          <CopyableId value={entry.actor} label={entry.actor} />
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-xs font-semibold text-foreground">
                        {entry.action}
                      </td>
                      <td className="px-4 py-3 align-top text-xs">
                        <p className="font-medium text-foreground">{entry.entityType}</p>
                        <CopyableId value={entry.entityId} label={entry.entityType} />
                      </td>
                      <td className="max-w-md space-y-1.5 px-4 py-3 align-top text-xs">
                        <p className="text-foreground">{entry.reason || t('common.none')}</p>
                        <JsonDiffViewer beforeState={entry.beforeState} afterState={entry.afterState} />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <CopyableId value={entry.correlationId} label="Correlation ID" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 lg:hidden">
              {logs.map((entry) => (
                <article key={entry.auditId} className="space-y-2 rounded-lg border border-border p-3.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-foreground">{entry.action}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(entry.at)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{entry.role}</span>
                    <CopyableId value={entry.actor} label={entry.actor} />
                  </div>
                  <p className="text-xs text-foreground">{entry.reason || t('common.none')}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>
                      {entry.entityType}: <CopyableId value={entry.entityId} label={entry.entityType} />
                    </span>
                    <CopyableId value={entry.correlationId} label="Correlation ID" />
                  </div>
                  <JsonDiffViewer beforeState={entry.beforeState} afterState={entry.afterState} />
                </article>
              ))}
            </div>
          </>
        )}

        <PaginationBar pagination={auditQuery.data?.pagination} onPageChange={setPage} />
      </section>
    </div>
  )
}
