import { z } from 'zod'
import { DECISION_OUTCOMES, REFUND_OUTCOMES, RESPONSIBLE_PARTIES } from './api'

export const DECISION_REASON_MAX = 1000

export type DecisionValidationMessages = {
  positiveInt: string
  exceedsRemaining: string
  requiredForPartial: string
  reasonRequired: string
  reasonMax: string
}

export type CreateDecisionSchemaOptions = {
  remainingRefundable?: number
  messages: DecisionValidationMessages
}

/**
 * Schema form quyết định phân xử CSKH (FR-CPL-007, BR-CPL-05, BR-CPL-06):
 * - Bắt buộc nhập lý do (sau khi trim không được rỗng).
 * - Khi chọn phương án hoàn tiền, kiểm tra số tiền nguyên dương và không vượt quá `remainingRefundable`.
 */
export function createDecisionSchema(options: CreateDecisionSchemaOptions) {
  return z
    .object({
      outcome: z.enum(DECISION_OUTCOMES),
      responsibleParty: z.enum(RESPONSIBLE_PARTIES),
      refundAmount: z.string(),
      reason: z.string(),
    })
    .superRefine((values, ctx) => {
      const issue = (path: 'outcome' | 'responsibleParty' | 'refundAmount' | 'reason', message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message })

      const trimmedReason = values.reason.trim()
      if (trimmedReason.length === 0) {
        issue('reason', options.messages.reasonRequired)
      } else if ([...trimmedReason].length > DECISION_REASON_MAX) {
        issue('reason', options.messages.reasonMax)
      }

      if (REFUND_OUTCOMES.has(values.outcome)) {
        const trimmedAmount = values.refundAmount.trim()
        if (values.outcome === 'PARTIAL_REFUND' && trimmedAmount === '') {
          issue('refundAmount', options.messages.requiredForPartial)
          return
        }
        if (trimmedAmount !== '') {
          if (!/^[0-9]+$/.test(trimmedAmount)) {
            issue('refundAmount', options.messages.positiveInt)
            return
          }
          const numericAmount = Number(trimmedAmount)
          if (!Number.isSafeInteger(numericAmount) || numericAmount <= 0) {
            issue('refundAmount', options.messages.positiveInt)
            return
          }
          if (
            options.remainingRefundable !== undefined &&
            numericAmount > options.remainingRefundable
          ) {
            issue('refundAmount', options.messages.exceedsRemaining)
          }
        }
      }
    })
}

export type DecisionFormValues = z.infer<ReturnType<typeof createDecisionSchema>>
