import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import Script from "next/script";
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
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const companyInfo = await getCompanyInfo().catch(() => null);
  const name = companyInfo?.nomSociete || "RZMedical" || "randz medical" || "randzmedical";

  // Cache busting: on ajoute `?v=timestamp` pour forcer le navigateur à rafraîchir le favicon 
  // si le logo a été mis à jour dans la base de données.
  const version = companyInfo?.misAJourLe ? new Date(companyInfo.misAJourLe).getTime() : Date.now();
  const iconUrl = companyInfo?.logoUrl ? `${imageUrl(companyInfo.logoUrl)}?v=${version}` : "/icon.png";

  return {
    metadataBase: new URL(siteUrl),
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
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-8KYNSN9MQP"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-8KYNSN9MQP');
          `}
        </Script>
        <CompanyProvider initialData={companyInfo}>
          <Providers>{children}</Providers>
        </CompanyProvider>
      </body>
    </html>
  );
}
