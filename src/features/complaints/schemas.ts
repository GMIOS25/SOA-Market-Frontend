import type { TFunction } from 'i18next'
import { z } from 'zod'
import { formatVnd } from '@/lib/format'
import { COMPLAINT_TYPES, REQUESTED_RESOLUTIONS } from './helpers'

export function createComplaintSchema(t: TFunction<'complaints'>, maxPartialRefund?: number) {
  return z
    .object({
      orderId: z.string().min(1, t('create.validation.orderRequired')),
      sellerOrderIds: z.array(z.string()).min(1, t('create.validation.packagesRequired')),
      type: z.enum(COMPLAINT_TYPES, {
        message: t('create.validation.typeRequired'),
      }),
      requestedResolution: z.enum(REQUESTED_RESOLUTIONS, {
        message: t('create.validation.resolutionRequired'),
      }),
      requestedRefundAmount: z.string(),
      description: z.string(),
    })
    .superRefine((values, ctx) => {
      if (!values.description.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['description'],
          message: t('create.validation.descriptionRequired'),
        })
      }

      if (values.requestedResolution === 'PARTIAL_REFUND') {
        const parsed = Number(values.requestedRefundAmount.trim())
        if (!Number.isInteger(parsed) || parsed <= 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['requestedRefundAmount'],
            message: t('create.validation.refundAmountPositive'),
          })
        } else if (maxPartialRefund !== undefined && maxPartialRefund > 0 && parsed > maxPartialRefund) {
          ctx.addIssue({
            code: 'custom',
            path: ['requestedRefundAmount'],
            message: t('create.validation.refundAmountExceedsPackage', {
              max: formatVnd(maxPartialRefund),
            }),
          })
        }
      }
    })
}

export type CreateComplaintFormValues = z.infer<ReturnType<typeof createComplaintSchema>>

export const SELLER_RESPONSE_MODES = [
  'PARTIAL_REFUND',
  'ACCEPT',
  'OTHER_PROPOSAL',
  'MESSAGE',
] as const

export type SellerResponseMode = (typeof SELLER_RESPONSE_MODES)[number]

export function createSellerResponseSchema(
  t: TFunction<'complaints'>,
  maxRefundAmount?: number,
) {
  return z
    .object({
      mode: z.enum(SELLER_RESPONSE_MODES),
      resolution: z.enum(['FULL_REFUND', 'RETURN_REFUND', 'EXCHANGE']),
      refundAmount: z.string(),
      messageAction: z.enum(['MESSAGE', 'REJECT']),
      content: z.string(),
    })
    .superRefine((values, ctx) => {
      if (!values.content.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['content'],
          message: t('sellerResponse.validation.contentRequired'),
        })
      }

      if (values.mode === 'PARTIAL_REFUND') {
        const parsed = Number(values.refundAmount.trim())
        if (!Number.isInteger(parsed) || parsed <= 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['refundAmount'],
            message: t('sellerResponse.validation.refundAmountPositive'),
          })
        } else if (maxRefundAmount !== undefined && maxRefundAmount >= 0 && parsed > maxRefundAmount) {
          ctx.addIssue({
            code: 'custom',
            path: ['refundAmount'],
            message: t('sellerResponse.validation.refundAmountExceedsOrder', {
              max: formatVnd(maxRefundAmount),
            }),
          })
        }
      }
    })
}

export type SellerResponseFormValues = z.infer<ReturnType<typeof createSellerResponseSchema>>

export function createBuyerNegotiationSchema(t: TFunction<'complaints'>) {
  return z.object({
    content: z
      .string()
      .trim()
      .min(1, t('negotiation.validation.contentRequired')),
  })
}

export type BuyerNegotiationFormValues = z.infer<ReturnType<typeof createBuyerNegotiationSchema>>
