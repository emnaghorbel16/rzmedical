import { Container } from "@/components/ui/Container";
import { Filters } from "@/components/catalogue/Filters";
import { MobileFilters } from "@/components/catalogue/MobileFilters";
import { SortSelect } from "@/components/catalogue/SortSelect";
import { ProductCard } from "@/components/catalogue/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SubcategoryBanner } from "@/components/catalogue/SubcategoryBanner";
import { Pagination } from "@/components/ui/Pagination";
import type { CategorieListItem, SousCategorieListItem, MarqueListItem } from "@/lib/types";
import { getVisibleCategories, getSubcategories, getBrands, getPagedProducts } from "@/lib/api";
import { PackageIcon } from "@/components/ui/icons";

export interface CategoryCatalogProps {
  category: CategorieListItem;
  searchParams: Record<string, string | string[] | undefined>;
  forcedFilters?: {
    promo?: boolean;
    filter?: "new";
  };
  customHeading?: string;
}

const SORTS = ["recent", "prix-asc", "prix-desc", "nom", "remise"] as const;
function one(v: string | string[] | undefined): string | undefined { return Array.isArray(v) ? v[0] : v; }
function num(v: string | string[] | undefined): number | undefined {
  const s = one(v);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export async function CategoryCatalog({
  category,
  searchParams,
  forcedFilters,
  customHeading,
}: CategoryCatalogProps) {
  const sort = one(searchParams.sort);
  const q = one(searchParams.q)?.trim() || undefined;

  const filters = {
    categorieId: category.id,
    sousCategorieId: num(searchParams.sousCategorieId),
    marqueId: num(searchParams.marqueId),
    q,
    promo: forcedFilters?.promo ?? (one(searchParams.promo) === "1" ? true : undefined),
    disponible: one(searchParams.disponible) === "1" ? true : undefined,
    minPrix: num(searchParams.minPrix),
    maxPrix: num(searchParams.maxPrix),
    sort: (SORTS as readonly string[]).includes(sort ?? "") ? (sort as any) : undefined,
    filter: forcedFilters?.filter ?? undefined,
    page: num(searchParams.page) ?? 1,
  };

  const [paginated, filterData] = await Promise.all([
    getPagedProducts(filters),
    Promise.allSettled([
      getVisibleCategories(),
      getSubcategories(),
      getBrands(),
    ]),
  ]);

  const categories = filterData[0].status === "fulfilled" ? filterData[0].value : [];
  const subcategories = filterData[1].status === "fulfilled" ? filterData[1].value : [];
  const brands = filterData[2].status === "fulfilled" ? filterData[2].value : [];

  const products = paginated.products;

  let heading = customHeading ?? category.nom;
  if (q) heading = `Résultats pour « ${q} »`;
  else if (filters.sousCategorieId) {
    heading = subcategories.find((s) => s.id === filters.sousCategorieId)?.nom ?? heading;
  } else if (filters.marqueId) {
    heading = brands.find((b) => b.id === filters.marqueId)?.nom ?? heading;
  }

  const subcategory = filters.sousCategorieId
    ? subcategories.find((s) => s.id === filters.sousCategorieId)
    : undefined;
  const marque = filters.marqueId
    ? brands.find((m) => m.id === filters.marqueId)
    : undefined;

  const bannerName = subcategory?.nom ?? marque?.nom;
  const bannerImage = subcategory?.image ?? marque?.logo;
  
  const baseBreadcrumb = [{ label: category.nom, href: `/${category.nom.toLowerCase()}` }];
  const bannerBreadcrumb = subcategory
    ? [...baseBreadcrumb, { label: subcategory.nom }]
    : marque
      ? [...baseBreadcrumb, { label: marque.nom }]
      : [];

  const productCountLabel = `${paginated.totalProducts} produit${paginated.totalProducts > 1 ? "s" : ""}${q ? "" : " disponibles"}`;
  const showBanner = Boolean(bannerName && !customHeading && !q);

  return (
    <>
      {showBanner && bannerName ? (
        <SubcategoryBanner
          name={bannerName}
          image={bannerImage}
          breadcrumb={bannerBreadcrumb}
        />
      ) : null}

      <Container className="py-6 lg:py-10">
        {!showBanner ? (
          <>
            <Breadcrumb items={baseBreadcrumb} />
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
                hideCategory={true}
                currentCategorieId={filters.categorieId ? String(filters.categorieId) : undefined}
                currentSousCategorieId={filters.sousCategorieId ? String(filters.sousCategorieId) : undefined}
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
                  hideCategory={true}
                  currentCategorieId={filters.categorieId ? String(filters.categorieId) : undefined}
                  currentSousCategorieId={filters.sousCategorieId ? String(filters.sousCategorieId) : undefined}
                />
              </div>
              <div className="ml-auto w-[180px]">
                <SortSelect />
              </div>
            </div>

            {/* Grille */}
            {products.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 xl:grid-cols-4">
                {products.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 4} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<PackageIcon size={32} />}
                title="Aucun produit trouvé"
                description={
                  q
                    ? `Nous n'avons trouvé aucun résultat pour « ${q} »`
                    : "Modifiez vos filtres ou explorez d'autres catégories."
                }
              />
            )}

            {/* Pagination UI */}
            {paginated.totalPages > 1 && (
              <Pagination
                currentPage={paginated.currentPage}
                totalPages={paginated.totalPages}
                className="mt-10"
              />
            )}
          </div>
        </div>
      </Container>
    </>
  );
}
