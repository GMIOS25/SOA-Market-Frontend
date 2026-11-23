import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { MapPin, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { SvcIdn } from '@/api/generated'
import { AuthAccountShell } from '../components/AuthAccountShell'
import {
  AuthApiError,
  apiCreateAddress,
  apiDeleteAddress,
  apiListAddresses,
  apiUpdateAddress,
} from '../api'
import { addressSchema, type AddressFormValues } from '../schemas'
import { useAuthSession } from '../session'

type AddressItem = SvcIdn.components['schemas']['AddressDTO']

export function AddressesPage() {
  const { t } = useTranslation()
  const session = useAuthSession()
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AddressItem | null>(null)
  const [bannerError, setBannerError] = useState<string | null>(null)

  const addressesQuery = useQuery({
    queryKey: ['auth', 'addresses'],
    queryFn: apiListAddresses,
    enabled: Boolean(session.accessToken),
  })

  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      receiver: '',
      phone: '',
      line: '',
      ward: '',
      district: '',
      province: '',
      isDefault: false,
    },
  })

  const openCreateModal = () => {
    setEditing(null)
    setBannerError(null)
    form.reset({
      receiver: session.user?.fullName ?? '',
      phone: session.user?.phone ?? '',
      line: '',
      ward: '',
      district: '',
      province: '',
      isDefault: false,
    })
    setModalOpen(true)
  }

  const openEditModal = (addr: AddressItem) => {
    setEditing(addr)
    setBannerError(null)
    form.reset({
      receiver: addr.receiver,
      phone: addr.phone,
      line: addr.line,
      ward: addr.ward,
      district: addr.district,
      province: addr.province,
      isDefault: addr.isDefault,
    })
    setModalOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (values: AddressFormValues) => {
      if (editing) {
        return apiUpdateAddress(editing.addressId, values)
      }
      return apiCreateAddress(values)
    },
    onSuccess: () => {
      setModalOpen(false)
      setEditing(null)
      void queryClient.invalidateQueries({ queryKey: ['auth', 'addresses'] })
    },
    onError: (err) => {
      setBannerError(err instanceof AuthApiError ? err.parsed.message : 'Không thể lưu địa chỉ.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: apiDeleteAddress,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auth', 'addresses'] })
    },
    onError: (err) => {
      setBannerError(err instanceof AuthApiError ? err.parsed.message : 'Không thể xóa địa chỉ.')
    },
  })

  const setDefaultMutation = useMutation({
    mutationFn: (addr: AddressItem) =>
      apiUpdateAddress(addr.addressId, {
        receiver: addr.receiver,
        phone: addr.phone,
        line: addr.line,
        ward: addr.ward,
        district: addr.district,
        province: addr.province,
        isDefault: true,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auth', 'addresses'] })
    },
  })

  const addresses = addressesQuery.data?.data ?? []

  return (
    <AuthAccountShell
      title={t('authProfile.addresses.title')}
      subtitle="Địa chỉ được chụp cố định vào đơn hàng tại thời điểm thanh toán."
    >
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="size-4" aria-hidden="true" />
          {t('authProfile.addresses.addBtn')}
        </button>
      </div>

      {bannerError && !modalOpen && (
        <p
          role="alert"
          className="mb-4 rounded-md border border-status-danger-border bg-status-danger px-3 py-2 text-sm text-status-danger-foreground"
        >
          {bannerError}
        </p>
      )}

      {addressesQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-36 animate-pulse rounded-lg bg-muted" />
          <div className="h-36 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : addresses.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-10 text-center">
          <MapPin className="size-10 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold">{t('authProfile.addresses.emptyTitle')}</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {t('authProfile.addresses.emptyDesc')}
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <Plus className="size-4" aria-hidden="true" />
            {t('authProfile.addresses.addBtn')}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {addresses.map((addr) => (
            <article
              key={addr.addressId}
              className="flex flex-col justify-between rounded-lg border border-border bg-card p-5 shadow-xs"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{addr.receiver}</p>
                    <p className="font-mono text-xs text-muted-foreground">{addr.phone}</p>
                  </div>
                  {addr.isDefault && (
                    <span className="rounded-full border border-status-success-border bg-status-success px-2.5 py-0.5 text-xs font-medium text-status-success-foreground">
                      Mặc định
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm text-foreground">
                  {addr.line}, {addr.ward}, {addr.district}, {addr.province}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                {!addr.isDefault && (
                  <button
                    type="button"
                    disabled={setDefaultMutation.isPending}
                    onClick={() => setDefaultMutation.mutate(addr)}
                    className="inline-flex h-8 items-center rounded-md border border-input bg-card px-2.5 text-xs font-medium hover:bg-muted"
                  >
                    Đặt làm mặc định
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openEditModal(addr)}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-card px-2.5 text-xs font-medium hover:bg-muted"
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                  Sửa
                </button>
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(addr.addressId)}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-status-danger-border bg-status-danger px-2.5 text-xs font-medium text-status-danger-foreground hover:opacity-90"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Xóa
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
        >
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-semibold">
                {editing ? 'Cập nhật địa chỉ' : 'Thêm địa chỉ giao hàng mới'}
              </h2>
              <button
                type="button"
                aria-label="Đóng hộp thoại"
                onClick={() => setModalOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            {bannerError && (
              <p
                role="alert"
                className="mt-3 rounded-md border border-status-danger-border bg-status-danger px-3 py-2 text-xs text-status-danger-foreground"
              >
                {bannerError}
              </p>
            )}

            <form
              onSubmit={(e) => void form.handleSubmit((values) => saveMutation.mutate(values))(e)}
              className="mt-4 space-y-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="addr-receiver" className="block text-sm font-medium">
                    Người nhận
                  </label>
                  <input
                    id="addr-receiver"
                    type="text"
                    {...form.register('receiver')}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  />
                  {form.formState.errors.receiver && (
                    <p className="mt-1 text-xs text-status-danger-foreground">
                      {form.formState.errors.receiver.message}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="addr-phone" className="block text-sm font-medium">
                    Số điện thoại
                  </label>
                  <input
                    id="addr-phone"
                    type="tel"
                    {...form.register('phone')}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  />
                  {form.formState.errors.phone && (
                    <p className="mt-1 text-xs text-status-danger-foreground">
                      {form.formState.errors.phone.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="addr-line" className="block text-sm font-medium">
                  Số nhà, tên đường
                </label>
                <input
                  id="addr-line"
                  type="text"
                  {...form.register('line')}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                />
                {form.formState.errors.line && (
                  <p className="mt-1 text-xs text-status-danger-foreground">
                    {form.formState.errors.line.message}
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="addr-ward" className="block text-sm font-medium">
                    Phường/Xã
                  </label>
                  <input
                    id="addr-ward"
                    type="text"
                    {...form.register('ward')}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  />
                  {form.formState.errors.ward && (
                    <p className="mt-1 text-xs text-status-danger-foreground">
                      {form.formState.errors.ward.message}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="addr-district" className="block text-sm font-medium">
                    Quận/Huyện
                  </label>
                  <input
                    id="addr-district"
                    type="text"
                    {...form.register('district')}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  />
                  {form.formState.errors.district && (
                    <p className="mt-1 text-xs text-status-danger-foreground">
                      {form.formState.errors.district.message}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="addr-province" className="block text-sm font-medium">
                    Tỉnh/Thành phố
                  </label>
                  <input
                    id="addr-province"
                    type="text"
                    {...form.register('province')}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  />
                  {form.formState.errors.province && (
                    <p className="mt-1 text-xs text-status-danger-foreground">
                      {form.formState.errors.province.message}
                    </p>
                  )}
                </div>
              </div>

              <label htmlFor="addr-default" className="flex items-center gap-2 pt-1 text-sm">
                <input
                  id="addr-default"
                  type="checkbox"
                  {...form.register('isDefault')}
                  className="size-4 rounded border-input"
                />
                <span>Đặt làm địa chỉ giao hàng mặc định</span>
              </label>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="inline-flex h-10 items-center rounded-md border border-input bg-card px-4 text-sm font-medium hover:bg-muted"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Đang lưu...' : 'Lưu địa chỉ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AuthAccountShell>
  )
}
