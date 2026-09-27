import { getNewProducts } from "@/lib/api";
import { Container } from "@/components/ui/Container";
import { ProductRail } from "@/components/catalogue/ProductRail";
import { SectionHeading } from "./SectionHeading";
import { ArrowRightIcon } from "@/components/ui/icons";

/** Derniers produits ajoutés au catalogue. Section non bloquante (Suspense). */
export async function NewArrivals() {
  let products;
  try {
    products = await getNewProducts(8);
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
      <ProductRail products={products.slice(0, 8)} className="[scrollbar-color:theme(colors.azure.500)_transparent]" />
    </Container>
  );
}
