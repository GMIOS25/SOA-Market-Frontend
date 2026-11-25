import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { CircleCheck, Loader2, MapPin, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, type FieldPath } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/errors'
import { CopyableId } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { apiUpdatePickupAddress, type ShopDTO } from '../api'
import {
  PICKUP_AREA_MAX,
  PICKUP_CONTACT_MAX,
  PICKUP_LINE_MAX,
  createPickupAddressSchema,
  pickupAddressDefaults,
  type PickupAddressFormValues,
} from '../schemas'

const PICKUP_FIELDS = new Set<string>(['contactName', 'phone', 'line', 'ward', 'district', 'province'])

const inputClass =
  'h-10 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-status-danger-border'

type PickupAddressFormProps = {
  shop: ShopDTO
  onUpdated: (shop: ShopDTO) => void
}

/** Form cấu hình địa chỉ lấy hàng mặc định (`PUT /v1/seller/shop/pickup-address`, FR-SEL-003). */
export function PickupAddressForm({ shop, onUpdated }: PickupAddressFormProps) {
  const { t } = useTranslation('sellerShop')
  const schema = useMemo(() => createPickupAddressSchema(t), [t])
  const [submitError, setSubmitError] = useState<ApiError | Error | null>(null)
  const [saved, setSaved] = useState(false)
  const locked = shop.status === 'LOCKED'

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<PickupAddressFormValues>({
    resolver: zodResolver(schema),
    defaultValues: pickupAddressDefaults(shop.pickupAddress),
  })

  useEffect(() => {
    reset(pickupAddressDefaults(shop.pickupAddress))
  }, [shop.pickupAddress, reset])

  const mutation = useMutation({
    mutationFn: (values: PickupAddressFormValues) => apiUpdatePickupAddress(values),
    onMutate: () => {
      setSubmitError(null)
      setSaved(false)
    },
    onSuccess: (updated) => {
      onUpdated(updated)
      setSaved(true)
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) {
        setSubmitError(new Error(t('sellerShop.pickup.submitError')))
        return
      }
      const fieldErrors = error.details.filter((d) => PICKUP_FIELDS.has(d.field))
      fieldErrors.forEach((detail, index) =>
        setError(detail.field as FieldPath<PickupAddressFormValues>, { message: detail.reason }, { shouldFocus: index === 0 }),
      )
      if (fieldErrors.length === 0 || fieldErrors.length < error.details.length) {
        setSubmitError(error)
      }
    },
  })

  const submitting = mutation.isPending

  return (
    <section
      id="pickup-address-section"
      aria-labelledby="pickup-address-heading"
      className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5 shadow-xs"
    >
      <header className="flex flex-col gap-1 border-b border-border pb-3">
        <h2 id="pickup-address-heading" className="flex items-center gap-2 text-lg font-semibold">
          <MapPin aria-hidden="true" className="size-4 text-primary" />
          {t('sellerShop.pickup.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('sellerShop.pickup.description')}</p>
      </header>

      {saved && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md border border-status-success-border bg-status-success px-3 py-2 text-sm text-status-success-foreground"
        >
          <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
          {t('sellerShop.pickup.saved')}
        </p>
      )}

      <form
        noValidate
        onSubmit={(event) => void handleSubmit((values) => mutation.mutate(values))(event)}
        className="flex flex-col gap-4"
        aria-busy={submitting}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pickup-contact-name">
              {t('sellerShop.pickup.contactName')} <span aria-hidden="true" className="text-status-danger-foreground">*</span>
            </Label>
            <input
              id="pickup-contact-name"
              maxLength={PICKUP_CONTACT_MAX}
              disabled={submitting || locked}
              aria-invalid={errors.contactName ? true : undefined}
              className={inputClass}
              {...register('contactName')}
            />
            {errors.contactName && (
              <p className="text-xs text-status-danger-foreground">{errors.contactName.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pickup-phone">
              {t('sellerShop.pickup.phone')} <span aria-hidden="true" className="text-status-danger-foreground">*</span>
            </Label>
            <input
              id="pickup-phone"
              inputMode="tel"
              disabled={submitting || locked}
              aria-invalid={errors.phone ? true : undefined}
              className={cn(inputClass, 'font-mono')}
              {...register('phone')}
            />
            {errors.phone && <p className="text-xs text-status-danger-foreground">{errors.phone.message}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pickup-line">
            {t('sellerShop.pickup.line')} <span aria-hidden="true" className="text-status-danger-foreground">*</span>
          </Label>
          <input
            id="pickup-line"
            maxLength={PICKUP_LINE_MAX}
            disabled={submitting || locked}
            aria-invalid={errors.line ? true : undefined}
            className={inputClass}
            {...register('line')}
          />
          {errors.line && <p className="text-xs text-status-danger-foreground">{errors.line.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pickup-ward">
              {t('sellerShop.pickup.ward')} <span aria-hidden="true" className="text-status-danger-foreground">*</span>
            </Label>
            <input
              id="pickup-ward"
              maxLength={PICKUP_AREA_MAX}
              disabled={submitting || locked}
              aria-invalid={errors.ward ? true : undefined}
              className={inputClass}
              {...register('ward')}
            />
            {errors.ward && <p className="text-xs text-status-danger-foreground">{errors.ward.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pickup-district">
              {t('sellerShop.pickup.district')} <span aria-hidden="true" className="text-status-danger-foreground">*</span>
            </Label>
            <input
              id="pickup-district"
              maxLength={PICKUP_AREA_MAX}
              disabled={submitting || locked}
              aria-invalid={errors.district ? true : undefined}
              className={inputClass}
              {...register('district')}
            />
            {errors.district && <p className="text-xs text-status-danger-foreground">{errors.district.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pickup-province">
              {t('sellerShop.pickup.province')} <span aria-hidden="true" className="text-status-danger-foreground">*</span>
            </Label>
            <input
              id="pickup-province"
              maxLength={PICKUP_AREA_MAX}
              disabled={submitting || locked}
              aria-invalid={errors.province ? true : undefined}
              className={inputClass}
              {...register('province')}
            />
            {errors.province && <p className="text-xs text-status-danger-foreground">{errors.province.message}</p>}
          </div>
        </div>

        {submitError && (
          <div
            role="alert"
            className="flex flex-col gap-1 rounded-md border border-status-danger-border bg-status-danger p-3 text-sm text-status-danger-foreground"
          >
            <p className="flex items-start gap-2 font-medium">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {submitError.message}
            </p>
            {submitError instanceof ApiError && submitError.correlationId && (
              <p className="flex items-center gap-1 text-xs">
                X-Correlation-Id: <CopyableId value={submitError.correlationId} label="X-Correlation-Id" />
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting || locked}>
            {submitting && <Loader2 aria-hidden="true" className="animate-spin" />}
            {submitting ? t('sellerShop.pickup.saving') : t('sellerShop.pickup.save')}
          </Button>
        </div>
      </form>
    </section>
  )
}
