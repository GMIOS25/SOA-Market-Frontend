import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FlaskConical, Play } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { StatusBadge } from '@/components/ui/status-badge'
import { useAuthSession } from '@/lib/auth/session'
import { env } from '@/lib/env'

const commonFields = { delayMs: 30_000, duplicateWebhookCount: 10, badSignature: false } as const
const paymentFields = {
  ...commonFields, forceFail: false, forceFailCode: '', forceRefundFailCount: Number.MAX_SAFE_INTEGER,
  dropWebhook: false, delayedSuccessAfterExpiry: false, overrideObservedAmountVnd: Number.MAX_SAFE_INTEGER,
} as const
const shippingFields = {
  ...commonFields, forceQuoteFailure: false, failCreateCount: 50, simulateDeliveryFailed: false, outOfOrderWebhook: false,
} as const
const steps = ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_ATTEMPT_FAILED', 'FAIL_3X_RETURN', 'OUT_OF_ORDER_PICKUP'] as const
const inputClass = 'min-w-0 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring'

type Mode = 'payment' | 'shipping'
type Field = keyof typeof paymentFields | keyof typeof shippingFields
type Faults = Partial<Record<Field, string | boolean>>
type Action = 'load' | 'save' | 'reset' | 'advance'
type ShippingSimulation = { waybillStatus: string; lastEventStatus: string; deliveryAttempts: number; webhooksSent: number }

async function mockRequest<T>(path: string, token: string, method = 'GET', body?: object): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      Accept: 'application/json',
      ...(body && { 'Content-Type': 'application/json' }),
    },
    body: body && JSON.stringify(body),
    cache: 'no-store',
    redirect: 'error',
  })
  if (!response.ok) throw new DemoError(response.status)
  return response.json()
}

class DemoError extends Error {
  constructor(readonly status: number) { super(`HTTP ${status}`) }
}

