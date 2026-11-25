import { ImagePlus, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { readAsDataUrl } from '../file-utils'
import { ACCEPTED_KYC_TYPES } from '../schemas'

type KycFileFieldProps = {
  label: string
  file: File | null
  error?: string
  disabled?: boolean
  onChange: (file: File | null) => void
}

/** Ảnh xem trước của tệp đang chọn; bản đọc xong của tệp cũ bị bỏ qua nhờ so khớp `file`. */
function usePreviewUrl(file: File | null): string | null {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null)
  useEffect(() => {
    if (!file) return
    let cancelled = false
    readAsDataUrl(file)
      .then((url) => !cancelled && setPreview({ file, url }))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [file])
  return preview && preview.file === file ? preview.url : null
}

/** Ô tải 1 ảnh KYC (CCCD / ĐKKD): xem trước, đổi / bỏ ảnh, báo lỗi theo trường (FR-SEL-001). */
export function KycFileField({ label, file, error, disabled = false, onChange }: KycFileFieldProps) {
  const { t } = useTranslation('sellerShop')
  const inputId = useId()
  const errorId = `${inputId}-error`
  const inputRef = useRef<HTMLInputElement>(null)
  const previewUrl = usePreviewUrl(file)

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label} <span aria-hidden="true" className="text-status-danger-foreground">*</span>
      </label>
      <div
        className={cn(
          'flex items-center gap-3 rounded-md border border-dashed bg-card p-3',
          error ? 'border-status-danger-border' : 'border-input',
        )}
      >
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus aria-hidden="true" className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {file ? (
            <>
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{formatNumber(Math.ceil(file.size / 1024))} KB</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{t('onboarding.form.documentsHint')}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            aria-describedby={error ? errorId : undefined}
          >
            {file ? t('onboarding.form.replaceFile') : t('onboarding.form.chooseFile')}
          </Button>
          {file && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => {
                if (inputRef.current) inputRef.current.value = ''
                onChange(null)
              }}
            >
              <X aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{t('onboarding.form.removeFile')}</span>
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_KYC_TYPES.join(',')}
          className="sr-only"
          tabIndex={-1}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.currentTarget.files?.[0] ?? null)}
        />
      </div>
      {error && (
        <p id={errorId} className="text-xs text-status-danger-foreground">
          {error}
        </p>
      )}
    </div>
  )
}
