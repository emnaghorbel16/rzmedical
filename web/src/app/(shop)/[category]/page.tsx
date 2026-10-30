import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getVisibleCategories, getSiteContent } from "@/lib/api";
import { findCategoryBySlug } from "@/lib/slug";
import { Hero } from "@/components/home/Hero";
import { GlobalBannerCarousel } from "@/components/layout/GlobalBannerCarousel";
import { CategoryNewArrivalsSection } from "@/components/category/CategoryNewArrivalsSection";
import { CategoryPromotionsSection } from "@/components/category/CategoryPromotionsSection";
import { CategorySubcategoryRails } from "@/components/category/CategorySubcategoryRails";
import { CategoryBrandsStrip } from "@/components/category/CategoryBrandsStrip";

type Props = {
  params: Promise<{ category: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: catSlug } = await params;
  const categories = await getVisibleCategories();
  const cat = findCategoryBySlug(categories, catSlug);

  if (!cat) return {};

  return {
    title: cat.nom,
    description: `Découvrez tous nos produits de la catégorie ${cat.nom} pour les professionnels de santé en Tunisie.`,
    alternates: {
      canonical: `/${catSlug}`,
    },
  };
}

export default async function CategoryHomePage({ params }: Props) {
  const { category: catSlug } = await params;

  const categories = await getVisibleCategories().catch(() => []);
  const category = findCategoryBySlug(categories, catSlug);

  if (!category) {
    notFound();
  }

  const content = await getSiteContent(category.id).catch(() => null);

  const banners = content?.bannieres || [];
  const videoHero = content?.videoHero || null;

  return (
    <>
      {/* 1. Hero — Même vidéo que l'accueil global */}
      <Hero videoHero={videoHero} />

      {/* 2. Bannières — Mêmes bannières que l'accueil global */}
      {banners.length > 0 && (
        <div className="bg-slate-50 pt-8 pb-4">
          <GlobalBannerCarousel banners={banners} />
        </div>
      )}

      {/* 3. Nouveautés de la catégorie */}
      <Suspense fallback={null}>
        <CategoryNewArrivalsSection category={category} />
      </Suspense>

      {/* 4. Promotions de la catégorie */}
      <Suspense fallback={null}>
        <CategoryPromotionsSection category={category} />
      </Suspense>

      {/* 5. Rails de produits par sous-catégorie */}
      <Suspense fallback={null}>
        <CategorySubcategoryRails category={category} />
      </Suspense>

      {/* 6. Marques disponibles dans cette catégorie */}
      <Suspense fallback={null}>
        <CategoryBrandsStrip category={category} />
      </Suspense>
    </>
  );
}
