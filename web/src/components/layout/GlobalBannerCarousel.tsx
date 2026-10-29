"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { BanniereSite } from "@/lib/types";
import { imageUrl } from "@/lib/api";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ChevronLeftIcon, ChevronRightIcon, ArrowRightIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

const AUTOPLAY_MS = 2000;

function isExternal(href: string) {
  return href.startsWith("http://") || href.startsWith("https://");
}

/**
 * Carrousel plein-largeur positionné juste sous le header, visible sur toutes
 * les pages. Il s'affiche uniquement quand au moins une bannière est active.
 */
export function GlobalBannerCarousel({ banners }: { banners: BanniereSite[] }) {
  const pathname = usePathname();
  const slides = banners.filter((b) => Boolean(b.image));
  const count = slides.length;
  const railRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();

  const goTo = useCallback(
    (i: number, smooth = true) => {
      const rail = railRef.current;
      if (!rail || count === 0) return;
      const next = ((i % count) + count) % count;
      rail.scrollTo({
        left: next * rail.clientWidth,
        behavior: smooth && !reduced ? "smooth" : "auto",
      });
    },
    [count, reduced],
  );

  // Track scroll position → active dot
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!rail.clientWidth) return;
        setIndex(Math.round(rail.scrollLeft / rail.clientWidth));
      });
    };
    rail.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      rail.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Autoplay
  useEffect(() => {
    if (paused || count <= 1) return;

    const timeoutId = setTimeout(() => {
      goTo(index + 1);
    }, AUTOPLAY_MS);

    return () => clearTimeout(timeoutId);
  }, [index, paused, count, goTo]);

  // Affiche sur l'accueil ("/") et sur toutes les pages catégorie ("/dentaire", "/optique", etc.)
  const isHome = pathname === "/";
  const isCategoryPage = /^\/[^/]+$/.test(pathname); // un seul segment, ex: /dentaire

  if (count === 0 || !(isHome || isCategoryPage)) return null;

  return (
    <section
      aria-roledescription="carrousel"
      aria-label="Bannières promotionnelles"
      className="relative w-full overflow-hidden shadow-md"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Rail */}
      <div
        ref={railRef}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((b, i) => (
          <Slide key={b.id} banner={b} eager={i === 0} position={`${i + 1} sur ${count}`} />
        ))}
      </div>

      {/* Controls — only when multiple slides */}
      {count > 1 && (
        <>
          {/* Arrows */}
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Diapositive précédente"
            className="absolute left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-navy-900 shadow-md backdrop-blur-sm transition-all hover:bg-white hover:shadow-lg active:scale-95 sm:flex"
          >
            <ChevronLeftIcon size={20} />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Diapositive suivante"
            className="absolute right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-navy-900 shadow-md backdrop-blur-sm transition-all hover:bg-white hover:shadow-lg active:scale-95 sm:flex"
          >
            <ChevronRightIcon size={20} />
          </button>

          {/* Dots */}
          <div className="absolute inset-x-0 bottom-3 flex justify-center items-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Aller à la bannière ${i + 1}`}
                aria-current={i === index}
                className="h-2 w-2 rounded-full bg-white transition-[opacity,transform] duration-300 will-change-transform origin-center"
                style={{
                  transform: i === index ? "scaleX(3)" : "scaleX(1)",
                  opacity: i === index ? 1 : 0.5,
                }}
              />
            ))}
          </div>

          {/* Progress bar */}
          {!paused && !reduced && (
            <div
              key={index}
              className="absolute bottom-0 left-0 h-0.5 bg-azure-400/80"
              style={{
                animation: `progressBar ${AUTOPLAY_MS}ms linear forwards`,
              }}
            />
          )}
        </>
      )}
    </section>
  );
}

function Slide({
  banner,
  eager,
  position,
}: {
  banner: BanniereSite;
  eager: boolean;
  position: string;
}) {
  const hasText = Boolean(banner.titre || banner.description);

  const content = (
    <>
      <Image
        src={imageUrl(banner.image)}
        alt={banner.titre ?? "Bannière promotionnelle"}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1200px) 100vw, 1920px"
        className="object-cover object-center"
        priority={eager}
        fetchPriority={eager ? "high" : "auto"}
        loading={eager ? "eager" : "lazy"}
      />
      {hasText && (
        <>
          {/* Overlays — full coverage so text stays readable on any image/device */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-navy-950/85 via-navy-950/55 to-navy-950/20"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-navy-950/70 via-transparent to-navy-950/30"
          />
          <div className="absolute inset-0 flex flex-col justify-center px-5 py-8 sm:px-12 sm:py-10 lg:px-20">
            <div className="max-w-xl">
              {banner.titre && (
                <h2 className="text-2xl font-bold leading-tight text-white drop-shadow sm:text-3xl lg:text-4xl">
                  {banner.titre}
                </h2>
              )}
              {banner.description && (
                <p className="mt-2 text-[13.5px] leading-relaxed text-white/90 drop-shadow sm:text-base">
                  {banner.description}
                </p>
              )}
              {banner.lien && (
                <span className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 shadow transition-transform duration-200 hover:translate-x-0.5 sm:w-auto sm:py-2">
                  Découvrir
                  <ArrowRightIcon size={15} />
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );

  const height = Math.min(960, Math.max(420, banner.hauteur || 680));
  const bannerStyle = { "--banner-h": `${height}px` } as CSSProperties;
  const cls =
    "group relative w-full shrink-0 snap-center overflow-hidden bg-navy-100 h-[220px] sm:h-[460px] lg:h-[var(--banner-h)]";
  const a11y = {
    "aria-roledescription": "diapositive" as const,
    "aria-label": position,
  };

  if (banner.lien) {
    return isExternal(banner.lien) ? (
      <a href={banner.lien} target="_blank" rel="noopener noreferrer" className={cls} style={bannerStyle} {...a11y}>
        {content}
      </a>
    ) : (
      <Link href={banner.lien} className={cls} style={bannerStyle} {...a11y}>
        {content}
      </Link>
    );
  }

  return (
    <div className={cls} style={bannerStyle} {...a11y}>
      {content}
    </div>
  );
}
