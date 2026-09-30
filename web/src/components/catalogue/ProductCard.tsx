"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Produit } from "@/lib/types";
import { imageUrl } from "@/lib/api";
import { hasDiscount, isRecent } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Price } from "@/components/ui/Price";
import { PackageIcon } from "@/components/ui/icons";
import { AddToCartButton } from "./AddToCartButton";
import { useAuth } from "@/providers/AuthProvider";
import { useCategory } from "@/providers/CategoryProvider";
import { useWishlist } from "@/providers/WishlistProvider";
import { getCountryFlag } from "@/lib/countryFlag";
import { cn } from "@/lib/cn";

const IMAGE_SIZES =
  "(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw";

export function ProductCard({
  product,
  className,
  priority = false,
}: {
  product: Produit;
  className?: string;
  priority?: boolean;
}) {
  const { isAuthenticated, user } = useAuth();
  const { toggle, has } = useWishlist();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch by only applying the client discount after the component has mounted on the client
  const remiseClient = mounted && isAuthenticated ? user?.remise ?? 0 : 0;
  
  const { categorySlug } = useCategory();
  
  const href = mounted && categorySlug 
    ? `/${categorySlug}/produits/${encodeURIComponent(product.reference)}`
    : `/produit/${encodeURIComponent(product.reference)}`;
    
  const image = product.images?.[0];
  const outOfStock = !product.disponibleALaVente;
  const promo = hasDiscount(product.remise);
  const isNew = !promo && isRecent(product.creeLe);
  const inStock = !outOfStock;


  return (
    <article
      className={cn(
        "bg-white border border-slate-200/60 shadow-sm hover:shadow-md hover:border-slate-300 hover:-translate-y-1 transition-all duration-300 group relative flex flex-col overflow-hidden rounded-[12px]",
        className,
      )}
    >
      {/* Image area */}
      <Link
        href={href}
        className="relative block aspect-[4/3] overflow-hidden bg-slate-50 border-b border-slate-100"
        aria-label={product.nom}
      >
        {image ? (
          <Image
            src={imageUrl(image)}
            alt={product.nom}
            fill
            sizes={IMAGE_SIZES}
            preload={priority}
            className={cn(
              "object-contain p-5 transition-transform duration-500 ease-out group-hover:scale-[1.03]",
              outOfStock && "opacity-40 grayscale",
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <PackageIcon size={48} strokeWidth={1} />
          </div>
        )}

        {/* Top-Left Badges */}
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5 z-20">
          {promo && (
            <Badge variant="promo" size="sm" className="rounded font-bold text-[10px] tracking-wide uppercase px-2 py-0.5">Promotion</Badge>
          )}
          {isNew && (
            <Badge variant="new" size="sm" className="rounded font-bold text-[10px] tracking-wide uppercase px-2 py-0.5">Nouveau</Badge>
          )}
        </div>
        
        {/* Top-Right: Flag or Wishlist */}
        {(() => {
          const flag = getCountryFlag(product.paysFabrication);
          if (flag) {
            return (
              <div
                className="absolute right-3 top-3 z-20 flex items-center justify-center w-8 h-8 rounded-md bg-white/80 backdrop-blur-sm shadow-sm border border-slate-100/70 text-lg leading-none select-none"
                title={product.paysFabrication ?? ""}
                aria-label={`Fabriqué en ${product.paysFabrication}`}
              >
                {flag}
              </div>
            );
          }
          return (
            <button
              className={cn(
                "absolute right-3 top-3 z-20 p-1.5 transition-all duration-200 bg-white/70 hover:bg-white backdrop-blur-sm rounded-full shadow-sm border",
                mounted && has(product.id)
                  ? "text-red-500 border-red-200 scale-110"
                  : "text-slate-400 border-slate-100/50 hover:text-red-500 hover:border-red-100 hover:scale-110"
              )}
              aria-label={mounted && has(product.id) ? "Retirer des favoris" : "Ajouter aux favoris"}
              aria-pressed={mounted && has(product.id)}
              onClick={(e) => {
                e.preventDefault();
                toggle(product.id);
              }}
            >
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill={mounted && has(product.id) ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="transition-all duration-200"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          );
        })()}

        {outOfStock && (
          <div className="absolute inset-x-0 bottom-0 bg-slate-900/90 backdrop-blur-sm py-1.5 text-center text-[11px] font-bold text-white tracking-wide z-20">
            Épuisé pour l'instant
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        {/* Brand & Reference */}
        <div className="flex items-center justify-between mb-1.5 gap-2">
          {product.marque?.nom ? (
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {product.marque.nom}
            </p>
          ) : (
            <div />
          )}
          <p className="text-[10px] font-medium text-slate-400 truncate">
            Réf: {product.reference}
          </p>
        </div>

        {/* Title */}
        <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug text-slate-800 group-hover:text-azure-700 transition-colors duration-200">
          <Link href={href} className="after:absolute after:inset-0 after:content-['']">
            {product.nom}
          </Link>
        </h3>

        {/* Status Indicators */}
        <div className="mt-2 flex items-center gap-2">
           {inStock && (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              En stock
            </span>
          )}
        </div>

        {/* Price & Cart Area */}
        <div className="mt-auto pt-4 flex items-end justify-between gap-3">
          <Price prix={product.prix} tva={product.tva} remise={product.remise} remiseClient={remiseClient} size="md" className="whitespace-nowrap" />
        </div>

        {/* CTA */}
        <div className="relative z-10 mt-4">
          <AddToCartButton
            product={product}
            size="md"
            fullWidth
            label="Ajouter au panier"
            className="!bg-navy-900 !text-white hover:!bg-navy-800 !shadow-none !border-0 !rounded-lg !font-semibold transition-colors duration-200"
          />
        </div>
      </div>
    </article>
  );
}
