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
        "flex flex-row snap-x snap-mandatory overflow-x-auto overscroll-x-contain pb-4 pr-4 scroll-smooth [scrollbar-width:none] sm:[scrollbar-width:thin] sm:[scrollbar-color:theme(colors.azure.500)_transparent] [&::-webkit-scrollbar]:hidden sm:[&::-webkit-scrollbar]:block sm:[&::-webkit-scrollbar]:h-[2px] sm:[&::-webkit-scrollbar-track]:bg-transparent sm:[&::-webkit-scrollbar-thumb]:bg-azure-500/50 sm:[&::-webkit-scrollbar-thumb:hover]:bg-azure-500/70 sm:[&::-webkit-scrollbar-thumb]:rounded gap-4 sm:gap-5",
        className,
      )}
    >
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          className="w-[260px] shrink-0 snap-start sm:w-[280px] lg:w-[292px] [&:hover]:translate-y-[-2px] [&:hover]:shadow-xl transition-all duration-500"
        />
      ))}
    </div>
  );
}
