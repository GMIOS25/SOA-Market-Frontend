import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Info, Minus, Plus, RefreshCw, ShoppingCart, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '@/api/errors'
import {
  CopyableId,
  ServiceFallbackBanner,
  ShopPackageCard,
  ShopPackageItem,
  ShopPackageSummary,
} from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatVnd } from '@/lib/format'
import {
  apiDeleteCartItem,
  apiGetCart,
  apiGetPublicShop,
  apiUpdateCartItem,
  fallbackShopName,
  type CartItemView,
  type CartView,
} from '../api'
import { CheckoutSteps } from '../components/CheckoutSteps'
import { DesktopOrderSummary, MobileStickyBottomBar } from '../components/StickySummaryBar'

function setCheckboxIndeterminate(el: HTMLInputElement | null, indeterminate: boolean) {
  if (el) {
    el.indeterminate = indeterminate
  }
}

function CartSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
      <div className="space-y-4 lg:col-span-8">
        <Skeleton className="h-12 w-full rounded-lg" />
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
      <div className="lg:col-span-4">
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  )
}

export function CartPage() {
  const { t } = useTranslation('checkout')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [mutationError, setMutationError] = useState<ApiError | Error | null>(null)
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const autoUncheckedRef = useRef<Set<string>>(new Set())

  const cartQuery = useQuery({
    queryKey: ['cart'],
    queryFn: apiGetCart,
  })

  const cart = cartQuery.data
  const shopGroups = useMemo(() => cart?.shopGroups ?? [], [cart])
  const prdDegraded = Boolean(cart?.prdDegraded)

  // Tự động bỏ chọn các mục không khả dụng nếu còn trạng thái `selected: true` từ cache/dữ liệu cũ (FR-CRT-003).
  useEffect(() => {
    if (!cart || cart.prdDegraded) return
    const staleSelected = (cart.shopGroups ?? [])
      .flatMap((group) => group.items ?? [])
      .filter((item) => !item.available && item.selected && !autoUncheckedRef.current.has(item.cartItemId))

    if (staleSelected.length === 0) return

    for (const item of staleSelected) {
      autoUncheckedRef.current.add(item.cartItemId)
    }

    void (async () => {
      let latestCart: CartView | null = null
      for (const item of staleSelected) {
        try {
          latestCart = await apiUpdateCartItem(item.cartItemId, { selected: false })
        } catch {
          // Bỏ qua nếu mục đã bị xóa hoặc xung đột; người dùng vẫn thấy trạng thái disabled trên UI.
        }
      }
      if (latestCart) {
        queryClient.setQueryData(['cart'], latestCart)
      }
    })()
  }, [cart, queryClient])

  const shopIds = useMemo(
    () => Array.from(new Set(shopGroups.map((group) => group.shopId))),
    [shopGroups],
  )

  const shopQueries = useQueries({
    queries: shopIds.map((shopId) => ({
      queryKey: ['shop', 'public', shopId],
      queryFn: () => apiGetPublicShop(shopId),
      retry: false,
      staleTime: 5 * 60_000,
    })),
  })

  const shopNameMap = useMemo(() => {
    const map = new Map<string, string>()
    shopIds.forEach((shopId, index) => {
      const data = shopQueries[index]?.data
      map.set(shopId, data?.name || fallbackShopName(shopId))
    })
    return map
  }, [shopIds, shopQueries])

  const updateItemMutation = useMutation({
    mutationFn: ({ cartItemId, quantity, selected }: { cartItemId: string; quantity?: number; selected?: boolean }) =>
      apiUpdateCartItem(cartItemId, { quantity, selected }),
    onMutate: () => {
      setMutationError(null)
    },
    onSuccess: (updatedCart) => {
      queryClient.setQueryData(['cart'], updatedCart)
    },
    onError: (err) => {
      setMutationError(err instanceof Error ? err : new Error(t('cart.updateErrorFallback')))
    },
  })

  const deleteItemMutation = useMutation({
    mutationFn: (cartItemId: string) => apiDeleteCartItem(cartItemId),
    onMutate: () => {
      setMutationError(null)
    },
    onSuccess: (updatedCart) => {
      queryClient.setQueryData(['cart'], updatedCart)
    },
    onError: (err) => {
      setMutationError(err instanceof Error ? err : new Error(t('cart.updateErrorFallback')))
    },
  })

  const allItems = useMemo(() => shopGroups.flatMap((group) => group.items ?? []), [shopGroups])
  const availableItems = useMemo(() => allItems.filter((item) => item.available), [allItems])
  const selectedValidItems = useMemo(
    () => availableItems.filter((item) => item.selected),
    [availableItems],
  )
  const selectedValidQuantity = useMemo(
    () => selectedValidItems.reduce((sum, item) => sum + item.quantity, 0),
    [selectedValidItems],
  )

  const hasPriceChanges = useMemo(
    () =>
      allItems.some(
        (item) => item.priceChanged || (item.warnings ?? []).some((w) => w.code === 'PRICE_CHANGED'),
      ),
    [allItems],
  )
  const hasUnavailableItems = useMemo(
    () => !prdDegraded && allItems.some((item) => !item.available),
    [allItems, prdDegraded],
  )

  const allAvailableSelected =
    availableItems.length > 0 && selectedValidItems.length === availableItems.length
  const someAvailableSelected =
    selectedValidItems.length > 0 && selectedValidItems.length < availableItems.length

  const isMutating =
    updateItemMutation.isPending || deleteItemMutation.isPending || isBulkUpdating

  const canProceedCheckout =
    Boolean(cart) &&
    !prdDegraded &&
    Boolean(cart?.canCheckout) &&
    selectedValidQuantity > 0 &&
    !isMutating

  async function toggleItemsSelection(items: CartItemView[], nextSelected: boolean) {
    if (prdDegraded || isMutating) return
    const targets = items.filter((item) => item.available && item.selected !== nextSelected)
    if (targets.length === 0) return

    setMutationError(null)
    setIsBulkUpdating(true)
    try {
      let latestCart: CartView | null = null
      for (const item of targets) {
        latestCart = await apiUpdateCartItem(item.cartItemId, { selected: nextSelected })
      }
      if (latestCart) {
        queryClient.setQueryData(['cart'], latestCart)
      }
    } catch (err) {
      setMutationError(err instanceof Error ? err : new Error(t('cart.updateErrorFallback')))
      void cartQuery.refetch()
    } finally {
      setIsBulkUpdating(false)
    }
  }

  function handleProceedToCheckout() {
    if (!canProceedCheckout) return
    void navigate('/checkout')
  }

  const totalItemCount = cart?.totalItemCount ?? 0
  const selectedItemsTotal = cart?.selectedItemsTotal ?? 0

  return (
    <div className={shopGroups.length > 0 ? 'pb-28 lg:pb-6' : undefined}>
      <header className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('cart.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalItemCount > 0
              ? t('cart.subtitleWithCount', { count: totalItemCount })
              : t('cart.subtitle')}
          </p>
        </div>
        <CheckoutSteps currentStep={1} />
      </header>

      {cartQuery.isLoading ? (
        <CartSkeleton />
      ) : cartQuery.isError ? (
        <ServiceFallbackBanner
          message={cartQuery.error instanceof ApiError ? cartQuery.error.message : t('cart.loadError')}
          onRetry={() => void cartQuery.refetch()}
          isRetrying={cartQuery.isFetching}
        />
      ) : shopGroups.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-12 text-center shadow-xs">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ShoppingCart aria-hidden="true" className="size-7" />
          </div>
          <h2 className="text-lg font-semibold">{t('cart.emptyTitle')}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{t('cart.emptyDescription')}</p>
          <Button asChild variant="cta" size="cta" className="mt-2">
            <Link to="/products">{t('cart.emptyAction')}</Link>
          </Button>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
            <div className="space-y-4 lg:col-span-8">
              {prdDegraded && (
                <ServiceFallbackBanner
                  message={cart?.degradedWarning || t('cart.prdDegraded')}
                  onRetry={() => void cartQuery.refetch()}
                  isRetrying={cartQuery.isFetching}
                />
              )}

              {hasPriceChanges && (
                <div
                  role="status"
                  className="flex items-start gap-2.5 rounded-lg border border-status-warning-border bg-status-warning px-4 py-3 text-sm text-status-warning-foreground"
                >
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>{t('cart.priceChangedNotice')}</span>
                </div>
              )}

              {hasUnavailableItems && (
                <div
                  role="status"
                  className="flex items-start gap-2.5 rounded-lg border border-status-info-border bg-status-info px-4 py-3 text-sm text-status-info-foreground"
                >
                  <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>{t('cart.autoUncheckedNotice')}</span>
                </div>
              )}

              {mutationError && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-status-danger-border bg-status-danger px-4 py-3 text-sm text-status-danger-foreground"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{mutationError.message}</p>
                    {mutationError instanceof ApiError && mutationError.correlationId && (
                      <p className="flex items-center gap-1 text-xs">
                        {t('checkout.stockModal.correlationId')}:
                        <CopyableId
                          value={mutationError.correlationId}
                          label={t('checkout.stockModal.correlationId')}
                        />
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMutationError(null)
                      void cartQuery.refetch()
                    }}
                  >
                    <RefreshCw aria-hidden="true" />
                    {t('cart.refresh')}
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-xs">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
                  <input
                    ref={(el) => setCheckboxIndeterminate(el, someAvailableSelected)}
                    type="checkbox"
                    checked={allAvailableSelected}
                    disabled={prdDegraded || availableItems.length === 0 || isMutating}
                    onChange={(e) => void toggleItemsSelection(availableItems, e.target.checked)}
                    className="size-4 rounded border-input accent-primary disabled:cursor-not-allowed"
                  />
                  <span>{t('cart.selectAllWithCount', { count: availableItems.length })}</span>
                </label>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={cartQuery.isFetching}
                  onClick={() => void cartQuery.refetch()}
                >
                  <RefreshCw aria-hidden="true" className={cartQuery.isFetching ? 'animate-spin' : undefined} />
                  {cartQuery.isFetching ? t('cart.refreshing') : t('cart.refresh')}
                </Button>
              </div>

              {shopGroups.map((group) => {
                const items = group.items ?? []
                const shopName = shopNameMap.get(group.shopId) ?? fallbackShopName(group.shopId)
                const shopAvailableItems = items.filter((item) => item.available)
                const shopSelectedCount = shopAvailableItems.filter((item) => item.selected).length
                const allShopSelected =
                  shopAvailableItems.length > 0 && shopSelectedCount === shopAvailableItems.length
                const someShopSelected =
                  shopSelectedCount > 0 && shopSelectedCount < shopAvailableItems.length
                const shopInactive = Boolean(group.shopStatus && group.shopStatus !== 'ACTIVE')

                return (
                  <ShopPackageCard
                    key={group.shopId}
                    shop={{ id: group.shopId, name: shopName }}
                    status={shopInactive ? group.shopStatus : undefined}
                    headerStart={
                      <input
                        ref={(el) => setCheckboxIndeterminate(el, someShopSelected)}
                        type="checkbox"
                        aria-label={t('cart.selectShop', { shop: shopName })}
                        checked={allShopSelected}
                        disabled={prdDegraded || shopAvailableItems.length === 0 || isMutating}
                        onChange={(e) => void toggleItemsSelection(shopAvailableItems, e.target.checked)}
                        className="size-4 rounded border-input accent-primary disabled:cursor-not-allowed"
                      />
                    }
                    notice={
                      shopInactive ? (
                        <p className="flex items-start gap-2 rounded-md border border-status-danger-border bg-status-danger px-3 py-2 text-xs font-medium text-status-danger-foreground">
                          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                          <span>{t('cart.shopInactiveNotice')}</span>
                        </p>
                      ) : undefined
                    }
                    footer={<ShopPackageSummary itemsAmount={group.shopSubtotal} />}
                  >
                    {items.map((item) => {
                      const productName =
                        item.productName ||
                        t('cart.fallbackProductName', {
                          shortId: item.variantId.slice(0, 8).toUpperCase(),
                        })
                      const warnings = item.warnings ?? []
                      const nonPriceWarnings = warnings.filter((w) => w.code !== 'PRICE_CHANGED')
                      const priceWarning = warnings.find((w) => w.code === 'PRICE_CHANGED')
                      const showPriceBadge = item.priceChanged || Boolean(priceWarning)

                      const priceBadgeText =
                        item.previousPrice !== undefined && item.currentPrice !== undefined
                          ? t('cart.priceChangedBadge', {
                              from: formatVnd(item.previousPrice),
                              to: formatVnd(item.currentPrice),
                            })
                          : priceWarning?.message || t('cart.priceChangedSimple')

                      const showQuickAdjust =
                        !prdDegraded &&
                        !item.available &&
                        item.availableQuantity > 0 &&
                        item.quantity > item.availableQuantity

                      const itemBadges =
                        showPriceBadge || nonPriceWarnings.length > 0 || (!prdDegraded && !item.available) ? (
                          <>
                            {showPriceBadge && (
                              <StatusBadge status="PARTIAL" tone="warning" label={priceBadgeText} />
                            )}
                            {nonPriceWarnings.map((warning) => (
                              <StatusBadge
                                key={`${item.cartItemId}-${warning.code}`}
                                status="EXPIRED"
                                tone="danger"
                                label={warning.message}
                              />
                            ))}
                            {!prdDegraded && !item.available && nonPriceWarnings.length === 0 && (
                              <StatusBadge
                                status="EXPIRED"
                                tone="danger"
                                label={
                                  item.availableQuantity === 0
                                    ? t('cart.outOfStockBadge')
                                    : t('cart.unavailableBadge')
                                }
                              />
                            )}
                          </>
                        ) : undefined

                      const itemControls = (
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-1">
                            <div className="inline-flex items-center rounded-md border border-input bg-card">
                              <button
                                type="button"
                                aria-label={t('cart.decreaseQty', { name: productName })}
                                disabled={prdDegraded || !item.available || item.quantity <= 1 || isMutating}
                                onClick={() =>
                                  updateItemMutation.mutate({
                                    cartItemId: item.cartItemId,
                                    quantity: item.quantity - 1,
                                  })
                                }
                                className="inline-flex size-8 items-center justify-center rounded-l-md text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
                              >
                                <Minus aria-hidden="true" className="size-3.5" />
                              </button>
                              <span
                                aria-live="polite"
                                className="min-w-8 px-1.5 text-center text-sm font-medium tabular-nums"
                              >
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                aria-label={t('cart.increaseQty', { name: productName })}
                                disabled={
                                  prdDegraded ||
                                  !item.available ||
                                  item.quantity >= item.availableQuantity ||
                                  isMutating
                                }
                                onClick={() =>
                                  updateItemMutation.mutate({
                                    cartItemId: item.cartItemId,
                                    quantity: item.quantity + 1,
                                  })
                                }
                                className="inline-flex size-8 items-center justify-center rounded-r-md text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
                              >
                                <Plus aria-hidden="true" className="size-3.5" />
                              </button>
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t('cart.removeItem', { name: productName })}
                              disabled={isMutating}
                              onClick={() => deleteItemMutation.mutate(item.cartItemId)}
                              className="text-muted-foreground hover:text-status-danger-foreground"
                            >
                              <Trash2 aria-hidden="true" className="size-4" />
                            </Button>
                          </div>

                          <p className="text-sm font-semibold text-foreground tabular-nums">
                            {formatVnd(item.lineSubtotal)}
                          </p>

                          {showQuickAdjust && (
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              disabled={isMutating}
                              onClick={() =>
                                updateItemMutation.mutate({
                                  cartItemId: item.cartItemId,
                                  quantity: item.availableQuantity,
                                  selected: true,
                                })
                              }
                            >
                              {t('cart.adjustToAvailable', { count: item.availableQuantity })}
                            </Button>
                          )}
                        </div>
                      )

                      return (
                        <ShopPackageItem
                          key={item.cartItemId}
                          name={productName}
                          variantLabel={item.variantLabel}
                          imageUrl={item.imageRef}
                          quantity={item.quantity}
                          unitPrice={item.unitPrice}
                          href={item.productId ? `/products/${item.productId}` : undefined}
                          dimmed={!prdDegraded && !item.available}
                          start={
                            <input
                              type="checkbox"
                              aria-label={t('cart.selectItem', { name: productName })}
                              checked={item.available ? item.selected : false}
                              disabled={prdDegraded || !item.available || isMutating}
                              onChange={(e) =>
                                updateItemMutation.mutate({
                                  cartItemId: item.cartItemId,
                                  selected: e.target.checked,
                                })
                              }
                              className="mt-1 size-4 shrink-0 rounded border-input accent-primary disabled:cursor-not-allowed"
                            />
                          }
                          badges={itemBadges}
                          end={itemControls}
                        />
                      )
                    })}
                  </ShopPackageCard>
                )
              })}
            </div>

            <div className="hidden lg:col-span-4 lg:block">
              <DesktopOrderSummary
                title={t('cart.summaryTitle')}
                rows={[
                  {
                    label: t('cart.selectedCountLabel'),
                    value: String(selectedValidQuantity),
                  },
                  {
                    label: t('cart.selectedItemsTotal'),
                    value: formatVnd(selectedItemsTotal),
                  },
                ]}
                totalLabel={t('cart.selectedItemsTotal')}
                totalAmount={selectedItemsTotal}
                ctaLabel={
                  selectedValidQuantity > 0
                    ? t('cart.proceedCheckout', { count: selectedValidQuantity })
                    : t('cart.proceedCheckoutEmpty')
                }
                disabled={!canProceedCheckout}
                onAction={handleProceedToCheckout}
                notice={
                  prdDegraded ? (
                    <p className="rounded-md border border-status-danger-border bg-status-danger px-3 py-2 text-xs font-medium text-status-danger-foreground">
                      {t('cart.blockedPrdDegraded')}
                    </p>
                  ) : selectedValidQuantity === 0 ? (
                    <p className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                      {t('cart.noSelectionHint')}
                    </p>
                  ) : undefined
                }
                footerNote={<p>{t('cart.shippingNote')}</p>}
              />
            </div>
          </div>

          <MobileStickyBottomBar
            totalLabel={t('cart.mobileTotalLabel', { count: selectedValidQuantity })}
            totalAmount={selectedItemsTotal}
            ctaLabel={
              selectedValidQuantity > 0
                ? t('cart.mobileCta', { count: selectedValidQuantity })
                : t('cart.mobileCtaDisabled')
            }
            disabled={!canProceedCheckout}
            onAction={handleProceedToCheckout}
            leading={
              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium whitespace-nowrap">
                <input
                  ref={(el) => setCheckboxIndeterminate(el, someAvailableSelected)}
                  type="checkbox"
                  checked={allAvailableSelected}
                  disabled={prdDegraded || availableItems.length === 0 || isMutating}
                  onChange={(e) => void toggleItemsSelection(availableItems, e.target.checked)}
                  className="size-4 rounded border-input accent-primary disabled:cursor-not-allowed"
                />
                <span>{t('cart.selectAll')}</span>
              </label>
            }
          />
        </>
      )}
    </div>
  )
}
