"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Produit } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";
import { formatDate, isExpired, hasDiscount, isRecent } from "@/lib/format";
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
  TagIcon,
  SparklesIcon,
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
  const isNew = !promo && isRecent(product.creeLe);

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      {/* ── En-tête : Marque (avec logo) & Pays d'origine ───────── */}
      {(product.marque || product.paysFabrication) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          {/* Logo & nom de la marque */}
          {product.marque && (
            <Link
              href={`/catalogue?marqueId=${product.marqueId}`}
              className="group flex items-center gap-2.5 transition-opacity hover:opacity-85"
              title={`Voir tous les produits de ${product.marque.nom}`}
            >
              {product.marque.logo ? (
                <div className="relative h-11 w-28 shrink-0 overflow-hidden rounded-lg border border-slate-200/80 bg-white p-1.5 shadow-2xs">
                  <Image
                    src={imageUrl(product.marque.logo)}
                    alt={product.marque.nom}
                    fill
                    sizes="112px"
                    unoptimized
                    className="object-contain transition-transform duration-200 group-hover:scale-105"
                  />
                </div>
              ) : (
                <div className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-3 text-azure-700 shadow-2xs font-bold text-xs uppercase tracking-wider">
                  <AwardIcon size={16} />
                  <span>{product.marque.nom}</span>
                </div>
              )}
            </Link>
          )}

          {/* Pays de fabrication avec drapeau */}
          {product.paysFabrication && (
            <div
              className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 shadow-2xs"
              title={`Fabriqué en ${product.paysFabrication}`}
            >
              {countryCode ? (
                <img
                  src={`https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`}
                  alt={product.paysFabrication}
                  className="h-auto w-6 rounded-[2px] shadow-2xs"
                />
              ) : (
                <span className="text-base">🌍</span>
              )}
              <span className="text-[12px] font-bold text-navy-900">
                {product.paysFabrication}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Badges supérieurs & Réf ───────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {promo && (
            <Badge variant="promo" size="sm" className="font-bold uppercase tracking-wider">
              Promo -{Math.round(parseFloat(product.remise))}%
            </Badge>
          )}
          {isNew && (
            <Badge variant="new" size="sm" className="font-bold uppercase tracking-wider">
              Nouveau
            </Badge>
          )}
          {outOfStock ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-600 border border-rose-200">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              Rupture
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              En stock
            </span>
          )}
        </div>

        {product.reference && (
          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-500 bg-slate-100/80 border border-slate-200/70 px-2.5 py-1 rounded-md">
            <TagIcon size={12} className="text-azure-600" />
            RÉF: <strong className="text-navy-900">{product.reference}</strong>
          </span>
        )}
      </div>

      {/* ── Nom du produit ───────────────────────────────────── */}
      <h1 className="mt-3 text-2xl font-extrabold leading-tight text-navy-900 sm:text-3xl">
        {product.nom}
      </h1>

      {/* ── Bloc Caractéristiques (au-dessus du prix) ──────────── */}
      <div className="mt-5 mb-5 rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50/90 via-slate-50/40 to-azure-50/30 p-4">
        <div className="mb-3 flex items-center justify-between border-b border-slate-200/60 pb-2">
          <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            <SparklesIcon size={13} className="text-azure-600" />
            Caractéristiques du produit
          </span>
          <span className="text-[10px] font-bold text-azure-600 bg-azure-50 border border-azure-100 px-2 py-0.5 rounded-full">
            Certifié Pro
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Marque */}
          {product.marque?.nom && (
            <div className="flex items-center gap-2.5 rounded-lg border border-slate-200/70 bg-white p-2.5 shadow-2xs transition-all hover:border-azure-300">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-azure-50 text-azure-600">
                {product.marque.logo ? (
                  <div className="relative h-6 w-6">
                    <Image
                      src={imageUrl(product.marque.logo)}
                      alt={product.marque.nom}
                      fill
                      sizes="24px"
                      unoptimized
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <AwardIcon size={16} />
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

          {/* Origine / Pays de fabrication */}
          {product.paysFabrication && (
            <div className="flex items-center gap-2.5 rounded-lg border border-slate-200/70 bg-white p-2.5 shadow-2xs">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-50 border border-slate-200/60 overflow-hidden">
                {countryCode ? (
                  <img
                    src={`https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`}
                    alt={product.paysFabrication}
                    className="w-5 h-auto rounded-[2px]"
                  />
                ) : (
                  <span className="text-sm">🌍</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Pays d&apos;origine
                </span>
                <span className="truncate text-[13px] font-bold text-navy-900 block">
                  {product.paysFabrication}
                </span>
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
