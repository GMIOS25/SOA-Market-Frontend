import { ImagePlus, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { REVIEW_IMAGE_MAX_BYTES, REVIEW_IMAGE_TYPES, REVIEW_IMAGES_MAX } from '../api'

/** Đọc ảnh thành data URL để xem trước — không cần thu hồi như object URL (an toàn với StrictMode). */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

function Preview({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    readAsDataUrl(file)
      .then((next) => !cancelled && setUrl(next))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [file])
  return url ? <img src={url} alt="" className="size-full object-cover" /> : null
}

type ReviewImagesInputProps = {
  files: File[]
  onChange: (files: File[]) => void
  onError: (message: string | null) => void
  error?: string
  disabled?: boolean
}

/** Chọn tối đa 5 ảnh JPEG/PNG/WebP ≤ 5MB cho đánh giá (FR-REV-001). Tệp sai bị loại ngay kèm lý do. */
export function ReviewImagesInput({ files, onChange, onError, error, disabled = false }: ReviewImagesInputProps) {
  const { t } = useTranslation('reviews')
  const inputId = useId()
  const errorId = `${inputId}-error`
  const inputRef = useRef<HTMLInputElement>(null)

  function add(selected: File[]) {
    const accepted: File[] = []
    let message: string | null = null
    for (const file of selected) {
      if (!(REVIEW_IMAGE_TYPES as readonly string[]).includes(file.type)) message = t('form.imageType')
      else if (file.size > REVIEW_IMAGE_MAX_BYTES) message = t('form.imageSize')
      else accepted.push(file)
    }
    const next = [...files, ...accepted]
    if (next.length > REVIEW_IMAGES_MAX) message = t('form.tooManyImages', { max: REVIEW_IMAGES_MAX })
    onChange(next.slice(0, REVIEW_IMAGES_MAX))
    onError(message)
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium">
        {t('form.imagesLabel', { max: REVIEW_IMAGES_MAX })}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {files.map((file, index) => (
          <div key={`${file.name}-${index}`} className="relative size-16 overflow-hidden rounded-md border border-border bg-muted">
            <Preview file={file} />
            <button
              type="button"
              disabled={disabled}
              aria-label={t('form.removeImage', { index: index + 1 })}
              onClick={() => {
                onChange(files.filter((_, i) => i !== index))
                onError(null)
              }}
              className="absolute top-0.5 right-0.5 rounded-full bg-foreground/70 p-0.5 text-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <X aria-hidden="true" className="size-3" />
            </button>
          </div>
        ))}
        {files.length < REVIEW_IMAGES_MAX && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            aria-describedby={error ? errorId : undefined}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus aria-hidden="true" />
            {t('form.addImages')}
          </Button>
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept={REVIEW_IMAGE_TYPES.join(',')}
          className="sr-only"
          tabIndex={-1}
          disabled={disabled}
          onChange={(event) => {
            add([...(event.currentTarget.files ?? [])])
            event.currentTarget.value = ''
          }}
        />
      </div>
      {error ? (
        <p id={errorId} className="text-xs text-status-danger-foreground">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t('form.imagesHint')}</p>
      )}
    </div>
  )
}
