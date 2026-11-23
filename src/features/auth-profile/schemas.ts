import { z } from 'zod'

const PHONE_REGEX = /^\+?\d{8,20}$/

export const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .max(128, 'Mật khẩu tối đa 128 ký tự')
  .refine((val) => /[a-zA-Z\p{L}]/u.test(val) && /\d/.test(val), {
    message: 'Mật khẩu phải gồm cả chữ cái và chữ số',
  })

export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .refine((v) => PHONE_REGEX.test(v), {
    message: 'Số điện thoại phải gồm 8–20 chữ số (có thể bắt đầu bằng +)',
  })

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Họ tên tối thiểu 2 ký tự').max(150, 'Họ tên tối đa 150 ký tự'),
    email: z.string().trim().email('Email không đúng định dạng'),
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu'),
    privacyConsented: z.boolean().refine((val) => val === true, {
      message: 'Bạn bắt buộc phải đồng ý xử lý dữ liệu cá nhân theo NĐ 13/2023',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu xác nhận không khớp',
  })

export const verifyOtpSchema = z.object({
  email: z.string().trim().email('Email không đúng định dạng'),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Mã OTP phải gồm đúng 6 chữ số'),
})

export const loginSchema = z.object({
  email: z.string().trim().email('Email không đúng định dạng'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Email không đúng định dạng'),
})

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, 'Thiếu token đặt lại mật khẩu'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu xác nhận không khớp',
  })

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Họ tên tối thiểu 2 ký tự').max(150, 'Họ tên tối đa 150 ký tự'),
  phone: phoneSchema,
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu xác nhận không khớp',
  })

export const addressSchema = z.object({
  receiver: z.string().trim().min(2, 'Tên người nhận tối thiểu 2 ký tự').max(150, 'Tên người nhận tối đa 150 ký tự'),
  phone: phoneSchema,
  line: z.string().trim().min(3, 'Địa chỉ chi tiết tối thiểu 3 ký tự').max(255, 'Địa chỉ chi tiết tối đa 255 ký tự'),
  ward: z.string().trim().min(1, 'Vui lòng nhập Phường/Xã'),
  district: z.string().trim().min(1, 'Vui lòng nhập Quận/Huyện'),
  province: z.string().trim().min(1, 'Vui lòng nhập Tỉnh/Thành phố'),
  isDefault: z.boolean(),
})

export const auditReasonSchema = z.object({
  reason: z.string().trim().min(10, 'Lý do bắt buộc tối thiểu 10 ký tự (BR-GEN-04)'),
})

export type RegisterFormValues = z.infer<typeof registerSchema>
export type VerifyOtpFormValues = z.infer<typeof verifyOtpSchema>
export type LoginFormValues = z.infer<typeof loginSchema>
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>
export type UpdateProfileFormValues = z.infer<typeof updateProfileSchema>
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>
export type AddressFormValues = z.infer<typeof addressSchema>
