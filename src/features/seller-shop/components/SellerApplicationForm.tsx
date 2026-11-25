import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Loader2, LockKeyhole, TriangleAlert, User } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm, useWatch, type FieldPath } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/errors'
import { CopyableId } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  apiSubmitApplication,
  DOCUMENT_FIELDS,
  REQUIRED_DOCUMENTS,
  sellerShopKeys,
  type ApplicationDTO,
  type SellerType,
} from '../api'
import {
  createApplicationSchema,
  emptyApplicationForm,
  kycFileError,
  SHOP_NAME_MAX,
  type ApplicationFormValues,
} from '../schemas'
import { KycFileField } from './KycFileField'

const FORM_FIELDS = new Set<string>(Object.keys(emptyApplicationForm()))
const SELLER_TYPES: SellerType[] = ['INDIVIDUAL', 'ORGANIZATION']

type SellerApplicationFormProps = {
  /** Lý do lần bị từ chối trước — hiển thị làm ngữ cảnh khi nộp lại. */
  previousRejectionReason?: string
  /** Có khi đang nộp lại sau REJECTED: quay về màn hình trạng thái. */
  onCancel?: () => void
}

const inputClass =
  'h-10 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-invalid:border-status-danger-border'

/** Form đăng ký nhà bán cá nhân / tổ chức kèm ảnh KYC (FR-SEL-001, 03-App-Flow §4.4). */
export function SellerApplicationForm({ previousRejectionReason, onCancel }: SellerApplicationFormProps) {
  const { t } = useTranslation('sellerShop')
  const queryClient = useQueryClient()
  const schema = useMemo(() => createApplicationSchema(t), [t])
  const [submitError, setSubmitError] = useState<ApiError | Error | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    control,
    formState: { errors },
  } = useForm<ApplicationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyApplicationForm(),
  })
  const values = useWatch({ control })
  const sellerType: SellerType = values.sellerType ?? 'INDIVIDUAL'

  const mutation = useMutation({
    mutationFn: (form: ApplicationFormValues) =>
      apiSubmitApplication({
        sellerType: form.sellerType,
        shopName: form.shopName,
        identityOrBusinessNumber: form.identityOrBusinessNumber,
        taxCode: form.taxCode,
        files: Object.fromEntries(
          REQUIRED_DOCUMENTS[form.sellerType].map((docType) => [docType, form[DOCUMENT_FIELDS[docType]] ?? undefined]),
        ),
      }),
    onMutate: () => setSubmitError(null),
    onSuccess: (application: ApplicationDTO) => {
      queryClient.setQueryData(sellerShopKeys.myApplication, application)
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) {
        setSubmitError(new Error(t('onboarding.form.submitError')))
        return
      }
      if (error.code === 'APPLICATION_ALREADY_EXISTS') {
        // TC-SEL-01: đã có hồ sơ PENDING/APPROVED ở tab/thiết bị khác → tải lại để hiện màn hình trạng thái.
        void queryClient.invalidateQueries({ queryKey: sellerShopKeys.myApplication })
      }
      if (error.code === 'SHOP_NAME_TAKEN') {
        setError('shopName', { message: error.message }, { shouldFocus: true })
        return
      }
      const fieldErrors = error.details.filter((d) => FORM_FIELDS.has(d.field))
      fieldErrors.forEach((detail, index) =>
        setError(detail.field as FieldPath<ApplicationFormValues>, { message: detail.reason }, { shouldFocus: index === 0 }),
      )
      if (fieldErrors.length === 0 || fieldErrors.length < error.details.length) setSubmitError(error)
    },
  })

  function changeSellerType(next: SellerType) {
    setValue('sellerType', next)
    // Mã số & tài liệu khác nhau giữa 2 loại hình → xóa lỗi cũ để không báo nhầm trường đã ẩn.
    clearErrors(['identityOrBusinessNumber', ...Object.values(DOCUMENT_FIELDS)])
  }

  function changeFile(field: (typeof DOCUMENT_FIELDS)[keyof typeof DOCUMENT_FIELDS], file: File | null) {
    setValue(field, file, { shouldDirty: true })
    const message = file ? kycFileError(file, t) : null
    if (message) setError(field, { message })
    else clearErrors(field)
  }

  const submitting = mutation.isPending

  return (
    <form
      noValidate
      onSubmit={(event) => void handleSubmit((form) => mutation.mutate(form))(event)}
      className="flex flex-col gap-6"
      aria-busy={submitting}
    >
      {previousRejectionReason && (
        <div className="rounded-md border border-status-danger-border bg-status-danger p-3 text-sm text-status-danger-foreground">
          <p className="font-medium">{t('onboarding.previousRejection')}</p>
          <p className="mt-1 whitespace-pre-line">{previousRejectionReason}</p>
        </div>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-semibold">{t('onboarding.form.sellerTypeLegend')}</legend>
        <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
          {SELLER_TYPES.map((type) => {
            const Icon = type === 'INDIVIDUAL' ? User : Building2
            const checked = sellerType === type
            return (
              <label
                key={type}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring',
                  checked ? 'border-primary bg-primary-soft' : 'border-input bg-card hover:bg-background',
                )}
              >
                <input
                  type="radio"
                  name="sellerType"
                  value={type}
                  checked={checked}
                  disabled={submitting}
                  onChange={() => changeSellerType(type)}
                  className="sr-only"
                />
                <Icon aria-hidden="true" className={cn('mt-0.5 size-5', checked ? 'text-primary' : 'text-muted-foreground')} />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{t(`sellerType.${type}`)}</span>
                  <span className="text-xs text-muted-foreground">{t(`onboarding.form.sellerTypeHint.${type}`)}</span>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <Label htmlFor="shopName">
            {t('onboarding.form.shopName')} <span aria-hidden="true" className="text-status-danger-foreground">*</span>
          </Label>
          <input
            id="shopName"
            maxLength={SHOP_NAME_MAX}
            autoComplete="organization"
            disabled={submitting}
            aria-invalid={errors.shopName ? true : undefined}
            aria-describedby="shopName-hint"
            className={inputClass}
            {...register('shopName')}
          />
          <FieldMessage id="shopName-hint" error={errors.shopName?.message} hint={t('onboarding.form.shopNameHint')} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="identityOrBusinessNumber">
            {t(`onboarding.form.identityNumber.${sellerType}`)}{' '}
            <span aria-hidden="true" className="text-status-danger-foreground">*</span>
          </Label>
          <input
            id="identityOrBusinessNumber"
            inputMode="numeric"
            disabled={submitting}
            aria-invalid={errors.identityOrBusinessNumber ? true : undefined}
            aria-describedby="identityOrBusinessNumber-hint"
            className={cn(inputClass, 'font-mono')}
            {...register('identityOrBusinessNumber')}
          />
          <FieldMessage
            id="identityOrBusinessNumber-hint"
            error={errors.identityOrBusinessNumber?.message}
            hint={t(`onboarding.form.identityNumberHint.${sellerType}`)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="taxCode">
            {t('onboarding.form.taxCode')} <span aria-hidden="true" className="text-status-danger-foreground">*</span>
          </Label>
          <input
            id="taxCode"
            inputMode="numeric"
            disabled={submitting}
            aria-invalid={errors.taxCode ? true : undefined}
            aria-describedby="taxCode-hint"
            className={cn(inputClass, 'font-mono')}
            {...register('taxCode')}
          />
          <FieldMessage id="taxCode-hint" error={errors.taxCode?.message} hint={t('onboarding.form.taxCodeHint')} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">{t('onboarding.form.documentsLegend')}</legend>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <LockKeyhole aria-hidden="true" className="size-4 shrink-0" />
          {t('onboarding.form.privacyNotice')}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {REQUIRED_DOCUMENTS[sellerType].map((docType) => {
            const field = DOCUMENT_FIELDS[docType]
            return (
              <KycFileField
                key={field}
                label={t(`docType.${docType}`)}
                file={values[field] ?? null}
                error={errors[field]?.message}
                disabled={submitting}
                onChange={(file) => changeFile(field, file)}
              />
            )
          })}
        </div>
      </fieldset>

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

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" disabled={submitting} onClick={onCancel}>
            {t('onboarding.form.cancelResubmit')}
          </Button>
        )}
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting && <Loader2 aria-hidden="true" className="animate-spin" />}
          {submitting ? t('onboarding.form.submitting') : t('onboarding.form.submit')}
        </Button>
      </div>
    </form>
  )
}

function FieldMessage({ id, error, hint }: { id: string; error?: string; hint: string }) {
  return error ? (
    <p id={id} className="text-xs text-status-danger-foreground">
      {error}
    </p>
  ) : (
    <p id={id} className="text-xs text-muted-foreground">
      {hint}
    </p>
  )
}
