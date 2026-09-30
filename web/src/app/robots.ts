import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://randzmedical.com";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/", 
        "/compte/", 
        "/commande/", 
        "/panier/", 
        "/connexion/", 
        "/inscription/", 
        "/mot-de-passe-oublie/", 
        "/reinitialiser-mot-de-passe/"
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
