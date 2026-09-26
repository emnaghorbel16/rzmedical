import type { Produit } from "@/lib/types";
import { ProductCard } from "./ProductCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";

/** Classe de grille produits, réutilisable (ex. pagination client LoadMore). */
export const PRODUCT_GRID_CLASS =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-6";

const GRID = PRODUCT_GRID_CLASS;

/** Grille de produits responsive. `priorityCount` précharge les N premières images. */
export function ProductGrid({
  products,
  className,
  priorityCount = 0,
}: {
  products: Produit[];
  className?: string;
  priorityCount?: number;
}) {
  return (
    <div className={cn(GRID, className)}>
      {products.map((product, i) => (
        <ProductCard
          key={product.id}
          product={product}
          priority={i < priorityCount}
        />
      ))}
    </div>
  );
}

/** Squelette d'une carte produit (même gabarit que ProductCard). */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <Skeleton className="aspect-square rounded-none" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="mt-2 flex items-end justify-between">
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="mt-3 h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}

/** Grille de squelettes pour les états de chargement. */
export function ProductGridSkeleton({
  count = 8,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn(GRID, className)} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
