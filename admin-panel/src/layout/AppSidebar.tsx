"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import { useCompanyInfo } from "../context/CompanyInfoContext";
import { getApiUrl, getBaseUrl } from "@/utils/api";
import { useAuth } from "../hooks/useAuth";
import {
  BoxCubeIcon,
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  ListIcon,
  UserCircleIcon,
} from "../icons/index";
import SidebarWidget from "./SidebarWidget";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

const navItems: NavItem[] = [
  {
    icon: (
      <svg className="fill-current" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="currentColor" />
      </svg>
    ),
    name: "Accueil",
    path: "/",
  },
  {
    icon: <GridIcon />,
    name: "Tableau de Bord",
    path: "/dashboard",
  },
  {
    icon: (
      <svg className="fill-current" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" fill="currentColor" />
      </svg>
    ),
    name: "Impayés",
    path: "/impayes",
  },
  {
    icon: <GridIcon />,
    name: "Stock",
    path: "/stock",
  },
  {
    icon: <GridIcon />,
    name: "Mouvements de stock",
    path: "/mouvements-stock",
  },
  {

    name: "Catalogue",
    icon: <BoxCubeIcon />,
    subItems: [
      { name: "Catégories", path: "/categories", pro: false },
      { name: "Sous-Catégories", path: "/subcategories", pro: false },
      { name: "Ordre sous-catégories", path: "/reorder-subcategories", pro: false },
      { name: "Marques", path: "/brands", pro: false },
      { name: "Produits", path: "/products", pro: false },

    ],
  },


  {
    name: "Ventes",
    icon: <ListIcon />,
    subItems: [
      { name: "Commandes", path: "/orders", pro: false },
      { name: "Bons de Livraison", path: "/bons-livraison", pro: false, new: true },
      { name: "Bons de Sortie", path: "/bons-sortie", pro: false },
      { name: "Factures Clients", path: "/invoices", pro: false },
      { name: "Factures Annulées", path: "/invoices/annulees", pro: false },
      { name: "Avoirs Clients", path: "/avoirs", pro: false },
      { name: "Devis Clients", path: "/devis", pro: false },
      { name: "Exercices Fiscaux", path: "/exercices", pro: false },
    ],
  },

  {
    name: "Achats",
    icon: (
      <svg className="fill-current" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2zm-9.83-3.25l.03-.12.9-1.63H17c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0021.46 4H5.21L4.27 2H1v2h2l3.6 7.59-1.35 2.44C4.52 15.37 5.48 17 7 17h12v-2H7a.13.13 0 01-.13-.13l.1-.12z" fill="currentColor" />
      </svg>
    ),
    subItems: [
      { name: "Factures Fournisseurs", path: "/factures-fournisseurs", pro: false, new: true },
      { name: "Bons de Commande", path: "/bons-commande", pro: false },
      { name: "Bons de Réception", path: "/bons-reception", pro: false },
    ],
  },
  {
    name: "Charges",
    icon: (
      <svg className="fill-current" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M4 5a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4h10v2H7V9zm0 4h6v2H7v-2z" fill="currentColor" />
      </svg>
    ),
    subItems: [
      { name: "Charges", path: "/charges", pro: false, new: true },
      { name: "CNSS", path: "/charges/cnss", pro: false },
      { name: "9ba4a", path: "/charges/9ba4a", pro: false },
    ],
  },
  {
    name: "Stock Commerciaux",
    icon: (
      <svg className="fill-current" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    subItems: [
      { name: "Tableau de bord", path: "/stock-commercial", pro: false },
      { name: "Inventaires", path: "/inventaires", pro: false },
    ],
  },
  {
    icon: <GridIcon />,
    name: "exercice",
    path: "/exercices",
  },
  {
    name: "Utilisateurs",
    icon: <UserCircleIcon />,
    subItems: [
      { name: "Mon Profil", path: "/profile", pro: false },
      { name: "Administrateurs", path: "/admins", pro: false },
      { name: "Comptes Clients", path: "/customers", pro: false },
      { name: "Commerciaux", path: "/commerciaux", pro: false },
      { name: "Tiers", path: "/tiers", pro: false },
      { name: "Fournisseurs", path: "/fournisseurs", pro: false },
    ],
  },
  {
    name: "Contenu du site",
    icon: <GridIcon />,
    path: "/site-content",
  },
  {
    name: "Support",
    icon: <ListIcon />,
    path: "/support",
  },
];


const othersItems: NavItem[] = [
  {
    icon: (
      <svg className="fill-current" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="currentColor" />
      </svg>
    ),
    name: "Configuration",
    subItems: [
      { name: "Société & Fiscalité", path: "/configuration", pro: false },
      { name: "Services", path: "/configuration/services", pro: false },
    ]
  },
  {
    icon: <UserCircleIcon />,
    name: "Paramètres",
    path: "/profile",
  },
  {
    icon: (
      <svg className="fill-current" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm16 2l-8 5-8-5v12h16V6zm-8 7l8-5v1.2l-8 5-8-5V6l8 5z" fill="currentColor" />
      </svg>
    ),
    name: "Inbox",
    path: "/inbox",
  }
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered, toggleMobileSidebar } = useSidebar();
  const pathname = usePathname();
  const { companyInfo } = useCompanyInfo();
  const API_URL = getApiUrl();
  const logoSrc = companyInfo?.logoUrl ? (companyInfo.logoUrl.startsWith("http") ? companyInfo.logoUrl : `${getBaseUrl()}${companyInfo.logoUrl}`) : "/images/logo/logo-rzmedical.png";

  const renderMenuItems = (
    navItems: NavItem[],
    menuType: "main" | "others"
  ) => (
    <ul className="flex flex-col gap-4">
      {navItems.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group  ${openSubmenu?.type === menuType && openSubmenu?.index === index
                ? "menu-item-active"
                : "menu-item-inactive"
                } cursor-pointer ${!isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
                }`}
            >
              <span
                className={` ${openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-icon-active"
                  : "menu-item-icon-inactive"
                  }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className={`menu-item-text`}>{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200  ${openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                    ? "rotate-180 text-brand-500"
                    : ""
                    }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                onClick={() => {
                  if (isMobileOpen) toggleMobileSidebar();
                }}
                className={`menu-item group ${isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                  }`}
              >
                <span
                  className={`${isActive(nav.path)
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                    }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className={`menu-item-text`}>{nav.name}</span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      href={subItem.path}
                      onClick={() => {
                        if (isMobileOpen) toggleMobileSidebar();
                      }}
                      className={`menu-dropdown-item ${isActive(subItem.path)
                        ? "menu-dropdown-item-active"
                        : "menu-dropdown-item-inactive"
                        }`}
                    >
                      {subItem.name}
                      <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                          <span
                            className={`ml-auto ${isActive(subItem.path)
                              ? "menu-dropdown-badge-active"
                              : "menu-dropdown-badge-inactive"
                              } menu-dropdown-badge `}
                          >
                            new
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ml-auto ${isActive(subItem.path)
                              ? "menu-dropdown-badge-active"
                              : "menu-dropdown-badge-inactive"
                              } menu-dropdown-badge `}
                          >
                            pro
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "others";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback(
    (path: string) => path === pathname || (path === "/" && pathname === "/accueil"),
    [pathname]
  );

  useEffect(() => {
    // Check if the current path matches any submenu item
    let submenuMatched = false;
    ["main", "others"].forEach((menuType) => {
      const items = menuType === "main" ? navItems : othersItems;
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (isActive(subItem.path)) {
              setOpenSubmenu({
                type: menuType as "main" | "others",
                index,
              });
              submenuMatched = true;
            }
          });
        }
      });
    });

    // If no submenu item matches, close the open submenu
    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [pathname, isActive]);

  useEffect(() => {
    // Set the height of the submenu items when the submenu is opened
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${isExpanded || isMobileOpen
          ? "w-[290px]"
          : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex  ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
          }`}
      >
        <Link href="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <img
                className="dark:hidden"
                src={logoSrc}
                alt="Logo"
                width={150}
                height={40}
              />
              <img
                className="hidden dark:block"
                src={logoSrc}
                alt="Logo"
                width={150}
                height={40}
              />
            </>
          ) : (
            <img
              src={logoSrc}
              alt="Logo"
              width={32}
              height={32}
            />
          )}
        </Link>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${!isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "justify-start"
                  }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(navItems, "main")}
            </div>

            <div className="">
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${!isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "justify-start"
                  }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Others"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(othersItems, "others")}
            </div>
          </div>
        </nav>
        {isExpanded || isHovered || isMobileOpen ? <SidebarWidget /> : null}
        <LogoutButton />
      </div>
    </aside>
  );
};

function LogoutButton() {
  const [mounted, setMounted] = useState(false);
  const { logout, getUser, isExpanded, isHovered, isMobileOpen } = (() => {
    const auth = useAuth();
    const sidebar = useSidebar();
    return { ...auth, ...sidebar };
  })();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const user = getUser();
  const expanded = isExpanded || isHovered || isMobileOpen;

  return (
    <div className={`mt-4 border-t border-gray-200 dark:border-gray-800 pt-4 px-3 pb-2`}>
      {expanded && user && (
        <div className="mb-2 px-1">
          <p className="text-xs font-medium text-gray-800 dark:text-white/90 truncate">{user.prenom} {user.nom}</p>
          <p className="text-xs text-gray-400 truncate">{user.email}</p>
        </div>
      )}
      <button
        onClick={logout}
        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        {expanded && <span>Déconnexion</span>}
      </button>
    </div>
  );
}

export default AppSidebar;
