"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Produit } from "@/lib/types";
import { ProductCard } from "./ProductCard";

interface Props {
  products: Produit[];
  prevNextLabel?: string;
}

/**
 * Carousel horizontal mobile-only — un produit visible à la fois.
 * Auto-avance toutes les 5 s, boucle infinie intra-sous-catégorie.
 */
export function ProductMobileCarousel({ products, prevNextLabel = "Produits" }: Props) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const total = products.length;

  const goTo = useCallback(
    (index: number) => {
      const next = ((index % total) + total) % total;
      setCurrent(next);
    },
    [total]
  );

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % total);
    }, 5000);
  }, [total]);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resetTimer]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.children[current] as HTMLElement | undefined;
    if (slide) {
      slide.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    }
  }, [current]);

  const handlePrev = () => { goTo(current - 1); resetTimer(); };
  const handleNext = () => { goTo(current + 1); resetTimer(); };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 40) {
      if (delta > 0) handleNext();
      else handlePrev();
    }
    touchStartX.current = null;
  };

  if (total === 0) return null;

  return (
    <div className="relative w-full">
      {/* Prev / Next + dots — top right */}
      <div className="flex items-center justify-end gap-2 mb-3">
        <button
          aria-label={`Précédent — ${prevNextLabel}`}
          onClick={handlePrev}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-azure-200 bg-white text-azure-700 shadow-sm hover:bg-azure-50 active:scale-95 transition-all duration-150 text-base font-semibold select-none"
        >
          ‹
        </button>
        <div className="flex items-center gap-1">
          {products.map((_, i) => (
            <button
              key={i}
              onClick={() => { goTo(i); resetTimer(); }}
              aria-label={`Produit ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? "w-5 bg-azure-600" : "w-1.5 bg-azure-200"
                }`}
            />
          ))}
        </div>
        <button
          aria-label={`Suivant — ${prevNextLabel}`}
          onClick={handleNext}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-azure-200 bg-white text-azure-700 shadow-sm hover:bg-azure-50 active:scale-95 transition-all duration-150 text-base font-semibold select-none"
        >
          ›
        </button>
      </div>

      {/* Carousel track */}
      <div
        ref={trackRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex overflow-x-hidden w-full"
        style={{ scrollbarWidth: "none" }}
      >
        {products.map((product) => (
          <div key={product.id} className="w-full shrink-0">
            <ProductCard product={product} className="w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
