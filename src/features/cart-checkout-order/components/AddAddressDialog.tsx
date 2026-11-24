import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/errors'
import { CopyableId } from '@/components/shared'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { addressSchema, type AddressFormValues } from '@/features/auth-profile/schemas'
import { cn } from '@/lib/utils'
import { apiCreateAddress, type AddressDTO } from '../api'

export type AddAddressDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultReceiver?: string
  defaultPhone?: string
  defaultIsDefault?: boolean
  onCreated: (address: AddressDTO) => void
}

const inputBaseClass =
  'h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-invalid:border-destructive'

/**
 * Modal thêm địa chỉ giao hàng ngay tại màn hình Checkout để không làm gián đoạn luồng ≤ 3 màn hình (NFR-USA-002).
 */
export function AddAddressDialog({
  open,
  onOpenChange,
  defaultReceiver = '',
  defaultPhone = '',
  defaultIsDefault = false,
  onCreated,
}: AddAddressDialogProps) {
  const { t } = useTranslation('checkout')
  const queryClient = useQueryClient()
  const baseId = useId()
  const [submitError, setSubmitError] = useState<ApiError | Error | null>(null)

  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      receiver: defaultReceiver,
      phone: defaultPhone,
      line: '',
      ward: '',
      district: '',
      province: '',
      isDefault: defaultIsDefault,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        receiver: defaultReceiver,
        phone: defaultPhone,
        line: '',
        ward: '',
        district: '',
        province: '',
        isDefault: defaultIsDefault,
      })
    }
  }, [open, defaultReceiver, defaultPhone, defaultIsDefault, form])

  const createMutation = useMutation({
    mutationFn: apiCreateAddress,
    onMutate: () => {
      setSubmitError(null)
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['auth', 'addresses'] })
      setSubmitError(null)
      onOpenChange(false)
      onCreated(created)
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const fieldKeys = new Set<keyof AddressFormValues>([
          'receiver',
          'phone',
          'line',
          'ward',
          'district',
          'province',
          'isDefault',
        ])
        for (const detail of err.details) {
          if (fieldKeys.has(detail.field as keyof AddressFormValues)) {
            form.setError(detail.field as keyof AddressFormValues, { message: detail.reason })
          }
        }
        setSubmitError(err)
        return
      }
      setSubmitError(new Error(t('checkout.addressModal.errorFallback')))
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!createMutation.isPending) {
          setSubmitError(null)
          onOpenChange(next)
        }
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('checkout.addressModal.title')}</DialogTitle>
          <DialogDescription>{t('checkout.addressModal.description')}</DialogDescription>
        </DialogHeader>

        {submitError && (
          <div
            role="alert"
            className="flex flex-col gap-1 rounded-md border border-status-danger-border bg-status-danger px-3 py-2 text-xs text-status-danger-foreground"
          >
            <p className="flex items-start gap-2 font-medium">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{submitError.message}</span>
            </p>
            {submitError instanceof ApiError && submitError.correlationId && (
              <p className="flex items-center gap-1">
                {t('checkout.stockModal.correlationId')}:
                <CopyableId value={submitError.correlationId} label={t('checkout.stockModal.correlationId')} />
              </p>
            )}
          </div>
        )}

        <form
          onSubmit={(e) => void handleSubmit((values) => createMutation.mutate(values))(e)}
          className="space-y-3"
          noValidate
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`${baseId}-receiver`}>{t('checkout.addressModal.receiver')}</Label>
              <input
                id={`${baseId}-receiver`}
                type="text"
                placeholder={t('checkout.addressModal.receiverPlaceholder')}
                aria-invalid={Boolean(errors.receiver)}
                aria-describedby={errors.receiver ? `${baseId}-receiver-err` : undefined}
                {...register('receiver')}
                className={inputBaseClass}
              />
              {errors.receiver && (
                <p id={`${baseId}-receiver-err`} className="text-xs text-status-danger-foreground">
                  {errors.receiver.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor={`${baseId}-phone`}>{t('checkout.addressModal.phone')}</Label>
              <input
                id={`${baseId}-phone`}
                type="tel"
                placeholder={t('checkout.addressModal.phonePlaceholder')}
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? `${baseId}-phone-err` : undefined}
                {...register('phone')}
                className={inputBaseClass}
              />
              {errors.phone && (
                <p id={`${baseId}-phone-err`} className="text-xs text-status-danger-foreground">
                  {errors.phone.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor={`${baseId}-line`}>{t('checkout.addressModal.line')}</Label>
            <input
              id={`${baseId}-line`}
              type="text"
              placeholder={t('checkout.addressModal.linePlaceholder')}
              aria-invalid={Boolean(errors.line)}
              aria-describedby={errors.line ? `${baseId}-line-err` : undefined}
              {...register('line')}
              className={inputBaseClass}
            />
            {errors.line && (
              <p id={`${baseId}-line-err`} className="text-xs text-status-danger-foreground">
                {errors.line.message}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor={`${baseId}-ward`}>{t('checkout.addressModal.ward')}</Label>
              <input
                id={`${baseId}-ward`}
                type="text"
                placeholder={t('checkout.addressModal.wardPlaceholder')}
                aria-invalid={Boolean(errors.ward)}
                aria-describedby={errors.ward ? `${baseId}-ward-err` : undefined}
                {...register('ward')}
                className={inputBaseClass}
              />
              {errors.ward && (
                <p id={`${baseId}-ward-err`} className="text-xs text-status-danger-foreground">
                  {errors.ward.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor={`${baseId}-district`}>{t('checkout.addressModal.district')}</Label>
              <input
                id={`${baseId}-district`}
                type="text"
                placeholder={t('checkout.addressModal.districtPlaceholder')}
                aria-invalid={Boolean(errors.district)}
                aria-describedby={errors.district ? `${baseId}-district-err` : undefined}
                {...register('district')}
                className={inputBaseClass}
              />
              {errors.district && (
                <p id={`${baseId}-district-err`} className="text-xs text-status-danger-foreground">
                  {errors.district.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor={`${baseId}-province`}>{t('checkout.addressModal.province')}</Label>
              <input
                id={`${baseId}-province`}
                type="text"
                placeholder={t('checkout.addressModal.provincePlaceholder')}
                aria-invalid={Boolean(errors.province)}
                aria-describedby={errors.province ? `${baseId}-province-err` : undefined}
                {...register('province')}
                className={inputBaseClass}
              />
              {errors.province && (
                <p id={`${baseId}-province-err`} className="text-xs text-status-danger-foreground">
                  {errors.province.message}
                </p>
              )}
            </div>
          </div>

          <label htmlFor={`${baseId}-default`} className="flex items-center gap-2 pt-1 text-sm">
            <input
              id={`${baseId}-default`}
              type="checkbox"
              {...register('isDefault')}
              className="size-4 rounded border-input accent-primary"
            />
            <span>{t('checkout.addressModal.isDefault')}</span>
          </label>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={createMutation.isPending}
              onClick={() => onOpenChange(false)}
            >
              {t('checkout.addressModal.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className={cn(createMutation.isPending && 'cursor-progress')}
            >
              {createMutation.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
              {createMutation.isPending ? t('checkout.addressModal.submitting') : t('checkout.addressModal.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
