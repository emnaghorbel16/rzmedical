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

const STATS = [
  { value: "500+", label: "références en stock" },
  { value: "50+", label: "marques partenaires" },
  { value: "24-48h", label: "délai de livraison" },
];

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
      className="relative w-full overflow-hidden flex flex-col"
      style={{ minHeight: "100vh" }}
    >
      {/* ── Image de fond ── */}
      <Image
        src="/images/hero_bg.jpg"
        alt="RZ Medical – Équipements médicaux et dentaires"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />

      {/* ── Couches d'overlay ── */}
      {/* Dégradé foncé principal pour la lisibilité du texte */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628]/85 via-[#0e2456]/70 to-[#0d3a8c]/50 z-10 pointer-events-none" />
      {/* Bruit de texture subtil */}
      <div
        className="absolute inset-0 z-10 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
        }}
      />
      {/* Ligne décorative haute */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-azure-400/50 to-transparent z-20" />

      {/* ── Contenu principal ── */}
      <Container className="relative z-20 flex flex-col justify-center flex-1 pt-48 pb-20 lg:pt-52 lg:pb-24">
        <div className="max-w-3xl">

          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2 mb-8 shadow-lg">
            <span className="flex h-2 w-2 rounded-full bg-azure-400 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/90">
              Sfax · Tunisie — Livraison nationale
            </span>
          </div>

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

      {/* ── Barre de stats ── */}
      <div className="relative z-20 border-t border-white/10 bg-black/25 backdrop-blur-sm">
        <Container>
          <div className="grid grid-cols-3 divide-x divide-white/10 py-5">
            {STATS.map(({ value, label }) => (
              <div key={label} className="px-6 first:pl-0 last:pr-0 text-center sm:text-left">
                <p className="font-display text-xl sm:text-2xl font-black text-white">{value}</p>
                <p className="text-[11px] sm:text-xs text-white/50 mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </Container>
      </div>

      {/* ── Flèche de scroll ── */}
      <div className="absolute bottom-20 right-8 z-20 hidden lg:flex flex-col items-center gap-2 opacity-50">
        <div className="h-12 w-px bg-gradient-to-b from-white/0 to-white/60" />
        <span className="text-[9px] font-semibold uppercase tracking-widest text-white rotate-90 origin-center mt-1">Défiler</span>
      </div>
    </section>
  );
}