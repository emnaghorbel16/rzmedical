"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/providers/CartProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import {
  ApiError,
  createOrder,
  imageUrl,
  updateMe,
  type UpdateProfileInput,
} from "@/lib/api";
import type { Commande } from "@/lib/types";
import { clientPrice, formatTND, orderNumber } from "@/lib/format";
import { Container } from "@/components/ui/Container";
import { Button, buttonVariants } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Field, fieldClass, fieldError, textareaClass } from "@/components/ui/Field";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BuildingIcon,
  CartIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  CreditCardIcon,
  LockIcon,
  MapPinIcon,
  PackageIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrashIcon,
  TruckIcon,
  type IconProps,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";

const round2 = (x: number) => Math.round(x * 100) / 100;

type PaymentId = "cod" | "virement";

const PAYMENT_METHODS: {
  id: PaymentId;
  title: string;
  desc: string;
  icon: ComponentType<IconProps>;
  recommended?: boolean;
}[] = [
  {
    id: "cod",
    title: "Paiement à la livraison",
    desc: "Réglez en espèces à la réception de votre commande.",
    icon: TruckIcon,
    recommended: true,
  },
  {
    id: "virement",
    title: "Virement bancaire",
    desc: "Un conseiller vous transmettra les coordonnées bancaires.",
    icon: BuildingIcon,
  },
];

type FormState = {
  prenom: string;
  nom: string;
  telephone: string;
  adresse: string;
};

