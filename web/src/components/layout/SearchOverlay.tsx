"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Produit } from "@/lib/types";
import { searchProducts, imageUrl, ApiError } from "@/lib/api";
import { useUI } from "@/providers/UIProvider";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { Price } from "@/components/ui/Price";
import {
  PackageIcon,
  SearchIcon,
  SpinnerIcon,
  XIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";

const MAX_RESULTS = 6;
const SUGGESTIONS = ["Fauteuil", "Dentaire", "Instruments", "Consommables", "Gants", "Imagerie"];

export function SearchOverlay() {
  const { searchOpen, closeSearch } = useUI();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Produit[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const ref = useFocusTrap<HTMLDivElement>(searchOpen);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (searchOpen) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(t);
    }
    setQuery("");
    setResults([]);
    setStatus("idle");
    abortRef.current?.abort();
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen, closeSearch]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setStatus("idle");
      abortRef.current?.abort();
      return;
    }
    setStatus("loading");
    const t = window.setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      searchProducts(term, ctrl.signal)
        .then((data) => { setResults(data); setStatus("done"); })
        .catch((err) => {
          if (err instanceof ApiError && err.status === 0) return;
          if (err?.name === "AbortError") return;
          setStatus("error");
        });
    }, 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const submit = useCallback(
    (e: SyntheticEvent) => {
      e.preventDefault();
      const term = query.trim();
      if (term.length === 0) return;
      closeSearch();
      router.push(`/catalogue?q=${encodeURIComponent(term)}`);
    },
    [query, router, closeSearch],
  );

  if (!mounted) return null;

  const term = query.trim();
  const shown = results.slice(0, MAX_RESULTS);
  const hasMore = results.length > MAX_RESULTS;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[105]",
        searchOpen ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!searchOpen}
    >
      {/* Backdrop */}
      <div
        onClick={closeSearch}
        className={cn(
          "absolute inset-0 bg-slate-900/30 backdrop-blur-md transition-opacity duration-300",
          searchOpen ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Search panel */}
      <div
        ref={ref}
        role="dialog"
        aria-modal={searchOpen || undefined}
        aria-label="Recherche"
        className={cn(
          "absolute inset-x-0 top-0 origin-top transition-all duration-300 ease-out-quint",
          "bg-white/95 backdrop-blur-2xl border-b border-slate-200/80",
          "shadow-[0_20px_60px_rgba(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,1)]",
          searchOpen ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0",
        )}
      >
        {/* Top azure line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-azure-500/60 to-transparent pointer-events-none" />

        <div className="container-page py-5">
          {/* Search input row */}
          <form onSubmit={submit} className="flex items-center gap-3">
            <div className="relative flex-1">
              <SearchIcon
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-azure-500"
              />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un produit, une référence, une marque…"
                aria-label="Rechercher"
                className={cn(
                  "h-13 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-[15px] text-navy-900 placeholder:text-slate-400 outline-none transition-all shadow-inner",
                  "focus:border-azure-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(14,165,233,0.15)]",
                )}
              />
            </div>
            <button
              type="button"
              onClick={closeSearch}
              aria-label="Fermer"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 hover:text-navy-900 hover:border-slate-300 shrink-0 shadow-sm"
            >
              <XIcon size={18} />
            </button>
          </form>

          {/* Results */}
          {term.length >= 2 && (
            <div className="mt-4 max-h-[58vh] overflow-y-auto">
              {status === "loading" && (
                <div className="flex items-center justify-center gap-2.5 py-12 text-[13px] text-slate-500">
                  <SpinnerIcon size={18} className="animate-spin text-azure-500" />
                  Recherche en cours…
                </div>
              )}

              {status === "error" && (
                <p className="py-12 text-center text-[13px] text-red-500">
                  La recherche a échoué. Réessayez.
                </p>
              )}

              {status === "done" && shown.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-[14px] font-semibold text-navy-900">
                    Aucun résultat pour «&nbsp;{term}&nbsp;»
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    Essayez avec un autre mot-clé.
                  </p>
                </div>
              )}

              {status === "done" && shown.length > 0 && (
                <>
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                    Résultats
                  </p>
                  <ul className="space-y-1">
                    {shown.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/produit/${encodeURIComponent(p.reference)}`}
                          onClick={closeSearch}
                          className="flex items-center gap-3 rounded-xl px-3 py-3 transition-all hover:bg-slate-50 hover:border-slate-200 border border-transparent group"
                        >
                          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white transition-all group-hover:border-azure-300 shadow-sm">
                            {p.images?.[0] ? (
                              <Image
                                src={imageUrl(p.images[0])}
                                alt={p.nom}
                                fill
                                sizes="48px"
                                className="object-contain p-1"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-slate-300">
                                <PackageIcon size={20} strokeWidth={1.25} />
                              </span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-navy-900 group-hover:text-azure-600 transition-colors">
                              {p.nom}
                            </span>
                            {p.marque?.nom && (
                              <span className="block truncate text-[11px] text-slate-500 mt-0.5">
                                {p.marque.nom}
                              </span>
                            )}
                          </span>
                          <Price
                            prix={p.prix}
                            tva={p.tva}
                            remise={p.remise}
                            size="sm"
                            showBadge={false}
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={submit}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3.5 text-[13px] font-bold text-azure-600 transition-all hover:bg-azure-50 hover:border-azure-200 hover:text-azure-700 shadow-sm"
                  >
                    {hasMore ? `Voir les ${results.length} résultats` : "Voir tous les résultats"}
                    <SearchIcon size={14} />
                  </button>
                </>
              )}
            </div>
          )}

          {/* Suggestions when idle */}
          {term.length < 2 && (
            <div className="pt-5 border-t border-slate-200 mt-4">
              <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Recherches suggérées
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setQuery(sug)}
                    className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-azure-50 hover:text-azure-600 hover:border-azure-200 transition-all shadow-sm"
                  >
                    {sug}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-[11px] text-slate-400">
                Saisissez au moins 2 caractères · Appuyez sur{" "}
                <kbd className="font-sans font-bold bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] text-slate-500">
                  Échap
                </kbd>{" "}
                pour fermer.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
