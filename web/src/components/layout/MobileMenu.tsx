"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useUI } from "@/providers/UIProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useCart } from "@/providers/CartProvider";
import { useCategory } from "@/providers/CategoryProvider";
import { useCompany } from "@/providers/CompanyProvider";
import { Logo } from "@/components/ui/Logo";
import { imageUrl } from "@/lib/api";
import type { CategorieListItem, MarqueListItem } from "@/lib/types";
import { cn } from "@/lib/cn";
import {
  ChevronDownIcon,
  PackageIcon,
  SparklesIcon,
  TagIcon,
  UserIcon,
  HomeIcon,
  CartIcon,
  InfoIcon,
  MailIcon,
  SearchIcon,
  XIcon,
} from "@/components/ui/icons";

export function MobileMenu({
  categories = [],
  marques = [],
}: {
  categories?: CategorieListItem[];
  marques?: MarqueListItem[];
}) {
  const { mobileMenuOpen, closeMobileMenu } = useUI();
  const { isAuthenticated, user } = useAuth();
  const { openCart, count } = useCart();
  const { selectedCategory, categorySlug } = useCategory();
  const company = useCompany();

  const [openCatId, setOpenCatId] = useState<number | null>(null);
  const [brandSearch, setBrandSearch] = useState("");

  const ref = useFocusTrap<HTMLElement>(mobileMenuOpen);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobileMenu();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen, closeMobileMenu]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      setOpenCatId(null);
      setBrandSearch("");
    }
  }, [mobileMenuOpen]);

  const filteredMarques = useMemo(() => {
    const withLogo = marques.some((m) => Boolean(m.logo))
      ? marques.filter((m) => Boolean(m.logo))
      : marques;
    if (!brandSearch.trim()) return withLogo;
    const q = brandSearch.toLowerCase();
    return withLogo.filter((m) => m.nom.toLowerCase().includes(q));
  }, [marques, brandSearch]);

  const activeCat = selectedCategory
    ? categories.find((c) => c.id === selectedCategory.id) ?? selectedCategory
    : null;
  const activeSubs = activeCat?.sousCategories ?? [];

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-opacity duration-300 lg:hidden",
        mobileMenuOpen
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0"
      )}
      aria-hidden={!mobileMenuOpen}
    >
      {/* Overlay plein, sans flou */}
      <div
        onClick={closeMobileMenu}
        className="absolute inset-0 bg-navy-950/70"
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation principale"
        tabIndex={-1}
        className={cn(
          "absolute left-0 top-0 flex h-full w-[86%] max-w-[380px] flex-col bg-white border-r border-slate-200 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header — logo à gauche, ligne de séparation nette */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 pl-5 pr-3">
          <Link
            href={categorySlug ? `/${categorySlug}` : "/"}
            onClick={closeMobileMenu}
            aria-label={`${company?.nomSociete || "RZMedical"} - Accueil`}
            className="shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-azure-500/50"
          >
            <Logo tone="dark" className="h-8 w-auto" />
          </Link>
          <button
            type="button"
            onClick={closeMobileMenu}
            className="flex h-11 w-11 items-center justify-center text-slate-400 hover:text-navy-900 transition-colors"
            aria-label="Fermer le menu"
          >
            <XIcon size={20} strokeWidth={1.75} />
          </button>
        </div>

        {/* Contenu défilant */}
        <nav aria-label="Navigation mobile" className="flex-1 overflow-y-auto px-5 pt-5 pb-8">
          {/* Liens rapides — plats, sans icône-badge colorée */}
          <ul className="mb-5 flex flex-col">
            <li>
              <Link
                href="/"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 py-2.5 text-[15px] font-medium text-navy-900 hover:text-azure-600 transition-colors"
              >
                <HomeIcon size={16} strokeWidth={1.75} className="text-slate-400 shrink-0" />
                Accueil
              </Link>
            </li>
            <li>
              <Link
                href="/catalogue?promo=1"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 py-2.5 text-[15px] font-medium text-error hover:text-error/80 transition-colors"
              >
                <TagIcon size={16} strokeWidth={1.75} className="text-error/60 shrink-0" />
                Promotions
              </Link>
            </li>
            <li>
              <Link
                href="/catalogue?filter=new"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 py-2.5 text-[15px] font-medium text-navy-900 hover:text-azure-600 transition-colors"
              >
                <SparklesIcon size={16} strokeWidth={1.75} className="text-slate-400 shrink-0" />
                Nouveautés
              </Link>
            </li>
            <li>
              <Link
                href="/catalogue"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 py-2.5 text-[15px] font-medium text-navy-900 hover:text-azure-600 transition-colors"
              >
                <PackageIcon size={16} strokeWidth={1.75} className="text-slate-400 shrink-0" />
                Catalogue complet
              </Link>
            </li>
          </ul>

          {/* Bloc catégorie active — repère de contexte, pas une carte */}
          {selectedCategory && (
            <>
              <div className="my-4 h-px bg-slate-100" />
              <p className="mb-2.5 pl-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-azure-600">
                Vous consultez — {selectedCategory.nom}
              </p>
              <ul className="mb-5 flex flex-col">
                {[
                  { href: `/${categorySlug}`, label: "Accueil du rayon", icon: HomeIcon },
                  { href: `/${categorySlug}/nouveautes`, label: "Nouveautés", icon: SparklesIcon },
                  { href: `/${categorySlug}/promotions`, label: "Promotions", icon: TagIcon },
                  { href: `/${categorySlug}/sous-categories`, label: "Rayons", icon: PackageIcon },
                ].map(({ href, label, icon: Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={closeMobileMenu}
                      className="flex items-center gap-3 py-2 pl-1 text-[14px] font-normal text-slate-600 hover:text-navy-900 transition-colors"
                    >
                      <Icon size={14} strokeWidth={1.75} className="text-slate-300 shrink-0" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="my-5 h-px bg-slate-100" />

          {/* Accordéon catégories — chevron comme seul indicateur d'état */}
          <button
            type="button"
            onClick={() => setOpenCatId(openCatId === -1 ? null : -1)}
            aria-expanded={openCatId === -1}
            className={cn(
              "flex w-full items-center justify-between py-3 text-left text-[15px] font-medium transition-colors",
              openCatId === -1 ? "text-azure-600" : "text-navy-900 hover:text-azure-600"
            )}
          >
            <span>Explorer les sous-catégories</span>
            <ChevronDownIcon
              size={16}
              strokeWidth={1.75}
              className={cn(
                "shrink-0 transition-transform duration-300",
                openCatId === -1 ? "rotate-180 text-azure-600" : "text-slate-400"
              )}
            />
          </button>

          <div
            className={cn(
              "overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]",
              openCatId === -1 ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="ml-1 mt-1 border-l border-slate-200 pl-4">
              {activeCat ? (
                <>
                  <Link
                    href={`/${categorySlug}`}
                    onClick={closeMobileMenu}
                    className="mb-2 block py-2 text-[14px] font-medium text-azure-600 hover:text-azure-700 transition-colors"
                  >
                    Toute la catégorie — {activeCat.nom}
                  </Link>

                  {activeSubs.length === 0 ? (
                    <p className="py-2 text-[13px] text-slate-400">
                      Aucune sous-catégorie disponible.
                    </p>
                  ) : (
                    <ul className="flex flex-col">
                      {activeSubs.map((sub) => (
                        <li key={sub.id}>
                          <Link
                            href={`/catalogue?sousCategorieId=${sub.id}`}
                            onClick={closeMobileMenu}
                            className="block py-2 text-[14px] text-slate-600 hover:text-navy-900 transition-colors"
                          >
                            {sub.nom}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="py-2 text-[13px] text-slate-400">
                  Sélectionnez une catégorie pour voir ses sous-catégories.
                </p>
              )}
            </div>
          </div>

          <div className="my-5 h-px bg-slate-100" />

          {/* Marques — grille sobre, sans ombres ni flou */}
          {marques.length > 0 && (
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Marques référencées
              </p>

              <div className="relative mb-3">
                <SearchIcon
                  size={14}
                  strokeWidth={1.75}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Rechercher une marque"
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                  className="w-full border border-slate-200 bg-white py-2 pl-8 pr-3 text-[13px] outline-none transition-colors focus:border-azure-400"
                />
              </div>

              <div className="pr-1">
                {filteredMarques.length === 0 ? (
                  <p className="py-5 text-center text-[13px] text-slate-400">
                    Aucune marque trouvée.
                  </p>
                ) : (
                  <ul className="grid grid-cols-4 gap-2">
                    {filteredMarques.map((m) => (
                      <li key={m.id}>
                        <div
                          className="flex flex-col items-center gap-1.5 border border-slate-150 bg-white p-2 rounded-lg cursor-default select-none pointer-events-none"
                        >
                          {m.logo ? (
                            <div className="relative h-11 w-11 shrink-0">
                              <Image
                                src={imageUrl(m.logo)}
                                alt={m.nom}
                                fill
                                sizes="44px"
                                unoptimized
                                className="object-contain"
                              />
                            </div>
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-slate-50 text-[15px] font-semibold text-slate-400">
                              {m.nom.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="w-full truncate text-center text-[9.5px] font-medium uppercase tracking-wide text-slate-600">
                            {m.nom}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <div className="my-5 h-px bg-slate-100" />

          {/* Compte & Panier */}
          <ul className="flex flex-col">
            <li>
              <Link
                href={isAuthenticated ? "/compte" : "/connexion"}
                onClick={closeMobileMenu}
                className="flex items-center gap-3 py-3 text-[15px] font-medium text-navy-900 hover:text-azure-600 transition-colors"
              >
                <UserIcon size={17} strokeWidth={1.75} className="text-slate-400 shrink-0" />
                {isAuthenticated
                  ? user?.prenom
                    ? `Mon compte (${user.prenom})`
                    : "Mon compte"
                  : "Se connecter / S'inscrire"}
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  closeMobileMenu();
                  openCart();
                }}
                className="flex w-full items-center justify-between py-3 text-[15px] font-medium text-navy-900 hover:text-azure-600 transition-colors"
              >
                <span className="flex items-center gap-3">
                  <CartIcon size={17} strokeWidth={1.75} className="text-slate-400 shrink-0" />
                  Panier
                </span>
                {count > 0 && (
                  <span className="flex h-6 min-w-[1.5rem] items-center justify-center bg-azure-600 px-1.5 text-[11px] font-semibold text-white">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
            </li>
          </ul>

          <div className="my-5 h-px bg-slate-100" />

          {/* Liens de bas de menu */}
          <ul className="flex flex-col pb-6">
            <li>
              <Link
                href="/a-propos"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 py-2.5 text-[14px] text-slate-500 hover:text-navy-900 transition-colors"
              >
                <InfoIcon size={15} strokeWidth={1.75} className="text-slate-300 shrink-0" />
                À propos de nous
              </Link>
            </li>
            <li>
              <Link
                href="/support"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 py-2.5 text-[14px] text-slate-500 hover:text-navy-900 transition-colors"
              >
                <MailIcon size={15} strokeWidth={1.75} className="text-slate-300 shrink-0" />
                Contactez-nous
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
    </div>
  );
  console.log("DEBUG selectedCategory:", selectedCategory);
  console.log("DEBUG categorySlug:", categorySlug);
  console.log("DEBUG activeCat:", activeCat);
}