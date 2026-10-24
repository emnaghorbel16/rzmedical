"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState } from "react";
import { Container } from "@/components/ui/Container";
import { buttonVariants } from "@/components/ui/Button";
import { ArrowRightIcon, PhoneIcon } from "@/components/ui/icons";
import { imageUrl } from "@/lib/api";
import type { VideoHero } from "@/lib/types";
import { useSetHeroVideo, useSetHeroImage } from "@/providers/HeroVideoProvider";

/** Section d'accroche de la page d'accueil. */
export function Hero({ videoHero }: { videoHero?: VideoHero | null }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const showVideo = !!(videoHero && videoHero.actif && !videoFailed);

  // Signal the header which mode we're in
  useSetHeroVideo(showVideo);
  useSetHeroImage(!showVideo);

  /* ── Variante vidéo ── */
  if (showVideo) {
    return (
      <section
        className="relative overflow-hidden w-full flex items-center justify-center bg-navy-960"
        style={{
          height: "60vh",
          maxHeight: "60vh",
          minHeight: "320px",
        }}
      >
        {/* Ligne décorative haute */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-azure-500/40 to-transparent z-20" />
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

        <div className="relative z-20 w-full px-6 lg:px-8 flex flex-col items-center text-center">
          <h1 className="font-display font-black text-3xl sm:text-4xl lg:text-6xl leading-[1.06] tracking-tight text-white mb-4 drop-shadow">
            Matériel médical,{" "}
            <span className="text-azure-300">livré en confiance</span>.
          </h1>
          <p className="text-sm sm:text-base text-white/70 mb-8 max-w-md mx-auto">
            Équipements certifiés pour les professionnels de santé en Tunisie.
          </p>
          <Link href="/catalogue" className={buttonVariants({ variant: "accent", size: "lg" })}>
            Voir le catalogue
            <ArrowRightIcon size={16} />
          </Link>
        </div>
      </section>
    );
  }

  /* ── Variante image (sans vidéo) ── */
  return (
    <section
      className="relative w-full overflow-hidden flex flex-col min-h-[580px] lg:min-h-[680px]"
    >
      {/* ── Image de fond ── */}
      <Image
        src="/images/hero_bg.jpg"
        alt="RZ Medical – Équipements médicaux et dentaires"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[80%_center] lg:object-right"
      />

      {/* Ligne décorative haute */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-azure-400/50 to-transparent z-20" />

      {/* ── Contenu principal — calé sur la gauche pour laisser le smartphone visible à droite ── */}
      <Container className="relative z-20 flex flex-col justify-center flex-1 pt-24 pb-16 lg:pt-28 lg:pb-20">
        <div className="max-w-xl lg:max-w-2xl">

          {/* Titre */}
          <h1 className="font-display font-black text-4xl sm:text-5xl lg:text-[4rem] xl:text-[4.5rem] leading-[1.04] tracking-tight text-white mb-6 drop-shadow-lg">
            L&apos;excellence médicale,{" "}
            <br className="hidden sm:block" />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(90deg, #60b8ff 0%, #a8d4ff 50%, #7ec8ff 100%)",
              }}
            >
              à portée de votre cabinet.
            </span>
          </h1>

          {/* Description */}
          <p className="text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mb-10">
            R&amp;Z Medical distribue du matériel médical et dentaire certifié aux professionnels
            de santé partout en Tunisie. Commandez aujourd&apos;hui, recevez sous 24-48h.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/catalogue"
              className={buttonVariants({ variant: "accent", size: "xl" })}
            >
              Explorer le catalogue
              <ArrowRightIcon size={18} />
            </Link>
            <a
              href="tel:+21628113131"
              className="inline-flex h-14 items-center justify-center gap-2.5 rounded-xl border border-white/20 bg-white/10 backdrop-blur-md px-8 text-sm font-semibold text-white transition-all hover:bg-white/20 hover:border-white/30 shadow-lg"
            >
              <PhoneIcon size={16} />
              +216 28 113 131
            </a>
          </div>
        </div>
      </Container>

      {/* ── Flèche de scroll ── */}
      <div className="absolute bottom-8 right-8 z-20 hidden lg:flex flex-col items-center gap-2 opacity-40">
        <div className="h-12 w-px bg-gradient-to-b from-white/0 to-white/60" />
        <span className="text-[9px] font-semibold uppercase tracking-widest text-white rotate-90 origin-center mt-1">Défiler</span>
      </div>
    </section>
  );
}