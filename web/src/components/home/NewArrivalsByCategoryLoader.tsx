import { getVisibleCategories, getNewProductsByCategory } from "@/lib/api";
import { NewArrivalsByCategory } from "./NewArrivalsByCategory";

/**
 * Server Component non bloquant (Suspense) qui charge les données
 * et délègue l'affichage et l'interactivité à NewArrivalsByCategory (client).
 */
export async function NewArrivalsByCategoryLoader() {
  try {
    const categories = await getVisibleCategories();
    const data = await getNewProductsByCategory(categories, 10);
    if (data.length === 0) return null;
    return <NewArrivalsByCategory data={data} />;
  } catch {
    return null; // section non essentielle
  }
}
