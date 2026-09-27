"use client";

import { useState } from "react";
import Link from "next/link";
import type { CategorieListItem, Produit } from "@/lib/types";
import { ProductRail } from "@/components/catalogue/ProductRail";
import { ArrowRightIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

interface CategoryNewArrivals {
  categorie: CategorieListItem;
  products: Produit[];
}

interface Props {
  data: CategoryNewArrivals[];
}

/**
 * Section Nouveautés de la page d'accueil.
 * Affiche les 10 produits les plus récents pour chaque catégorie,
 * avec des onglets cliquables pour changer de catégorie.
 */
export function NewArrivalsByCategory({ data }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (data.length === 0) return null;

  const active = data[activeIndex];

  return (
    <section className="relative bg-white border-t border-slate-200/60 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
        {/* Header */}
        <div className="flex flex-col gap-6 mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-azure-200 bg-azure-50 px-4 py-1.5 mb-3 select-none">
              <span className="h-px w-3 bg-azure-500/60" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-azure-600">
                Sélection
              </span>
            </div>
            <h2 className="font-display text-3xl font-black text-navy-900 tracking-tight sm:text-4xl leading-tight">
              Nouveautés
            </h2>
            <p className="mt-2 text-[15px] text-slate-500 max-w-md">
              Les dernières références ajoutées à notre catalogue, par catégorie.
            </p>
          </div>
          <Link
            href={`/catalogue?category=${encodeURIComponent(active.categorie.nom)}`}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-[13px] font-semibold text-navy-800 shadow-sm transition-all hover:border-azure-300 hover:-translate-y-[1px] hover:shadow-md"
          >
            Voir tout — {active.categorie.nom}
            <ArrowRightIcon size={14} />
          </Link>
        </div>

        {/* Onglets par catégorie */}
        <div
          className="flex gap-2 mb-8 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Catégories de nouveautés"
        >
          {data.map((item, i) => (
            <button
              key={item.categorie.id}
              role="tab"
              aria-selected={i === activeIndex}
              aria-controls={`nouveautes-panel-${item.categorie.id}`}
              id={`nouveautes-tab-${item.categorie.id}`}
              onClick={() => setActiveIndex(i)}
              className={cn(
                "shrink-0 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition-all duration-200 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure-400",
                i === activeIndex
                  ? "bg-azure-600 text-white border-azure-600 shadow-md shadow-azure-500/20"
                  : "bg-white text-navy-700 border-slate-200 hover:border-azure-300 hover:bg-azure-50 hover:text-azure-700",
              )}
            >
              {item.categorie.nom}
              <span
                className={cn(
                  "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                  i === activeIndex
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500",
                )}
              >
                {item.products.length}
              </span>
            </button>
          ))}
        </div>

        {/* Grille produits */}
        <div
          id={`nouveautes-panel-${active.categorie.id}`}
          role="tabpanel"
          aria-labelledby={`nouveautes-tab-${active.categorie.id}`}
          key={active.categorie.id}
          className="animate-in fade-in duration-300"
        >
          <ProductRail products={active.products.slice(0, 10)} />
        </div>
      </div>
    </section>
  );
}
