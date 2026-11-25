import type { TFunction } from 'i18next'
import { z } from 'zod'
import {
  DOCUMENT_FIELDS,
  REQUIRED_DOCUMENTS,
  type DocumentField,
  type PickupAddressDTO,
  type SellerType,
  type ShopDTO,
} from './api'

/* Quy tắc khớp `validateApplication`, `validateShopProfile`, `UpdateMyPickupAddress` của SVC-SEL (services/svc-sel/internal/service/sel_service.go). */
export const SHOP_NAME_MIN = 2
export const SHOP_NAME_MAX = 100
export const SHOP_DESCRIPTION_MAX = 2000
export const SHOP_POLICY_MAX = 5000
export const CONTACT_EMAIL_MAX = 254
export const PICKUP_CONTACT_MAX = 150
export const PICKUP_LINE_MAX = 255
export const PICKUP_AREA_MAX = 100
export const MAX_KYC_FILE_BYTES = 5 * 1024 * 1024
export const ACCEPTED_KYC_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MAX_NOTE_LENGTH = 1000

export const CCCD_RE = /^[0-9]{12}$/
export const BUSINESS_NUMBER_RE = /^[0-9]{10}(-[0-9]{3})?$/
export const TAX_CODE_RE = /^([0-9]{10}(-[0-9]{3})?|[0-9]{12})$/
export const PHONE_RE = /^(0|\+84)[0-9]{9,10}$/
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const fileField = z.custom<File | null>((value) => value === null || value instanceof File)

export const DOCUMENT_FIELD_NAMES = Object.values(DOCUMENT_FIELDS) as DocumentField[]

/** Lỗi của 1 tệp ảnh KYC, `null` nếu hợp lệ. Dùng cả khi chọn tệp (báo ngay) và khi submit. */
export function kycFileError(file: File, t: TFunction<'sellerShop'>): string | null {
  if (!(ACCEPTED_KYC_TYPES as readonly string[]).includes(file.type)) return t('onboarding.validation.fileType')
  if (file.size > MAX_KYC_FILE_BYTES) return t('onboarding.validation.fileSize')
  return null
}

/** Lỗi của tệp logo gian hàng, `null` nếu hợp lệ. */
export function shopLogoError(file: File, t: TFunction<'sellerShop'>): string | null {
  if (!(ACCEPTED_KYC_TYPES as readonly string[]).includes(file.type)) return t('sellerShop.validation.logoType')
  if (file.size > MAX_KYC_FILE_BYTES) return t('sellerShop.validation.logoSize')
  return null
}

/**
 * Mọi quy tắc nằm trong 1 `superRefine` trên các trường kiểu thô: zod v4 bỏ qua refinement của object khi
 * trường con đã lỗi, nên tách ra như vậy để 1 lần submit hiện ĐỦ lỗi của mọi trường cùng lúc.
 */
export function createApplicationSchema(t: TFunction<'sellerShop'>) {
  return z
    .object({
      sellerType: z.enum(['INDIVIDUAL', 'ORGANIZATION']),
      shopName: z.string(),
      identityOrBusinessNumber: z.string(),
      taxCode: z.string(),
      cccdFront: fileField,
      cccdBack: fileField,
      businessLicense: fileField,
      representativeCccdFront: fileField,
      representativeCccdBack: fileField,
    })
    .superRefine((values, ctx) => {
      const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })

      const shopNameLength = [...values.shopName.trim()].length
      if (shopNameLength < SHOP_NAME_MIN) issue('shopName', t('onboarding.validation.shopNameMin'))
      else if (shopNameLength > SHOP_NAME_MAX) issue('shopName', t('onboarding.validation.shopNameMax'))

      const individual = values.sellerType === 'INDIVIDUAL'
      if (!(individual ? CCCD_RE : BUSINESS_NUMBER_RE).test(values.identityOrBusinessNumber.trim())) {
        issue(
          'identityOrBusinessNumber',
          t(individual ? 'onboarding.validation.cccd' : 'onboarding.validation.businessNumber'),
        )
      }

      if (!TAX_CODE_RE.test(values.taxCode.trim())) issue('taxCode', t('onboarding.validation.taxCode'))

      // Chỉ kiểm tra tài liệu của loại hình đang chọn — tệp của loại hình kia không được gửi lên.
      for (const docType of REQUIRED_DOCUMENTS[values.sellerType]) {
        const field = DOCUMENT_FIELDS[docType]
        const file = values[field]
        const message = file ? kycFileError(file, t) : t('onboarding.validation.fileRequired')
        if (message) issue(field, message)
      }
    })
}

export type ApplicationFormValues = z.infer<ReturnType<typeof createApplicationSchema>>

