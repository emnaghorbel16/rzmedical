"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCompany } from "@/providers/CompanyProvider";

export type AnnonceSite = {
  texte: string;
  actif: boolean;
};

// Voix de marque RZmedical : concret, terrain tunisien, matériel médical.
const DEFAULT_PHRASES = [
  "Livraison express vers toute la Tunisie",
  "Paiement à la livraison sur tout le territoire",
  "Devis et facture fournis pour chaque commande",
];

const SHOW_MS = 4200;
const ANIM_MS = 560;

// Signature visuelle : navy (prim.), blanc (texte), azure (accent unique).
const ACCENT = "#2196d2";

function useReducedMotion(): boolean {
  const [v, setV] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setV(mql.matches);
    const fn = (e: MediaQueryListEvent) => setV(e.matches);
    mql.addEventListener("change", fn);
    return () => mql.removeEventListener("change", fn);
  }, []);
  return v;
}

export function AnnouncementBar({ annonces, onDismiss }: { annonces: AnnonceSite[]; onDismiss?: () => void; }) {
  const reduced = useReducedMotion();
  const company = useCompany();

  const email = company?.email || "randzmedical@outlook.com";
  const telDisplay = company?.telephone || "+216 28 113 131";
  const telHref = (company?.telephone || "+21628113131").replace(/\s/g, "");

  const phrases = useMemo(() => {
    const list = (annonces || [])
      .filter((a) => a.actif && a.texte.trim().length > 0)
      .map((a) => a.texte.trim());
    return list.length > 0 ? list : DEFAULT_PHRASES;
  }, [annonces]);

  const count = phrases.length;

  const [slot, setSlot] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const pausedRef = useRef(false);

  const curIndex = slot % count;
  const prevIndex = (slot - 1 + count) % count;

  useEffect(() => {
    if (dismissed || count <= 1) return;
    let cancelled = false;
    let t: ReturnType<typeof setTimeout>;
    const cycle = () => {
      t = setTimeout(() => {
        if (cancelled) return;
        if (pausedRef.current) {
          cycle();
          return;
        }
        setSlot((s) => s + 1);
        cycle();
      }, SHOW_MS);
    };
    cycle();
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [count, dismissed]);

  if (dismissed) return null;

  const isFirstSlot = slot === 0;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes rzBoardOut {
              from { transform: translateY(0);    opacity: 1; }
              to   { transform: translateY(-110%); opacity: 0; }
            }
            @keyframes rzBoardIn {
              from { transform: translateY(110%);  opacity: 0; }
              to   { transform: translateY(0);     opacity: 1; }
            }
            @keyframes rzScan {
              0%   { opacity: 0; transform: translateX(-100%); }
              30%  { opacity: 1; }
              70%  { opacity: 1; }
              100% { opacity: 0; transform: translateX(100%); }
            }
          `,
        }}
      />

      <div
        className="relative overflow-hidden bg-navy-900 text-white"
        style={{ borderBottom: `1px solid ${ACCENT}40` }}
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          pausedRef.current = false;
        }}
      >
        {/* Ligne de balayage discrète (azure, pas un reflet "verre") */}
        {!reduced && (
          <span
            key={`scan-${slot}`}
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              willChange: "transform, opacity",
              background:
                "linear-gradient(100deg, transparent 0%, transparent 38%, rgba(33,150,210,0.18) 50%, transparent 62%, transparent 100%)",
              animation: `rzScan ${ANIM_MS * 2}ms cubic-bezier(0.16,1,0.3,1) both`,
            }}
          />
        )}

        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* GAUCHE — marque + message rotatif */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* Tick azure : signature minimaliste de la marque */}
            <span
              aria-hidden="true"
              className="h-3.5 w-[2px] shrink-0"
              style={{ background: ACCENT }}
            />

            <div
              className="relative h-9 min-w-0 flex-1 overflow-hidden"
              aria-live="polite"
              aria-atomic="true"
            >
              {!isFirstSlot && (
                <p
                  key={`old-${slot}`}
                  aria-hidden="true"
                  className="absolute inset-0 truncate font-display text-[12.5px] font-medium tracking-tight text-white/90"
                  style={{
                    lineHeight: "2.25rem",
                    animation: `rzBoardOut ${ANIM_MS}ms cubic-bezier(0.4,0,0.6,1) both`,
                    pointerEvents: "none",
                  }}
                >
                  {phrases[prevIndex]}
                </p>
              )}

              <p
                key={`new-${slot}`}
                className="absolute inset-0 truncate font-display text-[12.5px] font-semibold tracking-tight text-white"
                style={{
                  lineHeight: "2.25rem",
                  willChange: "transform, opacity",
                  animation: isFirstSlot
                    ? "none"
                    : `rzBoardIn ${ANIM_MS}ms cubic-bezier(0.22,1,0.36,1) both`,
                }}
              >
                {phrases[curIndex]}
              </p>
            </div>
          </div>

          {/* DROITE — contacts fonctionnels + fermeture */}
          <div className="flex shrink-0 items-center gap-3 text-[12px] font-semibold text-white/90 sm:gap-4 sm:text-[12.5px]">
            <a
              href={`mailto:${email}`}
              className="hidden items-center gap-1.5 rounded-sm transition-colors hover:text-white sm:flex"
              aria-label={`Écrire à ${email}`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
              <span>{email}</span>
            </a>

            <span aria-hidden="true" className="hidden h-3.5 w-px bg-white/15 sm:block" />

            <a
              href={`tel:${telHref}`}
              className="flex items-center gap-1.5 rounded-sm transition-colors hover:text-white"
              aria-label={`Appeler le ${telDisplay}`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l.8-.8a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span className="hidden sm:inline">{telDisplay}</span>
              <span className="sm:hidden">Appeler</span>
            </a>

            <button
              type="button"
              onClick={() => { setDismissed(true); onDismiss?.(); }}
              className="-mr-1 ml-1 rounded-sm p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Masquer la barre"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
