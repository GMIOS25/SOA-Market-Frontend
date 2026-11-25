import type { Category, Product, ProductSearchPage, ProductSummary, ProductVariant } from './api'

export const SHOP_ID = '22222222-2222-4222-8222-222222222222'
export const PRODUCT_ID = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b'
export const CATEGORY_ROOT_ID = '11111111-1111-4111-8111-111111111111'
export const CATEGORY_LEAF_ID = '33333333-3333-4333-8333-333333333333'
export const WHITE_M_ID = '44444444-4444-4444-8444-444444444444'
export const WHITE_L_ID = '55555555-5555-4555-8555-555555555555'
export const BLACK_M_ID = '66666666-6666-4666-8666-666666666666'
export const FIRST_IMAGE_REF = `products/${SHOP_ID}/photo-1.jpg`

export function makeVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    variantId: WHITE_M_ID,
    sku: 'AO-THUN-TRANG-M',
    attributes: { Màu: 'Trắng', 'Cỡ': 'M' },
    price: 120_000,
    weightGram: 200,
    isActive: true,
    availableQuantity: 10,
    ...overrides,
  }
}

/** Áo thun 3 biến thể: Trắng/M còn 10, Trắng/L hết hàng, Đen/M còn 4. */
export function makeTshirtVariants(): ProductVariant[] {
  return [
    makeVariant(),
    makeVariant({
      variantId: WHITE_L_ID,
      sku: 'AO-THUN-TRANG-L',
      attributes: { Màu: 'Trắng', 'Cỡ': 'L' },
      price: 150_000,
      availableQuantity: 0,
    }),
    makeVariant({
      variantId: BLACK_M_ID,
      sku: 'AO-THUN-DEN-M',
      attributes: { Màu: 'Đen', 'Cỡ': 'M' },
      price: 130_000,
      availableQuantity: 4,
    }),
  ]
}

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    productId: PRODUCT_ID,
    shopId: SHOP_ID,
    categoryId: CATEGORY_LEAF_ID,
    name: 'Áo thun Cotton Compact',
    brand: 'SOA Basics',
    description: 'Áo thun cotton 100%, co giãn 4 chiều.',
    images: [FIRST_IMAGE_REF, `products/${SHOP_ID}/photo-2.jpg`],
    status: 'ACTIVE',
    minPrice: 120_000,
    maxPrice: 150_000,
    inStock: true,
    ratingAvg: 4.8,
    ratingCount: 124,
    version: 3,
    variants: makeTshirtVariants(),
    ...overrides,
  }
}

export function makeProductSummary(overrides: Partial<ProductSummary> = {}): ProductSummary {
  return {
    productId: PRODUCT_ID,
    shopId: SHOP_ID,
    categoryId: CATEGORY_LEAF_ID,
    name: 'Áo thun Cotton Compact',
    brand: 'SOA Basics',
    images: [FIRST_IMAGE_REF],
    minPrice: 120_000,
    maxPrice: 150_000,
    inStock: true,
    soldCount: 321,
    ratingAvg: 4.8,
    ratingCount: 124,
    ...overrides,
  }
}

export function makeSearchPage(
  items: ProductSummary[],
  overrides: Partial<ProductSearchPage> = {},
): ProductSearchPage {
  return {
    data: items,
    pagination: { page: 1, pageSize: 20, totalItems: items.length, totalPages: 1 },
    ...overrides,
  }
}

export function makeCategories(): Category[] {
  return [
    {
      categoryId: CATEGORY_ROOT_ID,
      name: 'Thời trang',
      level: 1,
      status: 'VISIBLE',
      sortOrder: 1,
      children: [
        {
          categoryId: CATEGORY_LEAF_ID,
          name: 'Áo',
          level: 2,
          status: 'VISIBLE',
          sortOrder: 1,
          parentId: CATEGORY_ROOT_ID,
          children: [],
        },
        {
          categoryId: '77777777-7777-4777-8777-777777777777',
          name: 'Quần',
          level: 2,
          status: 'VISIBLE',
          sortOrder: 2,
          parentId: CATEGORY_ROOT_ID,
          children: [],
        },
      ],
    },
    {
      categoryId: '88888888-8888-4888-8888-888888888888',
      name: 'Điện tử',
      level: 1,
      status: 'VISIBLE',
      sortOrder: 2,
      children: null,
    },
  ]
}

/** Giỏ hàng rỗng theo hình dạng `CartView` của SVC-ORD (chỉ dùng để so sánh trong test). */
export function makeCartView(totalItemCount = 0) {
  return {
    cartId: 'cart-1',
    buyerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    shopGroups: [],
    totalItemCount,
    selectedCount: 0,
    selectedItemsTotal: 0,
    canCheckout: false,
    prdDegraded: false,
  }
}
