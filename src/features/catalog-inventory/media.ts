import { env } from '@/lib/env'

/**
 * `imageRef` trong hợp đồng là object key (VD `products/<shopId>/<uuid>.jpg` trong bucket công khai
 * `public-products`), không phải URL. Bucket cho tải nặc danh nên chỉ cần ghép với nguồn ảnh công khai.
 * Trả về `undefined` khi không có ảnh hoặc chưa cấu hình nguồn ảnh để UI vẽ nền thay thế.
 */
export function productImageUrl(imageRef?: string | null): string | undefined {
  const ref = imageRef?.trim()
  if (!ref) return undefined
  if (/^https?:\/\//i.test(ref)) return ref
  const base = env.mediaBaseUrl.replace(/\/+$/, '')
  if (!base) return undefined
  return `${base}/${ref.replace(/^\/+/, '')}`
}
