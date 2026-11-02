"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { X, ArrowRight } from "lucide-react";
import type { AlerteSite } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";
import { useCategory } from "@/providers/CategoryProvider";

// ── Config ────────────────────────────────────────────────────────────────────

const DEFAULT_ALERT: AlerteSite = {
  id: 0,
  type: "INFO",
  affichage: "POPUP",
  titre: "Rejoignez RZ Medical",
  message:
    "Créez votre compte pour profiter d'offres exclusives, suivre vos commandes et accéder à vos factures en ligne.",
  lien: "/inscription",
  texteBouton: "Créer un compte",
  actif: true,
  dateDebut: null,
  dateFin: null,
  creeLe: "",
};

const TOAST_DURATION_MS = 8000;

// ── Design tokens — one quiet accent per type, no icons, no labels ─────────────
// The "magic" lives in the glow behind the card and the motion, not in chrome.

const TYPE_STYLES = {
  INFO: { accent: "#0284C7", glow: "rgba(2,132,199,0.16)" },
  PROMO: { accent: "#0F766E", glow: "rgba(15,118,110,0.16)" },
  WARNING: { accent: "#B45309", glow: "rgba(180,83,9,0.16)" },
  SUCCESS: { accent: "#15803D", glow: "rgba(21,128,61,0.16)" },
} as const;

// ── Shared: focus trap for the modal popup ─────────────────────────────────────

function useFocusTrap(active: boolean, containerRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!active || !containerRef.current) return;
    const container = containerRef.current;
    const focusable = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || focusable.length === 0) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [active, containerRef]);
}

// ── Global keyframes (mounted once) ─────────────────────────────────────────────

