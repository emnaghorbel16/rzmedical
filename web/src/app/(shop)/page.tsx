import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import {
  getBrands,
  getSiteContent,
  getVisibleCategories,
} from "@/lib/api";
import type { BanniereSite, CategorieListItem, MarqueListItem, VideoHero } from "@/lib/types";
import { Container } from "@/components/ui/Container";
import { GlobalBannerCarousel } from "@/components/layout/GlobalBannerCarousel";
import { Hero } from "@/components/home/Hero";
import { BannerCarousel } from "@/components/home/BannerCarousel";
import { FeatureStrip } from "@/components/home/FeatureStrip";
import { NewArrivals } from "@/components/home/NewArrivals";
import { PromoSection } from "@/components/home/PromoSection";
import { SectionHeading } from "@/components/home/SectionHeading";
import { CategoryCard } from "@/components/catalogue/CategoryCard";
import { BrandStrip } from "@/components/catalogue/BrandStrip";
import { ProductGridSkeleton } from "@/components/catalogue/ProductGrid";
import { buttonVariants } from "@/components/ui/Button";
import { ArrowRightIcon, PhoneIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Accueil",
  description:
    "RZmedical — matériel médical et dentaire pour les professionnels de santé en Tunisie. Livraison rapide, produits certifiés et support expert.",
};

async function loadHome(): Promise<{
  banners: BanniereSite[];
  categories: CategorieListItem[];
  brands: MarqueListItem[];
  videoHero: VideoHero | null;
}> {
  const [content, cats, brands] = await Promise.allSettled([
    getSiteContent(),
    getVisibleCategories(),
    getBrands(),
  ]);

  return {
    banners: content.status === "fulfilled" ? content.value.bannieres : [],
    categories: cats.status === "fulfilled" ? cats.value : [],
    brands: brands.status === "fulfilled" ? brands.value : [],
    videoHero: content.status === "fulfilled" ? content.value.videoHero : null,
  };
}

export default async function HomePage() {
  const { banners, categories, brands, videoHero } = await loadHome();

  return (
    <>
      <Hero videoHero={videoHero} />
      {banners.length > 0 && (
        <div className="bg-slate-50 pt-8 pb-4">
          <GlobalBannerCarousel banners={banners} />
        </div>
      )}

      {/* <FeatureStrip /> */}

      {/* Categories section */}
      

      {/* New arrivals */}
      <Suspense
        fallback={
          <Container className="py-14 lg:py-20">
            <ProductGridSkeleton count={8} />
          </Container>
        }
      >
        <NewArrivals />
      </Suspense>

      <Suspense fallback={null}>
        <PromoSection />
      </Suspense>
      {/* Brands */}
      {brands.length > 0 && (
        <section className="relative bg-slate-50 overflow-hidden border-t border-slate-200/60">
          <div className="absolute inset-0 bg-gradient-to-b from-white to-slate-50 pointer-events-none" />
          <Container className="relative py-14 lg:py-20">
            <SectionHeading
              eyebrow="Confiance"
              title="Nos marques partenaires"
              description="Nous distribuons les références reconnues du secteur médical et dentaire."
            />
            <BrandStrip brands={brands} />
          </Container>
        </section>
      )}
      {categories.length > 0 && (
        <section className="relative bg-navy-960 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-white/10 pointer-events-none" />

          <Container className="relative py-14 lg:py-20">
            <SectionHeading
              eyebrow="Nos univers"
              title="Explorer par catégorie"
              description="Trouvez rapidement le matériel adapté à votre spécialité."
              href="/catalogue"
              linkLabel="Tout le catalogue"
              dark
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.slice(0, 9).map((category, i) => (
                <CategoryCard key={category.id} category={category} index={i} />
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* Expert CTA section */}
      <section className="relative overflow-hidden bg-white border-t border-slate-200/60">
        <Container className="grid gap-10 py-16 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-20 relative">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-azure-200 bg-azure-50 px-4 py-1.5 mb-5 select-none shadow-sm">
              <span className="h-px w-3 bg-azure-500/60" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-azure-600">
                Support client dédié
              </span>
            </div>
            <h2 className="font-display text-3xl font-black text-navy-900 tracking-tight sm:text-4xl leading-tight mb-4">
              Besoin d&apos;un conseil sur-mesure pour votre équipement&nbsp;?
            </h2>
            <p className="max-w-md text-[15px] leading-relaxed text-slate-600 mb-8">
              Notre équipe d&apos;experts dentaires et médicaux vous accompagne dans le choix des instruments et matériels adaptés à votre cabinet ou clinique.
            </p>
            <div className="flex flex-col gap-3.5 sm:flex-row">
              <a
                href="tel:+21628113131"
                className={buttonVariants({ variant: "accent", size: "lg" })}
              >
                <PhoneIcon size={18} />
                Nous contacter
              </a>
              <Link
                href="/catalogue"
                className="inline-flex h-12 items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-6 text-[14px] font-semibold text-navy-800 transition-all hover:border-azure-300 hover:-translate-y-[1px] hover:shadow-md"
              >
                Parcourir le catalogue
                <ArrowRightIcon size={16} />
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                title: "Disponibilité",
                text: "Du lundi au vendredi de 8h30 à 18h00.",
              },
              {
                title: "Contact direct",
                text: "randzmedical@outlook.com\n+216 28 113 131",
              },
            ].map(({ title, text }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 transition-all hover:border-azure-200 hover:bg-white shadow-sm hover:shadow-md"
              >
                <p className="text-[13px] font-bold text-navy-900 mb-1.5">{title}</p>
                <p className="text-[12px] text-slate-600 leading-relaxed whitespace-pre-line">{text}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