export function emptyApplicationForm(sellerType: SellerType = 'INDIVIDUAL'): ApplicationFormValues {
  return {
    sellerType,
    shopName: '',
    identityOrBusinessNumber: '',
    taxCode: '',
    cccdFront: null,
    cccdBack: null,
    businessLicense: null,
    representativeCccdFront: null,
    representativeCccdBack: null,
  }
}

export function createShopProfileSchema(t: TFunction<'sellerShop'>) {
  return z
    .object({
      name: z.string(),
      description: z.string(),
      policy: z.string(),
      contactEmail: z.string(),
      contactPhone: z.string(),
      logo: fileField,
    })
    .superRefine((values, ctx) => {
      const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })

      const nameLength = [...values.name.trim()].length
      if (nameLength < SHOP_NAME_MIN) issue('name', t('sellerShop.validation.nameMin'))
      else if (nameLength > SHOP_NAME_MAX) issue('name', t('sellerShop.validation.nameMax'))

      if ([...values.description.trim()].length > SHOP_DESCRIPTION_MAX) {
        issue('description', t('sellerShop.validation.descriptionMax', { max: SHOP_DESCRIPTION_MAX }))
      }
      if ([...values.policy.trim()].length > SHOP_POLICY_MAX) {
        issue('policy', t('sellerShop.validation.policyMax', { max: SHOP_POLICY_MAX }))
      }

      const email = values.contactEmail.trim()
      if (email && (!EMAIL_RE.test(email) || email.length > CONTACT_EMAIL_MAX)) {
        issue('contactEmail', t('sellerShop.validation.contactEmail'))
      }

      const phone = values.contactPhone.trim()
      if (phone && !PHONE_RE.test(phone)) {
        issue('contactPhone', t('sellerShop.validation.contactPhone'))
      }

      if (values.logo) {
        const logoErr = shopLogoError(values.logo, t)
        if (logoErr) issue('logo', logoErr)
      }
    })
}

export type ShopProfileFormValues = z.infer<ReturnType<typeof createShopProfileSchema>>

export function shopProfileDefaults(shop: ShopDTO): ShopProfileFormValues {
  return {
    name: shop.name,
    description: shop.description ?? '',
    policy: shop.policy ?? '',
    contactEmail: shop.contactEmail ?? '',
    contactPhone: shop.contactPhone ?? '',
    logo: null,
  }
}

export function createPickupAddressSchema(t: TFunction<'sellerShop'>) {
  return z
    .object({
      contactName: z.string(),
      phone: z.string(),
      line: z.string(),
      ward: z.string(),
      district: z.string(),
      province: z.string(),
    })
    .superRefine((values, ctx) => {
      const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
      const checkRequired = (
        field: keyof PickupAddressFormValues,
        max: number,
        requiredMessage: string,
        maxMessage: string,
      ) => {
        const len = [...values[field].trim()].length
        if (len === 0) issue(field, requiredMessage)
        else if (len > max) issue(field, maxMessage)
      }

      checkRequired(
        'contactName',
        PICKUP_CONTACT_MAX,
        t('sellerShop.validation.contactNameRequired'),
        t('sellerShop.validation.contactNameMax', { max: PICKUP_CONTACT_MAX }),
      )
      const phone = values.phone.trim()
      if (!phone) issue('phone', t('sellerShop.validation.pickupPhoneRequired'))
      else if (!PHONE_RE.test(phone)) issue('phone', t('sellerShop.validation.pickupPhoneInvalid'))

      checkRequired(
        'line',
        PICKUP_LINE_MAX,
        t('sellerShop.validation.lineRequired'),
        t('sellerShop.validation.lineMax', { max: PICKUP_LINE_MAX }),
      )
      checkRequired(
        'ward',
        PICKUP_AREA_MAX,
        t('sellerShop.validation.wardRequired'),
        t('sellerShop.validation.areaMax', { max: PICKUP_AREA_MAX }),
      )
      checkRequired(
        'district',
        PICKUP_AREA_MAX,
        t('sellerShop.validation.districtRequired'),
        t('sellerShop.validation.areaMax', { max: PICKUP_AREA_MAX }),
      )
      checkRequired(
        'province',
        PICKUP_AREA_MAX,
        t('sellerShop.validation.provinceRequired'),
        t('sellerShop.validation.areaMax', { max: PICKUP_AREA_MAX }),
      )
    })
}

export type PickupAddressFormValues = z.infer<ReturnType<typeof createPickupAddressSchema>>

export function pickupAddressDefaults(pickup?: PickupAddressDTO): PickupAddressFormValues {
  return {
    contactName: pickup?.contactName ?? '',
    phone: pickup?.phone ?? '',
    line: pickup?.line ?? '',
    ward: pickup?.ward ?? '',
    district: pickup?.district ?? '',
    province: pickup?.province ?? '',
  }
}
