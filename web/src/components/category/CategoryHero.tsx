"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Container } from "@/components/ui/Container";
import { buttonVariants } from "@/components/ui/Button";
import { ArrowRightIcon, SparklesIcon, TagIcon } from "@/components/ui/icons";
import { imageUrl } from "@/lib/api";
import type { VideoHero, CategorieListItem } from "@/lib/types";
import { toSlug } from "@/lib/slug";
import { cn } from "@/lib/cn";
import { useSetHeroVideo } from "@/providers/HeroVideoProvider";

interface CategoryHeroProps {
  category: CategorieListItem;
  videoHero?: VideoHero | null;
}

/** Hero section pour les pages de catégorie — plein écran avec vidéo si disponible. */
export function CategoryHero({ category, videoHero }: CategoryHeroProps) {
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const slug = toSlug(category.nom);
  const showVideo = !!(videoHero && videoHero.actif && !videoFailed);

  // Signal to SiteHeader that this page has an active video hero
  useSetHeroVideo(showVideo);

  return (
    <section
      className={cn(
        "relative overflow-hidden flex items-center justify-center",
        showVideo
          ? "bg-navy-960"
          : "bg-gradient-to-br from-navy-950 via-navy-900 to-azure-950 min-h-[55vh] lg:min-h-[70vh] items-end"
      )}
      style={showVideo ? {
        width: "100vw",
        marginLeft: "calc(50% - 50vw)",
        marginRight: "calc(50% - 50vw)",
        height: "30vh",
        maxHeight: "30vh",
        minHeight: "180px",
        paddingTop: "64px",
      } : undefined}
    >
      {/* ── Background ─────────────────────────────────────────────── */}
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          poster={videoHero!.posterUrl ? imageUrl(videoHero!.posterUrl) : undefined}
          onError={() => setVideoFailed(true)}
          className="absolute inset-0 w-full h-full object-cover z-0"
        >
          <source src={imageUrl(videoHero!.videoUrl)} type="video/mp4" />
          <source src={imageUrl(videoHero!.videoUrl)} type="video/webm" />
        </video>
      ) : (
        <>
          {/* Subtle texture: light top border highlight */}
          <div className="absolute top-0 left-0 right-0 h-px bg-white/10 pointer-events-none" />
        </>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-navy-960 via-navy-950/60 to-navy-950/10 z-10 pointer-events-none" />

      {/* ── Content ────────────────────────────────────────────────── */}
      <Container
        className={cn(
          "relative z-20",
          showVideo
            ? "py-12 lg:py-16 flex flex-col items-center text-center"
            : "pb-14 pt-32 lg:pb-20"
        )}
      >
        <div className={cn(showVideo ? "w-full max-w-4xl mx-auto" : "max-w-2xl")}>
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-azure-400/30 bg-azure-500/10 px-4 py-1.5 mb-5">
            <span className="h-px w-4 bg-azure-400/60" />
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-azure-300">
              Catégorie
            </span>
          </div>

          {/* Category name */}
          <h1 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-white mb-5">
            {category.nom}
          </h1>

          <p className={cn(
            "text-[16px] sm:text-lg leading-relaxed text-navy-200 mb-8",
            showVideo ? "max-w-2xl mx-auto" : "max-w-xl"
          )}>
            Découvrez notre sélection complète de produits{" "}
            <span className="text-white font-semibold">{category.nom.toLowerCase()}</span>{" "}
            &mdash; matériel professionnel certifié, livré partout en Tunisie.
          </p>

          {/* CTAs */}
          <div className={cn(
            "flex flex-col gap-3 sm:flex-row",
            showVideo && "justify-center"
          )}>
            <Link
              href={`/${slug}/nouveautes`}
              className={cn(
                buttonVariants({ variant: "accent", size: "lg" }),
                "gap-2"
              )}
            >
              <SparklesIcon size={18} />
              Nouveautés
            </Link>
            <Link
              href={`/${slug}/promotions`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-6 text-[14px] font-semibold text-white transition-all duration-200 hover:bg-white/20 hover:border-white/30"
            >
              <TagIcon size={16} />
              Promotions
            </Link>
            <Link
              href={`/${slug}/sous-categories`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-6 text-[14px] font-semibold text-white transition-all duration-200 hover:bg-white/20 hover:border-white/30"
            >
              Explorer les rayons
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
