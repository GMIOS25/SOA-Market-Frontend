import type { TFunction } from 'i18next'
import { z } from 'zod'
import { DOCUMENT_FIELDS, REQUIRED_DOCUMENTS, type DocumentField, type SellerType } from './api'

/* Quy tắc khớp `validateApplication` của SVC-SEL (services/svc-sel/internal/service/sel_service.go). */
export const SHOP_NAME_MIN = 2
export const SHOP_NAME_MAX = 100
export const MAX_KYC_FILE_BYTES = 5 * 1024 * 1024
export const ACCEPTED_KYC_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MAX_NOTE_LENGTH = 1000

export const CCCD_RE = /^[0-9]{12}$/
export const BUSINESS_NUMBER_RE = /^[0-9]{10}(-[0-9]{3})?$/
export const TAX_CODE_RE = /^([0-9]{10}(-[0-9]{3})?|[0-9]{12})$/

const fileField = z.custom<File | null>((value) => value === null || value instanceof File)

export const DOCUMENT_FIELD_NAMES = Object.values(DOCUMENT_FIELDS) as DocumentField[]

/** Lỗi của 1 tệp ảnh KYC, `null` nếu hợp lệ. Dùng cả khi chọn tệp (báo ngay) và khi submit. */
export function kycFileError(file: File, t: TFunction<'sellerShop'>): string | null {
  if (!(ACCEPTED_KYC_TYPES as readonly string[]).includes(file.type)) return t('onboarding.validation.fileType')
  if (file.size > MAX_KYC_FILE_BYTES) return t('onboarding.validation.fileSize')
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
