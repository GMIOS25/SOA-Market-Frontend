import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type DisclosurePanelProps = {
  title: string
  children: ReactNode
  summary?: ReactNode
  icon?: ReactNode
  initiallyOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  variant?: 'card' | 'plain'
  inlineSummary?: boolean
  className?: string
}

/** A compact detail row. Summary content should be readable text, without interactive controls. */
export function DisclosurePanel({
  title, children, summary, icon, initiallyOpen = false, open: controlledOpen, onOpenChange,
  variant = 'card', inlineSummary = false, className,
}: DisclosurePanelProps) {
  const panelId = useId()
  const titleId = `${panelId}-title`
  const summaryId = summary ? `${panelId}-summary` : undefined
  const [internalOpen, setInternalOpen] = useState(initiallyOpen)
  const open = controlledOpen ?? internalOpen

  function toggle() {
    if (controlledOpen === undefined) setInternalOpen(!open)
    onOpenChange?.(!open)
  }

  return (
    <div className={cn(variant === 'card' && 'rounded-lg border border-border bg-card', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-labelledby={titleId}
        aria-describedby={summaryId}
        onClick={toggle}
        className={cn(
          'flex min-h-11 w-full items-center gap-2.5 rounded-lg text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
          variant === 'card' ? 'px-3.5 py-2.5 hover:bg-muted/60' : 'py-2 hover:text-primary',
        )}
      >
        {icon && <span aria-hidden="true" className="shrink-0 text-primary [&>svg]:size-4">{icon}</span>}
        <span className={cn('min-w-0', inlineSummary ? 'flex flex-wrap items-baseline gap-x-2 gap-y-0.5' : 'flex-1')}>
          <span id={titleId} className="block text-sm font-semibold">{title}</span>
          {summary && (
            <span id={summaryId} className={inlineSummary ? 'text-base font-bold text-price tabular-nums' : 'mt-0.5 block truncate text-xs text-muted-foreground'}>
              {summary}
            </span>
          )}
        </span>
        <ChevronDown aria-hidden="true" className={cn('size-4 shrink-0 text-muted-foreground motion-safe:transition-transform', open && 'rotate-180')} />
      </button>
      <div id={panelId} hidden={!open} className={cn('border-t border-border py-3', variant === 'card' && 'px-3.5')}>
        {open && children}
      </div>
    </div>
  )
}
