import Link from "next/link";
import { getPagedProducts } from "@/lib/api";
import type { CategorieListItem, Produit } from "@/lib/types";
import { toSlug } from "@/lib/slug";
import { Container } from "@/components/ui/Container";
import { ProductRail } from "@/components/catalogue/ProductRail";
import { MobileProductCarousel } from "@/components/catalogue/MobileProductCarousel";
import { SectionHeading } from "@/components/home/SectionHeading";
import { ArrowRightIcon } from "@/components/ui/icons";

// Style partagé — identique au bouton "Voir toutes les promotions"
const BTN =
  "inline-flex h-10 flex-shrink-0 items-center justify-center gap-2 rounded-lg border border-azure-200 bg-white px-5 text-sm font-medium text-azure-700 shadow-sm hover:bg-azure-50 hover:border-azure-400 transition-all duration-200";

async function SubcategoryRail({
  subcategory,
  categorySlug,
}: {
  subcategory: { id: number; nom: string };
  categorySlug: string;
}) {
  let products: Produit[] = [];
  try {
    const result = await getPagedProducts({
      sousCategorieId: subcategory.id,
      misEnAvantSousCat: true,
      page: 1,
      limit: 10,
      sort: "recent",
    });
    products = result.products;
  } catch {
    return null;
  }

  if (products.length === 0) return null;

  return (
    <section className="relative overflow-hidden bg-slate-50/70 border-y border-slate-200/60">
      <Container className="relative py-12 lg:py-20 z-10">
        <SectionHeading
          title={subcategory.nom}
          description={`Découvrez notre sélection pour le rayon ${subcategory.nom.toLowerCase()}.`}
          dark={false}
          extraAction={
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/${categorySlug}/sous-categories/${toSlug(subcategory.nom)}`}
                className={BTN}
              >
                Voir la sous-catégorie
                <ArrowRightIcon size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link
                href={`/${categorySlug}/sous-categories?rayon=${subcategory.id}`}
                className={BTN}
              >
                Voir tout le rayon
                <ArrowRightIcon size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>
          }
        />

        {/* Mobile : carousel horizontal, 1 produit à la fois */}
        <MobileProductCarousel products={products} subcategoryId={subcategory.id} />

        {/* Desktop : rail horizontal inchangé */}
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

/**
 * Affiche un rail de produits pour chaque sous-catégorie d'une catégorie.
 * Alterne entre thème sombre et thème clair.
 */
export async function CategorySubcategoryRails({
  category,
}: {
  category: CategorieListItem;
}) {
  const subs = category.sousCategories || [];
  
  if (subs.length === 0) return null;

  const slug = toSlug(category.nom);

  return (
    <div className="flex flex-col my-4">
      {subs.map((sub) => (
        <SubcategoryRail
          key={sub.id}
          subcategory={sub}
          categorySlug={slug}
        />
      ))}
    </div>
  );
}

