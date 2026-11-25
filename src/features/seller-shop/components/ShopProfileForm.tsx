import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, ImagePlus, Loader2, LockKeyhole, RotateCcw, Store, TriangleAlert, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useForm, useWatch, type FieldPath } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/errors'
import { CopyableId } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { apiUpdateMyShop, sellerShopKeys, type ShopDTO } from '../api'
import { readAsDataUrl } from '../file-utils'
import {
  ACCEPTED_KYC_TYPES,
  SHOP_DESCRIPTION_MAX,
  SHOP_NAME_MAX,
  SHOP_POLICY_MAX,
  createShopProfileSchema,
  shopLogoError,
  shopProfileDefaults,
  type ShopProfileFormValues,
} from '../schemas'

const PROFILE_FIELDS = new Set<string>(['name', 'description', 'policy', 'contactEmail', 'contactPhone', 'logo'])

const inputClass =
  'h-10 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-status-danger-border'

function useLogoPreview(file: File | null): string | null {
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

type ShopProfileFormProps = {
  shop: ShopDTO
  onUpdated: (shop: ShopDTO) => void
}

/** Form cập nhật hồ sơ gian hàng & logo (`PUT /v1/seller/shop`, FR-SEL-003). */
export function ShopProfileForm({ shop, onUpdated }: ShopProfileFormProps) {
  const { t } = useTranslation('sellerShop')
  const queryClient = useQueryClient()
  const schema = useMemo(() => createShopProfileSchema(t), [t])
  const logoInputId = useId()
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [submitError, setSubmitError] = useState<ApiError | Error | null>(null)
  const [conflict, setConflict] = useState(false)
  const [saved, setSaved] = useState(false)

  const locked = shop.status === 'LOCKED'

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    reset,
    control,
    formState: { errors },
  } = useForm<ShopProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: shopProfileDefaults(shop),
  })

  useEffect(() => {
    reset(shopProfileDefaults(shop))
    if (logoInputRef.current) logoInputRef.current.value = ''
  }, [shop, reset])

  const logoFile = useWatch({ control, name: 'logo' }) ?? null
  const logoPreviewUrl = useLogoPreview(logoFile)
  const displayedLogoUrl = logoPreviewUrl ?? shop.logoUrl ?? null

  const mutation = useMutation({
    mutationFn: (values: ShopProfileFormValues) =>
      apiUpdateMyShop({
        name: values.name,
        description: values.description,
        policy: values.policy,
        contactEmail: values.contactEmail,
        contactPhone: values.contactPhone,
        logo: values.logo,
      }),
    onMutate: () => {
      setSubmitError(null)
      setConflict(false)
      setSaved(false)
    },
    onSuccess: (updated) => {
      onUpdated(updated)
      setSaved(true)
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) {
        setSubmitError(new Error(t('sellerShop.profile.submitError')))
        return
      }
      if (error.code === 'SHOP_NAME_TAKEN') {
        setError('name', { message: error.message }, { shouldFocus: true })
        return
      }
      if (error.code === 'SHOP_VERSION_CONFLICT') {
        setConflict(true)
        return
      }
      const fieldErrors = error.details.filter((d) => PROFILE_FIELDS.has(d.field))
      fieldErrors.forEach((detail, index) =>
        setError(detail.field as FieldPath<ShopProfileFormValues>, { message: detail.reason }, { shouldFocus: index === 0 }),
      )
      if (fieldErrors.length === 0 || fieldErrors.length < error.details.length) {
        setSubmitError(error)
      }
    },
  })

  function changeLogo(file: File | null) {
    setValue('logo', file, { shouldDirty: true })
    const message = file ? shopLogoError(file, t) : null
    if (message) setError('logo', { message })
    else clearErrors('logo')
  }

  const submitting = mutation.isPending

  return (
    <section
      aria-labelledby="shop-profile-heading"
      className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5 shadow-xs"
    >
      <header className="flex flex-col gap-1 border-b border-border pb-3">
        <h2 id="shop-profile-heading" className="text-lg font-semibold">
          {t('sellerShop.profile.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('sellerShop.profile.description')}</p>
      </header>

      {locked && (
        <p className="flex items-center gap-2 rounded-md border border-status-danger-border bg-status-danger px-3 py-2 text-xs text-status-danger-foreground">
          <LockKeyhole aria-hidden="true" className="size-4 shrink-0" />
          {t('sellerShop.profile.lockedHint')}
        </p>
      )}

      {saved && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md border border-status-success-border bg-status-success px-3 py-2 text-sm text-status-success-foreground"
        >
          <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
          {t('sellerShop.profile.saved')}
        </p>
      )}

      {conflict && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-status-warning-border bg-status-warning p-3 text-sm text-status-warning-foreground"
        >
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
            {t('sellerShop.profile.conflict')}
          </p>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => void queryClient.invalidateQueries({ queryKey: sellerShopKeys.myShop })}
          >
            <RotateCcw aria-hidden="true" />
            {t('sellerShop.profile.reload')}
          </Button>
        </div>
      )}

      <form
        noValidate
        onSubmit={(event) => void handleSubmit((values) => mutation.mutate(values))(event)}
        className="flex flex-col gap-4"
        aria-busy={submitting}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor={logoInputId} className="text-sm font-medium">
            {t('sellerShop.profile.logoLabel')}
          </label>
          <div
            className={cn(
              'flex flex-col gap-3 rounded-md border border-dashed bg-background p-3 sm:flex-row sm:items-center',
              errors.logo ? 'border-status-danger-border' : 'border-input',
            )}
          >
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card">
              {displayedLogoUrl ? (
                <img src={displayedLogoUrl} alt={shop.name} className="size-full object-cover" />
              ) : (
                <Store aria-hidden="true" className="size-6 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {logoFile ? (
                <p className="truncate text-sm font-medium">{logoFile.name}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{t('sellerShop.profile.logoHint')}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={submitting || locked}
                onClick={() => logoInputRef.current?.click()}
              >
                <ImagePlus aria-hidden="true" />
                {displayedLogoUrl ? t('sellerShop.profile.replaceLogo') : t('sellerShop.profile.chooseLogo')}
              </Button>
              {logoFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={submitting || locked}
                  onClick={() => {
                    if (logoInputRef.current) logoInputRef.current.value = ''
                    changeLogo(null)
                  }}
                >
                  <X aria-hidden="true" />
                  {t('sellerShop.profile.removeLogo')}
                </Button>
              )}
            </div>
            <input
              ref={logoInputRef}
              id={logoInputId}
              type="file"
              accept={ACCEPTED_KYC_TYPES.join(',')}
              className="sr-only"
              tabIndex={-1}
              disabled={submitting || locked}
              aria-invalid={errors.logo ? true : undefined}
              onChange={(event) => changeLogo(event.currentTarget.files?.[0] ?? null)}
            />
          </div>
          {errors.logo && <p className="text-xs text-status-danger-foreground">{errors.logo.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shop-profile-name">
            {t('sellerShop.profile.name')} <span aria-hidden="true" className="text-status-danger-foreground">*</span>
          </Label>
          <input
            id="shop-profile-name"
            maxLength={SHOP_NAME_MAX}
            disabled={submitting || locked}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby="shop-profile-name-hint"
            className={inputClass}
            {...register('name')}
          />
          <p
            id="shop-profile-name-hint"
            className={cn('text-xs', errors.name ? 'text-status-danger-foreground' : 'text-muted-foreground')}
          >
            {errors.name?.message ?? t('sellerShop.profile.nameHint')}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shop-profile-email">{t('sellerShop.profile.contactEmail')}</Label>
            <input
              id="shop-profile-email"
              type="email"
              disabled={submitting}
              aria-invalid={errors.contactEmail ? true : undefined}
              className={inputClass}
              {...register('contactEmail')}
            />
            {errors.contactEmail && (
              <p className="text-xs text-status-danger-foreground">{errors.contactEmail.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shop-profile-phone">{t('sellerShop.profile.contactPhone')}</Label>
            <input
              id="shop-profile-phone"
              inputMode="tel"
              disabled={submitting}
              aria-invalid={errors.contactPhone ? true : undefined}
              className={cn(inputClass, 'font-mono')}
              {...register('contactPhone')}
            />
            {errors.contactPhone && (
              <p className="text-xs text-status-danger-foreground">{errors.contactPhone.message}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shop-profile-description">{t('sellerShop.profile.descriptionLabel')}</Label>
          <Textarea
            id="shop-profile-description"
            rows={3}
            maxLength={SHOP_DESCRIPTION_MAX}
            disabled={submitting || locked}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby="shop-profile-description-hint"
            {...register('description')}
          />
          <p
            id="shop-profile-description-hint"
            className={cn('text-xs', errors.description ? 'text-status-danger-foreground' : 'text-muted-foreground')}
          >
            {errors.description?.message ?? t('sellerShop.profile.descriptionHint')}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shop-profile-policy">{t('sellerShop.profile.policyLabel')}</Label>
          <Textarea
            id="shop-profile-policy"
            rows={4}
            maxLength={SHOP_POLICY_MAX}
            disabled={submitting || locked}
            aria-invalid={errors.policy ? true : undefined}
            aria-describedby="shop-profile-policy-hint"
            {...register('policy')}
          />
          <p
            id="shop-profile-policy-hint"
            className={cn('text-xs', errors.policy ? 'text-status-danger-foreground' : 'text-muted-foreground')}
          >
            {errors.policy?.message ?? t('sellerShop.profile.policyHint')}
          </p>
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
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 aria-hidden="true" className="animate-spin" />}
            {submitting ? t('sellerShop.profile.saving') : t('sellerShop.profile.save')}
          </Button>
        </div>
      </form>
    </section>
  )
}
