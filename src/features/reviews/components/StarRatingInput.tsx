import { Star } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

type StarRatingInputProps = {
  value: number
  onChange: (stars: number) => void
  disabled?: boolean
  error?: string
}

/**
 * Chọn 1–5 sao bằng nhóm radio thật (ẩn trực quan): phím mũi tên đổi sao, Tab vào/ra nhóm — đúng hành vi
 * radiogroup chuẩn mà không phải tự cài đặt bàn phím.
 */
export function StarRatingInput({ value, onChange, disabled = false, error }: StarRatingInputProps) {
  const { t } = useTranslation('reviews')
  const name = useId()
  const errorId = `${name}-error`
  const [hovered, setHovered] = useState(0)
  const shown = hovered || value

  return (
    <fieldset className="flex flex-col gap-1.5" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-1 text-sm font-medium">
        {t('stars.inputLegend')} <span aria-hidden="true" className="text-status-danger-foreground">*</span>
      </legend>
      <div className="flex items-center gap-3">
        <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
          {[1, 2, 3, 4, 5].map((star) => (
            <label
              key={star}
              onMouseEnter={() => !disabled && setHovered(star)}
              className={cn(
                'cursor-pointer rounded-md p-0.5 has-focus-visible:ring-2 has-focus-visible:ring-ring',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                type="radio"
                name={name}
                value={star}
                checked={value === star}
                disabled={disabled}
                onChange={() => onChange(star)}
                className="sr-only"
              />
              <span className="sr-only">{t('stars.inputOption', { count: star })}</span>
              <Star
                aria-hidden="true"
                className={cn('size-7', star <= shown ? 'fill-current text-primary' : 'text-muted-foreground/40')}
              />
            </label>
          ))}
        </div>
        {shown > 0 && (
          <span className="text-sm text-muted-foreground">{t(`stars.hint.${shown as 1 | 2 | 3 | 4 | 5}`)}</span>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-xs text-status-danger-foreground">
          {error}
        </p>
      )}
    </fieldset>
  )
}
