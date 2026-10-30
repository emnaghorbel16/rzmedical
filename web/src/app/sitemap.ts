import type { MetadataRoute } from "next";
import { getVisibleCategories, getSubcategories, getProducts } from "@/lib/api";
import { toSlug } from "@/lib/slug";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://randzmedical.com";

  // Routes statiques principales
  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/catalogue`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/marques`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/a-propos`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/support`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  try {
    // 1. Pages de catégories (ex: /nom-categorie)
    const categories = await getVisibleCategories();
    categories.forEach((cat) => {
      routes.push({
        url: `${baseUrl}/${toSlug(cat.nom)}`,
        lastModified: cat.misAJourLe ? new Date(cat.misAJourLe) : new Date(),
        changeFrequency: "weekly",
        priority: 0.85,
      });
    });

    // 3. Pages de produits — on inclut TOUS les produits (même en rupture)
    // Les produits en rupture restent indexés → pas de perte de ranking quand
    // ils reviennent en stock.
    const paginatedProducts = await getProducts({ page: 1, limit: 2000 });
    const productsList = Array.isArray(paginatedProducts)
      ? paginatedProducts
      : paginatedProducts.products;

    productsList.forEach((prod) => {
      routes.push({
        url: `${baseUrl}/produit/${encodeURIComponent(prod.reference)}`,
        lastModified: prod.misAJourLe ? new Date(prod.misAJourLe) : new Date(),
        changeFrequency: "weekly",
        // Priorité réduite pour les produits indisponibles
        priority: prod.disponibleALaVente ? 0.8 : 0.4,
      });
    });
  } catch (err) {
    console.error("Erreur lors de la génération du sitemap:", err);
  }

  return routes;
}
