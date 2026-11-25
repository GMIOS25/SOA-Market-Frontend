/**
 * Lớp dùng chung cho ô nhập và ô chọn trên form của cổng người mua: viền `--input`, focus ring theo Brief §7.3,
 * viền đỏ khi `aria-invalid`.
 */
export const textFieldClass =
  'h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-invalid:border-destructive'
