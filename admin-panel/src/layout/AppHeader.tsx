"use client";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import UserDropdown from "@/components/header/UserDropdown";
import ExerciceDropdown from "@/components/header/ExerciceDropdown";
import { useSidebar } from "@/context/SidebarContext";
import Image from "next/image";
import Link from "next/link";
import { useCompanyInfo } from "@/context/CompanyInfoContext";
import { getApiUrl } from "@/utils/api";
import React, { useState ,useEffect,useRef} from "react";

const AppHeader: React.FC = () => {
  const { companyInfo } = useCompanyInfo();
  const API_URL = getApiUrl();
  const logoSrc = companyInfo?.logoUrl ? (companyInfo.logoUrl.startsWith("http") ? companyInfo.logoUrl : `${API_URL.replace("/api", "")}${companyInfo.logoUrl}`) : "/images/logo/logo-rzmedical.png";
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);

  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  const toggleApplicationMenu = () => {
    setApplicationMenuOpen(!isApplicationMenuOpen);
  };
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 flex w-full overflow-visible border-b border-gray-200 bg-white/95 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/95">
      <div className="flex w-full min-w-0 items-center justify-between px-2 py-2 sm:px-3 lg:px-5">
        {/* Left Area: Sidebar Toggle & Brand */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
            onClick={handleToggle}
            aria-label="Toggle Sidebar"
          >
            {isMobileOpen ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            )}
          </button>

          <Link href="/" className="hidden items-center sm:flex lg:hidden">
            <img
              width={120}
              height={28}
              className="h-6 w-auto object-contain dark:hidden"
              src={logoSrc}
              alt="RZMedical Logo"
            />
            <img
              width={120}
              height={28}
              className="hidden h-6 w-auto object-contain dark:block"
              src={logoSrc}
              alt="RZMedical Logo"
            />
          </Link>
        </div>

        {/* Right Area: Exercice Selector, Theme Toggle, Notifications, Profile */}
        <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
          <ExerciceDropdown />
          <ThemeToggleButton />
          <NotificationDropdown />
          <UserDropdown />
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
