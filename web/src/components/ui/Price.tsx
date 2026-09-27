import { cn } from "@/lib/cn";
import { parsePrice, clientPrice, formatTND } from "@/lib/format";
import { Badge } from "./Badge";

type PriceSize = "sm" | "md" | "lg" | "xl";

const CURRENT_SIZE: Record<PriceSize, string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
  xl: "text-[2rem] leading-tight",
};

/**
 * Affiche le prix courant, le prix barré et le badge -X% le cas échéant.
 * `remise` = remise produit (%). `remiseClient` = remise personnelle du client (%),
 * à passer uniquement quand l'utilisateur est connecté (page produit / panier).
 */
export function Price({
  prix,
  remise = 0,
  remiseClient = 0,
  size = "md",
  showBadge = true,
  className,
}: {
  prix: string | number;
  tva?: string | number;
  remise?: string | number;
  remiseClient?: string | number;
  size?: PriceSize;
  showBadge?: boolean;
  className?: string;
}) {
  const tvaRate = parsePrice(tva);
  const baseHT = parsePrice(prix);
  const baseTTC = baseHT * (1 + tvaRate / 100);
  
  const currentHT = clientPrice(prix, remise, remiseClient);
  const currentTTC = currentHT * (1 + tvaRate / 100);
  
  const discounted = baseTTC > 0 && currentTTC < baseTTC - 0.0001;
  const pct = discounted ? Math.round((1 - currentTTC / baseTTC) * 100) : 0;

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
      <span
        className={cn(
          "font-display font-bold tabular-nums text-navy-900",
          CURRENT_SIZE[size],
        )}
      >
        {formatTND(currentTTC)}
      </span>
      {discounted && (
        <>
          <span className="text-sm text-faint line-through tabular-nums">
            {formatTND(baseTTC)}
          </span>
          {showBadge && pct > 0 && (
            <Badge variant="promo" size="sm">
              -{pct}%
            </Badge>
          )}
        </>
      )}
    </div>
  );
}
