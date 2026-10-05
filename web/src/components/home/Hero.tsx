"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState } from "react";
import { Container } from "@/components/ui/Container";
import { buttonVariants } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { imageUrl } from "@/lib/api";
import type { VideoHero } from "@/lib/types";
import { useSetHeroVideo } from "@/providers/HeroVideoProvider";

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
  useSetHeroVideo(showVideo);

  /* ── Variante vidéo ── */
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

  /* ── Variante sans vidéo ── */
  return (
    <section className="relative overflow-hidden bg-navy-960 flex flex-col">

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

      <Container className="relative z-10 pt-28 pb-16 lg:pt-36 lg:pb-20 flex-1">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Gauche — texte */}
          <div>
            <p className="text-azure-400 text-xs font-semibold uppercase tracking-[0.18em] mb-5">
              Sfax · Tunisie
            </p>

            <h1 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl leading-[1.04] tracking-tight text-white mb-6">
              Tout ce dont votre cabinet a besoin,{" "}
              <span className="text-azure-400">livré sans attente.</span>
            </h1>

            <p className="text-slate-400 text-base leading-relaxed max-w-md mb-10">
              R&amp;Z Medical équipe les dentistes, médecins et laboratoires
              avec du matériel certifié — expédié le jour même, facturé à la livraison.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/catalogue"
                className={buttonVariants({ variant: "accent", size: "xl" })}
              >
                Voir tout le matériel
                <ArrowRightIcon size={18} />
              </Link>
              <Link
                href="/catalogue?promo=1"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 text-sm font-semibold text-white/80 transition-all hover:bg-white/10 hover:text-white hover:border-white/20"
              >
                Promos en cours
              </Link>
            </div>
          </div>

          {/* Droite — image */}
          <div className="relative hidden lg:block">
            <div className="relative rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl">
              <div className="relative aspect-[4/3] w-full">
                <Image
                  src="/images/medical_hero.jpg"
                  alt="Cabinet médical équipé par RZmedical"
                  fill
                  priority
                  sizes="50vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-960/60 via-transparent to-transparent" />
              </div>
            </div>

            {/* Badge flottant */}
            <div className="absolute -bottom-5 -left-5 rounded-xl border border-white/10 bg-navy-900/95 backdrop-blur-xl px-5 py-4 shadow-xl ring-1 ring-white/5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Disponible maintenant</p>
              <p className="font-display text-2xl font-black text-white">
                500<span className="text-azure-400">+</span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5">références en stock</p>
            </div>
          </div>
        </div>
      </Container>

      {/* Barre de stats */}
      <div className="relative z-10 border-t border-white/[0.06]">
        <Container>
          <div className="grid grid-cols-3 divide-x divide-white/[0.06] py-6">
            {STATS.map(({ value, label }) => (
              <div key={label} className="px-6 first:pl-0 last:pr-0">
                <p className="font-display text-xl font-black text-white">{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </Container>
      </div>
    </section>
  );
}