function AlertKeyframes() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          @keyframes rz-overlay-in { from { opacity: 0 } to { opacity: 1 } }
          @keyframes rz-modal-in {
            from { opacity: 0; transform: translateY(16px) scale(0.96); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes rz-glow-pulse {
            0%, 100% { opacity: 0.7; transform: scale(1); }
            50%      { opacity: 1;   transform: scale(1.06); }
          }
          @keyframes rz-banner-in {
            from { transform: translateY(100%); }
            to   { transform: translateY(0); }
          }
          @keyframes rz-toast-in {
            from { opacity: 0; transform: translateX(24px); }
            to   { opacity: 1; transform: translateX(0); }
          }
          @keyframes rz-progress {
            from { transform: scaleX(1); }
            to   { transform: scaleX(0); }
          }
          @media (prefers-reduced-motion: reduce) {
            .rz-anim { animation-duration: 0.01ms !important; }
          }
        `,
      }}
    />
  );
}

// ── Popup ────────────────────────────────────────────────────────────────────

function PopupAlert({ alert, onDismiss }: { alert: AlerteSite; onDismiss: () => void }) {
  const router = useRouter();
  const s = TYPE_STYLES[alert.type];
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, modalRef);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onDismiss();
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onDismiss]);

  return (
    <>
      <AlertKeyframes />
      {/* Overlay */}
      <div
        onClick={onDismiss}
        className="rz-anim fixed inset-0 z-[9998] bg-navy-950/60 backdrop-blur-sm"
        style={{ animation: "rz-overlay-in 220ms ease both" }}
        aria-hidden="true"
      />

      {/* Dialog wrapper — flex-center with safe padding */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rz-alert-title"
        className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6"
        style={{ pointerEvents: "none" }}
      >
        <div
          className="relative w-full sm:max-w-[520px] md:max-w-[850px]"
          style={{ pointerEvents: "auto" }}
        >
          {/* Glow — desktop only */}
          <div
            className="rz-anim pointer-events-none absolute -inset-6 -z-10 hidden md:block rounded-[32px] blur-3xl opacity-50"
            style={{ background: s.glow, animation: "rz-glow-pulse 3.6s ease-in-out infinite" }}
            aria-hidden="true"
          />

          <div
            ref={modalRef}
            className="rz-anim flex flex-col md:flex-row w-full overflow-hidden
              rounded-t-[24px] sm:rounded-[20px] md:rounded-[24px]
              bg-white
              shadow-[0_-8px_40px_-8px_rgba(15,23,42,0.25)] sm:shadow-[0_32px_64px_-12px_rgba(15,23,42,0.3)]
              ring-1 ring-slate-900/5
              max-h-[92dvh] sm:max-h-none overflow-y-auto sm:overflow-visible"
            style={{ animation: "rz-modal-in 320ms cubic-bezier(0.16,1,0.3,1) both" }}
          >
            {/* ── Mobile header strip (visible on mobile only) ── */}
            <div
              className="md:hidden flex items-center justify-between px-5 py-4"
              style={{ background: `linear-gradient(135deg, ${s.accent}ee, ${s.accent})` }}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-[13px] font-black text-white tracking-wide">RZ Medical</span>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold text-white">
                  100% Gratuit
                </span>
              </div>
              <button
                onClick={onDismiss}
                aria-label="Fermer"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* ── Desktop left pane ── */}
            <div className="relative hidden md:flex flex-col items-center justify-center p-6 md:w-[42%] shrink-0 overflow-hidden bg-gradient-to-br from-azure-400 to-azure-600">
              <div className="absolute -left-16 top-12 h-48 w-48 rounded-full bg-azure-300/20 blur-[2px]" />
              <div className="absolute -left-8 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-azure-300/20 blur-[2px]" />
              <div className="absolute -right-20 -bottom-10 h-72 w-72 rounded-full bg-azure-300/10 blur-[2px]" />
              <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-azure-300/15 blur-3xl" />

              <div className="relative z-10 flex h-full w-full flex-col rounded-xl bg-gradient-to-br from-[#60b6e9] via-[#0ea5e9] to-[#0284c7] p-6 text-white shadow-2xl ring-1 ring-white/15">
                <div className="flex items-center justify-between mb-auto">
                  <span className="text-[12.5px] font-bold">RZ Medical</span>
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-[9px] font-black uppercase text-azure-600 shadow-sm">
                    Gratuit
                  </span>
                </div>
                <div className="my-auto flex flex-col items-center text-center">
                  <p className="mb-4 text-[9px] font-bold uppercase tracking-[0.2em] text-azure-100">Édition Professionnelle</p>
                  <h3 className="text-[34px] font-black leading-[1.05] tracking-tight text-white drop-shadow-sm">
                    Catalogue<br />
                    <span className="font-serif italic font-normal text-azure-50">Privé</span>
                  </h3>
                  <p className="mt-5 text-[13px] leading-relaxed text-azure-50 max-w-[200px]">
                    Découvrez les tarifs préférentiels réservés aux professionnels de la santé.
                  </p>
                </div>
                <div className="mt-auto flex flex-wrap justify-center gap-2">
                  <span className="rounded-full border border-white/40 bg-white/5 px-3 py-1.5 text-[10px] font-medium text-white">Offres exclusives</span>
                  <span className="rounded-full border border-white/40 bg-white/5 px-3 py-1.5 text-[10px] font-medium text-white">Devis en ligne</span>
                </div>
              </div>
            </div>

            {/* ── Right / main pane ── */}
            <div className="relative flex flex-col justify-center bg-white
              px-5 py-6
              sm:px-8 sm:py-8
              md:w-[58%] md:px-10 md:py-10
              lg:px-12">

              {/* Close button — desktop only (mobile has it in the header strip) */}
              <button
                onClick={onDismiss}
                aria-label="Fermer"
                className="absolute right-5 top-5 hidden md:flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X size={16} />
              </button>

              {/* Badge */}
              <div className="mb-3 inline-flex items-center gap-2 self-start rounded-full bg-azure-50 px-3 py-1 ring-1 ring-azure-500/20">
                <span className="text-[10.5px] font-black uppercase tracking-wider text-azure-700">
                  {alert.type === "INFO" ? "Nouveau compte" : alert.type}
                </span>
                <span className="text-[10.5px] text-azure-600/60 font-medium">• Gratuit</span>
              </div>

              {/* Title */}
              <h2
                id="rz-alert-title"
                className="mb-2.5 text-[22px] font-bold leading-tight tracking-tight text-slate-900
                  sm:text-[26px] md:text-[30px]"
              >
                {alert.titre}
              </h2>

              {/* Message */}
              <p className="mb-5 text-[13.5px] sm:text-[15px] leading-relaxed text-slate-600">
                {alert.message}
              </p>

              {/* Checklist */}
              <ul className="mb-6 space-y-2.5 sm:space-y-3">
                {[
                  "Offres exclusives et remises professionnelles",
                  "Suivi de commandes en temps réel",
                  "Factures et devis accessibles en ligne",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] sm:text-[14px] font-medium text-slate-700">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-azure-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {/* CTAs */}
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                {alert.lien && alert.texteBouton && (
                  <button
                    onClick={() => { onDismiss(); router.push(alert.lien!); }}
                    className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl
                      px-6 py-3.5
                      text-[14px] sm:text-[15px] font-bold text-white
                      transition-all active:scale-[0.98]"
                    style={{ background: s.accent, boxShadow: `0 4px 14px ${s.glow}` }}
                  >
                    <ArrowRight size={16} />
                    {alert.texteBouton}
                  </button>
                )}
                <button
                  onClick={onDismiss}
                  className="w-full sm:w-auto rounded-xl px-5 py-3.5
                    text-[13.5px] font-semibold text-slate-500
                    hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                  Plus tard
                </button>
              </div>

              <p className="mt-5 text-[11.5px] text-slate-400 font-medium">
                Rejoignez des centaines de professionnels de la santé.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Banner ───────────────────────────────────────────────────────────────────

function BannerAlert({ alert, onDismiss }: { alert: AlerteSite; onDismiss: () => void }) {
  const router = useRouter();
  const s = TYPE_STYLES[alert.type];

  return (
    <>
      <AlertKeyframes />
      <div
        role="alert"
        className="rz-anim fixed inset-x-0 bottom-0 z-[9999] border-t bg-white shadow-[0_-8px_30px_-6px_rgba(15,23,42,0.12)]"
        style={{ borderTopColor: s.accent, animation: "rz-banner-in 360ms cubic-bezier(0.16,1,0.3,1) both" }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-3.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: s.accent }}
            aria-hidden="true"
          />
          <div className="min-w-[200px] flex-1">
            <p className="text-[14px] font-semibold text-slate-900">{alert.titre}</p>
            <p className="text-[13px] text-slate-500">{alert.message}</p>
          </div>
          <div className="flex items-center gap-2">
            {alert.lien && alert.texteBouton && (
              <button
                onClick={() => {
                  onDismiss();
                  router.push(alert.lien!);
                }}
                className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-transform active:scale-[0.98]"
                style={{ background: s.accent }}
              >
                {alert.texteBouton}
              </button>
            )}
            <button
              onClick={onDismiss}
              aria-label="Fermer"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={17} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Toast ────────────────────────────────────────────────────────────────────

function ToastAlert({ alert, onDismiss }: { alert: AlerteSite; onDismiss: () => void }) {
  const router = useRouter();
  const s = TYPE_STYLES[alert.type];

  useEffect(() => {
    const t = setTimeout(onDismiss, TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <>
      <AlertKeyframes />
      <div
        role="alert"
        className="rz-anim fixed bottom-6 right-6 z-[9999] w-[calc(100vw-3rem)] max-w-[340px] overflow-hidden rounded-2xl bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.25)] ring-1 ring-slate-900/5"
        style={{ animation: "rz-toast-in 320ms cubic-bezier(0.16,1,0.3,1) both" }}
      >
        <div className="flex items-start gap-3 p-4">
          <span
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            style={{ background: s.accent }}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-slate-900">{alert.titre}</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">{alert.message}</p>
            {alert.lien && alert.texteBouton && (
              <button
                onClick={() => {
                  onDismiss();
                  router.push(alert.lien!);
                }}
                className="mt-2.5 rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-transform active:scale-[0.98]"
                style={{ background: s.accent }}
              >
                {alert.texteBouton}
              </button>
            )}
          </div>
          <button
            onClick={onDismiss}
            aria-label="Fermer"
            className="shrink-0 text-slate-400 transition-colors hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>
        {/* Countdown progress bar */}
        <div className="h-[3px] w-full bg-slate-100">
          <div
            className="rz-anim h-full origin-left"
            style={{
              background: s.accent,
              animation: `rz-progress ${TOAST_DURATION_MS}ms linear forwards`,
            }}
          />
        </div>
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SiteAlert({ alertes }: { alertes: AlerteSite[] }) {
  const [visible, setVisible] = useState(false);
  const { isAuthenticated, ready } = useAuth();
  const pathname = usePathname();
  const { categories } = useCategory();

  // Determine which alert to show (real DB alert takes priority over default)
  const hasRealAlert = alertes?.length > 0;
  const alert = hasRealAlert ? alertes[0] : DEFAULT_ALERT;

  // For the default "sign-up" alert, only show on exact category root pages (/nom-cat)
  const isOnCategoryPage = (() => {
    if (!pathname) return false;
    const segments = pathname.split("/").filter(Boolean);
    // Must be exactly /nom-de-cat (one segment only, not /nom-de-cat/produits/78)
    if (segments.length !== 1) return false;
    const firstSegment = segments[0];
    return categories.some(
      (c) =>
        c.nom.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") ===
        firstSegment.toLowerCase()
    );
  })();

  const shouldShow = hasRealAlert
    ? true // always show real admin alerts
    : ready && !isAuthenticated && isOnCategoryPage; // default sign-up alert: category page + not logged in

  useEffect(() => {
    if (!shouldShow) {
      setVisible(false);
      return;
    }
    // Reappears on every page load/refresh, even if it was closed before.
    const t = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(t);
  }, [alert.id, shouldShow]);

  const handleDismiss = () => {
    setVisible(false);
  };

  if (!visible) return null;

  if (alert.affichage === "BANNER") return <BannerAlert alert={alert} onDismiss={handleDismiss} />;
  if (alert.affichage === "TOAST") return <ToastAlert alert={alert} onDismiss={handleDismiss} />;
  return <PopupAlert alert={alert} onDismiss={handleDismiss} />;
}