"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useCategory } from "@/providers/CategoryProvider";
import type { CategorieListItem } from "@/lib/types";
import { cn } from "@/lib/cn";

export function CategoryOnboardingModal({
  categories,
}: {
  categories: CategorieListItem[];
}) {
  const { isOnboardingOpen, selectCategory } = useCategory();
  const [selected, setSelected] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || !isOnboardingOpen) return null;

  const handleSelect = (cat: CategorieListItem) => {
    setSelected(cat.id);
    setTimeout(() => selectCategory(cat), 220);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm" aria-hidden />

      {/* Card */}
      <div
        style={{ animation: "rzIn 360ms cubic-bezier(0.16,1,0.3,1) both" }}
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden"
      >
        {/* Header accent strip */}
        <div className="h-1 w-full bg-gradient-to-r from-azure-500 to-azure-400" />

        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-azure-50">
            <svg className="h-6 w-6 text-azure-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h1
            id="onboarding-title"
            className="text-xl font-bold text-navy-900"
          >
            Choisissez votre domaine
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Sélectionnez votre rayon d&apos;activité pour personnaliser votre catalogue.
          </p>
        </div>

        {/* Category buttons */}
        <div className="px-5 pb-6 grid gap-2.5">
          {categories.map((cat) => {
            const isSelected = selected === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelect(cat)}
                className={cn(
                  "group relative flex w-full items-center gap-4 rounded-xl border-2 px-5 py-4 text-left transition-all duration-150 cursor-pointer",
                  isSelected
                    ? "border-azure-500 bg-azure-50 shadow-md scale-[1.01]"
                    : "border-slate-200 bg-white hover:border-azure-300 hover:bg-azure-50/50 hover:shadow-sm active:scale-[0.99]",
                )}
              >
                {/* Indicator circle */}
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150",
                    isSelected
                      ? "border-azure-500 bg-azure-500"
                      : "border-slate-300 bg-white group-hover:border-azure-400",
                  )}
                >
                  {isSelected && (
                    <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>

                {/* Label */}
                <span
                  className={cn(
                    "flex-1 text-[15px] font-semibold transition-colors",
                    isSelected ? "text-azure-700" : "text-navy-800 group-hover:text-navy-900",
                  )}
                >
                  {cat.nom}
                </span>

                {/* Arrow */}
                <svg
                  className={cn(
                    "h-5 w-5 shrink-0 transition-all duration-150",
                    isSelected ? "text-azure-500 translate-x-0 opacity-100" : "text-slate-300 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-60",
                  )}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes rzIn {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>,
    document.body,
  );
}