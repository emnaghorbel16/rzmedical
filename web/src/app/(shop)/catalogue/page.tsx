import type { Metadata } from "next";
import Link from "next/link";
import type { ProductFilters } from "@/lib/api";
import {
  getBrands,
  getPagedProducts,
  getSubcategories,
  getVisibleCategories,
} from "@/lib/api";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductCard } from "@/components/catalogue/ProductCard";
import { Pagination } from "@/components/catalogue/Pagination";
import { Filters } from "@/components/catalogue/Filters";
import { SortSelect } from "@/components/catalogue/SortSelect";
import { MobileFilters } from "@/components/catalogue/MobileFilters";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SubcategoryBanner } from "@/components/catalogue/SubcategoryBanner";
import { PackageIcon } from "@/components/ui/icons";
import { PRODUCT_GRID_CLASS } from "@/components/catalogue/ProductGrid";

export const metadata: Metadata = {
  title: "Catalogue",
  description:
    "Découvrez notre catalogue de matériel médical et dentaire : équipements, consommables et instruments de qualité, livrés partout en Tunisie.",
};

type SearchParams = Record<string, string | string[] | undefined>;

const SORTS = ["recent", "prix-asc", "prix-desc", "nom", "remise"] as const;
const PAGE_SIZE = 12;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
function num(v: string | string[] | undefined): number | undefined {
  const s = one(v);
  if (s === undefined || s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function parseFilters(sp: SearchParams): ProductFilters {
  const sort = one(sp.sort);
  const filter = one(sp.filter);
  return {
    categorieId: num(sp.categorieId),
    sousCategorieId: num(sp.sousCategorieId),
    marqueId: num(sp.marqueId),
    q: one(sp.q)?.trim() || undefined,
    promo: one(sp.promo) === "1" ? true : undefined,
    disponible: one(sp.disponible) === "1" ? true : undefined,
    minPrix: num(sp.minPrix),
    maxPrix: num(sp.maxPrix),
    sort: (SORTS as readonly string[]).includes(sort ?? "")
      ? (sort as ProductFilters["sort"])
      : undefined,
    filter: filter === "new" || filter === "promo" ? filter : undefined,
  };
}

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const currentPage = Math.max(1, num(sp.page) ?? 1);

  // Les produits sont essentiels : leur échec doit remonter (error.tsx). Les
  // données de la barre de filtres (catégories, sous-catégories, marques) sont
  // secondaires — on les résout séparément et on dégrade en liste vide si l'API
  // échoue, pour que le catalogue reste consultable même sans la barre latérale.
  const [paginated, filterData] = await Promise.all([
    getPagedProducts({ ...filters, page: currentPage, limit: PAGE_SIZE }),
    Promise.allSettled([
      getVisibleCategories(),
      getSubcategories(),
      getBrands(),
    ]),
  ]);
  const categories =
    filterData[0].status === "fulfilled" ? filterData[0].value : [];
  const subcategories =
    filterData[1].status === "fulfilled" ? filterData[1].value : [];
  const brands =
    filterData[2].status === "fulfilled" ? filterData[2].value : [];

  const products = paginated.products;
  const totalProducts = paginated.totalProducts;
  const totalPages = paginated.totalPages;

  // Intitulé contextuel
  let heading = "Tous les produits";
  if (filters.q) heading = `Résultats pour « ${filters.q} »`;
  else if (filters.filter === "new") heading = "Nouveautés";
  else if (filters.promo || filters.filter === "promo") heading = "Promotions";
  else if (filters.sousCategorieId) {
    heading =
      subcategories.find((s) => s.id === filters.sousCategorieId)?.nom ??
      heading;
  } else if (filters.marqueId) {
    heading = brands.find((b) => b.id === filters.marqueId)?.nom ?? heading;
  } else if (filters.categorieId) {
    heading =
      categories.find((c) => c.id === filters.categorieId)?.nom ?? heading;
  }

  const activeCount =
    (filters.categorieId ? 1 : 0) +
    (filters.sousCategorieId ? 1 : 0) +
    (filters.marqueId ? 1 : 0) +
    (filters.promo ? 1 : 0) +
    (filters.disponible ? 1 : 0) +
    (filters.minPrix || filters.maxPrix ? 1 : 0);

  const subcategory = filters.sousCategorieId
    ? subcategories.find((s) => s.id === filters.sousCategorieId)
    : undefined;
  const category = filters.categorieId
    ? categories.find((c) => c.id === filters.categorieId)
    : undefined;
  const marque = filters.marqueId
    ? brands.find((m) => m.id === filters.marqueId)
    : undefined;

  const bannerName = subcategory?.nom ?? category?.nom ?? marque?.nom;
  const bannerImage =
    subcategory?.image ??
    (category
      ? subcategories.find((s) => s.categorieId === category.id && s.image)?.image
      : undefined) ??
    marque?.logo;
  
  const bannerBreadcrumb = subcategory
    ? [
        { label: "Catalogue", href: "/catalogue" },
        ...(subcategory.categorie
          ? [
              {
                label: subcategory.categorie.nom,
                href: `/catalogue?categorieId=${subcategory.categorieId}`,
              },
            ]
          : []),
        { label: subcategory.nom },
      ]
    : category
      ? [
          { label: "Catalogue", href: "/catalogue" },
          { label: category.nom },
        ]
      : marque
        ? [
            { label: "Catalogue", href: "/catalogue" },
            { label: marque.nom },
          ]
        : [];

  const productCountLabel = `${totalProducts} produit${totalProducts > 1 ? "s" : ""}${filters.q ? "" : " disponibles"}`;
  const showBanner = Boolean(bannerName);

  return (
    <>
      {showBanner && bannerName ? (
        <SubcategoryBanner
          name={bannerName}
          image={bannerImage}
          breadcrumb={bannerBreadcrumb}
          isLogo={!!marque}
        />
      ) : null}

    <Container className="py-6 lg:py-10">
      {!showBanner ? (
        <>
          <Breadcrumb items={[{ label: "Catalogue" }]} />
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
              {heading}
            </h1>
            <p className="mt-1.5 text-sm text-muted">{productCountLabel}</p>
          </header>
        </>
      ) : (
        <p className="mb-6 text-sm text-muted">{productCountLabel}</p>
      )}

      <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[17rem_minmax(0,1fr)]">
        {/* Filtres (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-xl border border-border bg-surface p-5 shadow-sm">
            <Filters
              categories={categories}
              subcategories={subcategories}
              brands={brands}
            />
          </div>
        </aside>

        {/* Résultats */}
        <div className="min-w-0">
          {/* Barre d'outils */}
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="lg:hidden">
              <MobileFilters
                categories={categories}
                subcategories={subcategories}
                brands={brands}
              />
            </div>
            <div className="ml-auto">
              <SortSelect />
            </div>
          </div>

          {products.length === 0 ? (
            <EmptyState
              icon={<PackageIcon size={30} />}
              title="Aucun produit trouvé"
              description="Essayez d'élargir votre recherche ou de réinitialiser les filtres."
              action={
                <Link
                  href="/catalogue"
                  className="text-sm font-semibold text-azure-600 hover:text-azure-700"
                >
                  Réinitialiser les filtres
                </Link>
              }
            />
          ) : (
            <>
              <div className={PRODUCT_GRID_CLASS}>
                {products.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 4} />
                ))}
              </div>

              {/* Pagination 1 2 3 ... */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                searchParams={sp}
              />
            </>
          )}
        </div>
      </div>
    </Container>
    </>
  );
}
