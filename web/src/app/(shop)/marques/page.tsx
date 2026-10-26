import type { Metadata } from "next";
import { getBrands } from "@/lib/api";
import { BrandStrip } from "@/components/catalogue/BrandStrip";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Toutes nos marques | RZMedical",
  description:
    "Decouvrez toutes les marques partenaires de RZMedical. Materiel medical et dentaire des references reconnues du secteur.",
};

export default async function MarquesPage() {
  const brands = await getBrands();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="relative border-b border-slate-200/60 bg-white">
        <div className="absolute inset-0 bg-gradient-to-b from-azure-50/30 to-white pointer-events-none" />
        <Container className="relative py-12 lg:py-16">
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-azure-600">
            Nos partenaires
          </p>
          <h1 className="text-3xl font-black text-navy-900 lg:text-4xl">
            Toutes nos marques
          </h1>
          <p className="mt-3 max-w-xl text-[15px] text-slate-500">
            Nous distribuons les references reconnues du secteur medical et
            dentaire. Cliquez sur une marque pour voir ses produits.
          </p>
          {brands.length > 0 && (
            <p className="mt-2 text-[13px] font-semibold text-azure-600">
              {brands.length} marque{brands.length > 1 ? "s" : ""} referencee
              {brands.length > 1 ? "s" : ""}
            </p>
          )}
        </Container>
      </div>

      {/* Grille des marques */}
      <Container className="py-12 lg:py-16">
        {brands.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-[15px] text-slate-400">
              Aucune marque disponible pour le moment.
            </p>
          </div>
        ) : (
          <BrandStrip brands={brands} />
        )}
      </Container>
    </div>
  );
}
