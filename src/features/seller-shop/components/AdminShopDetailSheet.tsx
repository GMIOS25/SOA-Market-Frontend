import { ExternalLink, LockKeyhole, PauseCircle, PlayCircle, Star, Store } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CopyableId } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDateTime } from '@/lib/format'
import type { ShopDTO, ShopStatus } from '../api'

const TARGET_STATUSES: ShopStatus[] = ['ACTIVE', 'SUSPENDED', 'LOCKED']

type AdminShopDetailSheetProps = {
  shop: ShopDTO | null
  onOpenChange: (open: boolean) => void
  onChangeStatus: (target: ShopStatus) => void
}

/** Chi tiết gian hàng + thao tác chuyển trạng thái (T2-07) — mở từ `/admin/shops`. */
export function AdminShopDetailSheet({ shop, onOpenChange, onChangeStatus }: AdminShopDetailSheetProps) {
  const { t } = useTranslation('sellerShop')

  return (
    <Sheet open={Boolean(shop)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        {shop && (
          <>
            <SheetHeader className="border-b border-border">
              <SheetTitle>{t('adminShops.detail.title', { shopName: shop.name })}</SheetTitle>
              <SheetDescription>{t('adminShops.detail.description')}</SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                  {shop.logoUrl ? (
                    <img src={shop.logoUrl} alt={shop.name} className="size-full object-cover" />
                  ) : (
                    <Store aria-hidden="true" className="size-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold">{shop.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <StatusBadge status={shop.status} />
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                      <Star aria-hidden="true" className="size-3.5 text-status-warning-foreground" />
                      {shop.ratingAvg.toFixed(1)} ({shop.ratingCount})
                    </span>
                  </div>
                </div>
                {shop.status === 'ACTIVE' && (
                  <Button asChild variant="outline" size="xs">
                    <Link to={`/shops/${shop.shopId}`}>
                      <ExternalLink aria-hidden="true" />
                      {t('adminShops.detail.viewPublic')}
                    </Link>
                  </Button>
                )}
              </div>

              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Field label={t('adminShops.detail.shopId')}>
                  <CopyableId
                    value={shop.shopId}
                    display={shop.shopId.slice(0, 8).toUpperCase()}
                    label={t('adminShops.detail.shopId')}
                  />
                </Field>
                <Field label={t('adminShops.detail.sellerUserId')}>
                  <CopyableId
                    value={shop.sellerUserId}
                    display={shop.sellerUserId.slice(0, 8).toUpperCase()}
                    label={t('adminShops.detail.sellerUserId')}
                  />
                </Field>
                <Field label={t('adminShops.detail.applicationId')}>
                  <CopyableId
                    value={shop.applicationId}
                    display={shop.applicationId.slice(0, 8).toUpperCase()}
                    label={t('adminShops.detail.applicationId')}
                  />
                </Field>
                <Field label={t('adminShops.columns.changedBy')}>
                  {shop.statusChangedBy
                    ? t(`adminShops.changedBy.${shop.statusChangedBy}`)
                    : t('adminShops.changedBy.none')}
                </Field>
                <Field label={t('adminShops.detail.contactEmail')}>{shop.contactEmail || '—'}</Field>
                <Field label={t('adminShops.detail.contactPhone')}>
                  <span className="font-mono">{shop.contactPhone || '—'}</span>
                </Field>
                <Field label={t('adminShops.detail.createdAt')}>
                  <span className="tabular-nums">{formatDateTime(shop.createdAt)}</span>
                </Field>
                <Field label={t('adminShops.columns.updatedAt')}>
                  <span className="tabular-nums">{formatDateTime(shop.updatedAt)}</span>
                </Field>
              </dl>

              {shop.statusReason && (
                <div className="rounded-md border border-border bg-background p-3 text-sm">
                  <p className="font-medium">{t('adminShops.detail.statusReason')}</p>
                  <p className="mt-1 whitespace-pre-line text-muted-foreground">{shop.statusReason}</p>
                </div>
              )}

              {shop.description && (
                <div className="rounded-md border border-border bg-background p-3 text-sm">
                  <p className="font-medium">{t('adminShops.detail.shopDescription')}</p>
                  <p className="mt-1 whitespace-pre-line text-muted-foreground">{shop.description}</p>
                </div>
              )}

              {shop.policy && (
                <div className="rounded-md border border-border bg-background p-3 text-sm">
                  <p className="font-medium">{t('adminShops.detail.policy')}</p>
                  <p className="mt-1 whitespace-pre-line text-muted-foreground">{shop.policy}</p>
                </div>
              )}
            </div>

            <SheetFooter className="sticky bottom-0 flex-row flex-wrap justify-end gap-2 border-t border-border bg-card">
              {TARGET_STATUSES.filter((status) => status !== shop.status).map((target) => (
                <Button
                  key={target}
                  type="button"
                  variant={target === 'ACTIVE' ? 'default' : 'destructive-outline'}
                  onClick={() => onChangeStatus(target)}
                >
                  {target === 'ACTIVE' && <PlayCircle aria-hidden="true" />}
                  {target === 'SUSPENDED' && <PauseCircle aria-hidden="true" />}
                  {target === 'LOCKED' && <LockKeyhole aria-hidden="true" />}
                  {t(`adminShops.actions.${target}`)}
                </Button>
              ))}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
