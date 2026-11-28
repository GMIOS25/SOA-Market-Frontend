import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, CheckCircle2, ChevronDown, ChevronUp, Inbox, RefreshCw, RotateCw, Server, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AuditReasonDialog, CopyableId, ServiceFallbackBanner } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDateTime } from '@/lib/format'
import type { StatusTone } from '@/lib/status'
import { cn } from '@/lib/utils'
import {
  adminReportsKeys,
  getSystemHealth,
  listDLQ,
  replayDLQ,
  splitDuration,
  type DLQEntry,
  type DLQReplayResult,
} from './api'
import { PaginationBar } from './components'

const PAGE_SIZE = 20

function healthTone(status: string): StatusTone {
  switch (status) {
    case 'healthy':
      return 'success'
    case 'degraded':
      return 'warning'
    default:
      return 'danger'
  }
}

function healthStatusLabel(status: string, t: ReturnType<typeof useTranslation<'adminReports'>>['t']): string {
  if (status === 'healthy' || status === 'degraded' || status === 'unhealthy' || status === 'missing') {
    return t(`system.health.statuses.${status}`)
  }
  return status
}

/**
 * A13 `/admin/system` — Giám sát sức khỏe dịch vụ SOA (Consul) & Replay thông điệp DLQ (NATS JetStream SOA_DLQ).
 */
