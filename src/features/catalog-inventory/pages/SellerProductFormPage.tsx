import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ImagePlus, Plus, RotateCw, Trash2, TriangleAlert } from 'lucide-react'
import { useId, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '@/api/errors'
import { CopyableId } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  apiCreateProduct,
  apiGetProduct,
  apiListPublicCategories,
  apiUpdateProduct,
  apiUploadProductImage,
  catalogKeys,
  type Product,
  type ProductBody,
  type VariantInput,
} from '../api'
import { textFieldClass } from '../components/form-field'
import { productImageUrl } from '../media'
import {
  flattenLeafCategories,
  MAX_PRODUCT_IMAGES,
  validateProductImageFile,
  type LeafCategoryOption,
} from '../management-helpers'

type AttributeDraft = { key: string; value: string }

type VariantDraft = {
  variantId?: string
  sku: string
  price: string
  weightGram: string
  initialStock: string
  attributes: AttributeDraft[]
}

function emptyVariant(): VariantDraft {
  return {
    sku: '',
    price: '',
    weightGram: '200',
    initialStock: '10',
    attributes: [{ key: 'Màu', value: '' }],
  }
}

function initialFormValues(product?: Product) {
  if (!product) {
    return {
      name: '',
      categoryId: '',
      brand: '',
      description: '',
      statusChoice: 'ACTIVE' as '' | 'DRAFT' | 'ACTIVE',
      images: [] as string[],
      variants: [emptyVariant()],
      version: undefined as number | undefined,
    }
  }
  const variants = (product.variants ?? []).map((v): VariantDraft => {
    const attrEntries = Object.entries(v.attributes ?? {})
    return {
      variantId: v.variantId,
      sku: v.sku,
      price: String(v.price),
      weightGram: String(v.weightGram),
      initialStock: String(v.availableQuantity),
      attributes: attrEntries.length > 0 ? attrEntries.map(([key, value]) => ({ key, value })) : [{ key: 'Màu', value: '' }],
    }
  })

  return {
    name: product.name,
    categoryId: product.categoryId,
    brand: product.brand ?? '',
    description: product.description ?? '',
    statusChoice: (product.status === 'DRAFT' ? 'DRAFT' : product.status === 'ACTIVE' ? 'ACTIVE' : '') as '' | 'DRAFT' | 'ACTIVE',
    images: [...(product.images ?? [])],
    variants: variants.length > 0 ? variants : [emptyVariant()],
    version: product.version,
  }
}

type EditorProps = {
  productId?: string
  initialProduct?: Product
  leafCategories: LeafCategoryOption[]
  onReloadLatest: () => Promise<unknown>
}

