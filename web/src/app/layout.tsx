import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { Providers } from "@/providers";
import { getCompanyInfo, imageUrl } from "@/lib/api";
import { CompanyProvider } from "@/providers/CompanyProvider";

// Note: Ensure LayoutProps is defined if not imported, or just use { children: React.ReactNode }
type LayoutProps<T = any> = { children: React.ReactNode };

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
  weight: ["400", "500", "600", "700"],
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
  preload: true,
  weight: ["600", "700", "800"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const companyInfo = await getCompanyInfo().catch(() => null);
  const name = companyInfo?.nomSociete || "Randz Medical";

  // Cache busting: on ajoute `?v=timestamp` pour forcer le navigateur à rafraîchir le favicon 
  // si le logo a été mis à jour dans la base de données.
  const version = companyInfo?.misAJourLe ? new Date(companyInfo.misAJourLe).getTime() : Date.now();
  const iconUrl = companyInfo?.logoUrl ? `${imageUrl(companyInfo.logoUrl)}?v=${version}` : "/icon.png";

  return {
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: "./",
    },
    title: {
      default: `${name} — Équipements & consommables médico-dentaires`,
      template: `%s · ${name}`,
    },
    description:
      `Randz Medical (RZMedical), votre partenaire de confiance en Tunisie pour l'équipement médical et dentaire : matériel professionnel, consommables et instruments de marques reconnues, au meilleur prix. Retrouvez tout le catalogue de ${name}.`,
    applicationName: name,
    icons: {
      icon: [
        { url: iconUrl, sizes: "any" },
      ],
      shortcut: iconUrl,
      apple: iconUrl,
    },
    keywords: [
      "matériel médical",
      "équipement dentaire",
      "consommables médicaux",
      "instruments dentaires",
      "Tunisie",
      "rzmedical",
      "randzmedical",
      "randz medical",
      name,
    ],
    authors: [{ name }],
    openGraph: {
      type: "website",
      locale: "fr_TN",
      siteName: name,
      title: `${name} — Équipements & consommables médico-dentaires`,
      description:
        "Votre partenaire de confiance en Tunisie pour l'équipement médical et dentaire professionnel.",
      url: siteUrl,
    },
    robots: { index: true, follow: true },
    verification: {
      google: "0x5_Sk4D3lUqOUHxZOwO8ri42S5GXSaRS3FVBapaWZE",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0c2340",
  width: "device-width",
  initialScale: 1,
};


export default async function RootLayout({ children }: LayoutProps<"/">) {
  const companyInfo = await getCompanyInfo().catch(() => null);

  return (
    <html
      lang="fr"
      className={`${inter.variable} ${sora.variable} h-full antialiased`}
    >
      <head>
        {/* Preconnect pour les ressources critiques */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://flagcdn.com" />

        {/* Google Tag Manager — balise Google (nouveau format) */}
        <script
          async
          src="https://www.googletagmanager.com/gtm.js?id=GTM-TCD5B69T"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
            `,
          }}
        />

        {/* Google Analytics GA4 — configuration */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-8KYNSN9MQP"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-8KYNSN9MQP');
            `,
          }}
        />
      </head>

      {/* JSON-LD — Organisation & MedicalBusiness (référencement local Google) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": ["MedicalBusiness", "Organization"],
                "@id": `${siteUrl}/#organization`,
                name: "Randz Medical",
                alternateName: ["RZMedical", "rzmedical"],
                url: siteUrl,
                logo: `${siteUrl}/icon.png`,
                telephone: "+21628113131",
                email: "randzmedical@outlook.com",
                address: {
                  "@type": "PostalAddress",
                  addressCountry: "TN",
                  addressLocality: "Tunis",
                  addressRegion: "Tunis",
                },
                openingHoursSpecification: [
                  {
                    "@type": "OpeningHoursSpecification",
                    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                    opens: "08:30",
                    closes: "18:00",
                  },
                ],
                sameAs: [],
                description:
                  "Distributeur de matériel médical et dentaire professionnel en Tunisie. Équipements certifiés, consommables et instruments de marques reconnues. Livraison rapide sur tout le territoire tunisien.",
                priceRange: "$$",
                currenciesAccepted: "TND",
                paymentAccepted: "Cash, Virement bancaire",
                areaServed: {
                  "@type": "Country",
                  name: "Tunisie",
                },
              },
              {
                "@type": "WebSite",
                "@id": `${siteUrl}/#website`,
                url: siteUrl,
                name: "Randz Medical",
                publisher: { "@id": `${siteUrl}/#organization` },
                potentialAction: {
                  "@type": "SearchAction",
                  target: {
                    "@type": "EntryPoint",
                    urlTemplate: `${siteUrl}/catalogue?q={search_term_string}`,
                  },
                  "query-input": "required name=search_term_string",
                },
                inLanguage: "fr-TN",
              },
            ],
          }),
        }}
      />
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* Google Tag Manager — fallback noscript (début du <body>) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-TCD5B69T"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>

        <CompanyProvider initialData={companyInfo}>
          <Providers>{children}</Providers>
        </CompanyProvider>
      </body>
    </html>
  );
}
