import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Lưới sản phẩm: 2 cột (360–639 px) → 3 → 4 → 5 cột (Brief §5.1). */
const GRID_CLASS = 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5'

export function ProductGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn(GRID_CLASS, className)}>{children}</ul>
}

export function ProductGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <ul className={GRID_CLASS} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="overflow-hidden rounded-lg border border-border bg-card">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  )
}
