import { useQuery } from '@tanstack/react-query'
import { ExternalLink, ImageOff, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/format'
import { apiAdminGetDocument, sellerShopKeys, type ApplicationDocumentDTO } from '../api'
import { openBlobInNewTab, readAsDataUrl } from '../file-utils'

type KycDocumentImageProps = {
  applicationId: string
  shopName: string
  document: ApplicationDocumentDTO
}

/**
 * Ảnh KYC riêng tư (NFR-SEC-011): tải qua proxy có kiểm tra quyền ADMINISTRATOR; không giữ trong cache
 * TanStack sau khi đóng hồ sơ (`gcTime: 0`).
 */
export function KycDocumentImage({ applicationId, shopName, document }: KycDocumentImageProps) {
  const { t } = useTranslation('sellerShop')
  const label = t(`docType.${document.type}`)
  const query = useQuery({
    queryKey: sellerShopKeys.kycDocument(applicationId, document.type),
    queryFn: async () => {
      const blob = await apiAdminGetDocument(applicationId, document.type)
      return { blob, dataUrl: await readAsDataUrl(blob) }
    },
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
  })
  const url = query.data?.dataUrl

  return (
    <figure className="flex flex-col gap-2 rounded-md border border-border bg-background p-2">
      <div className="flex aspect-[3/2] items-center justify-center overflow-hidden rounded bg-muted">
        {query.isPending && <Skeleton className="size-full" />}
        {query.isError && (
          <div className="flex flex-col items-center gap-2 p-3 text-center text-xs text-muted-foreground">
            <ImageOff aria-hidden="true" className="size-6" />
            <span>{t('admin.detail.imageError')}</span>
            <Button type="button" variant="outline" size="xs" onClick={() => void query.refetch()}>
              <RotateCcw aria-hidden="true" />
              {t('admin.detail.retryImage')}
            </Button>
          </div>
        )}
        {url && (
          <img src={url} alt={t('admin.detail.imageAlt', { docType: label, shopName })} className="size-full object-contain" />
        )}
      </div>
      <figcaption className="flex items-center justify-between gap-2 text-xs">
        <span className="flex flex-col">
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground tabular-nums">{formatDateTime(document.uploadedAt)}</span>
        </span>
        {query.data && (
          <Button type="button" variant="link" size="xs" className="h-auto px-0" onClick={() => openBlobInNewTab(query.data.blob)}>
            <ExternalLink aria-hidden="true" />
            {t('admin.detail.openImage')}
          </Button>
        )}
      </figcaption>
    </figure>
  )
}
