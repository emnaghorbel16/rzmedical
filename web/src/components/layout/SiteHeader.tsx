"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnnouncementBar } from "./AnnouncementBar";
import { DiscountBar } from "./DiscountBar";
import { Header } from "./Header";
import type { CategorieListItem, MarqueListItem, AnnonceSite } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useHasHeroVideo, useHasHeroImage } from "@/providers/HeroVideoProvider";

export function SiteHeader({
  annonces = [],
  categories = [],
  marques = [],
  hasGlobalVideoHero = false,
}: {
  annonces?: AnnonceSite[];
  categories?: CategorieListItem[];
  marques?: MarqueListItem[];
  hasGlobalVideoHero?: boolean;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [announcementVisible, setAnnouncementVisible] = useState(true);

  // Combine context (set by Hero components on client) with SSR knowledge
  // If we are on the home page and the global setting says there's a video,
  // we can assume true during SSR, preventing the banner from flashing.
  const contextHasVideo = useHasHeroVideo();
  const hasHeroVideo = contextHasVideo || (isHome && hasGlobalVideoHero);
  const hasHeroImage = useHasHeroImage();

  // Either video or full-bleed image triggers the transparent header
  const hasFullBleedHero = hasHeroVideo || hasHeroImage;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // initial check
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // When a hero (video or image) is active and the user hasn't scrolled yet,
  // the header floats in transparent/glass mode.
  const isInitialVideoState = hasFullBleedHero && !scrolled;

  return (
    <div
      className={cn(
        "w-full z-50 flex flex-col",
        // Float over the hero (video or image); otherwise anchor above content
        hasFullBleedHero ? "fixed top-0 left-0 right-0" : "sticky top-0"
      )}
    >
      {/* Announcement bar — hidden while floating over video */}
      <div
        className={cn(
          "w-full transition-all duration-500 overflow-hidden",
          isInitialVideoState
            ? "h-0 opacity-0 -translate-y-full"
            : "opacity-100 translate-y-0"
        )}
      >
        {/* Collapse wrapper: grid trick for smooth height→0 animation */}
        <div
          className="grid transition-all duration-300 ease-in-out"
          style={{ gridTemplateRows: announcementVisible ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <AnnouncementBar
              annonces={annonces}
              onDismiss={() => setAnnouncementVisible(false)}
            />
          </div>
        </div>
        <DiscountBar />
      </div>

      {/* Main header */}
      <div className="w-full">
        <Header
          categories={categories}
          marques={marques}
          isTransparent={isInitialVideoState}
          hideLogo={hasHeroVideo && !scrolled}
          darkText={hasHeroImage && !hasHeroVideo}
        />
      </div>
    </div>
  );
}
