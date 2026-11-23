import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export type CopyableIdProps = {
  /** Giá trị đầy đủ được sao chép (VD UUID của SellerOrder, trackingCode, correlationId, SHA-256). */
  value: string
  /** Chuỗi hiển thị nếu khác `value` (VD "SO-002"). */
  display?: string
  /** Mô tả cho trình đọc màn hình: "Sao chép <label>". */
  label: string
  className?: string
}

/** Mã định danh monospace + nút sao chép 1-click (Brief §1.2, §3.1). */
export function CopyableId({ value, display, label, className }: CopyableIdProps) {
  const { t } = useTranslation('shared')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // Clipboard API cần secure context; người dùng vẫn bôi đen để copy được.
    }
  }

  return (
    <span className={cn('inline-flex max-w-full items-center gap-1 align-middle', className)}>
      <span className="truncate font-mono text-xs text-muted-foreground select-all" title={value}>
        {display ?? value}
      </span>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={copied ? t('copy.copied') : t('copy.copy', { label })}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {copied ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? t('copy.copied') : ''}
      </span>
    </span>
  )
}
