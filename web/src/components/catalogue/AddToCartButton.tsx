"use client";

import { useCallback, useRef, useState } from "react";
import type { Produit } from "@/lib/types";
import { parsePrice } from "@/lib/format";
import { useCart, type AddItemInput } from "@/providers/CartProvider";
import { useToast } from "@/providers/ToastProvider";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { CartIcon, CheckIcon, PackageIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

function toCartItem(product: Produit): AddItemInput {
  return {
    produitId: product.id,
    reference: product.reference,
    nom: product.nom,
    image: product.images?.[0] ?? null,
    prix: parsePrice(product.prix),
    tva: parsePrice(product.tva),
    remise: parsePrice(product.remise),
    stock: product.stock,
    disponible: product.disponible,
    disponibleALaVente: product.disponibleALaVente,
  };
}

interface Props {
  product: Produit;
  quantity?: number;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  iconOnly?: boolean;
  label?: string;
  openDrawerOnAdd?: boolean;
  className?: string;
  onAdded?: () => void;
}

/**
 * Ajout au panier premium avec micro-interaction avancée.
 * Le panier étant côté client, l'ajout est instantané (pas d'état de chargement).
 */
export function AddToCartButton({
  product,
  quantity = 1,
  variant = "secondary",
  size = "md",
  fullWidth = false,
  iconOnly = false,
  label = "Ajouter",
  openDrawerOnAdd = true,
  className,
  onAdded,
}: Props) {
  const { addItem, openCart } = useCart();
  const toast = useToast();
  const [added, setAdded] = useState(false);
  const timer = useRef<number | null>(null);

  const outOfStock = !product.disponibleALaVente;

  const handleAdd = useCallback(() => {
    if (outOfStock) return;
    addItem(toCartItem(product), quantity);
    toast.success(`« ${product.nom} » ajouté au panier`);
    if (openDrawerOnAdd) openCart();
    onAdded?.();

    setAdded(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAdded(false), 1500);
  }, [
    outOfStock,
    addItem,
    product,
    quantity,
    toast,
    openDrawerOnAdd,
    openCart,
    onAdded,
  ]);

  if (iconOnly) {
    return (
      <IconButton
        label={outOfStock ? "Indisponible" : label}
        variant="solid"
        size={size === "lg" ? "lg" : "md"}
        onClick={handleAdd}
        disabled={outOfStock}
        className={cn(
          added && "bg-success/90 hover:bg-success/80 transition-all duration-300 transform hover:scale-[1.05]",
          className
        )}
      >
        {added ? <CheckIcon size={18} className="rotate-[15deg] animate-[bounce-slow_3s_ease-in-out_infinite]" /> : <CartIcon size={18} />}
      </IconButton>
    );
  }

  return (
    <Button
      variant={added ? "success" : variant}
      size={size}
      fullWidth={fullWidth}
      onClick={handleAdd}
      disabled={outOfStock}
      className={cn(
        "relative overflow-hidden",
        added && "bg-success/90 text-success/90 hover:bg-success/80 hover:text-success/100",
        !added && "transition-all duration-400 ease-in-out",
        "hover:-translate-y-[1px] hover:shadow-md",
        "active:scale-[0.98]",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {outOfStock ? (
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-warning-dark">
            <PackageIcon size={16} className="animate-pulse-slow" />
            Rupture de stock
          </span>
        ) : added ? (
          <>
            <CheckIcon size={18} className="rotate-[10deg] animate-[badge-bump_0.42s_ease-out-soft]" />
            <span className="flex-1">Ajouté</span>
            <CartIcon size={16} className="ml-2 animate-[spin-slow_12s_linear_infinite] opacity-70" />
          </>
        ) : (
          <>
            <CartIcon size={18} className="transition-transform duration-300 group-hover:translate-x-0.5" />
            <span className="flex-1">{label}</span>
          </>
        )}
      </div>

    </Button>
  );
}
