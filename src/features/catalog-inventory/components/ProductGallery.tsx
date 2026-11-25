import { Check, ImageOff } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export type ProductGalleryProps = {
  /** URL ảnh đã ghép từ `imageRef`; rỗng = không có ảnh để hiển thị. */
  images: string[]
  productName: string
}

/** Thư viện ảnh sản phẩm: ảnh lớn + hàng ảnh thu nhỏ (dùng bàn phím và trình đọc màn hình được). */
export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const { t } = useTranslation('catalog')
  const [activeIndex, setActiveIndex] = useState(0)
  const safeIndex = Math.min(activeIndex, Math.max(images.length - 1, 0))
  const active = images[safeIndex]

  return (
    <div className="space-y-3">
      <div className="aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted">
        {active ? (
          <img
            src={active}
            alt={t('detail.imageAlt', { index: safeIndex + 1, name: productName })}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff aria-hidden="true" className="size-16" />
          </div>
        )}
      </div>
      {images.length > 1 && (
        <ul className="flex flex-wrap gap-2">
          {images.map((url, index) => {
            const selected = index === safeIndex
            return (
              // Ảnh có thể trùng URL nên key kèm vị trí.
              <li key={`${index}-${url}`}>
                <button
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={t('detail.thumbnailAria', { index: index + 1 })}
                  aria-pressed={selected}
                  className={cn(
                    'relative size-16 overflow-hidden rounded-md border-2 bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    selected ? 'border-primary' : 'border-border hover:border-input',
                  )}
                >
                  <img src={url} alt="" className="size-full object-cover" />
                  {/* Dấu kiểm để ảnh đang xem không chỉ khác nhau ở màu viền. */}
                  {selected && (
                    <span
                      aria-hidden="true"
                      className="absolute right-0.5 bottom-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    >
                      <Check className="size-3" />
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