export function CheckoutView() {
  const router = useRouter();
  const toast = useToast();
  const {
    items,
    ready: cartReady,
    isEmpty,
    subtotal,
    clear,
    setQuantity,
    removeItem,
  } = useCart();
  const {
    token,
    user,
    ready: authReady,
    isAuthenticated,
    setUser,
  } = useAuth();

  const [form, setForm] = useState<FormState>({
    prenom: "",
    nom: "",
    telephone: "",
    adresse: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<FormState>>({});
  const [payment, setPayment] = useState<PaymentId>("cod");
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{
    order: Commande;
    method: PaymentId;
  } | null>(null);
  const [showMobileSummary, setShowMobileSummary] = useState(false);

  const remiseClient = user?.remise ?? 0;

  const clientTotal = useMemo(() => {
    if (remiseClient <= 0) return subtotal;
    return round2(
      items.reduce(
        (sum, i) => sum + clientPrice(i.prix, i.remise, remiseClient) * i.quantite,
        0,
      ),
    );
  }, [items, remiseClient, subtotal]);

  const loyaltySavings = round2(subtotal - clientTotal);

  // Redirection si non connecté (le panier reste intact).
  useEffect(() => {
    if (authReady && !isAuthenticated) {
      router.replace(`/connexion?next=${encodeURIComponent("/commande")}`);
    }
  }, [authReady, isAuthenticated, router]);

  // Pré-remplissage depuis le profil (une seule fois, dès que l'utilisateur est chargé).
  const didPrefill = useRef(false);
  useEffect(() => {
    if (user && !didPrefill.current) {
      didPrefill.current = true;
      setForm({
        prenom: user.prenom ?? "",
        nom: user.nom ?? "",
        telephone: user.telephone ?? "",
        adresse: user.adresse ?? "",
      });
    }
  }, [user]);

  const set =
    (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
    };

  const validate = (): boolean => {
    const errs: Partial<FormState> = {};
    if (!form.prenom.trim()) errs.prenom = "Champ requis";
    if (!form.nom.trim()) errs.nom = "Champ requis";
    if (!form.telephone.trim()) errs.telephone = "Champ requis";
    if (!form.adresse.trim()) errs.adresse = "Adresse de livraison requise";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const useCurrentLocation = () => {
    if (locating) return;
    if (!window.isSecureContext || !navigator.geolocation) {
      setError(
        "La localisation GPS nécessite une connexion sécurisée (HTTPS). Saisissez votre adresse manuellement ou ouvrez le site sur localhost.",
      );
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const query = new URLSearchParams({
            lat: String(coords.latitude),
            lon: String(coords.longitude),
            format: "jsonv2",
            "accept-language": "fr",
          });
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?${query.toString()}`,
            { headers: { Accept: "application/json" } },
          );
          if (!response.ok) throw new Error("reverse-geocoding-failed");
          const data = (await response.json()) as { display_name?: string };
          if (!data.display_name) throw new Error("address-not-found");
          setForm((current) => ({ ...current, adresse: data.display_name! }));
          setFieldErrors((current) => ({ ...current, adresse: undefined }));
        } catch {
          setError(
            "Position trouvée, mais l'adresse n'a pas pu être récupérée. Saisissez votre adresse manuellement.",
          );
        } finally {
          setLocating(false);
        }
      },
      (geoError) => {
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Autorisez la localisation dans votre navigateur ou saisissez votre adresse manuellement."
            : "Localisation indisponible. Saisissez votre adresse manuellement.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const placeOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || submitting) return;
    setError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      // 1) Persister les coordonnées de livraison sur le profil (Commande ne stocke pas d'adresse).
      const patch: UpdateProfileInput = {};
      if (form.prenom.trim() !== (user?.prenom ?? "")) patch.prenom = form.prenom.trim();
      if (form.nom.trim() !== (user?.nom ?? "")) patch.nom = form.nom.trim();
      if (form.telephone.trim() !== (user?.telephone ?? ""))
        patch.telephone = form.telephone.trim();
      if (form.adresse.trim() !== (user?.adresse ?? "")) patch.adresse = form.adresse.trim();
      if (Object.keys(patch).length > 0) {
        const updated = await updateMe(token, patch);
        setUser(updated);
      }

      // 2) Créer la commande (prix recalculés côté serveur).
      const lignes = items.map((i) => ({ produitId: i.produitId, quantite: i.quantite }));
      const order = await createOrder(token, lignes);

      setConfirmed({ order, method: payment });
      clear();
      toast.success("Commande confirmée !");
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "La commande n'a pas pu être finalisée. Veuillez réessayer.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // --- Écran de confirmation ---
  if (confirmed) {
    return <Confirmation order={confirmed.order} method={confirmed.method} />;
  }

  // --- Hydratation ---
  if (!authReady || !cartReady) {
    return (
      <Container className="py-10">
        <Skeleton className="h-8 w-56" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </Container>
    );
  }

  // --- Non connecté : redirection en cours ---
  if (!isAuthenticated) {
    return (
      <Container className="py-16">
        <p className="text-center text-sm text-muted">Redirection vers la connexion…</p>
      </Container>
    );
  }

  // --- Panier vide ---
  if (isEmpty) {
    return (
      <Container className="py-10">
        <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">Commande</h1>
        <EmptyState
          className="mt-6 rounded-2xl border border-border bg-surface"
          icon={<CartIcon size={30} />}
          title="Votre panier est vide"
          description="Ajoutez des produits à votre panier avant de passer commande."
          action={
            <Link href="/catalogue" className={buttonVariants({ variant: "primary" })}>
              Découvrir le catalogue
              <ArrowRightIcon size={18} />
            </Link>
          }
        />
      </Container>
    );
  }

  return (
    <Container className="py-8 lg:py-10">
      <div className="flex items-center gap-3">
        <Link
          href="/panier"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-navy-900"
        >
          <ArrowLeftIcon size={16} />
          Panier
        </Link>
      </div>
      
      <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
            Finaliser la commande
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            Veuillez renseigner vos coordonnées de livraison et choisir votre mode de règlement.
          </p>
        </div>

        {/* Visual Stepper */}
        <div className="w-full max-w-xs select-none">
          <ol className="flex items-center w-full text-[11px] sm:text-xs font-semibold text-muted">
            <li className="flex items-center text-azure-600 gap-1.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-azure-50 border border-azure-200 font-bold">1</span>
              <span>Informations</span>
            </li>
            <li className="flex-1 h-px bg-border mx-3" />
            <li className="flex items-center gap-1.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full border border-border font-bold">2</span>
              <span>Confirmation</span>
            </li>
          </ol>
        </div>
      </div>

      {/* Mobile summary toggle (shown on mobile/tablet, hidden on desktop) */}
      <div className="block lg:hidden mt-6 border border-border bg-surface rounded-xl p-4 shadow-xs select-none">
        <button
          type="button"
          onClick={() => setShowMobileSummary(!showMobileSummary)}
          className="flex w-full items-center justify-between font-bold text-navy-900 text-sm cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <CartIcon size={18} className="text-azure-500" />
            <span>Votre commande ({items.length} article{items.length > 1 ? "s" : ""})</span>
          </span>
          <div className="flex items-center gap-1.5">
            <span>{formatTND(clientTotal)}</span>
            <ChevronDownIcon size={16} className={cn("transition-transform duration-200 text-faint", showMobileSummary && "rotate-180")} />
          </div>
        </button>
        
        <div className={cn("overflow-hidden transition-all duration-300 ease-out-soft", showMobileSummary ? "max-h-[700px] opacity-100 mt-4 border-t border-border pt-4" : "max-h-0 opacity-0 pointer-events-none")}>
          <ul className="space-y-3">
            {items.map((item) => {
              const unitHT = clientPrice(item.prix, item.remise, remiseClient);
              const unit = unitHT;
              return (
                <li key={item.produitId} className="flex items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-white">
                    {item.image ? (
                      <Image
                        src={imageUrl(item.image)}
                        alt={item.nom}
                        fill
                        sizes="48px"
                        className="object-contain p-1"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-faint">
                        <PackageIcon size={16} />
                      </span>
                    )}
                    <span className="absolute -right-1.5 -top-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-navy-900 px-1 text-[10px] font-semibold text-white">
                      {item.quantite}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-xs font-semibold text-navy-800">
                      {item.nom}
                    </p>
                    <p className="text-[10px] text-muted">
                      {item.quantite} × {formatTND(unit)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <p className="text-xs font-bold tabular-nums text-navy-900">
                      {formatTND(round2(unit * item.quantite))}
                    </p>
                    <QuantityStepper
                      value={item.quantite}
                      onChange={(quantity) => setQuantity(item.produitId, quantity)}
                      max={undefined}
                      size="sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(item.produitId)}
                      className="text-[11px] font-medium text-error transition-colors hover:text-error-dark"
                    >
                      Retirer
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <form
        onSubmit={placeOrder}
        className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]"
      >
        <div className="space-y-8">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-error/20 bg-error-light px-4 py-3 text-sm text-error-dark"
            >
              <AlertCircleIcon size={18} className="mt-0.5 shrink-0 text-error" />
              <div>
                <p>{error}</p>
                <Link
                  href="/panier"
                  className="mt-1 inline-block font-semibold text-error-dark underline underline-offset-2"
                >
                  Revenir au panier
                </Link>
              </div>
            </div>
          )}

          {/* Coordonnées de livraison */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-azure-50 text-azure-600">
                <TruckIcon size={18} />
              </span>
              <h2 className="text-base font-bold text-navy-900">Livraison</h2>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Prénom" htmlFor="prenom" error={fieldErrors.prenom}>
                <input
                  id="prenom"
                  type="text"
                  autoComplete="given-name"
                  value={form.prenom}
                  onChange={set("prenom")}
                  className={cn(fieldClass, fieldError(!!fieldErrors.prenom))}
                />
              </Field>
              <Field label="Nom" htmlFor="nom" error={fieldErrors.nom}>
                <input
                  id="nom"
                  type="text"
                  autoComplete="family-name"
                  value={form.nom}
                  onChange={set("nom")}
                  className={cn(fieldClass, fieldError(!!fieldErrors.nom))}
                />
              </Field>
              <Field
                label="Téléphone"
                htmlFor="telephone"
                error={fieldErrors.telephone}
                className="sm:col-span-2"
              >
                <input
                  id="telephone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+216 …"
                  value={form.telephone}
                  onChange={set("telephone")}
                  className={cn(fieldClass, fieldError(!!fieldErrors.telephone))}
                />
              </Field>
              <Field
                label="Adresse de livraison"
                htmlFor="adresse"
                error={fieldErrors.adresse}
                className="sm:col-span-2"
              >
                <textarea
                  id="adresse"
                  autoComplete="street-address"
                  rows={3}
                  placeholder="Rue, ville, code postal, étage, instructions…"
                  value={form.adresse}
                  onChange={set("adresse")}
                  className={cn(textareaClass, fieldError(!!fieldErrors.adresse))}
                />
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  disabled={locating}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-azure-600 transition-colors hover:text-azure-700 disabled:cursor-wait disabled:opacity-60"
                >
                  <MapPinIcon size={15} />
                  {locating ? "Recherche de votre position…" : "Utiliser ma position GPS"}
                </button>
              </Field>
            </div>
            {user?.email && (
              <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
                <LockIcon size={13} />
                Confirmation envoyée à {user.email}
              </p>
            )}
          </section>

          {/* Mode de paiement */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-azure-50 text-azure-600">
                <CreditCardIcon size={18} />
              </span>
              <h2 className="text-base font-bold text-navy-900">Paiement</h2>
            </div>

            <fieldset className="mt-5 space-y-3">
              <legend className="sr-only">Choisir un mode de paiement</legend>
              {PAYMENT_METHODS.map((m) => {
                const Icon = m.icon;
                return (
                  <label
                    key={m.id}
                    className="relative flex cursor-pointer items-start gap-3.5 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-navy-300 has-[:checked]:border-azure-500 has-[:checked]:bg-azure-50/40 has-[:checked]:ring-1 has-[:checked]:ring-azure-500"
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={m.id}
                      checked={payment === m.id}
                      onChange={() => setPayment(m.id)}
                      className="peer sr-only"
                    />
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700 peer-checked:bg-azure-100 peer-checked:text-azure-700">
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-navy-900">{m.title}</span>
                        {m.recommended && (
                          <span className="rounded-full bg-success-light px-2 py-0.5 text-[11px] font-semibold text-success-dark">
                            Recommandé
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">{m.desc}</span>
                    </span>
                    <span
                      aria-hidden
                      className="mt-0.5 text-azure-500 opacity-0 transition-opacity peer-checked:opacity-100"
                    >
                      <CheckCircleIcon size={20} />
                    </span>
                  </label>
                );
              })}

              {/* Carte bancaire : à venir */}
              <div className="flex items-start gap-3.5 rounded-xl border border-dashed border-border bg-surface-2 p-4 opacity-70">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-faint">
                  <CreditCardIcon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-navy-700">Carte bancaire</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Paiement en ligne sécurisé — bientôt disponible.
                  </span>
                </span>
              </div>
            </fieldset>
          </section>
        </div>

        {/* Récapitulatif */}
        <aside className="lg:sticky lg:top-24">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-base font-bold text-navy-900">Votre commande</h2>

            <ul className="mt-4 space-y-3">
              {items.map((item) => {
                const unitHT = clientPrice(item.prix, item.remise, remiseClient);
                const unit = unitHT;
                return (
                  <li key={item.produitId} className="flex items-center gap-3">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-white">
                      {item.image ? (
                        <Image
                          src={imageUrl(item.image)}
                          alt={item.nom}
                          fill
                          sizes="56px"
                          className="object-contain p-1"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-faint">
                          <PackageIcon size={20} />
                        </span>
                      )}
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-navy-900 px-1 text-[11px] font-semibold text-white">
                        {item.quantite}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium text-navy-900">
                        {item.nom}
                      </p>
                      <p className="text-xs text-muted">
                        {item.quantite} × {formatTND(unit)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-end gap-2">
                      <QuantityStepper
                        value={item.quantite}
                        onChange={(quantity) => setQuantity(item.produitId, quantity)}
                        max={undefined}
                        size="sm"
                      />
                      <IconButton
                        label={`Retirer ${item.nom}`}
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.produitId)}
                        className="text-faint hover:text-error"
                      >
                        <TrashIcon size={16} />
                      </IconButton>
                      <p className="text-sm font-semibold tabular-nums text-navy-900">
                        {formatTND(round2(unit * item.quantite))}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <dl className="mt-5 space-y-2.5 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Sous-total</dt>
                <dd className="font-semibold tabular-nums text-navy-900">
                  {formatTND(subtotal)}
                </dd>
              </div>
              {remiseClient > 0 && (
                <div className="flex justify-between text-success-dark">
                  <dt>Remise fidélité (-{Math.round(remiseClient)}%)</dt>
                  <dd className="font-semibold tabular-nums">−{formatTND(loyaltySavings)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">Livraison</dt>
                <dd className="text-muted">Calculée à la livraison</dd>
              </div>
            </dl>

            <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
              <span className="text-sm font-medium text-navy-700">Total</span>
              <span className="font-display text-2xl font-bold tabular-nums text-navy-900">
                {formatTND(clientTotal)}
              </span>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              className="!mt-5"
            >
              {submitting ? "Traitement…" : "Confirmer la commande"}
            </Button>

            <Link
              href="/catalogue"
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 text-sm font-semibold text-azure-600 transition-colors hover:text-azure-700"
            >
              <PlusIcon size={16} />
              Ajouter d&apos;autres produits
            </Link>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
              <ShieldCheckIcon size={14} />
              Commande sécurisée · Aucun prépaiement en ligne
            </p>
          </div>
        </aside>
      </form>
    </Container>
  );
}

function Confirmation({
  order,
  method,
}: {
  order: Commande;
  method: PaymentId;
}) {
  return (
    <Container className="flex flex-col items-center py-10 lg:py-16">
      {/* Visual Stepper */}
      <div className="mb-10 w-full max-w-md select-none">
        <ol className="flex items-center w-full text-xs font-semibold text-muted">
          <li className="flex items-center text-success-dark gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-success-light border border-success-dark/20 text-success-dark font-bold">✓</span>
            <span>Informations</span>
          </li>
          <li className="flex-1 h-px bg-success-dark/20 mx-4" />
          <li className="flex items-center text-azure-600 gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-azure-50 border border-azure-200">2</span>
            <span>Confirmation</span>
          </li>
        </ol>
      </div>

      <div className="w-full max-w-lg text-center animate-reveal-up">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-light text-success shadow-sm">
          <CheckCircleIcon size={38} />
        </div>
        <h1 className="mt-6 text-2xl font-bold text-navy-900 sm:text-3xl">
          Merci pour votre commande&nbsp;!
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          Votre commande{" "}
          <span className="font-semibold text-navy-900">{orderNumber(order.id)}</span> a bien
          été enregistrée.
        </p>

        <div className="mt-8 rounded-2xl border border-border bg-surface p-6 text-left shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Montant total</span>
            <span className="font-display text-xl font-bold tabular-nums text-navy-900">
              {formatTND(order.total)}
            </span>
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-surface-2 p-4">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-azure-50 text-azure-600">
              {method === "cod" ? <TruckIcon size={18} /> : <BuildingIcon size={18} />}
            </span>
            <p className="text-sm leading-relaxed text-navy-700">
              {method === "cod"
                ? "Vous réglerez à la réception. Notre équipe vous contactera pour convenir de la livraison."
                : "Un conseiller vous contactera avec les coordonnées bancaires pour finaliser le paiement."}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/compte?tab=commandes" className={buttonVariants({ variant: "primary", size: "lg" })}>
            Suivre ma commande
          </Link>
          <Link
            href="/catalogue"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Continuer mes achats
          </Link>
        </div>
      </div>
    </Container>
  );
}
