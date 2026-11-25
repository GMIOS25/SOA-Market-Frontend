import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import type { ProductVariant } from '../api'
import {
  activeVariants,
  reconcileSelection,
  variantLabel,
  variantOptions,
  type VariantPicker,
  type VariantSelection,
} from '../storefront-helpers'
import { textFieldClass } from './form-field'

export type VariantPickerProps = {
  variants: ProductVariant[]
  picker: VariantPicker
  /** Chế độ theo thuộc tính: giá trị đã chọn của từng thuộc tính. */
  selection: VariantSelection
  /** Chế độ liệt kê: `variantId` đang chọn. */
  variantId: string
  onSelectionChange: (selection: VariantSelection) => void
  onVariantIdChange: (variantId: string) => void
}

/** Chọn biến thể (D6): mỗi thuộc tính một ô chọn; không ghép theo thuộc tính được thì chọn theo nhãn biến thể. */
export function VariantPicker({
  variants,
  picker,
  selection,
  variantId,
  onSelectionChange,
  onVariantIdChange,
}: VariantPickerProps) {
  const { t } = useTranslation('catalog')
  const baseId = useId()
  const active = activeVariants(variants)
  const outOfStockLabel = t('detail.outOfStockLabel')
  const optionLabel = (value: string, outOfStock: boolean) =>
    outOfStock ? `${value} — ${outOfStockLabel}` : value

  if (active.length === 0) {
    return <p className="text-sm text-status-danger-foreground">{t('detail.allVariantsUnavailable')}</p>
  }

  if (picker.mode === 'list') {
    return (
      <div className="space-y-1">
        <Label htmlFor={`${baseId}-variant`}>{t('detail.variantLabel')}</Label>
        <select
          id={`${baseId}-variant`}
          value={variantId}
          onChange={(event) => onVariantIdChange(event.target.value)}
          className={textFieldClass}
        >
          {active.length > 1 && <option value="">{t('detail.chooseVariant')}</option>}
          {active.map((variant) => (
            <option key={variant.variantId} value={variant.variantId}>
              {optionLabel(variantLabel(variant), variant.availableQuantity <= 0)}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {picker.keys.map((key) => {
        const options = variantOptions(variants, picker.keys, key, selection)
        // Thuộc tính chỉ có một giá trị thì hiển thị chữ, không cần ô chọn.
        if (options.length === 1) {
          return (
            <div key={key} className="space-y-1">
              <p className="text-sm font-medium text-foreground">{key}</p>
              <p className="text-sm text-muted-foreground">{options[0]?.value}</p>
            </div>
          )
        }
        return (
          <div key={key} className="space-y-1">
            <Label htmlFor={`${baseId}-${key}`}>{key}</Label>
            <select
              id={`${baseId}-${key}`}
              value={selection[key] ?? ''}
              onChange={(event) =>
                // Đổi một thuộc tính thì các thuộc tính khác được sắp xếp lại cho còn tổ hợp.
                onSelectionChange(
                  reconcileSelection(
                    variants,
                    picker,
                    { ...selection, [key]: event.target.value },
                    key,
                  ),
                )
              }
              className={textFieldClass}
            >
              <option value="">{t('detail.chooseValue')}</option>
              {options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {optionLabel(option.value, option.outOfStock)}
                </option>
              ))}
            </select>
          </div>
        )
      })}
    </div>
  )
}
