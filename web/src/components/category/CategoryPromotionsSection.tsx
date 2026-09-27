import Link from "next/link";
import { getPagedProducts } from "@/lib/api";
import type { CategorieListItem } from "@/lib/types";
import { toSlug } from "@/lib/slug";
import { Container } from "@/components/ui/Container";
import { ProductRail } from "@/components/catalogue/ProductRail";
import { MobileProductCarousel } from "@/components/catalogue/MobileProductCarousel";
import { ArrowRightIcon, PercentIcon } from "@/components/ui/icons";

/**
 * Section promotions filtrée sur la catégorie active.
 * Utilisé sur la homepage catégorie.
 */
export async function CategoryPromotionsSection({
  category,
}: {
  category: CategorieListItem;
}) {
  let products: import("@/lib/types").Produit[] = [];
  try {
    const result = await getPagedProducts({
      categorieId: category.id,
      promo: true,
      page: 1,
      limit: 12,
      sort: "remise",
    });
    products = result.products;
  } catch {
    return null;
  }

  if (products.length === 0) return null;

  const slug = toSlug(category.nom);

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-navy-900 to-navy-950">
      <div className="absolute top-0 left-0 right-0 h-px bg-white/10 pointer-events-none" />

      <Container className="relative py-12 lg:py-20">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="max-w-2xl">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-azure-300">
              <PercentIcon size={14} />
              Offres du moment
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Promotions {category.nom}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-navy-200">
              Profitez de remises sur une sélection de produits {category.nom.toLowerCase()}, dans la limite des stocks disponibles.
            </p>
          </div>
          <Link
            href={`/${slug}/promotions`}
            className="inline-flex h-10 flex-shrink-0 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-5 text-sm font-medium text-white hover:bg-white/20 hover:border-white/30 transition-all duration-200"
          >
            Voir toutes les promotions
            <ArrowRightIcon size={16} />
          </Link>
        </div>

        {/* Mobile : carousel horizontal, 1 produit à la fois */}
        <MobileProductCarousel products={products} />

        {/* Desktop : rail horizontal */}
        <div className="hidden sm:block">
          <ProductRail
            products={products}
            className="[scrollbar-color:theme(colors.azure.500)_transparent]"
          />
        </div>
      </Container>
    </section>
  );
}