function ProductFormEditor({ productId, initialProduct, leafCategories, onReloadLatest }: EditorProps) {
  const isEdit = Boolean(productId)
  const { t } = useTranslation('catalog')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const baseId = useId()

  const init = initialFormValues(initialProduct)
  const [name, setName] = useState(init.name)
  const [categoryId, setCategoryId] = useState(init.categoryId)
  const [brand, setBrand] = useState(init.brand)
  const [description, setDescription] = useState(init.description)
  const [statusChoice, setStatusChoice] = useState<'' | 'DRAFT' | 'ACTIVE'>(init.statusChoice)
  const [images, setImages] = useState<string[]>(init.images)
  const [variants, setVariants] = useState<VariantDraft[]>(init.variants)
  const version = init.version

  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageError, setImageError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<{ message: string; correlationId?: string; isConflict?: boolean } | null>(null)

  function updateVariant(index: number, patch: Partial<VariantDraft>) {
    setVariants((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)))
  }

  function updateAttribute(vIndex: number, aIndex: number, patch: Partial<AttributeDraft>) {
    setVariants((prev) =>
      prev.map((item, idx) => {
        if (idx !== vIndex) return item
        return {
          ...item,
          attributes: item.attributes.map((attr, j) => (j === aIndex ? { ...attr, ...patch } : attr)),
        }
      }),
    )
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImageError('')

    if (images.length >= MAX_PRODUCT_IMAGES) {
      setImageError(t('productForm.imageLimitError'))
      return
    }
    const invalid = validateProductImageFile(file)
    if (invalid === 'type') {
      setImageError(t('productForm.imageTypeError'))
      return
    }
    if (invalid === 'size') {
      setImageError(t('productForm.imageSizeError'))
      return
    }

    setUploadingImage(true)
    try {
      const uploaded = await apiUploadProductImage(file)
      setImages((prev) => [...prev, uploaded.imageRef])
    } catch (error) {
      setImageError(error instanceof Error ? error.message : t('productForm.loadError'))
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFieldErrors({})
    setSubmitError(null)

    const body: ProductBody = {
      name: name.trim(),
      categoryId,
      ...(brand.trim() ? { brand: brand.trim() } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
      images,
      ...(statusChoice ? { status: statusChoice } : {}),
      ...(isEdit && version !== undefined ? { version } : {}),
      variants: variants.map((v): VariantInput => {
        const attributes: Record<string, string> = {}
        for (const pair of v.attributes) {
          const k = pair.key.trim()
          const val = pair.value.trim()
          if (k && val) attributes[k] = val
        }
        const priceNum = Number(v.price)
        const weightNum = Number(v.weightGram)
        const stockNum = Number(v.initialStock)
        return {
          ...(v.variantId ? { variantId: v.variantId } : {}),
          sku: v.sku.trim(),
          price: Number.isFinite(priceNum) ? Math.trunc(priceNum) : 0,
          weightGram: Number.isFinite(weightNum) ? Math.trunc(weightNum) : 0,
          ...(!v.variantId && Number.isFinite(stockNum) ? { initialStock: Math.trunc(stockNum) } : {}),
          attributes,
        }
      }),
    }

    setSubmitting(true)
    try {
      const saved = isEdit && productId ? await apiUpdateProduct(productId, body) : await apiCreateProduct(body)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: catalogKeys.sellerProductsList }),
        queryClient.invalidateQueries({ queryKey: catalogKeys.sellerInventoryRoot }),
        queryClient.invalidateQueries({ queryKey: catalogKeys.product(saved.productId) }),
      ])
      void navigate('/seller/products')
    } catch (error) {
      if (error instanceof ApiError) {
        const mapped: Record<string, string> = {}
        for (const d of error.details) mapped[d.field] = d.reason
        setFieldErrors(mapped)
        setSubmitError({
          message: error.message,
          correlationId: error.correlationId,
          isConflict: error.code === 'VERSION_CONFLICT',
        })
      } else {
        setSubmitError({
          message: error instanceof Error ? error.message : t('productForm.validationSummary'),
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {isEdit && initialProduct?.moderationReason && (
        <div role="status" className="rounded-lg border border-status-warning-border bg-status-warning p-3 text-sm text-status-warning-foreground">
          {t('productForm.moderationNotice', { reason: initialProduct.moderationReason })}
        </div>
      )}

      {submitError && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-status-danger-border bg-status-danger p-4 text-sm text-status-danger-foreground"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-medium">
              <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
              {submitError.message}
            </p>
            {submitError.isConflict && isEdit && (
              <Button type="button" size="sm" variant="outline" onClick={() => void onReloadLatest()}>
                <RotateCw aria-hidden="true" className="size-3.5" />
                {t('productForm.reloadLatest')}
              </Button>
            )}
          </div>
          {submitError.correlationId && (
            <p className="flex items-center gap-1.5 text-xs">
              {t('productForm.correlationId')}: <CopyableId value={submitError.correlationId} label={t('productForm.correlationId')} />
            </p>
          )}
        </div>
      )}

      <form onSubmit={(event) => void handleSubmit(event)} noValidate className="flex flex-col gap-6">
        <section className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`${baseId}-name`}>{t('productForm.nameLabel')}</Label>
            <input
              id={`${baseId}-name`}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('productForm.namePlaceholder')}
              aria-invalid={fieldErrors.name ? true : undefined}
              className={textFieldClass}
            />
            {fieldErrors.name && <p className="text-xs text-status-danger-foreground">{fieldErrors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${baseId}-category`}>{t('productForm.categoryLabel')}</Label>
            <select
              id={`${baseId}-category`}
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              aria-invalid={fieldErrors.categoryId ? true : undefined}
              className={textFieldClass}
            >
              <option value="">{t('productForm.categoryPlaceholder')}</option>
              {leafCategories.map((opt) => (
                <option key={opt.categoryId} value={opt.categoryId}>
                  {opt.label}
                </option>
              ))}
            </select>
            {fieldErrors.categoryId && <p className="text-xs text-status-danger-foreground">{fieldErrors.categoryId}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${baseId}-brand`}>{t('productForm.brandLabel')}</Label>
            <input
              id={`${baseId}-brand`}
              type="text"
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              placeholder={t('productForm.brandPlaceholder')}
              aria-invalid={fieldErrors.brand ? true : undefined}
              className={textFieldClass}
            />
            {fieldErrors.brand && <p className="text-xs text-status-danger-foreground">{fieldErrors.brand}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${baseId}-status`}>{t('productForm.statusLabel')}</Label>
            <select
              id={`${baseId}-status`}
              value={statusChoice}
              onChange={(event) => setStatusChoice(event.target.value as '' | 'DRAFT' | 'ACTIVE')}
              aria-invalid={fieldErrors.status ? true : undefined}
              className={textFieldClass}
            >
              <option value="ACTIVE">{t('productForm.statusActive')}</option>
              <option value="DRAFT">{t('productForm.statusDraft')}</option>
            </select>
            {fieldErrors.status && <p className="text-xs text-status-danger-foreground">{fieldErrors.status}</p>}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`${baseId}-description`}>{t('productForm.descriptionLabel')}</Label>
            <Textarea
              id={`${baseId}-description`}
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('productForm.descriptionPlaceholder')}
              aria-invalid={fieldErrors.description ? true : undefined}
            />
            {fieldErrors.description && <p className="text-xs text-status-danger-foreground">{fieldErrors.description}</p>}
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor={`${baseId}-image-upload`}>{t('productForm.imagesLabel')}</Label>
            <label
              htmlFor={`${baseId}-image-upload`}
              className={cn(
                'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent',
                (uploadingImage || images.length >= MAX_PRODUCT_IMAGES) && 'pointer-events-none opacity-50',
              )}
            >
              <ImagePlus aria-hidden="true" className="size-3.5" />
              {uploadingImage ? t('productForm.uploadingImage') : t('productForm.uploadImageButton')}
            </label>
            <input
              id={`${baseId}-image-upload`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploadingImage || images.length >= MAX_PRODUCT_IMAGES}
              onChange={(event) => void handleFileUpload(event)}
              className="sr-only"
            />
          </div>

          {imageError && <p role="alert" className="text-xs text-status-danger-foreground">{imageError}</p>}
          {fieldErrors.images && <p className="text-xs text-status-danger-foreground">{fieldErrors.images}</p>}

          {images.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {images.map((ref, idx) => {
                const src = productImageUrl(ref)
                return (
                  <li key={ref} className="relative overflow-hidden rounded-lg border border-border bg-muted/40 p-2">
                    {src ? (
                      <img src={src} alt={`${name || 'Product'} ${idx + 1}`} className="aspect-square w-full rounded object-cover" />
                    ) : (
                      <div className="flex aspect-square items-center justify-center text-xs text-muted-foreground break-all">
                        {ref}
                      </div>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-label={t('productForm.removeImage', { index: idx + 1 })}
                      className="mt-2 w-full"
                      onClick={() => setImages((prev) => prev.filter((_, j) => j !== idx))}
                    >
                      <Trash2 aria-hidden="true" className="size-3.5" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{t('productForm.variantsTitle')}</h2>
            <Button type="button" size="sm" variant="outline" onClick={() => setVariants((prev) => [...prev, emptyVariant()])}>
              <Plus aria-hidden="true" className="size-3.5" />
              {t('productForm.addVariant')}
            </Button>
          </div>
          {fieldErrors.variants && <p className="text-xs text-status-danger-foreground">{fieldErrors.variants}</p>}

          <div className="space-y-4">
            {variants.map((variant, vIdx) => {
              const prefix = `variants[${vIdx}]`
              return (
                <div key={variant.variantId ?? `draft-${vIdx}`} className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">SKU #{vIdx + 1}</span>
                    {variants.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setVariants((prev) => prev.filter((_, j) => j !== vIdx))}
                      >
                        <Trash2 aria-hidden="true" className="size-3.5" />
                        {t('productForm.removeVariant')}
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="space-y-1">
                      <Label htmlFor={`${baseId}-sku-${vIdx}`}>{t('productForm.skuLabel')}</Label>
                      <input
                        id={`${baseId}-sku-${vIdx}`}
                        type="text"
                        value={variant.sku}
                        onChange={(event) => updateVariant(vIdx, { sku: event.target.value })}
                        aria-invalid={fieldErrors[`${prefix}.sku`] ? true : undefined}
                        className={textFieldClass}
                      />
                      {fieldErrors[`${prefix}.sku`] && (
                        <p className="text-xs text-status-danger-foreground">{fieldErrors[`${prefix}.sku`]}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor={`${baseId}-price-${vIdx}`}>{t('productForm.priceLabel')}</Label>
                      <input
                        id={`${baseId}-price-${vIdx}`}
                        type="number"
                        min={1}
                        value={variant.price}
                        onChange={(event) => updateVariant(vIdx, { price: event.target.value })}
                        aria-invalid={fieldErrors[`${prefix}.price`] ? true : undefined}
                        className={textFieldClass}
                      />
                      {fieldErrors[`${prefix}.price`] && (
                        <p className="text-xs text-status-danger-foreground">{fieldErrors[`${prefix}.price`]}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor={`${baseId}-weight-${vIdx}`}>{t('productForm.weightLabel')}</Label>
                      <input
                        id={`${baseId}-weight-${vIdx}`}
                        type="number"
                        min={10}
                        max={50000}
                        value={variant.weightGram}
                        onChange={(event) => updateVariant(vIdx, { weightGram: event.target.value })}
                        aria-invalid={fieldErrors[`${prefix}.weightGram`] ? true : undefined}
                        className={textFieldClass}
                      />
                      {fieldErrors[`${prefix}.weightGram`] && (
                        <p className="text-xs text-status-danger-foreground">{fieldErrors[`${prefix}.weightGram`]}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor={`${baseId}-stock-${vIdx}`}>{t('productForm.initialStockLabel')}</Label>
                      {variant.variantId ? (
                        <p className="flex h-10 items-center text-xs text-muted-foreground">
                          <Link to={`/seller/inventory?productId=${productId ?? ''}`} className="text-primary hover:underline">
                            {t('productForm.existingStockHint')}
                          </Link>
                        </p>
                      ) : (
                        <>
                          <input
                            id={`${baseId}-stock-${vIdx}`}
                            type="number"
                            min={0}
                            value={variant.initialStock}
                            onChange={(event) => updateVariant(vIdx, { initialStock: event.target.value })}
                            aria-invalid={fieldErrors[`${prefix}.initialStock`] ? true : undefined}
                            className={textFieldClass}
                          />
                          {fieldErrors[`${prefix}.initialStock`] && (
                            <p className="text-xs text-status-danger-foreground">{fieldErrors[`${prefix}.initialStock`]}</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{t('productForm.attributesTitle')}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => updateVariant(vIdx, { attributes: [...variant.attributes, { key: '', value: '' }] })}
                      >
                        {t('productForm.addAttribute')}
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {variant.attributes.map((attr, aIdx) => (
                        <div key={aIdx} className="flex items-center gap-2">
                          <input
                            type="text"
                            aria-label={`${t('productForm.attrKeyPlaceholder')} ${aIdx + 1}`}
                            placeholder={t('productForm.attrKeyPlaceholder')}
                            value={attr.key}
                            onChange={(event) => updateAttribute(vIdx, aIdx, { key: event.target.value })}
                            className={textFieldClass}
                          />
                          <input
                            type="text"
                            aria-label={`${t('productForm.attrValuePlaceholder')} ${aIdx + 1}`}
                            placeholder={t('productForm.attrValuePlaceholder')}
                            value={attr.value}
                            onChange={(event) => updateAttribute(vIdx, aIdx, { value: event.target.value })}
                            className={textFieldClass}
                          />
                          {variant.attributes.length > 1 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              aria-label={t('productForm.removeAttribute')}
                              onClick={() =>
                                updateVariant(vIdx, { attributes: variant.attributes.filter((_, j) => j !== aIdx) })
                              }
                            >
                              <Trash2 aria-hidden="true" className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <Button asChild type="button" variant="outline">
            <Link to="/seller/products">{t('sellerProducts.cancel')}</Link>
          </Button>
          <Button type="submit" disabled={submitting || uploadingImage}>
            {submitting
              ? t('productForm.saving')
              : isEdit
                ? t('productForm.saveEdit')
                : t('productForm.saveCreate')}
          </Button>
        </div>
      </form>
    </>
  )
}

/** S3 `/seller/products/new` & `/seller/products/:id/edit` — tạo/cập nhật sản phẩm nhiều SKU (FR-PRD-001..002). */
export function SellerProductFormPage() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = Boolean(id)
  const { t } = useTranslation('catalog')

  const categoriesQuery = useQuery({
    queryKey: catalogKeys.categories,
    queryFn: apiListPublicCategories,
  })
  const productQuery = useQuery({
    queryKey: catalogKeys.product(id ?? ''),
    queryFn: () => apiGetProduct(id!),
    enabled: isEdit,
  })

  const leafCategories = useMemo(
    () => flattenLeafCategories(categoriesQuery.data ?? []),
    [categoriesQuery.data],
  )

  if (isEdit && productQuery.isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (isEdit && productQuery.isError) {
    return (
      <div role="alert" className="space-y-3 rounded-xl border border-status-danger-border bg-status-danger p-5 text-sm text-status-danger-foreground">
        <p>{productQuery.error instanceof Error ? productQuery.error.message : t('productForm.loadError')}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void productQuery.refetch()}>
          {t('productForm.reloadLatest')}
        </Button>
      </div>
    )
  }

  const editorKey = isEdit && productQuery.data ? `${productQuery.data.productId}:${productQuery.data.version}` : 'create'

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <Link to="/seller/products" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t('productForm.backToList')}
        </Link>
        {isEdit && productQuery.data && <StatusBadge status={productQuery.data.status} />}
      </div>

      <header className="space-y-1 border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {isEdit ? t('productForm.editTitle') : t('productForm.createTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('productForm.subtitle')}</p>
      </header>

      <ProductFormEditor
        key={editorKey}
        productId={id}
        initialProduct={productQuery.data}
        leafCategories={leafCategories}
        onReloadLatest={() => productQuery.refetch()}
      />
    </div>
  )
}
