import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  getProductByReference,
  getSubcategories,
  getVisibleCategories,
  getProductReviews,
  imageUrl,
} from "@/lib/api";
import { toSlug, findCategoryBySlug } from "@/lib/slug";
import { Container } from "@/components/ui/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SubcategoryBanner } from "@/components/catalogue/SubcategoryBanner";
import { Gallery } from "@/components/product/Gallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { ProductReassuranceBar } from "@/components/product/ProductReassuranceBar";
import { ProductTabs } from "@/components/product/ProductTabs";
import { ProductReviews } from "@/components/product/ProductReviews";
import { RelatedProducts } from "@/components/product/RelatedProducts";
import { ProductGridSkeleton } from "@/components/catalogue/ProductGrid";

type Params = Promise<{ category: string; ref: string }>;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://randzmedical.com";

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { ref } = await params;
  const product = await getProductByReference(decodeURIComponent(ref));

  if (!product) {
    return { title: "Produit introuvable" };
  }

  const description =
    product.description?.slice(0, 160) ||
    `${product.nom} — ${product.marque?.nom ?? "matériel médical"} disponible chez RZmedical.`;
  const image = product.images?.[0] ? imageUrl(product.images[0]) : undefined;
  const productCanonical = `${siteUrl}/produit/${encodeURIComponent(product.reference)}`;

  return {
    title: product.nom,
    description,
    openGraph: {
      title: product.nom,
      description,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    alternates: {
      canonical: productCanonical,
    },
  };
}

export default async function CategoryProductPage({ params }: { params: Params }) {
  const { category: catSlug, ref } = await params;
  const product = await getProductByReference(decodeURIComponent(ref));
  if (!product) notFound();

  const [subcategories, categories, avisSummary] = await Promise.all([
    getSubcategories(),
    getVisibleCategories(),
    getProductReviews(product.id).catch(() => null),
  ]);

  const category = findCategoryBySlug(categories, catSlug);
  if (!category) notFound();

  const subcategory =
    product.sousCategorie ??
    subcategories.find((s) => s.id === product.sousCategorieId);

  // Même source d'image que le catalogue (liste sous-catégories).
  const bannerImage =
    subcategory?.image ??
    subcategories.find((s) => s.id === product.sousCategorieId)?.image ??
    null;

  const breadcrumbItems: { label: string; href?: string }[] = [
    { label: category.nom, href: `/${catSlug}` },
  ];
  if (subcategory) {
    breadcrumbItems.push({
      label: subcategory.nom,
      href: `/${catSlug}/sous-categories/${toSlug(subcategory.nom)}`,
    });
  }
  breadcrumbItems.push({ label: product.nom });

  // ── JSON-LD Schema.org Product (Rich Snippets Google) ─────────────────────
  const productUrl = `${siteUrl}/produit/${encodeURIComponent(product.reference)}`;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.nom,
    description:
      (product.description
        ? product.description
            .replace(/\[\/?(?:red|blue|green)\]/g, "")
            .replace(/[*_]/g, "")
            .replace(/<[^>]*>/g, "")
            .replace(/\s+/g, " ")
            .trim()
        : "") || `${product.nom} disponible chez Randz Medical.`,
    image: product.images?.map(imageUrl).filter(Boolean),
    sku: product.reference,
    url: productUrl,
    ...(product.marque?.nom && {
      brand: { "@type": "Brand", name: product.marque.nom },
    }),
    ...(product.sousCategorie?.nom && {
      category: product.sousCategorie.nom,
    }),
    offers: {
      "@type": "Offer",
      url: productUrl,
      price: parseFloat(product.prix).toFixed(3),
      priceCurrency: "TND",
      availability: product.disponibleALaVente
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: "Randz Medical",
      },
    },
    ...(avisSummary && avisSummary.totalAvis > 0 && avisSummary.notemoyenne !== null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: avisSummary.notemoyenne.toFixed(1),
            reviewCount: avisSummary.totalAvis,
            bestRating: "5",
            worstRating: "1",
          },
          review: avisSummary.avis.slice(0, 5).map((a) => ({
            "@type": "Review",
            author: { "@type": "Person", name: a.nomAuteur },
            reviewRating: {
              "@type": "Rating",
              ratingValue: a.note,
              bestRating: "5",
              worstRating: "1",
            },
            reviewBody: a.commentaire,
            datePublished: new Date(a.creeLe).toISOString().split("T")[0],
          })),
        }
      : {}),
  };

  return (
    <>
      {/* Données structurées JSON-LD pour Google Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

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

        {/* Avis et Témoignages */}
        <ProductReviews produitId={product.id} initialStats={avisSummary} />

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
