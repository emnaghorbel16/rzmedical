import Link from "next/link";
import { getPagedProducts } from "@/lib/api";
import type { CategorieListItem, Produit } from "@/lib/types";
import { toSlug } from "@/lib/slug";
import { Container } from "@/components/ui/Container";
import { ProductRail } from "@/components/catalogue/ProductRail";
import { SectionHeading } from "@/components/home/SectionHeading";
import { ArrowRightIcon } from "@/components/ui/icons";

const BTN =
  "inline-flex h-10 flex-shrink-0 items-center justify-center gap-2 rounded-lg border border-azure-200 bg-white px-5 text-sm font-medium text-azure-700 shadow-sm hover:bg-azure-50 hover:border-azure-400 transition-all duration-200";

/**
 * Section nouveautés filtrée sur la catégorie active.
 * Utilisé sur la homepage catégorie.
 */
export async function CategoryNewArrivalsSection({
  category,
}: {
  category: CategorieListItem;
}) {
  let products: Produit[] = [];
  try {
    const result = await getPagedProducts({
      categorieId: category.id,
      page: 1,
      limit: 10,
      sort: "recent",
    });
    products = result.products;
  } catch {
    return null;
  }

  if (products.length === 0) return null;

  const slug = toSlug(category.nom);

  return (
    <Container className="py-14 lg:py-20">
      <SectionHeading
        eyebrow="Sélection"
        title={`Nouveautés ${category.nom}`}
        description={`Les dernières références ${category.nom.toLowerCase()} ajoutées à notre catalogue.`}
        extraAction={
          <Link href={`/${slug}/nouveautes`} className={BTN}>
            Découvrir les nouveautés
            <ArrowRightIcon size={16} />
          </Link>
        }
      />
      <ProductRail
        products={products}
        className="[scrollbar-color:theme(colors.azure.500)_transparent]"
      />
    </Container>
  );
}
