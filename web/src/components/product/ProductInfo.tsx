"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Produit } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";
import { formatDate, isExpired } from "@/lib/format";
import { Price } from "@/components/ui/Price";
import { Badge } from "@/components/ui/Badge";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { AddToCartButton } from "@/components/catalogue/AddToCartButton";
import {
  CheckCircleIcon,
  AlertCircleIcon,
  ClockIcon,
  TruckIcon,
  ShieldCheckIcon,
  PackageIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export function ProductInfo({ product }: { product: Produit }) {
  const { isAuthenticated, user } = useAuth();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const remiseClient = mounted && isAuthenticated ? user?.remise ?? 0 : 0;
  const [qty, setQty] = useState(1);

  const outOfStock = !product.disponibleALaVente;
  const lowStock = false;
  const expired = isExpired(product.expirationDate);

  return (
    <div className="flex flex-col">
      {/* Marque + catégorie */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {product.marque?.nom && (
          <Link
            href={`/catalogue?marqueId=${product.marqueId}`}
            className="font-semibold uppercase tracking-wide text-azure-600 transition-colors hover:text-azure-700"
          >
            {product.marque.nom}
          </Link>
        )}
        {product.sousCategorie?.nom && (
          <>
            <span className="text-faint">·</span>
            <Link
              href={`/catalogue?sousCategorieId=${product.sousCategorieId}`}
              className="text-muted transition-colors hover:text-navy-900"
            >
              {product.sousCategorie.nom}
            </Link>
          </>
        )}
      </div>

      {/* Nom */}
      <h1 className="mt-2 text-2xl font-bold leading-tight text-navy-900 sm:text-3xl">
        {product.nom}
      </h1>

      {/* Prix */}
      <div className="mt-5">
        <Price
          prix={product.prix}
          tva={product.tva}
          remise={product.remise}
          remiseClient={remiseClient}
          size="xl"
        />
        <p className="mt-1 text-xs text-faint">Prix TTC en Dinar Tunisien</p>
        {remiseClient > 0 && (
          <Badge variant="accent" size="sm" className="mt-2">
            Votre remise fidélité : -{Math.round(remiseClient)}%
          </Badge>
        )}
      </div>

      {/* Disponibilité */}
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        {outOfStock ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-error">
            <AlertCircleIcon size={18} />
            Rupture de stock
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success-dark">
            <CheckCircleIcon size={18} />
            Disponible à la vente
          </span>
        )}

        {product.expirationDate && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-sm",
              expired ? "font-semibold text-error" : "text-muted",
            )}
          >
            <ClockIcon size={16} />
            {expired ? "Périmé le " : "Péremption : "}
            {formatDate(product.expirationDate)}
          </span>
        )}
      </div>

      {/* Achat */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <QuantityStepper
          value={qty}
          onChange={setQty}
          max={undefined}
          disabled={outOfStock}
          size="md"
        />
        <div className="flex-1">
          <AddToCartButton
            product={product}
            quantity={qty}
            variant="primary"
            size="lg"
            fullWidth
            label="Ajouter au panier"
          />
        </div>
      </div>

      {/* Réassurance */}
      <ul className="mt-6 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:flex-wrap">
        <Reassurance icon={TruckIcon} title="Livraison 24-48h" text="On expédie depuis Sfax dès que vous commandez." />
        <Reassurance icon={ShieldCheckIcon} title="Certifié et traçable" text="Avec son certificat de conformité CE." />
        <Reassurance icon={PackageIcon} title="Emballé avec soin" text="Chaque colis est protégé pour arriver intact." />
      </ul>
    </div>
  );
}

function Reassurance({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-azure-600">
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-navy-900">{title}</span>
        <span className="block text-xs text-muted">{text}</span>
      </span>
    </li>
  );
}
