/** Đọc Blob/File thành data URL để hiển thị `<img>` — không phải thu hồi như object URL (an toàn với StrictMode). */
export function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Không đọc được tệp'))
    reader.readAsDataURL(blob)
  })
}

/** Mở ảnh trong tab mới (trình duyệt chặn điều hướng tới data URL) — object URL tự thu hồi sau 60 giây. */
export function openBlobInNewTab(blob: Blob): void {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
