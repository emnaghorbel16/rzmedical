import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  getProductByReference,
  getProducts,
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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://randzmedical.com";

// ── ISR : revalide les pages produit toutes les heures ───────────────────────
export const revalidate = 3600;

// ── Pré-génère toutes les pages produit au build (SSG) ───────────────────────
// Évite le rendu à la demande : Google trouve des pages statiques, rapides
// et immédiatement crawlables.
export async function generateStaticParams() {
  try {
    const result = await getProducts({ limit: 2000 });
    const products = Array.isArray(result) ? result : result.products;
    return products.map((p) => ({
      reference: encodeURIComponent(p.reference),
    }));
  } catch {
    // En cas d'erreur au build, on génère à la demande
    return [];
  }
}

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

  // Description unique : description produit sinon fallback enrichi
  const description =
    product.description?.replace(/<[^>]*>/g, "").trim().slice(0, 160) ||
    `${product.nom}${product.marque?.nom ? ` — ${product.marque.nom}` : ""}. Disponible chez Randz Medical, votre spécialiste en équipement médico-dentaire en Tunisie.`;

  const image = product.images?.[0] ? imageUrl(product.images[0]) : undefined;
  const productUrl = `${siteUrl}/produit/${encodeURIComponent(product.reference)}`;

  // Mots-clés enrichis avec le nom du produit et la marque
  const keywords = [
    product.nom,
    product.marque?.nom,
    product.sousCategorie?.nom,
    product.sousCategorie?.categorie?.nom,
    ...( product.motsCles ?? []),
    "Tunisie",
    "rzmedical",
  ].filter(Boolean) as string[];

  return {
    title: product.nom,
    description,
    keywords,
    openGraph: {
      title: product.nom,
      description,
      type: "website",
      url: productUrl,
      siteName: "Randz Medical",
      locale: "fr_TN",
      images: image
        ? [
            {
              url: image,
              alt: product.nom,
              width: 800,
              height: 800,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: product.nom,
      description,
      images: image ? [image] : undefined,
    },
    alternates: {
      canonical: productUrl,
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

  // ── JSON-LD Schema.org Product (Rich Snippets Google) ─────────────────────
  const productUrl = `${siteUrl}/produit/${encodeURIComponent(product.reference)}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.nom,
    description:
      product.description?.replace(/<[^>]*>/g, "").trim() ||
      `${product.nom} disponible chez Randz Medical.`,
    image: product.images?.map(imageUrl).filter(Boolean),
    sku: product.reference,
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

