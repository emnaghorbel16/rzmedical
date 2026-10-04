"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState } from "react";
import { Container } from "@/components/ui/Container";
import { buttonVariants } from "@/components/ui/Button";
import {
  ArrowRightIcon,
  CheckIcon,
  ShieldCheckIcon,
  TruckIcon,
} from "@/components/ui/icons";
import { imageUrl } from "@/lib/api";
import type { VideoHero } from "@/lib/types";
import { useSetHeroVideo } from "@/providers/HeroVideoProvider";

const TRUST = [
  "Matériel qui respecte vraiment les normes (CE, traçabilité)",
  "On expédie votre commande dans la journée (avant 14h)",
  "Vous payez à la livraison, avec une facture claire",
];

const STATS = [
  { value: "500+", label: "références en stock" },
  { value: "50+", label: "marques partenaires" },
  { value: "24-48h", label: "pour être livré" },
];

/** Section d'accroche de la page d'accueil (proposition de valeur + CTA). */
export function Hero({ videoHero }: { videoHero?: VideoHero | null }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const showVideo = !!(videoHero && videoHero.actif && !videoFailed);

  // Signal to SiteHeader that this page has an active video hero
  useSetHeroVideo(showVideo);

  if (showVideo) {
    return (
      <section
        className="relative overflow-hidden flex items-center justify-center"
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

        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-navy-960/60 via-navy-950/50 to-navy-960/70 z-10 pointer-events-none" />

        {/* Centered content — full width */}
        <div className="relative z-20 w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-10 flex flex-col items-center text-center">
          <div className="w-full max-w-4xl mx-auto">
            <HeroContent isTransparent />
          </div>
        </div>
      </section>
    );
  }

  // Premium light 3D hero
  return (
    <section className="relative overflow-hidden bg-slate-50 min-h-[85vh] flex items-center">

      {/* === Background atmosphere === */}
      {/* Grid pattern */}
      <div className="absolute inset-0 grid-pattern opacity-[0.12] pointer-events-none" />

      {/* Ambient orbs */}
      {/* Background blobs removed for flat design */}

      {/* Animated scan line */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-azure-500/20 to-transparent animate-[scanLine_6s_ease-in-out_infinite]" />
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none" />

      <Container className="relative z-10 py-16 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">

          {/* === Left: Content === */}
          <div className="animate-reveal-up">
            {/* Eyebrow pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-azure-200 bg-azure-50 px-4 py-1.5 mb-6 select-none shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-azure-500 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-azure-500" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-azure-700">
                Sfax & Toute la Tunisie
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-display font-black leading-[1.06] tracking-tight text-navy-900 mb-6 relative">
              Tout ce dont votre cabinet a besoin,{" "}
              <br className="hidden sm:block" />
              <span className="text-azure-600">
                livré sans stress.
              </span>
            </h1>

            <p className="text-[16px] sm:text-lg leading-relaxed text-slate-600 mb-8 max-w-lg">
              Bonjour, nous sommes R&Z Medical. On équipe les dentistes, médecins et laboratoires avec du matériel sur lequel vous pouvez vraiment compter au quotidien. Zéro contrefaçon, zéro mauvaise surprise.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col gap-3 sm:flex-row mb-8">
              <Link
                href="/catalogue"
                className={buttonVariants({ variant: "accent", size: "xl" })}
              >
                Voir tout le matériel
                <ArrowRightIcon size={18} />
              </Link>
              <Link
                href="/catalogue?promo=1"
                className="inline-flex h-14 items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-8 text-base font-semibold text-navy-800 transition-all duration-200 hover:bg-slate-50 hover:border-azure-300 hover:-translate-y-[1px] hover:shadow-md active:translate-y-0 shadow-sm"
              >
                Nos promos actuelles
              </Link>
            </div>

            {/* Trust list */}
            <ul className="flex flex-col gap-2.5">
              {TRUST.map((t, i) => (
                <li
                  key={t}
                  className="flex items-start gap-3 text-[14px] font-medium text-slate-600"
                  style={{ animationDelay: `${(i + 1) * 100}ms` }}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 mt-0.5 shadow-sm">
                    <CheckIcon size={11} strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>

            {/* Stats row */}
            <div className="mt-10 pt-8 border-t border-slate-200 flex gap-8">
              {STATS.map(({ value, label }) => (
                <div key={label}>
                  <p className="font-display text-2xl font-black text-navy-900">{value}</p>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* === Right: 3D Visual Card === */}
          <div
            className="relative hidden lg:block animate-reveal-up"
            style={{ animationDelay: "180ms" }}
          >
            {/* Glow removed */}

            {/* Main image card */}
            <div className="relative rounded-3xl overflow-hidden border border-slate-200/80 bg-white shadow-[0_30px_80px_rgba(0,0,0,0.1),0_0_60px_rgba(14,165,233,0.15)]">
              {/* Top gloss line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent z-10 pointer-events-none" />

              <div className="relative aspect-[4/3] w-full overflow-hidden">
                <Image
                  src="/images/medical_hero.jpg"
                  alt="Cabinet médical moderne équipé par RZmedical"
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover transition-transform duration-700 hover:scale-[1.03] -rotate-1 origin-bottom-right"
                />
                {/* Subtle overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent pointer-events-none" />
              </div>

              {/* Floating info badges */}
              <div className="absolute bottom-6 left-6 right-6 flex gap-3 pointer-events-none select-none">
                {/* Badge 1 */}
                <div className="flex-1 rounded-2xl border border-white/60 bg-white/90 p-4 shadow-lg backdrop-blur-xl">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-azure-50 border border-azure-200 text-azure-600">
                      <ShieldCheckIcon size={18} />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-navy-900">Produits Certifiés</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Normes CE & traçabilité</p>
                    </div>
                  </div>
                </div>
                {/* Badge 2 */}
                <div className="flex-1 rounded-2xl border border-white/60 bg-white/90 p-4 shadow-lg backdrop-blur-xl">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-azure-50 border border-azure-200 text-azure-600">
                      <TruckIcon size={18} />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-navy-900">Livraison 24-48h</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Toute la Tunisie</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating stat card — top right */}
            <div className="absolute -top-4 -right-4 rounded-2xl border border-white/60 bg-white/95 px-5 py-3.5 shadow-xl backdrop-blur-xl animate-float">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">En stock</p>
              <p className="font-display text-2xl font-black text-navy-900 mt-0.5">500<span className="text-azure-600">+</span></p>
              <p className="text-[11px] text-slate-500 mt-0.5">produits disponibles</p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function HeroContent({ isTransparent = false }: { isTransparent?: boolean }) {
  return (
    <>
      {/* Eyebrow pill */}
      <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm px-3 py-1 mb-4 select-none">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">
          Matériel médical &amp; dentaire
        </span>
      </div>

      {/* Headline */}
      <h1 className="font-display font-black text-2xl sm:text-3xl lg:text-5xl leading-[1.08] tracking-tight text-white drop-shadow-lg mb-4">
        L&apos;équipement médical de référence,{" "}
        <span className="text-azure-300">livré en confiance</span>.
      </h1>

      {/* Description */}
      <p className="text-sm sm:text-base leading-relaxed text-white/80 drop-shadow mb-6 max-w-xl mx-auto">
        RZmedical accompagne les professionnels de santé en Tunisie avec une
        sélection d&apos;équipements certifiés et livrés rapidement.
      </p>

      {/* CTA Buttons */}
      <div className="flex flex-col gap-2.5 sm:flex-row justify-center">
        <Link href="/catalogue" className={buttonVariants({ variant: "accent", size: "lg" })}>
          Explorer le catalogue
          <ArrowRightIcon size={16} />
        </Link>
        <Link
          href="/catalogue?promo=1"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:border-white/40"
        >
          Voir les promotions
        </Link>
      </div>

      {/* Trust list — visible uniquement si assez de place (md+) */}
      <ul className="mt-5 hidden md:flex flex-row flex-wrap gap-x-6 gap-y-2 justify-center">
        {TRUST.map((t) => (
          <li key={t} className="flex items-center gap-2 text-[13px] font-medium text-white/80">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-azure-500/20 border border-azure-400/30 text-azure-300">
              <CheckIcon size={9} strokeWidth={3} />
            </span>
            {t}
          </li>
        ))}
      </ul>
    </>
  );
}