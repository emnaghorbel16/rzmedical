import { getNewProducts } from "@/lib/api";
import { Container } from "@/components/ui/Container";
import { ProductCarousel } from "@/components/catalogue/ProductCarousel";
import { SectionHeading } from "./SectionHeading";

/** Derniers produits ajoutés au catalogue. Section non bloquante (Suspense). */
export async function NewArrivals() {
  let products;
  try {
    products = await getNewProducts(10);
  } catch {
    return null; // section non essentielle : on l'omet si le backend échoue
  }

  if (products.length === 0) return null;

  return (
    <Container className="py-14 lg:py-20">
      <SectionHeading
        eyebrow="Sélection"
        title="Nouveautés"
        description="Les dernières références ajoutées à notre catalogue."
        href="/catalogue?filter=new"
      />
      <ProductCarousel products={products.slice(0, 10)} className="[scrollbar-color:theme(colors.azure.500)_transparent]" />
    </Container>
  );
}
