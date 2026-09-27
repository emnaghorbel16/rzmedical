import type { Produit } from "@/lib/types";
import { cn } from "@/lib/cn";
import { ProductCard } from "./ProductCard";

/** Rangée de produits défilable premium avec effets de défilement améliorés. */
export function ProductRail({ products, className }: { products: Produit[]; className?: string }) {
  return (
    <div
      role="region"
      aria-label="Produits défilables"
      tabIndex={0}
      className={cn(
        // Mobile (vertical)
        "flex flex-col gap-4 pb-4 w-full",
        // Desktop (horizontal rail)
        "sm:flex-row sm:snap-x sm:snap-mandatory sm:overflow-x-auto sm:overscroll-x-contain sm:pb-4 sm:pr-4 sm:scroll-smooth sm:[scrollbar-width:thin] sm:[scrollbar-color:theme(colors.azure.500)_transparent] sm:[scrollbar-height:1px] sm:[&::-webkit-scrollbar]:h-[1px] sm:[&::-webkit-scrollbar-track]:bg-transparent sm:[&::-webkit-scrollbar-thumb]:bg-azure-500/50 sm:[&::-webkit-scrollbar-thumb:hover]:bg-azure-500/70 sm:[&::-webkit-scrollbar-thumb]:rounded sm:[&::-webkit-scrollbar-thumb:hover]:bg-azure-500/80 sm:gap-5",
        className,
      )}
    >
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          className="w-full shrink-0 sm:snap-start sm:w-[280px] lg:w-[292px] [&:hover]:translate-y-[-2px] [&:hover]:shadow-xl transition-all duration-500"
        />
      ))}
    </div>
  );
}
