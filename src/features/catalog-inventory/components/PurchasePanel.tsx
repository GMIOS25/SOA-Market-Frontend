import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Minus, Plus, ShoppingCart, TriangleAlert } from 'lucide-react'
import { useId, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { loginPathFor } from '@/app/redirects'
import { ApiError } from '@/api/errors'
import { CopyableId } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { apiAddCartItem, CART_QUERY_KEY, catalogKeys, type Product } from '../api'
import {
  activeVariants,
  createVariantPicker,
  defaultVariantId,
  findVariant,
  parseMaxAddable,
  pickVariant,
  type VariantSelection,
} from '../storefront-helpers'
import { focusLinkClass } from './StorefrontState'
import { VariantPicker } from './VariantPicker'

type PurchaseFeedback =
  | { kind: 'added'; quantity: number }
  | { kind: 'error'; message: string; error?: ApiError }
  | null

type PurchasePanelProps = {
  product: Product
  isLoggedIn: boolean
  /** Người xem là chủ gian hàng của sản phẩm: xem được nhưng không mua được (BR-SEL-05). */
  isOwner: boolean
  /** Sản phẩm không ACTIVE: chỉ chủ gian hàng xem được, trang không đưa ra nút mua (D9). */
  isPreview: boolean
  /** Đang kiểm tra người xem có phải chủ gian hàng: chặn tạm nút mua để không bấm thẳng vào lỗi 403. */
  checkingOwnership: boolean
}

/** Chọn biến thể, chọn số lượng và thêm vào giỏ (FR-CRT-001). */
export function PurchasePanel({
  product,
  isLoggedIn,
  isOwner,
  isPreview,
  checkingOwnership,
}: PurchasePanelProps) {
  const { t } = useTranslation('catalog')
  const queryClient = useQueryClient()
  const location = useLocation()
  const quantityId = useId()

  const variants = useMemo(() => product.variants ?? [], [product.variants])
  const picker = useMemo(() => createVariantPicker(variants), [variants])
  const [selection, setSelection] = useState<VariantSelection>(picker.selection)
  const [variantId, setVariantId] = useState(() => defaultVariantId(variants))
  const [quantity, setQuantity] = useState(1)
  // Ô số lượng giữ chuỗi riêng để người mua xóa trắng rồi gõ số mới (ép về số ngay sẽ bị "1" + "5" = "15").
  const [quantityText, setQuantityText] = useState('1')
  const [feedback, setFeedback] = useState<PurchaseFeedback>(null)

  const hasActiveVariants = activeVariants(variants).length > 0
  const variant =
    picker.mode === 'list' ? findVariant(variants, variantId) : pickVariant(variants, picker, selection)
  const available = variant?.availableQuantity ?? 0
  const outOfStock = variant !== null && available <= 0
  const maxQuantity = Math.max(available, 1)
  const safeQuantity = Math.min(quantity, maxQuantity)

  function clampQuantity(value: number) {
    return Math.min(Math.max(Math.trunc(value) || 1, 1), maxQuantity)
  }

  const addToCart = useMutation({
    mutationFn: ({ variantId, quantity }: { variantId: string; quantity: number }) =>
      apiAddCartItem({ variantId, quantity }),
    onSuccess: (cart, variables) => {
      // Cùng query key với CartPage → trang giỏ thấy ngay món vừa thêm.
      queryClient.setQueryData(CART_QUERY_KEY, cart)
      setFeedback({ kind: 'added', quantity: variables.quantity })
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) {
        setFeedback({ kind: 'error', message: t('detail.addErrorFallback') })
        return
      }
      if (error.code === 'INSUFFICIENT_STOCK') {
        // FR-CRT-001 E1: backend nêu số còn thêm được → đưa số lượng về mức đó.
        const maxAddable = parseMaxAddable(error)
        if (maxAddable !== null && maxAddable > 0) {
          setQuantity(maxAddable)
          setQuantityText(String(maxAddable))
        }
      }
      if (error.code === 'ITEM_UNAVAILABLE') {
        // Sản phẩm vừa ngừng bán: tải lại để trang phản ánh trạng thái mới.
        void queryClient.invalidateQueries({ queryKey: catalogKeys.product(product.productId) })
      }
      // SHOP_NOT_ACTIVE giữ nguyên trang: tải lại sẽ ra 404 (gian hàng không ACTIVE thì người mua không xem
      // được sản phẩm) và làm mất thông điệp của backend.
      setFeedback({ kind: 'error', message: error.message, error })
    },
  })

  function handleQuantityInput(text: string) {
    setQuantityText(text)
    setFeedback(null)
    if (/^\d+$/.test(text)) setQuantity(clampQuantity(Number(text)))
  }

  function resetChoice() {
    setQuantity(1)
    setQuantityText('1')
    setFeedback(null)
  }

  function changeQuantity(value: number) {
    const next = clampQuantity(value)
    setQuantity(next)
    setQuantityText(String(next))
    setFeedback(null)
  }

  let action: ReactNode
  if (!isLoggedIn) {
    // FR-CRT-001 A1: khách đăng nhập rồi quay lại đúng sản phẩm này.
    action = hasActiveVariants ? (
      <Button asChild variant="cta" className="w-full sm:w-auto">
        <Link to={loginPathFor(location)}>{t('detail.loginToBuy')}</Link>
      </Button>
    ) : null
  } else if (isPreview) {
    action = null
  } else {
    action = (
      <Button
        type="button"
        variant="cta"
        className="w-full sm:w-auto"
        disabled={
          isOwner || checkingOwnership || variant === null || outOfStock || addToCart.isPending
        }
        onClick={() => {
          if (!variant) return
          setFeedback(null)
          addToCart.mutate({ variantId: variant.variantId, quantity: safeQuantity })
        }}
      >
        {addToCart.isPending ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          <ShoppingCart aria-hidden="true" />
        )}
        {addToCart.isPending ? t('detail.adding') : t('detail.addToCart')}
      </Button>
    )
  }

  let hint: ReactNode
  if (!hasActiveVariants) {
    // Ô chọn biến thể đã nói rõ sản phẩm không còn biến thể nào đang bán.
    hint = null
  } else if (isOwner) {
    hint = <p className="text-sm text-muted-foreground">{t('detail.ownShopBlocked')}</p>
  } else if (variant === null) {
    hint = <p className="text-sm text-muted-foreground">{t('detail.chooseVariantHint')}</p>
  } else if (outOfStock) {
    hint = (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-status-danger-border bg-status-danger px-2.5 py-0.5 text-xs font-medium text-status-danger-foreground">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
        {t('detail.outOfStockBadge')}
      </span>
    )
  } else {
    hint = (
      <p className="text-sm text-muted-foreground tabular-nums">
        {t('detail.available', { count: formatNumber(available) })}
      </p>
    )
  }

  const priceText = variant
    ? formatVnd(variant.price)
    : product.minPrice === product.maxPrice
      ? formatVnd(product.minPrice)
      : t('common.priceRange', { min: formatVnd(product.minPrice), max: formatVnd(product.maxPrice) })
  const stepperDisabled = variant === null || outOfStock || addToCart.isPending

  return (
    <div className="space-y-4">
      <VariantPicker
        variants={variants}
        picker={picker}
        selection={selection}
        variantId={variantId}
        onSelectionChange={(next) => {
          setSelection(next)
          resetChoice()
        }}
        onVariantIdChange={(next) => {
          setVariantId(next)
          resetChoice()
        }}
      />

      <p className={cn('font-bold text-foreground tabular-nums', variant ? 'text-2xl sm:text-3xl' : 'text-lg')}>
        {priceText}
      </p>

      {hasActiveVariants && (
        <div className="space-y-1">
          <Label htmlFor={quantityId}>{t('detail.quantityLabel')}</Label>
          <div className="inline-flex items-center">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t('detail.decreaseQuantity')}
              disabled={stepperDisabled || safeQuantity <= 1}
              onClick={() => changeQuantity(safeQuantity - 1)}
            >
              <Minus aria-hidden="true" />
            </Button>
            <input
              id={quantityId}
              type="number"
              inputMode="numeric"
              min={1}
              max={maxQuantity}
              value={quantityText}
              disabled={stepperDisabled}
              onChange={(event) => handleQuantityInput(event.target.value)}
              onBlur={() => setQuantityText(String(safeQuantity))}
              className="h-9 w-16 border-y border-input bg-card text-center text-sm tabular-nums focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t('detail.increaseQuantity')}
              disabled={stepperDisabled || safeQuantity >= maxQuantity}
              onClick={() => changeQuantity(safeQuantity + 1)}
            >
              <Plus aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {action}
        {hint}
      </div>

      {feedback?.kind === 'added' && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-md border border-status-success-border bg-status-success px-3 py-2 text-sm text-status-success-foreground"
        >
          <Check aria-hidden="true" className="size-4 shrink-0" />
          <span>{t('detail.added', { count: feedback.quantity })}</span>
          <Link to="/cart" className={cn('font-medium underline underline-offset-4', focusLinkClass)}>
            {t('detail.viewCart')}
          </Link>
        </div>
      )}

      {feedback?.kind === 'error' && (
        <div
          role="alert"
          className="space-y-1 rounded-md border border-status-danger-border bg-status-danger p-3 text-sm text-status-danger-foreground"
        >
          <p className="flex items-start gap-2 font-medium">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{feedback.message}</span>
          </p>
          {feedback.error?.correlationId && (
            <p className="flex items-center gap-1 text-xs">
              {t('detail.correlationId')}:
              <CopyableId value={feedback.error.correlationId} label={t('detail.correlationId')} />
            </p>
          )}
        </div>
      )}
    </div>
  )
}
