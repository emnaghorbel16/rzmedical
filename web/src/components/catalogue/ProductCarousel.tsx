"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import type { Produit } from "@/lib/types";
import { ProductCard } from "./ProductCard";
import { cn } from "@/lib/cn";

const INTERVAL_MS = 5000;

export function ProductCarousel({
  products,
  className,
}: {
  products: Produit[];
  className?: string;
}) {
  const [current, setCurrent] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ─── Detect mobile ─── */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /* ─── Auto-scroll (mobile only) ─── */
  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % products.length);
  }, [products.length]);

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + products.length) % products.length);
  }, [products.length]);

  useEffect(() => {
    if (!isMobile) return;
    timerRef.current = setInterval(next, INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isMobile, next]);

  /* ─── Sync scroll position (mobile) ─── */
  useEffect(() => {
    if (!isMobile || !railRef.current) return;
    const rail = railRef.current;
    const slide = rail.children[current] as HTMLElement | undefined;
    if (slide) {
      slide.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    }
  }, [current, isMobile]);

  /* ─── Restart timer on manual nav ─── */
  const navigate = (fn: () => void) => {
    if (timerRef.current) clearInterval(timerRef.current);
    fn();
    timerRef.current = setInterval(next, INTERVAL_MS);
  };

  /* ─────────────────────────────────────────────
     MOBILE : carrousel 1 slide à la fois
  ───────────────────────────────────────────── */
  if (isMobile) {
    return (
      <div className={cn("w-full", className)}>
        {/* Boutons navigation */}
        <div className="flex items-center justify-end gap-2 mb-3">
          <button
            onClick={() => navigate(prev)}
            aria-label="Produit précédent"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm text-slate-600 hover:bg-azure-50 hover:text-azure-600 hover:border-azure-300 transition-all duration-200"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="text-xs text-slate-500 font-medium tabular-nums">
            {current + 1} / {products.length}
          </span>
          <button
            onClick={() => navigate(next)}
            aria-label="Produit suivant"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm text-slate-600 hover:bg-azure-50 hover:text-azure-600 hover:border-azure-300 transition-all duration-200"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Rail des slides */}
        <div
          ref={railRef}
          className="flex snap-x snap-mandatory overflow-x-hidden gap-4"
          aria-live="polite"
        >
          {products.map((product) => (
            <div key={product.id} className="w-full shrink-0 snap-start">
              <ProductCard product={product} />
            </div>
          ))}
        </div>

        {/* Indicateurs (dots) */}
        <div className="flex justify-center gap-1.5 mt-3">
          {products.map((_, i) => (
            <button
              key={i}
              onClick={() => navigate(() => setCurrent(i))}
              aria-label={`Aller au produit ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === current ? "w-5 bg-azure-500" : "w-1.5 bg-slate-300"
              )}
            />
          ))}
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     DESKTOP : rail horizontal classique
  ───────────────────────────────────────────── */
  return (
    <div
      className={cn(
        "flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain pb-4 scroll-smooth gap-5",
        "[scrollbar-width:thin] [scrollbar-color:theme(colors.azure.500)_transparent]",
        "[&::-webkit-scrollbar]:h-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-azure-500/50 [&::-webkit-scrollbar-thumb:hover]:bg-azure-500 [&::-webkit-scrollbar-thumb]:rounded",
        className
      )}
    >
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          className="w-[280px] lg:w-[292px] shrink-0 snap-start hover:-translate-y-[2px] hover:shadow-xl transition-all duration-500"
        />
      ))}
    </div>
  );
}
