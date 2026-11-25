import type { Category, SellerInventoryEntry } from './api'

export type SellerProductSummaryRow = {
  productId: string
  productName: string
  productStatus: string
  minPrice: number
  maxPrice: number
  variantCount: number
  activeVariantCount: number
  totalOnHand: number
  totalReserved: number
  totalAvailable: number
  skus: string[]
}

export type LeafCategoryOption = {
  categoryId: string
  label: string
}

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_PRODUCT_IMAGES = 8

/**
 * Nhóm các dòng tồn kho (`GET /v1/seller/inventory`) theo `productId` theo đúng thứ tự sản phẩm mới nhất
 * từ backend để màn hình `/seller/products` hiển thị tổng quan theo từng sản phẩm.
 */
export function groupInventoryByProduct(entries: SellerInventoryEntry[]): SellerProductSummaryRow[] {
  const byProduct = new Map<string, SellerProductSummaryRow>()

  for (const entry of entries) {
    const existing = byProduct.get(entry.productId)
    if (!existing) {
      byProduct.set(entry.productId, {
        productId: entry.productId,
        productName: entry.productName,
        productStatus: entry.productStatus,
        minPrice: entry.price,
        maxPrice: entry.price,
        variantCount: 1,
        activeVariantCount: entry.isActive ? 1 : 0,
        totalOnHand: entry.onHand,
        totalReserved: entry.reserved,
        totalAvailable: entry.available,
        skus: [entry.sku],
      })
      continue
    }

    existing.minPrice = Math.min(existing.minPrice, entry.price)
    existing.maxPrice = Math.max(existing.maxPrice, entry.price)
    existing.variantCount += 1
    if (entry.isActive) existing.activeVariantCount += 1
    existing.totalOnHand += entry.onHand
    existing.totalReserved += entry.reserved
    existing.totalAvailable += entry.available
    existing.skus.push(entry.sku)
  }

  return Array.from(byProduct.values())
}

/** Danh sách danh mục lá (cấp 2 hoặc cấp 1 không có con) cho form tạo/sửa sản phẩm. */
export function flattenLeafCategories(tree: Category[]): LeafCategoryOption[] {
  const out: LeafCategoryOption[] = []
  for (const parent of tree) {
    const children = parent.children ?? []
    if (children.length === 0) {
      out.push({ categoryId: parent.categoryId, label: parent.name })
      continue
    }
    for (const child of children) {
      out.push({ categoryId: child.categoryId, label: `${parent.name} > ${child.name}` })
    }
  }
  return out
}

/** Tìm tên hiển thị của danh mục trong cây 2 cấp (trả về ID nếu chưa tìm thấy). */
export function findCategoryName(tree: Category[], categoryId: string): string {
  for (const parent of tree) {
    if (parent.categoryId === categoryId) return parent.name
    for (const child of parent.children ?? []) {
      if (child.categoryId === categoryId) return `${parent.name} > ${child.name}`
    }
  }
  return categoryId
}

export function formatAttributesText(attributes: Record<string, string> | undefined): string {
  if (!attributes) return ''
  const entries = Object.entries(attributes).filter(([k, v]) => k.trim() && v.trim())
  return entries.map(([k, v]) => `${k}: ${v}`).join(' · ')
}

export function validateProductImageFile(file: File): 'type' | 'size' | null {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) return 'type'
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) return 'size'
  return null
}
