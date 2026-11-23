import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  CreditCard,
  Info,
  MapPin,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '@/api/errors'
import { useIdempotencyKey } from '@/api/idempotency'
import {
  CopyableId,
  ServiceFallbackBanner,
  ShopPackageCard,
  ShopPackageItem,
  ShopPackageSummary,
} from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthSession } from '@/lib/auth/session'
import { formatTime, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  apiGetCheckoutSummary,
  apiListAddresses,
  apiSubmitCheckout,
  apiUpdateCartItem,
  fallbackShopName,
  isStockOrAvailabilityConflict,
  parseConflictItems,
  redirectToPaymentUrl,
  toAddressSnapshot,
  type AddressDTO,
  type CheckoutExpectedItem,
  type CheckoutRequestBody,
  type CheckoutSummaryPackage,
  type ConflictItemDisplay,
  type PaymentGateway,
} from '../api'
import { AddAddressDialog } from '../components/AddAddressDialog'
import { CheckoutSteps } from '../components/CheckoutSteps'
import { InsufficientStockDialog } from '../components/InsufficientStockDialog'
import { DesktopOrderSummary, MobileStickyBottomBar } from '../components/StickySummaryBar'

export type CheckoutPageProps = {
  /** Override điều hướng cổng thanh toán phục vụ unit/integration test. */
  onRedirect?: (url: string) => void
}

function CheckoutPackagesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  )
}

