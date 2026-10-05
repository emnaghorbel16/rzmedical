"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Container } from "@/components/ui/Container";
import { buttonVariants } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { imageUrl } from "@/lib/api";
import type { VideoHero, CategorieListItem } from "@/lib/types";
import { toSlug } from "@/lib/slug";
import { cn } from "@/lib/cn";
import { useSetHeroVideo } from "@/providers/HeroVideoProvider";

interface CategoryHeroProps {
  category: CategorieListItem;
  videoHero?: VideoHero | null;
}

/** Hero section pour les pages de catégorie. */
export function CategoryHero({ category, videoHero }: CategoryHeroProps) {
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const slug = toSlug(category.nom);
  const showVideo = !!(videoHero && videoHero.actif && !videoFailed);
  useSetHeroVideo(showVideo);

  /* ── Variante vidéo ── */
  if (showVideo) {
    return (
      <section
        className="relative overflow-hidden flex items-center justify-center bg-navy-960"
        style={{
          width: "100vw",
          marginLeft: "calc(50% - 50vw)",
          marginRight: "calc(50% - 50vw)",
          height: "60vh",
          maxHeight: "60vh",
          minHeight: "320px",
          paddingTop: "64px",
        }}
      >
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

        <div className="absolute inset-0 bg-navy-960/55 z-10 pointer-events-none" />

        <div className="relative z-20 w-full max-w-3xl mx-auto px-6 lg:px-8 flex flex-col items-center text-center">
          <h1 className="font-display font-black text-3xl sm:text-4xl lg:text-6xl leading-[1.05] tracking-tight text-white mb-4">
            {category.nom}
          </h1>
          <p className="text-sm sm:text-base text-white/70 mb-8">
            Matériel certifié, livré partout en Tunisie.
          </p>
          <Link
            href={`/${slug}`}
            className={buttonVariants({ variant: "accent", size: "lg" })}
          >
            Voir les produits
            <ArrowRightIcon size={16} />
          </Link>
        </div>
      </section>
    );
  }

  /* ── Variante sans vidéo ── */
  return (
    <section className="relative overflow-hidden bg-navy-960 flex flex-col min-h-[50vh] justify-end pb-16 lg:pb-24 pt-32">
      {/* Ligne décorative haute */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-azure-500/40 to-transparent" />

      {/* Fond — grain subtil */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
        }}
      />

      <Container className="relative z-10">
        <div className="max-w-2xl">
          <p className="text-azure-400 text-xs font-semibold uppercase tracking-[0.18em] mb-4">
            Catégorie
          </p>
          
          <h1 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-white mb-6">
            {category.nom}
          </h1>

          <p className="text-slate-400 text-base leading-relaxed max-w-xl mb-8">
            Découvrez notre sélection de{" "}
            <span className="text-white font-semibold">{category.nom.toLowerCase()}</span>{" "}
            — matériel professionnel certifié, expédié le jour même et livré partout en Tunisie.
          </p>

          <Link
            href={`/${slug}`}
            className={buttonVariants({ variant: "accent", size: "lg" })}
          >
            Voir les produits
            <ArrowRightIcon size={16} />
          </Link>
        </div>
      </Container>
    </section>
  );
}
