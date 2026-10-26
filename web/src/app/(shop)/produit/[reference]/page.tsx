import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  getProductByReference,
  getSubcategories,
  imageUrl,
} from "@/lib/api";
import { Container } from "@/components/ui/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SubcategoryBanner } from "@/components/catalogue/SubcategoryBanner";
import { Gallery } from "@/components/product/Gallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { ProductReassuranceBar } from "@/components/product/ProductReassuranceBar";
import { ProductTabs } from "@/components/product/ProductTabs";
import { RelatedProducts } from "@/components/product/RelatedProducts";
import { ProductGridSkeleton } from "@/components/catalogue/ProductGrid";

type Params = Promise<{ reference: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { reference } = await params;
  const product = await getProductByReference(decodeURIComponent(reference));

  if (!product) {
    return { title: "Produit introuvable" };
  }

  const description =
    product.description?.slice(0, 160) ||
    `${product.nom} — ${product.marque?.nom ?? "matériel médical"} disponible chez RZmedical.`;
  const image = product.images?.[0] ? imageUrl(product.images[0]) : undefined;

  return {
    title: product.nom,
    description,
    openGraph: {
      title: product.nom,
      description,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { reference } = await params;
  const [product, subcategories] = await Promise.all([
    getProductByReference(decodeURIComponent(reference)),
    getSubcategories(),
  ]);

  if (!product) notFound();

  const subcategory =
    product.sousCategorie ??
    subcategories.find((s) => s.id === product.sousCategorieId);
  // Même source d'image que le catalogue (liste sous-catégories).
  const bannerImage =
    subcategory?.image ??
    subcategories.find((s) => s.id === product.sousCategorieId)?.image ??
    null;
  const category = subcategory?.categorie;
  const breadcrumbItems: { label: string; href?: string }[] = [
    { label: "Catalogue", href: "/catalogue" },
  ];
  if (category) {
    breadcrumbItems.push({
      label: category.nom,
      href: `/catalogue?categorieId=${category.id}`,
    });
  }
  if (subcategory) {
    breadcrumbItems.push({
      label: subcategory.nom,
      href: `/catalogue?sousCategorieId=${product.sousCategorieId}`,
    });
  }
  breadcrumbItems.push({ label: product.nom });

  return (
    <>
      {subcategory ? (
        <SubcategoryBanner
          name={subcategory.nom}
          image={bannerImage}
          breadcrumb={breadcrumbItems}
          titleAs="p"
        />
      ) : null}

    <Container className="py-6 lg:py-10">
      {!subcategory ? <Breadcrumb items={breadcrumbItems} /> : null}

      {/* Galerie + infos */}
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-10 xl:gap-14">
        <Gallery images={product.images ?? []} alt={product.nom} />
        <div className="mt-8 lg:mt-0 lg:sticky lg:top-24">
          <ProductInfo product={product} />
        </div>
      </div>

      {/* Réassurance horizontale au-dessous de l'image et de la card */}
      <ProductReassuranceBar />

      {/* Onglets */}
      <div className="mt-12 lg:mt-16">
        <ProductTabs product={product} />
      </div>

      {/* Produits similaires */}
      <div className="mt-14 lg:mt-20">
        <Suspense fallback={<ProductGridSkeleton count={4} />}>
          <RelatedProducts
            sousCategorieId={product.sousCategorieId}
            excludeId={product.id}
          />
        </Suspense>
      </div>
    </Container>
    </>
  );
}
