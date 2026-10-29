"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { BanniereSite } from "@/lib/types";
import { imageUrl } from "@/lib/api";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";

const AUTOPLAY_MS = 5500;

function isExternal(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

/**
 * Carrousel de bannières promotionnelles (contenu piloté par l'admin).
 * Défilement natif scroll-snap + lecture auto (désactivée si mouvement réduit,
 * au survol/focus, ou avec une seule diapositive). Flèches + puces.
 */
export function BannerCarousel({ banners }: { banners: BanniereSite[] }) {
  const slides = banners.filter((b) => Boolean(b.image));
  const railRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const count = slides.length;

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

  // Synchronise la puce active sur le défilement manuel (throttle rAF).
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

  // Lecture automatique.
  useEffect(() => {
    if (reduced || paused || count <= 1) return;
    const id = setInterval(() => goTo(index + 1), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [reduced, paused, count, index, goTo]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carrousel"
      aria-label="Mises en avant"
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        ref={railRef}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl shadow-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((b, i) => (
          <BannerSlide
            key={b.id}
            banner={b}
            eager={i === 0}
            position={`${i + 1} sur ${count}`}
          />
        ))}
      </div>

      {count > 1 && (
        <>
          <CarouselArrow side="left" onClick={() => goTo(index - 1)} />
          <CarouselArrow side="right" onClick={() => goTo(index + 1)} />

          <div className="absolute inset-x-0 bottom-4 flex justify-center items-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Aller à la diapositive ${i + 1}`}
                aria-current={i === index}
                className="h-2 w-2 rounded-full bg-white transition-[opacity,transform] duration-300 will-change-transform origin-center"
                style={{
                  transform: i === index ? "scaleX(3)" : "scaleX(1)",
                  opacity: i === index ? 1 : 0.5,
                }}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function CarouselArrow({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Diapositive précédente" : "Diapositive suivante"}
      className={cn(
        "absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-navy-900 shadow-md backdrop-blur transition-all duration-200 hover:bg-white hover:shadow-lg active:scale-95 sm:flex",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon size={22} />
    </button>
  );
}

function BannerSlide({
  banner,
  eager,
  position,
}: {
  banner: BanniereSite;
  eager: boolean;
  position: string;
}) {
  const hasText = Boolean(banner.titre || banner.description);

  const inner = (
    <>
      <Image
        src={imageUrl(banner.image)}
        alt={banner.titre ?? ""}
        fill
        sizes="(min-width: 1280px) 1216px, 100vw"
        className="object-cover"
        priority={eager}
        fetchPriority={eager ? "high" : "auto"}
        loading={eager ? "eager" : "lazy"}
      />
      {hasText && (
        <>
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-navy-950/80 via-navy-950/40 to-transparent"
          />
          <div className="absolute inset-0 flex flex-col justify-center p-6 sm:p-10 lg:p-14">
            <div className="max-w-lg">
              {banner.titre && (
                <h2 className="text-2xl font-bold leading-tight text-white drop-shadow-sm sm:text-4xl">
                  {banner.titre}
                </h2>
              )}
              {banner.description && (
                <p className="mt-2 text-sm text-navy-100 sm:text-base">
                  {banner.description}
                </p>
              )}
              {banner.lien && (
                <span className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 shadow-sm transition-transform duration-200 group-hover:translate-x-0.5">
                  Découvrir
                  <ArrowRightIcon size={16} />
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );

  const className =
    "group relative aspect-[16/9] w-full shrink-0 snap-center overflow-hidden bg-navy-100 sm:aspect-[21/9]";
  const a11y = {
    "aria-roledescription": "diapositive",
    "aria-label": position,
  };

  if (banner.lien) {
    return isExternal(banner.lien) ? (
      <a
        href={banner.lien}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        {...a11y}
      >
        {inner}
      </a>
    ) : (
      <Link href={banner.lien} className={className} {...a11y}>
        {inner}
      </Link>
    );
  }

  return (
    <div className={className} {...a11y}>
      {inner}
    </div>
  );
}
