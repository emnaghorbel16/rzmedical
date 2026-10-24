"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/providers/CartProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useUI } from "@/providers/UIProvider";
import { useCategory } from "@/providers/CategoryProvider";
import { useCompany } from "@/providers/CompanyProvider";
import { Logo } from "@/components/ui/Logo";
import {
  CartIcon,
  MenuIcon,
  SearchIcon,
  UserIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { CategorieListItem, MarqueListItem } from "@/lib/types";
import { CategoryDropdown } from "./CategoryDropdown";


export function Header({
  categories = [],
  marques = [],
  isTransparent = false,
  hideLogo = false,
  darkText = false,
}: {
  categories?: CategorieListItem[];
  marques?: MarqueListItem[];
  isTransparent?: boolean;
  hideLogo?: boolean;
  darkText?: boolean;
}) {
  const { count, openCart } = useCart();
  const { isAuthenticated, user } = useAuth();
  const { openSearch, mobileMenuOpen, toggleMobileMenu } = useUI();
  const { selectedCategory, categorySlug } = useCategory();
  const company = useCompany();
  const [scrolled, setScrolled] = useState(false);


  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isGlass = isTransparent && !scrolled;
  const useLightText = !darkText && (isGlass || (scrolled && isTransparent));
  const shouldHideLogo = hideLogo && !darkText;

  return (
    <header
      className={cn(
        "w-full transition-all duration-500 ease-out",
        isGlass
          ? darkText
            ? "bg-transparent border-b border-slate-200/40 shadow-none"
            : "bg-transparent border-b border-white/10 shadow-none"
          : scrolled && isTransparent && !darkText
            ? "bg-navy-960/85 backdrop-blur-3xl border-b border-white/[0.08] shadow-[0_1px_0_rgba(255,255,255,0.05),0_12px_40px_rgba(0,0,0,0.5)]"
            : "bg-white/90 backdrop-blur-3xl border-b border-white shadow-[0_1px_0_rgba(255,255,255,1),0_8px_32px_rgba(12,35,64,0.08)]"
      )}
    >
      {/* Glossy top line (only visible in solid light mode) */}
      {!isGlass && (!scrolled || !isTransparent || darkText) && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-azure-500/30 to-transparent pointer-events-none" />
      )}

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6 lg:h-[76px] lg:gap-6 lg:px-8 relative">

        {/* 1. Left Group: Hamburger + Logo + Category Selector */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Hamburger Menu Button */}
          <button
            type="button"
            onClick={toggleMobileMenu}
            aria-label="Ouvrir le menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="sidebar-nav"
            className={cn(
              "group relative z-[9999] flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-300 border sm:h-11 sm:w-11",
              useLightText
                ? "bg-white/10 text-white border-white/15 hover:bg-white/20 hover:border-white/30 shadow-inner"
                : "bg-slate-100/80 text-navy-900 border-slate-200/70 hover:bg-slate-200/80 hover:border-slate-300 hover:shadow-sm"
            )}
          >
            <MenuIcon size={24} className="transition-transform duration-300 group-hover:scale-105" />
          </button>

          {/* Brand Logo */}
          <Link
            href={categorySlug ? `/${categorySlug}` : "/"}
            aria-label={categorySlug ? `${company?.nomSociete || "RZMedical"} — ${selectedCategory?.nom}` : `${company?.nomSociete || "RZMedical"} — Accueil`}
            className={cn(
              "shrink-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-azure-500 transition-all duration-300 hover:scale-[1.03]",
              shouldHideLogo ? "opacity-0 pointer-events-none" : "opacity-100",
              useLightText && "drop-shadow-[0_2px_12px_rgba(14,165,233,0.4)]"
            )}
          >
            <Logo tone={useLightText ? "light" : "dark"} className="h-8 w-auto sm:h-9 lg:h-10" />
          </Link>

          {/* Category Dropdown Context Pill (Visible on all devices) */}
          {selectedCategory && (
            <div className="flex items-center shrink-0">
              <CategoryDropdown isGlass={useLightText} />
            </div>
          )}
        </div>

        {/* 2. Center: Prominent Search Bar */}
        <div className="hidden flex-1 items-center justify-center max-w-md xl:max-w-lg mx-2 md:flex">
          <button
            type="button"
            onClick={openSearch}
            className={cn(
              "group relative flex h-11 w-full items-center gap-3 rounded-2xl border px-4 text-left text-[13.5px] font-medium transition-all duration-300 focus-visible:outline-none overflow-hidden",
              useLightText
                ? "border-white/15 bg-white/[0.08] backdrop-blur-md text-white/70 hover:bg-white/[0.14] hover:border-white/30 hover:text-white shadow-inner"
                : "border-slate-200/90 bg-slate-100/60 text-slate-500 hover:bg-white hover:border-azure-300 hover:shadow-[0_4px_20px_rgba(14,165,233,0.12)] hover:text-navy-900"
            )}
          >
            {/* Gloss reflection on hover */}
            {!useLightText && (
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300" />
            )}

            <SearchIcon
              size={18}
              className={cn(
                "shrink-0 transition-transform duration-300 group-hover:scale-110",
                useLightText ? "text-white/60 group-hover:text-azure-300" : "text-slate-400 group-hover:text-azure-600"
              )}
            />
            <span className="flex-1 truncate relative z-10">
              Rechercher un produit, une marque...
            </span>
            <div className={cn(
              "hidden flex-shrink-0 items-center justify-center rounded-lg px-2 py-0.5 text-[10px] font-bold sm:flex border transition-all duration-300 relative z-10",
              useLightText
                ? "bg-white/10 text-white/80 border-white/10"
                : "bg-white text-slate-400 border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] group-hover:border-azure-200 group-hover:text-azure-600 group-hover:bg-azure-50"
            )}>
              <span className="mr-0.5 opacity-70">⌘</span>K
            </div>
          </button>
        </div>

        {/* 3. Right Group: Global Navigation + Account & Cart Actions */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:gap-3">

          {/* Navigation links (Desktop) */}
          <nav aria-label="Navigation principale" className="hidden xl:flex items-center gap-1">
            {[
              { href: `/catalogue`, label: "Catalogue" },
              { href: `/catalogue?filter=new`, label: "Nouveautés" },
              { href: `/catalogue?promo=1`, label: "Promotions" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 outline-none",
                  "focus-visible:ring-2 focus-visible:ring-azure-500",
                  useLightText
                    ? "text-white/80 hover:text-white hover:bg-white/10"
                    : "text-navy-700 hover:text-azure-700 hover:bg-azure-50/70",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className={cn("hidden h-6 w-[1px] rounded-full xl:block mx-1", useLightText ? "bg-white/15" : "bg-slate-200")} />

          {/* Mobile Search Icon */}
          <button
            type="button"
            onClick={openSearch}
            aria-label="Rechercher"
            className={cn(
              "md:hidden flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-300 border sm:h-11 sm:w-11",
              useLightText
                ? "text-white/90 bg-white/10 border-white/15 hover:bg-white/20 hover:text-white"
                : "text-navy-800 bg-slate-100/80 border-slate-200 hover:bg-slate-200 hover:shadow-sm"
            )}
          >
            <SearchIcon size={20} />
          </button>

          {/* Account / Login Button */}
          <Link
            href={isAuthenticated ? "/compte" : "/connexion"}
            aria-label={isAuthenticated ? "Mon compte" : "Se connecter"}
            className={cn(
              "group flex h-10 items-center gap-2.5 rounded-2xl px-2.5 sm:px-3.5 sm:h-11 text-[13.5px] font-bold transition-all duration-300 border",
              useLightText
                ? "border-white/15 bg-white/[0.08] text-white hover:bg-white/[0.16] hover:border-white/30 shadow-inner"
                : "border-slate-200/90 bg-white text-navy-800 hover:border-azure-300 hover:text-azure-700 hover:bg-azure-50/40 shadow-sm hover:shadow-md hover:-translate-y-[1px]"
            )}
          >
            <span className={cn(
              "flex h-7 w-7 items-center justify-center rounded-xl transition-all duration-300",
              useLightText
                ? "bg-white/15 text-white group-hover:bg-azure-500/30 group-hover:text-azure-300 group-hover:scale-110"
                : "bg-slate-100 text-slate-600 group-hover:bg-azure-100 group-hover:text-azure-600 group-hover:scale-110"
            )}>
              <UserIcon size={16} />
            </span>
            <span className="hidden sm:inline max-w-[100px] truncate relative z-10">
              {isAuthenticated
                ? user?.prenom
                  ? `${user.prenom}`
                  : "Mon compte"
                : "Connexion"}
            </span>
          </Link>

          {/* Cart Button */}
          <button
            type="button"
            onClick={openCart}
            aria-label={`Panier (${count} article${count > 1 ? "s" : ""})`}
            className={cn(
              "group flex h-10 items-center gap-2.5 rounded-2xl px-2.5 sm:px-3.5 sm:h-11 text-[13.5px] font-bold transition-all duration-300 border",
              useLightText
                ? "border-azure-500 bg-azure-600 text-white hover:bg-azure-500 hover:border-azure-400 shadow-sm"
                : "border-azure-600 bg-azure-600 text-white hover:bg-azure-700 hover:border-azure-700 shadow-sm hover:shadow-md"
            )}
          >
            <CartIcon size={18} className="transition-transform duration-300 group-hover:scale-105" />
            <span className="hidden sm:inline">Panier</span>
            {count > 0 && (
              <span className={cn(
                "flex h-5 min-w-[1.25rem] px-1.5 items-center justify-center rounded-full text-[10.5px] font-black transition-all duration-300 motion-safe:animate-badge-bump",
                "bg-white text-azure-700 shadow-sm"
              )}>
                {count > 99 ? "99+" : count}
              </span>
            )}
          </button>

        </div>
      </div>
    </header>
  );
}