export function CheckoutPage({ onRedirect = redirectToPaymentUrl }: CheckoutPageProps) {
  const { t } = useTranslation('checkout')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useAuthSession()
  const idempotency = useIdempotencyKey()
  const addressSectionRef = useRef<HTMLElement | null>(null)

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [paymentGateway, setPaymentGateway] = useState<PaymentGateway>('MOCK_PAY')
  const [removingShopId, setRemovingShopId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<ApiError | Error | null>(null)
  const [stockConflict, setStockConflict] = useState<{
    message: string
    items: ConflictItemDisplay[]
    correlationId?: string
  } | null>(null)

  const addressesQuery = useQuery({
    queryKey: ['auth', 'addresses'],
    queryFn: apiListAddresses,
    enabled: Boolean(session.accessToken),
  })

  const addresses = useMemo(() => addressesQuery.data?.data ?? [], [addressesQuery.data])

  const selectedAddress = useMemo<AddressDTO | null>(() => {
    if (addresses.length === 0) return null
    if (selectedAddressId) {
      const matched = addresses.find((a) => a.addressId === selectedAddressId)
      if (matched) return matched
    }
    return addresses.find((a) => a.isDefault) ?? addresses[0] ?? null
  }, [addresses, selectedAddressId])

  const summaryQuery = useQuery({
    queryKey: [
      'checkout',
      'summary',
      selectedAddress?.addressId,
      selectedAddress?.line,
      selectedAddress?.ward,
      selectedAddress?.district,
      selectedAddress?.province,
    ],
    queryFn: () =>
      apiGetCheckoutSummary({
        addressId: selectedAddress!.addressId,
        deliveryAddress: toAddressSnapshot(selectedAddress!),
      }),
    enabled: Boolean(selectedAddress),
    retry: false,
  })

  const summary = summaryQuery.data
  const packages = useMemo(() => summary?.packages ?? [], [summary])
  const excludedItems = useMemo(() => summary?.excludedItems ?? [], [summary])

  const checkoutMutation = useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: CheckoutRequestBody; idempotencyKey: string }) =>
      apiSubmitCheckout(body, idempotencyKey),
    onMutate: () => {
      setSubmitError(null)
    },
    onSuccess: (result) => {
      idempotency.reset()
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
      const targetUrl =
        result.payment.paymentUrl || `/checkout/result?orderId=${encodeURIComponent(result.orderId)}`
      onRedirect(targetUrl)
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        if (isStockOrAvailabilityConflict(err)) {
          setStockConflict({
            message: err.message,
            items: parseConflictItems(err, summary),
            correlationId: err.correlationId,
          })
          return
        }
        if (err.code === 'CHECKOUT_ALREADY_COMPENSATED' || err.code === 'IDEMPOTENCY_KEY_REUSED') {
          idempotency.reset()
        }
        setSubmitError(err)
        return
      }
      setSubmitError(new Error(t('checkout.summary.retryHint')))
    },
  })

  async function handleRemoveShopItems(pkg: CheckoutSummaryPackage) {
    const items = pkg.items ?? []
    if (items.length === 0 || removingShopId) return
    setRemovingShopId(pkg.shopId)
    setSubmitError(null)
    try {
      for (const item of items) {
        await apiUpdateCartItem(item.cartItemId, { selected: false })
      }
      await queryClient.invalidateQueries({ queryKey: ['cart'] })
      await queryClient.invalidateQueries({ queryKey: ['checkout', 'summary'] })
    } catch (err) {
      setSubmitError(err instanceof Error ? err : new Error(t('cart.updateErrorFallback')))
    } finally {
      setRemovingShopId(null)
    }
  }

  function handleScrollToAddress() {
    addressSectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    setAddressModalOpen(true)
  }

  function handlePlaceOrder() {
    if (!selectedAddress || !summary || !summary.canCheckout || checkoutMutation.isPending) return

    const expectedPrices: CheckoutExpectedItem[] = packages.flatMap((pkg) =>
      (pkg.items ?? []).map((item) => ({
        variantId: item.variantId,
        unitPrice: item.unitPrice,
      })),
    )

    const body: CheckoutRequestBody = {
      addressId: selectedAddress.addressId,
      deliveryAddress: toAddressSnapshot(selectedAddress),
      paymentGateway,
      returnUrl: `${window.location.origin}/checkout/result`,
      expectedShippingTotal: summary.shippingTotal,
      expectedPrices,
    }

    const key = idempotency.keyFor(body)
    checkoutMutation.mutate({ body, idempotencyKey: key })
  }

  const summaryApiError = summaryQuery.error instanceof ApiError ? summaryQuery.error : null
  const isEmptySelection =
    summaryApiError?.code === 'EMPTY_CHECKOUT_SELECTION' ||
    summaryApiError?.code === 'NO_VALID_ITEMS_FOR_CHECKOUT'

  const itemsTotal = summary?.itemsTotal ?? 0
  const shippingTotal = summary?.shippingTotal ?? 0
  const grandTotal = summary?.grandTotal ?? 0
  const canPlaceOrder =
    Boolean(selectedAddress) &&
    Boolean(summary) &&
    Boolean(summary?.canCheckout) &&
    !summaryQuery.isFetching &&
    !checkoutMutation.isPending &&
    !removingShopId

  const hasFallbackShipping = packages.some((pkg) => pkg.isFallbackRate)

  return (
    <div className="pb-28 lg:pb-6">
      <header className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <Link
            to="/cart"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            <span>{t('checkout.backToCart')}</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{t('checkout.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('checkout.subtitle')}</p>
        </div>
        <CheckoutSteps currentStep={2} />
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <div className="space-y-6 lg:col-span-8">
          {/* 1. Địa chỉ giao hàng + modal thêm tại chỗ */}
          <section
            ref={addressSectionRef}
            aria-labelledby="checkout-address-heading"
            className="rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <h2 id="checkout-address-heading" className="flex items-center gap-2 text-lg font-semibold">
                <MapPin aria-hidden="true" className="size-5 text-primary" />
                <span>{t('checkout.address.sectionTitle')}</span>
              </h2>
              <Button type="button" variant="outline" size="sm" onClick={() => setAddressModalOpen(true)}>
                <Plus aria-hidden="true" />
                {t('checkout.address.addNew')}
              </Button>
            </div>

            {addressesQuery.isLoading ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-24 w-full rounded-md" />
                <Skeleton className="h-24 w-full rounded-md" />
              </div>
            ) : addressesQuery.isError ? (
              <div className="mt-4">
                <ServiceFallbackBanner
                  message={
                    addressesQuery.error instanceof ApiError
                      ? addressesQuery.error.message
                      : t('checkout.address.loadError')
                  }
                  onRetry={() => void addressesQuery.refetch()}
                  isRetrying={addressesQuery.isFetching}
                />
              </div>
            ) : addresses.length === 0 ? (
              <div className="mt-4 flex flex-col items-center gap-2.5 rounded-md border border-dashed border-border bg-background/60 p-6 text-center">
                <p className="font-semibold text-foreground">{t('checkout.address.emptyTitle')}</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  {t('checkout.address.emptyDescription')}
                </p>
                <Button type="button" onClick={() => setAddressModalOpen(true)} className="mt-1">
                  <Plus aria-hidden="true" />
                  {t('checkout.address.emptyAction')}
                </Button>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {addresses.map((addr) => {
                  const isSelected = selectedAddress?.addressId === addr.addressId
                  return (
                    <label
                      key={addr.addressId}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-sm transition-colors',
                        isSelected
                          ? 'border-primary bg-primary-soft/50 ring-1 ring-primary'
                          : 'border-border bg-card hover:bg-background',
                      )}
                    >
                      <input
                        type="radio"
                        name="checkout-delivery-address"
                        aria-label={t('checkout.address.selectAddress', {
                          receiver: addr.receiver,
                          line: addr.line,
                        })}
                        checked={isSelected}
                        onChange={() => {
                          setSelectedAddressId(addr.addressId)
                          setSubmitError(null)
                        }}
                        className="mt-1 size-4 shrink-0 accent-primary"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">{addr.receiver}</span>
                          <span className="font-mono text-xs text-muted-foreground">{addr.phone}</span>
                          {addr.isDefault && (
                            <span className="rounded-full border border-status-success-border bg-status-success px-2 py-0.5 text-[11px] font-medium text-status-success-foreground">
                              {t('checkout.address.defaultBadge')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {addr.line}, {addr.ward}, {addr.district}, {addr.province}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </section>

          {/* 2. Danh sách gói hàng & Phí vận chuyển riêng từng nhà bán */}
          <section aria-labelledby="checkout-packages-heading" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="checkout-packages-heading" className="text-lg font-semibold">
                {t('checkout.packages.sectionTitle', { count: packages.length })}
              </h2>
              {summary?.quoteExpiresAt && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {t('checkout.packages.quoteCacheNotice', {
                    time: formatTime(summary.quoteExpiresAt),
                  })}
                </p>
              )}
            </div>

            {!selectedAddress ? (
              <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground shadow-xs">
                {t('checkout.packages.needAddress')}
              </div>
            ) : summaryQuery.isLoading ? (
              <CheckoutPackagesSkeleton />
            ) : isEmptySelection ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-8 text-center shadow-xs">
                <ShoppingBag aria-hidden="true" className="size-10 text-muted-foreground" />
                <h3 className="text-base font-semibold">{t('checkout.packages.emptySelectionTitle')}</h3>
                <p className="max-w-md text-sm text-muted-foreground">
                  {t('checkout.packages.emptySelectionDescription')}
                </p>
                <Button asChild variant="cta" size="cta" className="mt-1">
                  <Link to="/cart">{t('checkout.backToCart')}</Link>
                </Button>
              </div>
            ) : summaryQuery.isError ? (
              summaryApiError?.isServiceUnavailable ? (
                <ServiceFallbackBanner
                  message={summaryApiError.message}
                  onRetry={() => void summaryQuery.refetch()}
                  isRetrying={summaryQuery.isFetching}
                />
              ) : (
                <div
                  role="alert"
                  className="space-y-3 rounded-lg border border-status-danger-border bg-status-danger p-4 text-sm text-status-danger-foreground"
                >
                  <p className="font-medium">
                    {summaryApiError?.message ?? t('checkout.packages.summaryError')}
                  </p>
                  {summaryApiError?.correlationId && (
                    <p className="flex items-center gap-1 text-xs">
                      {t('checkout.stockModal.correlationId')}:
                      <CopyableId
                        value={summaryApiError.correlationId}
                        label={t('checkout.stockModal.correlationId')}
                      />
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void summaryQuery.refetch()}
                    >
                      <RefreshCw aria-hidden="true" />
                      {t('checkout.stockModal.refreshSummary')}
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link to="/cart">{t('checkout.backToCart')}</Link>
                    </Button>
                  </div>
                </div>
              )
            ) : (
              <>
                {excludedItems.length > 0 && (
                  <div
                    role="status"
                    className="space-y-1.5 rounded-lg border border-status-warning-border bg-status-warning p-4 text-sm text-status-warning-foreground"
                  >
                    <p className="flex items-center gap-2 font-medium">
                      <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
                      <span>{t('checkout.packages.excludedBanner')}</span>
                    </p>
                    <ul className="list-disc space-y-0.5 pl-6 text-xs">
                      {excludedItems.map((ex) => (
                        <li key={ex.cartItemId}>{ex.message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {hasFallbackShipping && (
                  <p className="flex items-start gap-2 rounded-lg border border-status-info-border bg-status-info px-4 py-3 text-xs text-status-info-foreground">
                    <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <span>{t('checkout.packages.estimatedShippingHint')}</span>
                  </p>
                )}

                {packages.map((pkg) => {
                  const shopName = pkg.shopName || fallbackShopName(pkg.shopId)
                  const items = pkg.items ?? []
                  const isRemoving = removingShopId === pkg.shopId

                  return (
                    <ShopPackageCard
                      key={pkg.shopId}
                      shop={{ id: pkg.shopId, name: shopName }}
                      notice={
                        !pkg.serviceable ? (
                          <div
                            role="alert"
                            className="flex flex-col gap-2.5 rounded-md border border-status-danger-border bg-status-danger p-3 text-xs text-status-danger-foreground sm:flex-row sm:items-center sm:justify-between"
                          >
                            <p className="flex items-start gap-2 font-medium">
                              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                              <span>{pkg.unserviceableReason || t('checkout.packages.unserviceableShop')}</span>
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="destructive-outline"
                                size="xs"
                                disabled={isRemoving}
                                onClick={() => void handleRemoveShopItems(pkg)}
                              >
                                {t('checkout.packages.removeShopItems')}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                onClick={handleScrollToAddress}
                              >
                                {t('checkout.packages.changeAddress')}
                              </Button>
                            </div>
                          </div>
                        ) : undefined
                      }
                      footer={
                        <ShopPackageSummary
                          itemsAmount={pkg.itemsAmount}
                          shippingFee={pkg.serviceable ? pkg.shippingFee : undefined}
                          carrier={pkg.carrier || undefined}
                          etaAt={pkg.estimatedDeliveryAt}
                          isEstimatedFee={pkg.isFallbackRate}
                        />
                      }
                    >
                      {items.map((item) => (
                        <ShopPackageItem
                          key={item.cartItemId}
                          name={item.productName}
                          variantLabel={item.variantLabel}
                          imageUrl={item.imageRef}
                          quantity={item.quantity}
                          unitPrice={item.unitPrice}
                          href={`/products/${item.productId}`}
                          end={
                            <span className="text-sm font-semibold text-foreground tabular-nums">
                              {formatVnd(item.lineTotal)}
                            </span>
                          }
                        />
                      ))}
                    </ShopPackageCard>
                  )
                })}
              </>
            )}
          </section>

          {/* 3. Chọn phương thức thanh toán trực tuyến */}
          <section
            aria-labelledby="checkout-payment-heading"
            className="rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5"
          >
            <div className="border-b border-border pb-3">
              <h2 id="checkout-payment-heading" className="flex items-center gap-2 text-lg font-semibold">
                <CreditCard aria-hidden="true" className="size-5 text-primary" />
                <span>{t('checkout.payment.sectionTitle')}</span>
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">{t('checkout.payment.onlineOnlyNote')}</p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    value: 'MOCK_PAY' as const,
                    title: t('checkout.payment.mockPayTitle'),
                    desc: t('checkout.payment.mockPayDesc'),
                  },
                  {
                    value: 'VNPAY' as const,
                    title: t('checkout.payment.vnpayTitle'),
                    desc: t('checkout.payment.vnpayDesc'),
                  },
                ] as const
              ).map((option) => {
                const selected = paymentGateway === option.value
                return (
                  <label
                    key={option.value}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors',
                      selected
                        ? 'border-primary bg-primary-soft/50 ring-1 ring-primary'
                        : 'border-border bg-card hover:bg-background',
                    )}
                  >
                    <input
                      type="radio"
                      name="checkout-payment-gateway"
                      value={option.value}
                      checked={selected}
                      onChange={() => setPaymentGateway(option.value)}
                      className="mt-1 size-4 shrink-0 accent-primary"
                    />
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">{option.title}</p>
                      <p className="text-xs text-muted-foreground">{option.desc}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          </section>

          {submitError && (
            <div
              role="alert"
              className="space-y-1.5 rounded-lg border border-status-danger-border bg-status-danger p-4 text-sm text-status-danger-foreground"
            >
              <p className="font-medium">
                {submitError.message}
                {submitError instanceof ApiError && submitError.retryAfterSeconds
                  ? ` (${t('checkout.summary.rateLimitNotice', { seconds: submitError.retryAfterSeconds })})`
                  : ''}
              </p>
              {submitError instanceof ApiError && submitError.correlationId && (
                <p className="flex items-center gap-1 text-xs">
                  {t('checkout.stockModal.correlationId')}:
                  <CopyableId
                    value={submitError.correlationId}
                    label={t('checkout.stockModal.correlationId')}
                  />
                </p>
              )}
            </div>
          )}
        </div>

        {/* Khối tổng kết bên phải (Desktop sticky) */}
        <div className="hidden lg:col-span-4 lg:block">
          <DesktopOrderSummary
            title={t('checkout.summary.title')}
            rows={[
              {
                label: t('checkout.summary.itemsTotal'),
                value: formatVnd(itemsTotal),
              },
              {
                label: t('checkout.summary.shippingTotal', { count: packages.length }),
                value: formatVnd(shippingTotal),
              },
            ]}
            totalLabel={t('checkout.summary.grandTotal')}
            totalAmount={grandTotal}
            ctaLabel={t('checkout.summary.placeOrder')}
            pendingLabel={t('checkout.summary.placingOrder')}
            isPending={checkoutMutation.isPending}
            disabled={!canPlaceOrder}
            onAction={handlePlaceOrder}
            footerNote={
              <p className="flex items-start gap-1.5">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>{t('checkout.summary.idempotencyHint')}</span>
              </p>
            }
          />
        </div>
      </div>

      {/* Sticky Bottom Checkout Bar (Mobile ≥ 360px) */}
      <MobileStickyBottomBar
        totalLabel={t('checkout.summary.mobileTotalLabel')}
        totalAmount={grandTotal}
        ctaLabel={t('checkout.summary.mobileCta')}
        pendingLabel={t('checkout.summary.mobilePlacing')}
        isPending={checkoutMutation.isPending}
        disabled={!canPlaceOrder}
        onAction={handlePlaceOrder}
      />

      {/* Modal thêm địa chỉ giao hàng tại chỗ */}
      <AddAddressDialog
        open={addressModalOpen}
        onOpenChange={setAddressModalOpen}
        defaultReceiver={session.user?.fullName ?? ''}
        defaultPhone={session.user?.phone ?? ''}
        defaultIsDefault={addresses.length === 0}
        onCreated={(created) => {
          setSelectedAddressId(created.addressId)
          setSubmitError(null)
        }}
      />

      {/* Modal liệt kê các sản phẩm thiếu kho / không khả dụng */}
      <InsufficientStockDialog
        open={Boolean(stockConflict)}
        onOpenChange={(next) => {
          if (!next) setStockConflict(null)
        }}
        message={stockConflict?.message ?? ''}
        items={stockConflict?.items ?? []}
        correlationId={stockConflict?.correlationId}
        onBackToCart={() => void navigate('/cart')}
        onRefreshSummary={() => void summaryQuery.refetch()}
      />
    </div>
  )
}