function DemoControls({ mode }: { mode: Mode }) {
  const { t } = useTranslation('paymentShipping')
  const queryClient = useQueryClient()
  const payment = mode === 'payment'
  const [token, setToken] = useState(() => (payment ? env.paymentDemoToken : env.shippingDemoToken))
  const [faults, setFaults] = useState<Faults>({})
  const [reference, setReference] = useState('')
  const [step, setStep] = useState<string>(steps[0])
  const [location, setLocation] = useState('')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const [simulation, setSimulation] = useState<ShippingSimulation | null>(null)
  const base = payment ? '/mock/pay' : '/mock/ship'
  const fields = Object.entries(payment ? paymentFields : shippingFields) as [Field, string | number | boolean][]
  const action = useMutation({
    mutationFn: async (operation: Action) => {
      if (operation === 'advance') {
        const result = await mockRequest<ShippingSimulation>(
          `${base}/waybills/${encodeURIComponent(reference.trim())}/advance`, token, 'POST', { step, location, note },
        )
        setSimulation(result)
        await queryClient.invalidateQueries({
          predicate: ({ queryKey: [key, scope] }) =>
            key === 'shipments' || key === 'seller-orders' || key === 'order' || key === 'orders' ||
            (key === 'checkout' && scope === 'result'),
        })
        return t('demo.advanced', { count: result.webhooksSent })
      }
      const entries = fields.map(([field, kind]) => {
        const value = faults[field]
        if (typeof kind === 'boolean') return [field, Boolean(value)] as const
        if (typeof kind === 'string') return [field, String(value ?? '')] as const
        const number = Number(value ?? 0)
        if (operation === 'save' && (!Number.isSafeInteger(number) || number < 0 || number > kind)) {
          throw new RangeError()
        }
        return [field, number] as const
      })
      const endpoint = operation === 'reset' ? `${base}/faults/reset` : `${base}/faults`
      const method = operation === 'reset' ? 'POST' : operation === 'save' ? 'PUT' : 'GET'
      const config = await mockRequest<Partial<Record<Field, string | number | boolean>>>(
        endpoint, token, method, operation === 'save' ? Object.fromEntries(entries) : undefined,
      )
      setFaults(Object.fromEntries(fields.map(([field, kind]) => [
        field, typeof kind === 'boolean' ? config[field] === true : String(config[field] ?? (typeof kind === 'number' ? 0 : '')),
      ])))
      return t(operation === 'load' ? 'demo.loaded' : operation === 'reset' ? 'demo.resetDone' : 'demo.saved')
    },
    onMutate: (operation) => {
      setMessage('')
      if (operation === 'advance') setSimulation(null)
    },
    onSuccess: setMessage,
    onError: (error) => setMessage(
      error instanceof RangeError ? t('demo.numberInvalid') :
        error instanceof DemoError && [401, 403].includes(error.status) ? t('demo.unauthorized') :
          error instanceof DemoError ? t('demo.rejected', { status: error.status }) : t('demo.error'),
    ),
  })
  const locked = !token.trim() || action.isPending

  return (
    <div className="space-y-4">
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">{t('demo.token')}</span>
        <input className={inputClass} type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} />
        <span className="block text-xs text-muted-foreground">{t('demo.tokenHint')}</span>
      </label>
      <fieldset className="space-y-3 rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-semibold">{t('demo.faults')}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map(([field, kind]) => typeof kind === 'boolean' ? (
            <label key={field} className="flex items-center gap-2 text-sm">
              <input className="size-4 shrink-0 accent-primary" type="checkbox" checked={Boolean(faults[field])} onChange={(event) => setFaults({ ...faults, [field]: event.target.checked })} />
              {t(`demo.fields.${field}`)}
            </label>
          ) : (
            <label key={field} className="block space-y-1 text-xs font-medium">
              <span>{t(`demo.fields.${field}`)}</span>
              <input className={inputClass} type={typeof kind === 'number' ? 'number' : 'text'} min={0} max={typeof kind === 'number' ? kind : undefined} value={String(faults[field] ?? '')} onChange={(event) => setFaults({ ...faults, [field]: event.target.value })} />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={locked} onClick={() => action.mutate('load')}>{t('demo.load')}</Button>
          <Button size="sm" variant="outline" disabled={locked} onClick={() => action.mutate('reset')}>{t('demo.reset')}</Button>
          <Button size="sm" disabled={locked} onClick={() => action.mutate('save')}>{t('demo.save')}</Button>
        </div>
      </fieldset>
      <div className="space-y-3 rounded-xl border border-border p-4">
        <label className="block space-y-1 text-sm font-medium">
          <span>{t(payment ? 'demo.gatewayRef' : 'demo.trackingCode')}</span>
          <input className={inputClass} value={reference} onChange={(event) => setReference(event.target.value)} />
        </label>
        {payment ? (
          reference.trim() && <Button asChild size="sm" variant="outline">
            <a href={`${base}/${encodeURIComponent(reference.trim())}`} target="_blank" rel="noopener noreferrer">{t('demo.openPayment')}</a>
          </Button>
        ) : (
          <>
            <label className="block space-y-1 text-sm font-medium">
              <span>{t('demo.step')}</span>
              <select className={inputClass} value={step} onChange={(event) => setStep(event.target.value)}>
                {steps.map((status) => <option key={status} value={status}>{t(`demo.steps.${status}`)}</option>)}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm"><span>{t('demo.location')}</span><input className={inputClass} value={location} onChange={(event) => setLocation(event.target.value)} /></label>
              <label className="block space-y-1 text-sm"><span>{t('demo.note')}</span><input className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} /></label>
            </div>
            <Button size="sm" disabled={locked || !reference.trim()} onClick={() => action.mutate('advance')}><Play aria-hidden="true" />{t('demo.run')}</Button>
            {simulation && (
              <dl className="space-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <dt>{t('demo.waybillStatus')}</dt><dd><StatusBadge status={simulation.waybillStatus} /></dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <dt>{t('demo.lastEvent')}</dt><dd><StatusBadge status={simulation.lastEventStatus} /></dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt>{t('demo.deliveryAttempts')}</dt><dd className="tabular-nums">{simulation.deliveryAttempts}</dd>
                </div>
              </dl>
            )}
          </>
        )}
      </div>
      {message && <p role={action.isError ? 'alert' : 'status'} className={action.isError ? 'text-sm text-status-danger-foreground' : 'text-sm text-status-success-foreground'}>{message}</p>}
    </div>
  )
}

export function MockControlPanel() {
  const { t } = useTranslation('paymentShipping')
  const session = useAuthSession()
  const [mode, setMode] = useState<Mode>('payment')
  if (!session.accessToken) return null

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="fixed right-4 bottom-20 z-30 shadow-md sm:bottom-4">
          <FlaskConical aria-hidden="true" />{t('demo.title')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('demo.title')}</DialogTitle>
          <DialogDescription>{t('demo.description')}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(['payment', 'shipping'] as const).map((value) => (
            <Button key={value} type="button" aria-pressed={mode === value} size="sm" variant={mode === value ? 'outline' : 'ghost'} onClick={() => setMode(value)}>
              {t(`demo.${value}`)}
            </Button>
          ))}
        </div>
        <DemoControls key={mode} mode={mode} />
      </DialogContent>
    </Dialog>
  )
}
