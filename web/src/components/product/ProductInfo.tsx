"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Produit } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";
import { formatDate, isExpired, hasDiscount } from "@/lib/format";
import { getCountryCode } from "@/lib/countryFlag";
import { imageUrl } from "@/lib/api";
import { Price } from "@/components/ui/Price";
import { Badge } from "@/components/ui/Badge";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { AddToCartButton } from "@/components/catalogue/AddToCartButton";
import {
  CheckCircleIcon,
  AlertCircleIcon,
  ClockIcon,
  PackageIcon,
  AwardIcon,
  FileTextIcon,
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
  const expired = isExpired(product.expirationDate);
  const countryCode = getCountryCode(product.paysFabrication);
  const promo = hasDiscount(product.remise);

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      {/* ── Badge Promo (si promotion active) ────────────────── */}
      {promo && (
        <div className="mb-2.5">
          <Badge variant="promo" size="sm" className="font-bold uppercase tracking-wider">
            Promo -{Math.round(parseFloat(product.remise))}%
          </Badge>
        </div>
      )}

      {/* ── Nom du produit ───────────────────────────────────── */}
      <h1 className="text-2xl font-extrabold leading-tight text-navy-900 sm:text-3xl">
        {product.nom}
      </h1>

      {/* ── Bloc Caractéristiques (au-dessus du prix) ──────────── */}
      <div className="mt-5 mb-5 rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50/90 via-slate-50/40 to-azure-50/30 p-4">
        <div className="mb-3 flex items-center justify-between border-b border-slate-200/60 pb-2">
          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            Caractéristiques du produit
          </span>
          <span className="text-[10px] font-bold text-azure-600 bg-azure-50 border border-azure-100 px-2 py-0.5 rounded-full">
            Certifié Pro
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Marque (avec logo à la place de l'icône générique) */}
          {product.marque?.nom && (
            <div className="flex items-center gap-2.5 rounded-lg border border-slate-200/70 bg-white p-2.5 shadow-2xs transition-all hover:border-azure-300">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white border border-slate-200/80 p-0.5 overflow-hidden shadow-2xs">
                {product.marque.logo ? (
                  <img
                    src={imageUrl(product.marque.logo)}
                    alt={product.marque.nom}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-[11px] font-black text-azure-600">
                    {product.marque.nom.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Marque
                </span>
                <Link
                  href={`/catalogue?marqueId=${product.marqueId}`}
                  className="truncate text-[13px] font-bold text-navy-900 hover:text-azure-600 block transition-colors"
                >
                  {product.marque.nom}
                </Link>
              </div>
            </div>
          )}

          {/* Pays (drapeau comme icône + nom du pays) */}
          {product.paysFabrication && (
            <div className="flex items-center gap-2.5 rounded-lg border border-slate-200/70 bg-white p-2.5 shadow-2xs">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-50 border border-slate-200/80 p-0.5 overflow-hidden shadow-2xs">
                {countryCode ? (
                  <img
                    src={`https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`}
                    alt={product.paysFabrication}
                    className="h-auto w-5 object-contain rounded-[2px]"
                  />
                ) : (
                  <span className="text-sm">🌍</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Pays
                </span>
                <span className="truncate text-[13px] font-bold text-navy-900 block">
                  {product.paysFabrication}
                </span>
              </div>
            </div>
          )}

          {/* Sous-catégorie */}
          {product.sousCategorie?.nom && (
            <div className="flex items-center gap-2.5 rounded-lg border border-slate-200/70 bg-white p-2.5 shadow-2xs transition-all hover:border-azure-300">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-navy-50 text-navy-700">
                <PackageIcon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Sous-catégorie
                </span>
                <Link
                  href={`/catalogue?sousCategorieId=${product.sousCategorieId}`}
                  className="truncate text-[13px] font-bold text-navy-900 hover:text-azure-600 block transition-colors"
                >
                  {product.sousCategorie.nom}
                </Link>
              </div>
            </div>
          )}

          {/* Disponibilité */}
          <div className="flex items-center gap-2.5 rounded-lg border border-slate-200/70 bg-white p-2.5 shadow-2xs">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                outOfStock ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
              )}
            >
              {outOfStock ? <AlertCircleIcon size={16} /> : <CheckCircleIcon size={16} />}
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Disponibilité
              </span>
              <span
                className={cn(
                  "truncate text-[13px] font-bold block",
                  outOfStock ? "text-rose-600" : "text-emerald-700"
                )}
              >
                {outOfStock ? "Rupture de stock" : "Disponible à la vente"}
              </span>
            </div>
          </div>

          {/* Date de péremption si applicable */}
          {product.expirationDate && (
            <div className="flex items-center gap-2.5 rounded-lg border border-slate-200/70 bg-white p-2.5 shadow-2xs">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                  expired ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-600"
                )}
              >
                <ClockIcon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {expired ? "Date dépassée" : "Péremption"}
                </span>
                <span
                  className={cn(
                    "truncate text-[13px] font-bold block",
                    expired ? "text-rose-600 font-black" : "text-navy-900"
                  )}
                >
                  {formatDate(product.expirationDate)}
                </span>
              </div>
            </div>
          )}

          {/* Fiche technique */}
          {product.ficheTechnique && (
            <div className="flex items-center gap-2.5 rounded-lg border border-slate-200/70 bg-white p-2.5 shadow-2xs transition-all hover:border-azure-300">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-azure-50 text-azure-600">
                <FileTextIcon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Documentation
                </span>
                <a
                  href={imageUrl(product.ficheTechnique)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-[13px] font-bold text-azure-600 hover:text-azure-700 block underline"
                >
                  Fiche technique (PDF)
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Prix ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-azure-100 bg-gradient-to-r from-azure-50/40 via-white to-transparent p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Price
            prix={product.prix}
            tva={product.tva}
            remise={product.remise}
            remiseClient={remiseClient}
            size="xl"
          />
          {product.tva && (
            <span className="text-[12px] font-semibold text-slate-500">
              TVA {Math.round(parseFloat(product.tva))}% incluse
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-400 font-medium">Prix unitaire TTC en Dinar Tunisien (TND)</p>
        {remiseClient > 0 && (
          <Badge variant="accent" size="sm" className="mt-2 font-bold">
            Votre remise fidélité appliquée : -{Math.round(remiseClient)}%
          </Badge>
        )}
      </div>

      {/* ── Achat ────────────────────────────────────────────── */}
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
    </div>
  );
}
