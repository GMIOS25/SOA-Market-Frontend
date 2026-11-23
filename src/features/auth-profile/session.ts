// Session store đã được chuyển lên `@/lib/auth/session` (T2-03) để layouts, guards và API client dùng chung.
// Giữ file này để các import cũ trong auth-profile không phải đổi.
export * from '@/lib/auth/session'
