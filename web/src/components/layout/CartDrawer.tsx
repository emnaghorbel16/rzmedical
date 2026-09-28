"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/providers/CartProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { imageUrl } from "@/lib/api";
import { discountedPrice, clientPrice, formatTND } from "@/lib/format";
import { buttonVariants } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import {
  CartIcon,
  PackageIcon,
  TrashIcon,
  XIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/** Tiroir panier coulissant premium — light glass style. */
export function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    setQuantity,
    removeItem,
    subtotal,
    count,
    isEmpty,
  } = useCart();
  const { isAuthenticated, user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const ref = useFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, closeCart]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[100]",
        isOpen ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!isOpen}
    >
      {/* Backdrop */}
      <div
        onClick={closeCart}
        className={cn(
          "absolute inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Drawer panel */}
      <aside
        ref={ref}
        role="dialog"
        aria-modal={isOpen || undefined}
        aria-label="Panier"
        tabIndex={-1}
        className={cn(
          "absolute right-0 top-0 flex h-full w-full max-w-[420px] flex-col outline-none transition-transform duration-350 ease-out-quint will-change-transform",
          "bg-white/95 backdrop-blur-2xl border-l border-white/40",
          "shadow-[-20px_0_80px_rgba(0,0,0,0.1)]",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Left edge azure line */}
        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-azure-500/60 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 className="flex items-center gap-2.5 text-[15px] font-bold text-navy-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-azure-50 border border-azure-200 text-azure-600">
              <CartIcon size={16} />
            </span>
            Votre panier
            {count > 0 && (
              <span className="inline-flex items-center rounded-full bg-azure-50 border border-azure-200 px-2 py-0.5 text-[11px] font-bold text-azure-600">
                {count} article{count > 1 ? "s" : ""}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Fermer le panier"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition-all hover:bg-slate-100 hover:text-navy-900 hover:border-slate-300"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Content */}
        {isEmpty ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="text-center">
              {/* Floating icon with glow */}
              <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-azure-100 animate-glow-pulse" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                  <CartIcon size={28} className="text-slate-400" />
                </div>
              </div>
              <p className="text-base font-bold text-navy-900 mb-2">Votre panier est vide</p>
              <p className="text-[13px] text-slate-500 leading-relaxed mb-6">
                Parcourez notre catalogue et ajoutez vos produits.
              </p>
              <Link
                href="/catalogue"
                onClick={closeCart}
                className={buttonVariants({ variant: "accent", size: "md" })}
              >
                Voir le catalogue
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto px-5 divide-y divide-slate-100">
              {items.map((item) => {
                const unitHT = clientPrice(item.prix, item.remise, isAuthenticated ? user?.remise ?? 0 : 0);
                const unit = unitHT;
                const outOfStock = !item.disponibleALaVente;
                return (
                  <li key={item.produitId} className="flex gap-3 py-4">
                    {/* Image */}
                    <Link
                      href={`/produit/${encodeURIComponent(item.reference)}`}
                      onClick={closeCart}
                      className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:border-azure-300 shadow-sm"
                    >
                      {item.image ? (
                        <Image
                          src={imageUrl(item.image)}
                          alt={item.nom}
                          fill
                          sizes="72px"
                          className="object-contain p-1.5"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-slate-300">
                          <PackageIcon size={24} strokeWidth={1.25} />
                        </span>
                      )}
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <Link
                        href={`/produit/${encodeURIComponent(item.reference)}`}
                        onClick={closeCart}
                        className="line-clamp-2 text-[13px] font-semibold text-navy-900 transition-colors hover:text-azure-600"
                      >
                        {item.nom}
                      </Link>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {formatTND(unit)} l&apos;unité
                      </p>
                      {outOfStock && (
                        <p className="mt-0.5 text-[11px] font-bold text-red-500">
                          Indisponible
                        </p>
                      )}

                      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                        <QuantityStepper
                          value={item.quantite}
                          onChange={(q) => setQuantity(item.produitId, q)}
                          max={undefined}
                          size="sm"
                        />
                        <span className="text-[13px] font-black tabular-nums text-navy-900">
                          {formatTND(unit * item.quantite)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.produitId)}
                      aria-label={`Retirer ${item.nom}`}
                      className="-mr-1 self-start flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-slate-400 transition-all hover:bg-red-50 hover:border-red-200 hover:text-red-500"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Footer */}
            <div className="border-t border-slate-200 bg-slate-50/50 px-5 py-5 space-y-4">
              {/* Subtotal */}
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between shadow-sm">
                <span className="text-[13px] text-slate-500">Sous-total</span>
                <span className="font-display text-xl font-black tabular-nums text-navy-900">
                  {formatTND(subtotal)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 text-center">
                Livraison et remises calculées à l&apos;étape suivante.
              </p>

              <div className="grid gap-2.5">
                <Link
                  href={isAuthenticated ? "/commande" : "/inscription?next=/commande"}
                  onClick={closeCart}
                  className={buttonVariants({ variant: "accent", size: "lg", fullWidth: true })}
                >
                  Passer la commande
                </Link>
                <button
                  type="button"
                  onClick={closeCart}
                  className="text-center text-[13px] font-semibold text-slate-500 transition-colors hover:text-navy-900 py-1"
                >
                  Continuer mes achats
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>,
    document.body,
  );
}