export function AdminSystemPage() {
  const { t } = useTranslation('adminReports')
  const queryClient = useQueryClient()

  const [expandedService, setExpandedService] = useState<string | null>(null)
  const [eventTypeInput, setEventTypeInput] = useState('')
  const [consumerInput, setConsumerInput] = useState('')
  const [appliedFilters, setAppliedFilters] = useState<{ eventType?: string; consumer?: string }>({})
  const [dlqPage, setDlqPage] = useState(1)
  const [selectedEntry, setSelectedEntry] = useState<DLQEntry | null>(null)
  const [expandedRawId, setExpandedRawId] = useState<string | null>(null)
  const [replayBanner, setReplayBanner] = useState<{ entry: DLQEntry; result: DLQReplayResult } | null>(null)

  const healthQuery = useQuery({
    queryKey: adminReportsKeys.health(),
    queryFn: ({ signal }) => getSystemHealth(signal),
    retry: false,
  })

  const dlqFilter = {
    ...appliedFilters,
    page: dlqPage,
    pageSize: PAGE_SIZE,
  }
  const dlqQuery = useQuery({
    queryKey: adminReportsKeys.dlq(dlqFilter),
    queryFn: ({ signal }) => listDLQ(dlqFilter, signal),
    placeholderData: keepPreviousData,
    retry: false,
  })

  function handleDlqFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAppliedFilters({
      eventType: eventTypeInput.trim() || undefined,
      consumer: consumerInput.trim() || undefined,
    })
    setDlqPage(1)
  }

  async function handleConfirmReplay(reason: string) {
    if (!selectedEntry) return
    const entry = selectedEntry
    const result = await replayDLQ(entry.id, { reason })
    setReplayBanner({ entry, result })
    setSelectedEntry(null)
    await queryClient.invalidateQueries({ queryKey: [...adminReportsKeys.all, 'system-dlq'] })
    await queryClient.invalidateQueries({ queryKey: [...adminReportsKeys.all, 'audit-logs'] })
  }

  const services = healthQuery.data?.services ?? []
  const dlqEntries = dlqQuery.data?.data ?? []

  return (
    <div className="space-y-6">
      <header className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('system.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('system.subtitle')}</p>
      </header>

      {/* Phần 1: Sức khỏe dịch vụ Consul */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <Activity aria-hidden="true" className="size-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">{t('system.health.heading')}</h2>
            {healthQuery.data && (
              <StatusBadge
                status={healthQuery.data.overallStatus.toUpperCase()}
                tone={healthTone(healthQuery.data.overallStatus)}
                label={t('system.health.overall', {
                  status: healthStatusLabel(healthQuery.data.overallStatus, t),
                })}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            {healthQuery.data?.checkedAt && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {t('system.health.checkedAt', { time: formatDateTime(healthQuery.data.checkedAt) })}
              </span>
            )}
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={healthQuery.isFetching}
              onClick={() => void healthQuery.refetch()}
            >
              <RefreshCw aria-hidden="true" className={cn(healthQuery.isFetching && 'animate-spin')} />
              {t('common.refresh')}
            </Button>
          </div>
        </div>

        {healthQuery.isError ? (
          <ServiceFallbackBanner
            message={t('system.health.loadError')}
            onRetry={() => void healthQuery.refetch()}
            isRetrying={healthQuery.isFetching}
          />
        ) : healthQuery.isPending ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {services.map((svc) => {
              const instances = svc.instances ?? []
              const isOpen = expandedService === svc.serviceName
              return (
                <article
                  key={svc.serviceName}
                  className="flex flex-col justify-between gap-2 rounded-lg border border-border bg-background/60 p-3.5 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-foreground">
                      <Server aria-hidden="true" className="size-3.5 text-muted-foreground" />
                      {svc.serviceName}
                    </span>
                    <StatusBadge
                      status={svc.status.toUpperCase()}
                      tone={healthTone(svc.status)}
                      label={healthStatusLabel(svc.status, t)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {t('system.health.instances', {
                      passing: svc.passingInstances,
                      total: svc.totalInstances,
                    })}
                  </p>
                  {instances.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setExpandedService(isOpen ? null : svc.serviceName)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        {isOpen ? (
                          <ChevronUp aria-hidden="true" className="size-3.5" />
                        ) : (
                          <ChevronDown aria-hidden="true" className="size-3.5" />
                        )}
                        {t('system.health.showInstances', { count: instances.length })}
                      </button>
                      {isOpen && (
                        <ul className="mt-2 space-y-1.5 border-t border-border pt-2 text-xs">
                          {instances.map((inst) => (
                            <li key={inst.instanceId} className="space-y-0.5 rounded bg-muted/50 p-1.5">
                              <div className="flex items-center justify-between gap-1">
                                <span className="truncate font-mono">{`${inst.address}:${inst.port}`}</span>
                                <StatusBadge
                                  status={inst.status.toUpperCase()}
                                  tone={inst.status === 'passing' ? 'success' : 'danger'}
                                  label={inst.status}
                                />
                              </div>
                              {inst.checkOutput && (
                                <p className="line-clamp-2 font-mono text-[11px] text-muted-foreground">
                                  {inst.checkOutput}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* Phần 2: Dead-Letter Queue (SOA_DLQ) */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">{t('system.dlq.heading')}</h2>
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={dlqQuery.isFetching}
            onClick={() => void dlqQuery.refetch()}
          >
            <RefreshCw aria-hidden="true" className={cn(dlqQuery.isFetching && 'animate-spin')} />
            {t('common.refresh')}
          </Button>
        </div>

        {replayBanner && (
          <div
            role="status"
            className="flex items-start justify-between gap-3 rounded-lg border border-status-success-border bg-status-success p-4 text-sm text-status-success-foreground"
          >
            <div className="flex items-start gap-2.5">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              <div className="space-y-0.5">
                <p className="font-semibold">
                  {t('system.dlq.replaySuccessTitle', { id: replayBanner.result.id })}
                </p>
                <p className="text-xs">
                  {t('system.dlq.replaySuccessDesc', {
                    eventType: replayBanner.result.eventType,
                    eventId: replayBanner.result.eventId,
                    targetSubject: replayBanner.result.targetSubject,
                  })}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label={t('common.hide')}
              onClick={() => setReplayBanner(null)}
              className="rounded p-1 hover:bg-card/50"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleDlqFilterSubmit} className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={eventTypeInput}
            onChange={(event) => setEventTypeInput(event.target.value)}
            aria-label={t('system.dlq.eventTypeFilter')}
            placeholder={t('system.dlq.eventTypeFilter')}
            className="h-9 min-w-48 flex-1 rounded-md border border-input bg-background px-3 font-mono text-xs"
          />
          <input
            type="search"
            value={consumerInput}
            onChange={(event) => setConsumerInput(event.target.value)}
            aria-label={t('system.dlq.consumerFilter')}
            placeholder={t('system.dlq.consumerFilter')}
            className="h-9 min-w-44 flex-1 rounded-md border border-input bg-background px-3 font-mono text-xs"
          />
          <Button type="submit" size="sm" variant="outline">
            {t('common.applyFilter')}
          </Button>
          {(appliedFilters.eventType || appliedFilters.consumer) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEventTypeInput('')
                setConsumerInput('')
                setAppliedFilters({})
                setDlqPage(1)
              }}
            >
              <X aria-hidden="true" />
              {t('common.clearFilter')}
            </Button>
          )}
        </form>

        {dlqQuery.isError ? (
          <ServiceFallbackBanner
            message={t('system.dlq.loadError')}
            onRetry={() => void dlqQuery.refetch()}
            isRetrying={dlqQuery.isFetching}
          />
        ) : dlqQuery.isPending ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : dlqEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <Inbox aria-hidden="true" className="size-8" />
            <p>{t('system.dlq.empty')}</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">{t('system.dlq.cols.id')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('system.dlq.cols.event')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('system.dlq.cols.consumer')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('system.dlq.cols.error')}</th>
                    <th scope="col" className="px-4 py-2.5">{t('system.dlq.cols.age')}</th>
                    <th scope="col" className="px-4 py-2.5 text-right">{t('system.dlq.cols.action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dlqEntries.map((entry) => {
                    const dur = splitDuration(entry.ageSeconds)
                    const showRaw = expandedRawId === entry.id
                    return (
                      <tr key={entry.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 align-top">
                          <span className="font-mono text-xs font-semibold">#{entry.id}</span>
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{entry.subject}</p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-medium">
                            {entry.eventType || t('common.none')}
                          </span>
                          {entry.eventId && (
                            <div className="mt-1">
                              <CopyableId value={entry.eventId} label={entry.eventId} />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-xs">
                          <p className="font-mono font-medium">{entry.consumer || t('common.none')}</p>
                          <p className="text-muted-foreground">
                            {t('system.dlq.attemptsCount', { count: entry.attempts })}
                          </p>
                        </td>
                        <td className="max-w-xs space-y-1 px-4 py-3 align-top text-xs">
                          <p className="text-status-danger-foreground">{entry.error}</p>
                          {entry.rawPayload && (
                            <div>
                              <button
                                type="button"
                                onClick={() => setExpandedRawId(showRaw ? null : entry.id)}
                                className="text-[11px] font-medium text-primary hover:underline"
                              >
                                {t('system.dlq.rawPayloadBtn')}
                              </button>
                              {showRaw && (
                                <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted p-2 font-mono text-[11px]">
                                  {entry.rawPayload}
                                </pre>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-xs text-muted-foreground tabular-nums">
                          <p>{t(`common.duration.${dur.unit}`, { count: dur.count })}</p>
                          <p>{formatDateTime(entry.failedAt)}</p>
                        </td>
                        <td className="px-4 py-3 text-right align-top">
                          {entry.replayable ? (
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              onClick={() => setSelectedEntry(entry)}
                            >
                              <RotateCw aria-hidden="true" className="size-3.5" />
                              {t('system.dlq.replayBtn')}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">{t('system.dlq.notReplayable')}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {dlqEntries.map((entry) => {
                const dur = splitDuration(entry.ageSeconds)
                return (
                  <article key={entry.id} className="space-y-2 rounded-lg border border-border p-3.5 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-semibold">#{entry.id}</span>
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {entry.eventType || t('common.none')}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {t(`common.duration.${dur.unit}`, { count: dur.count })}
                      </span>
                    </div>
                    <p className="text-xs text-status-danger-foreground">{entry.error}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-mono">{entry.consumer}</span>
                      {entry.replayable ? (
                        <Button type="button" size="xs" variant="outline" onClick={() => setSelectedEntry(entry)}>
                          <RotateCw aria-hidden="true" className="size-3.5" />
                          {t('system.dlq.replayBtn')}
                        </Button>
                      ) : (
                        <span>{t('system.dlq.notReplayable')}</span>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}

        <PaginationBar pagination={dlqQuery.data?.pagination} onPageChange={setDlqPage} />
      </section>

      <AuditReasonDialog
        key={selectedEntry?.id ?? 'closed'}
        open={Boolean(selectedEntry)}
        onOpenChange={(open) => {
          if (!open) setSelectedEntry(null)
        }}
        title={selectedEntry ? t('system.dlq.dialogTitle', { id: selectedEntry.id }) : ''}
        description={
          selectedEntry
            ? t('system.dlq.dialogDesc', {
                eventType: selectedEntry.eventType || selectedEntry.subject,
                consumer: selectedEntry.consumer || t('common.none'),
              })
            : undefined
        }
        confirmLabel={t('system.dlq.dialogConfirm')}
        onConfirm={handleConfirmReplay}
      />
    </div>
  )
}
