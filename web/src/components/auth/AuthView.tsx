"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { useCategory } from "@/providers/CategoryProvider";
import { useCart } from "@/providers/CartProvider";
import { useToast } from "@/providers/ToastProvider";
import { ApiError, loginClient, registerClient } from "@/lib/api";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { Field, fieldClass } from "@/components/ui/Field";
import { AlertCircleIcon, EyeIcon, ShieldCheckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { getVisibleCategories } from "@/lib/api";
import type { CategorieListItem } from "@/lib/types";

function safeNext(raw: string | null, fallback = "/compte"): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return fallback;
}


export function AuthView({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const { login, isAuthenticated, ready } = useAuth();
  const { categories: allCategories, selectCategory } = useCategory();
  const { items, ready: cartReady } = useCart();
  const toast = useToast();

  const nextRaw = params.get("next") ?? params.get("redirect");
  const isRegister = mode === "register";
  const defaultFallback = isRegister ? "/" : "/compte";
  // En cas d'inscription, si le redirect pointe vers /compte ou n'est pas spécifié, orienter vers l'accueil
  const resolvedRaw = isRegister && nextRaw === "/compte" ? null : nextRaw;
  const next = safeNext(
    resolvedRaw ?? (!isRegister && cartReady && items.length > 0 ? "/commande" : null),
    defaultFallback,
  );

  const [form, setForm] = useState({
    prenom: "",
    nom: "",
    email: "",
    motDePasse: "",
    telephone: "",
    activiteCategoryId: "",
    matriculeFiscale: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategorieListItem[]>([]);
  const redirectingAfterSubmit = useRef(false);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    if (ready && isAuthenticated && !redirectingAfterSubmit.current) {
      router.replace(next);
    }
  }, [ready, isAuthenticated, next, router]);

  useEffect(() => {
    if (mode === "register") {
      getVisibleCategories().then(setCategories).catch(console.error);
    }
  }, [mode]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        redirectingAfterSubmit.current = true;
        const res = await loginClient({ email: form.email.trim(), motDePasse: form.motDePasse });
        login(res);
        toast.success(`Bonjour ${res.user?.prenom || ""} 👋 Vous êtes connecté.`);
        
        if (res.user?.activiteCategoryId) {
          const act = allCategories.find((c) => c.id === res.user.activiteCategoryId);
          if (act) {
            selectCategory(act, next);
            return;
          }
        }
        router.replace(next);
      } else {
        redirectingAfterSubmit.current = true;
        const res = await registerClient({
          email: form.email.trim(),
          motDePasse: form.motDePasse,
          prenom: form.prenom.trim(),
          nom: form.nom.trim(),
          telephone: form.telephone.trim() || undefined,
          matriculeFiscale: form.matriculeFiscale.trim(),
          activiteCategoryId: Number(form.activiteCategoryId),
        });
        login(res);
        toast.success("Votre compte est créé ! Bienvenue chez R&Z Medical.");
        
        if (res.user?.activiteCategoryId) {
          const act = allCategories.find((c) => c.id === res.user.activiteCategoryId);
          if (act) {
            selectCategory(act, next);
            return;
          }
        }
        router.replace(next);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Quelque chose s'est mal passé de notre côté. Réessayez ou appelez-nous au 28 113 131.");
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === "login";
  const switchNext = isLogin && nextRaw === "/compte" ? null : nextRaw;
  const switchHref =
    (isLogin ? "/inscription" : "/connexion") +
    (switchNext ? `?next=${encodeURIComponent(switchNext)}` : "");

  return (
    <Container className="py-8 lg:py-16 flex justify-center">
      <div className="w-full max-w-md lg:max-w-5xl lg:grid lg:grid-cols-2 lg:gap-12 lg:items-stretch">
        <div className="hidden lg:flex flex-col justify-between bg-navy-960 p-12 rounded-3xl text-white relative overflow-hidden select-none min-h-[580px] shadow-[0_20px_60px_rgba(0,0,0,0.15),_0_1px_0_rgba(255,255,255,0.1)_inset] border border-white/[0.05]">
          <div className="absolute inset-0 bg-slate-50/5 opacity-50 pointer-events-none" />
          <div className="relative z-10">
            <Link href="/" className="inline-flex transition-transform hover:scale-105" aria-label="Accueil RZmedical">
              <Logo tone="light" className="h-10 w-auto" />
            </Link>
            <h2 className="mt-14 text-4xl font-black font-display leading-[1.15] tracking-tight text-white">
              Votre compte, votre catalogue, vos prix — en un seul endroit.
            </h2>
            <p className="mt-6 text-[15px] text-navy-200/80 leading-relaxed max-w-md">
              Connectez-vous pour voir vos tarifs personnalisés et suivre chacune de vos commandes depuis Sfax ou où que vous soyez.
            </p>
          </div>
          <div className="relative z-10 space-y-4 pt-8 mt-12">
            {[
              "Jusqu'à 15% de remise dès votre 2e commande",
              "Toutes vos factures téléchargeables, pour vos comptables",
              "On vous rappelle si votre commande prend du retard"
            ].map((feature, i) => (
              <div key={i} className="group flex gap-4 items-center rounded-2xl bg-white/[0.03] border border-white/[0.05] p-3.5 transition-all duration-300 hover:bg-white/[0.06] hover:border-white/[0.1] hover:-translate-y-0.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-azure-500/20 border border-azure-400/20 text-azure-400 group-hover:scale-110 group-hover:text-azure-300 transition-all duration-300">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </span>
                <p className="text-[13px] font-semibold text-navy-100 group-hover:text-white transition-colors">{feature}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-center w-full max-w-md mx-auto py-4 animate-reveal-up">
          <div className="mb-6 lg:hidden text-center">
            <Link href="/" className="inline-flex" aria-label="Accueil RZmedical">
              <Logo />
            </Link>
          </div>
          <div className="mb-6 text-center lg:text-left">
            <h1 className="text-2xl font-bold text-navy-900">
              {isLogin ? "Connectez-vous à votre espace" : "Créer votre compte"}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {isLogin
                ? "Retrouvez vos commandes passées et vos prix négociés."
                : "Ça prend 2 minutes. Votre matricule fiscal suffit."}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6 shadow-md shadow-navy-950/5 sm:p-8">
            {error && (
              <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-lg border border-error/20 bg-error-light px-3.5 py-3 text-sm text-error-dark">
                <AlertCircleIcon size={18} className="mt-0.5 shrink-0 text-error" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              {!isLogin && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Prenom" htmlFor="prenom">
                    <input id="prenom" type="text" required autoComplete="given-name" value={form.prenom} onChange={set("prenom")} className={fieldClass} />
                  </Field>
                  <Field label="Nom" htmlFor="nom">
                    <input id="nom" type="text" required autoComplete="family-name" value={form.nom} onChange={set("nom")} className={fieldClass} />
                  </Field>
                </div>
              )}

              <Field label="Adresse e-mail" htmlFor="email">
                <input id="email" type="email" required autoComplete="email" value={form.email} onChange={set("email")} placeholder="vous@exemple.com" className={fieldClass} />
              </Field>

              <Field label="Mot de passe" htmlFor="password" hint={!isLogin ? "6 car. min." : undefined}>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={isLogin ? undefined : 6}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    value={form.motDePasse}
                    onChange={set("motDePasse")}
                    className={cn(fieldClass, "pr-11")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    aria-pressed={showPassword}
                    className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-faint transition-colors hover:bg-navy-50 hover:text-navy-700 cursor-pointer"
                  >
                    <EyeIcon size={18} />
                  </button>
                </div>
                {isLogin && (
                  <div className="mt-1.5 text-right">
                    <Link href="/mot-de-passe-oublie" className="text-xs font-medium text-azure-600 hover:text-azure-700 transition-colors">
                      Mot de passe oublié ?
                    </Link>
                  </div>
                )}
              </Field>

              {!isLogin && (
                <>
                  <Field label="Téléphone" htmlFor="telephone" optional>
                    <input id="telephone" type="tel" autoComplete="tel" value={form.telephone} onChange={set("telephone")} placeholder="+216 ..." className={fieldClass} />
                  </Field>
                  <Field label="Matricule Fiscal" htmlFor="matriculeFiscale">
                    <input id="matriculeFiscale" type="text" required value={form.matriculeFiscale} onChange={set("matriculeFiscale")} placeholder="Ex: 1234567XAM000" className={fieldClass} />
                  </Field>
                  <Field label="Activité" htmlFor="activiteCategoryId">
                    <select id="activiteCategoryId" required value={form.activiteCategoryId} onChange={(e) => setForm((f) => ({ ...f, activiteCategoryId: e.target.value }))} className={fieldClass}>
                      <option value="" disabled>Sélectionner votre activité</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.nom}</option>
                      ))}
                    </select>
                  </Field>
                </>
              )}

              <Button type="submit" variant="primary" size="lg" fullWidth loading={loading} className="!mt-6">
                {isLogin
                  ? "Se connecter"
                  : (nextRaw?.includes("/commande") ? "Confirmer la commande" : "Creer mon compte")
                }
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-muted lg:text-left lg:px-2">
            {isLogin ? "Première commande ? " : "Déjà client ? "}
            <Link href={switchHref} className="font-bold text-azure-600 transition-colors hover:text-azure-700">
              {isLogin ? "Créez votre compte" : "Connectez-vous"}
            </Link>
          </p>

          <p className="mt-5 flex items-center justify-center lg:justify-start gap-1.5 text-xs text-faint lg:px-2">
            <ShieldCheckIcon size={14} />
            Vos données ne sont jamais revendues ni partagées.
          </p>
        </div>
      </div>
    </Container>
  );
}
