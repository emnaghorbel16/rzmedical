"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Produit } from "@/lib/types";
import { ProductCard } from "./ProductCard";

interface Props {
  products: Produit[];
  subcategoryId: number;
}

/**
 * Carousel horizontal mobile — 1 produit à la fois.
 * Auto-avance toutes les 5 s, loop infini dans la sous-catégorie.
 * Boutons ‹ / › placés côté titre (passés via header slot).
 * Compatible swipe tactile natif.
 */
export function MobileProductCarousel({ products, subcategoryId }: Props) {
  const [current, setCurrent] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);
  const count = products.length;

  const goTo = useCallback(
    (index: number) => {
      const next = ((index % count) + count) % count;
      setCurrent(next);
    },
    [count],
  );

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  /** Reset le timer à chaque action manuelle ou changement d'index. */
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((c) => ((c + 1) % count));
    }, 5000);
  }, [count]);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resetTimer]);

  /** Scroll fluide vers la carte active. */
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[current] as HTMLElement | undefined;
    if (!card) return;
    track.scrollTo({ left: card.offsetLeft, behavior: "smooth" });
  }, [current]);

  /** Swipe tactile. */
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return; // trop court → ignoré
    if (delta < 0) {
      next();
    } else {
      prev();
    }
    resetTimer();
  };

  const handleNext = () => { next(); resetTimer(); };
  const handlePrev = () => { prev(); resetTimer(); };

  return (
    <div className="sm:hidden w-full" data-subcategory-id={subcategoryId}>
      {/* Contrôles nav */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs text-slate-400 font-medium">
          {current + 1} / {count}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            aria-label="Produit précédent"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-azure-200 bg-white text-azure-700 shadow-sm transition-all duration-200 hover:bg-azure-50 hover:border-azure-400 active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={handleNext}
            aria-label="Produit suivant"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-azure-200 bg-white text-azure-700 shadow-sm transition-all duration-200 hover:bg-azure-50 hover:border-azure-400 active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="flex overflow-x-hidden scroll-smooth snap-x snap-mandatory gap-4"
        style={{ scrollbarWidth: "none" }}
      >
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            className="w-full shrink-0 snap-start"
          />
        ))}
      </div>

      {/* Indicateurs dots */}
      {count > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {products.map((_, i) => (
            <button
              key={i}
              onClick={() => { goTo(i); resetTimer(); }}
              aria-label={`Aller au produit ${i + 1}`}
              className={`transition-all duration-300 rounded-full ${
                i === current
                  ? "w-5 h-2 bg-azure-500"
                  : "w-2 h-2 bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
