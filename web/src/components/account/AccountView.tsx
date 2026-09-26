"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ComponentType,
  type FormEvent,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { useCategory } from "@/providers/CategoryProvider";
import { useToast } from "@/providers/ToastProvider";
import {
  ApiError,
  createSupportTicket,
  addSupportMessage,
  getMySupportTickets,
  getMyOrders,
  getMyInvoices,
  imageUrl,
  updateMe,
  downloadInvoicePdf,
} from "@/lib/api";
import type { Commande, StatutCommande, Utilisateur } from "@/lib/types";
import { formatDate, formatTND, orderNumber, STATUT_LABELS } from "@/lib/format";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Field, fieldClass, textareaClass } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  AlertCircleIcon,
  DownloadIcon,
  EyeIcon,
  PackageIcon,
  MapPinIcon,
  PercentIcon,
  UserIcon,
  FileTextIcon,
  type IconProps,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";

type Tab = "profil" | "commandes" | "factures" | "support";

const NAV: { id: Tab; label: string; icon: ComponentType<IconProps> }[] = [
  { id: "profil", label: "Profil", icon: UserIcon },
  { id: "commandes", label: "Mes commandes", icon: PackageIcon },
  { id: "factures", label: "Mes factures", icon: FileTextIcon },
  { id: "support", label: "Support", icon: AlertCircleIcon },
];

const STATUT_VARIANT: Record<StatutCommande, BadgeVariant> = {
  EN_ATTENTE: "warning",
  PAYEE: "accent",
  EXPEDIEE: "navy",
  LIVREE: "success",
  ANNULEE: "error",
};

const ACTIVITES_CLIENT = [
  "Dentiste",
  "Laboratoire",
  "Médecin",
  "Clinique",
  "Pharmacie",
  "Hôpital",
  "Centre médical",
  "Cabinet médical",
  "Autre",
];

export function AccountView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { token, user, ready, isAuthenticated, setUser, logout } = useAuth();

  // URL-driven tab: /compte?tab=commandes or /compte (default: profil)
  const rawTab = searchParams.get("tab");
  const tab: Tab = rawTab === "commandes" || rawTab === "factures" || rawTab === "support" ? rawTab : "profil";

  const setTab = (id: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id === "profil") {
      params.delete("tab");
    } else {
      params.set("tab", id);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (ready && !isAuthenticated) {
      router.replace(`/connexion?next=${encodeURIComponent("/compte")}`);
    }
  }, [ready, isAuthenticated, router]);

  const handleLogout = () => {
    logout();
    toast.info("Vous êtes déconnecté.");
    router.replace("/");
  };

  if (!ready) {
    return (
      <Container className="py-10">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-slate-100 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-slate-100 animate-pulse" />
            <div className="h-3 w-48 rounded bg-slate-100 animate-pulse" />
          </div>
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="hidden lg:block h-64 rounded-2xl bg-slate-100 animate-pulse" />
          <div className="h-96 w-full rounded-2xl bg-slate-100 animate-pulse" />
        </div>
      </Container>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <Container className="py-16">
        <p className="text-center text-sm text-muted">Redirection vers la connexion…</p>
      </Container>
    );
  }

  const fullName = [user.prenom, user.nom].filter(Boolean).join(" ") || "Mon compte";
  const initials =
    [user.prenom, user.nom]
      .map((s) => s?.trim()?.[0])
      .filter(Boolean)
      .join("")
      .toUpperCase() || user.email.slice(0, 1).toUpperCase();

  return (
    <Container className="py-8 lg:py-10">
      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">Mon compte</h1>

      {/* Mobile: horizontal scrollable tab bar */}
      <div className="mt-6 flex gap-1 overflow-x-auto pb-1 border-b border-border lg:hidden select-none">
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = tab === n.id;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setTab(n.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-bold transition-colors duration-200 cursor-pointer whitespace-nowrap",
                active
                  ? "border-azure-500 text-azure-700"
                  : "border-transparent text-muted hover:text-navy-900",
              )}
            >
              <Icon size={16} />
              {n.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 lg:mt-8 grid items-start gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        {/* Sidebar (desktop only) */}
        <aside className="hidden lg:block lg:sticky lg:top-24">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-white shadow-sm">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-navy-900">{fullName}</p>
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>
            </div>

            {user.remise > 0 && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-success-light px-3 py-2 text-xs font-bold text-success-dark">
                <PercentIcon size={14} />
                Remise fidélité −{Math.round(user.remise)}%
              </div>
            )}

            <nav className="mt-5 space-y-1">
              {NAV.map((n) => {
                const Icon = n.icon;
                const active = tab === n.id;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setTab(n.id)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 cursor-pointer",
                      active
                        ? "bg-azure-50 font-bold text-azure-700"
                        : "text-navy-700 hover:bg-navy-50",
                    )}
                  >
                    <Icon size={18} />
                    {n.label}
                  </button>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-5 w-full cursor-pointer rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-navy-700 transition-all duration-200 hover:border-error/40 hover:bg-error-light hover:text-error-dark"
            >
              Se déconnecter
            </button>
          </div>
        </aside>

        {/* Content */}
        <div>
          {tab === "profil" ? (
            <ProfilePanel user={user} token={token!} setUser={setUser} />
          ) : tab === "commandes" ? (
            <OrdersPanel token={token!} />
          ) : tab === "factures" ? (
            <FacturesPanel token={token!} />
          ) : (
            <SupportPanel token={token!} />
          )}
        </div>
      </div>

      {/* Mobile logout */}
      <div className="mt-8 lg:hidden">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full cursor-pointer rounded-xl border border-border px-4 py-3 text-sm font-medium text-navy-700 transition-all duration-200 hover:border-error/40 hover:bg-error-light hover:text-error-dark"
        >
          Se déconnecter
        </button>
      </div>
    </Container>
  );
}

function SupportPanel({ token }: { token: string }) {
  const toast = useToast();
  const [tickets, setTickets] = useState<Array<{ id: number; sujet: string; message: string; statut: string; canalReponse: string; reponse?: string | null; messages?: Array<{ id: number; auteur: string; contenu: string; canal: string }> }>>([]);
  const [followUps, setFollowUps] = useState<Record<number, string>>({});
  const [sujet, setSujet] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void getMySupportTickets(token).then((data) => setTickets(data as typeof tickets));
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!sujet.trim() || !message.trim()) return;
    setSending(true);
    try {
      await createSupportTicket(token, { sujet, message });
      setSujet("");
      setMessage("");
      const updatedTickets = await getMySupportTickets(token);
      setTickets(updatedTickets as typeof tickets);
      toast.success("Votre demande a été envoyée au support.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'envoyer votre demande.");
    } finally {
      setSending(false);
    }
  };

  const sendFollowUp = async (ticketId: number) => {
    const contenu = followUps[ticketId]?.trim();
    if (!contenu) return;
    try {
      await addSupportMessage(token, ticketId, contenu);
      setFollowUps((current) => ({ ...current, [ticketId]: "" }));
      setTickets((await getMySupportTickets(token)) as typeof tickets);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'envoyer le message.");
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-xl font-bold text-navy-900">Contacter le support</h2>
      <p className="mt-1 text-sm text-muted">Signalez un problème avec votre commande, facture ou compte.</p>
      <div className="mt-6 space-y-4">
        <Field label="Sujet" htmlFor="support-sujet">
          <input id="support-sujet" value={sujet} onChange={(event) => setSujet(event.target.value)} className={fieldClass} required />
        </Field>
        <Field label="Votre message" htmlFor="support-message">
          <textarea id="support-message" value={message} onChange={(event) => setMessage(event.target.value)} className={textareaClass} rows={6} required />
        </Field>
      </div>
      <div className="mt-6 flex justify-end">
        <Button type="submit" loading={sending}>Envoyer au support</Button>
      </div>
      {tickets.length > 0 && (
        <div className="mt-8 border-t border-border pt-6">
          <h3 className="text-lg font-bold text-navy-900">Mes demandes</h3>
          <div className="mt-4 space-y-3">
            {tickets.map((ticket) => (
              <article key={ticket.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-navy-900">{ticket.sujet}</p>
                  <span className="text-xs font-semibold text-azure-700">{ticket.statut}</span>
                </div>
                {(ticket.messages?.length ? ticket.messages : [{ id: 0, auteur: "CLIENT", contenu: ticket.message, canal: "SUPPORT" }]).map((entry) => (
                  <div key={entry.id} className={`mt-3 flex ${entry.auteur === "ADMIN" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${entry.auteur === "ADMIN" ? "rounded-tr-sm bg-azure-600 text-white" : "rounded-tl-sm bg-slate-100 text-navy-800"}`}>
                      {entry.contenu}
                      {entry.auteur === "ADMIN" && <p className="mt-1 text-xs text-azure-100">Réponse par {entry.canal}</p>}
                    </div>
                  </div>
                ))}
                <div className="mt-4 flex gap-2">
                  <input value={followUps[ticket.id] || ""} onChange={(event) => setFollowUps((current) => ({ ...current, [ticket.id]: event.target.value }))} placeholder="Continuer la discussion..." className={fieldClass} />
                  <Button type="button" onClick={() => void sendFollowUp(ticket.id)}>Envoyer</Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}

// --- Profil ------------------------------------------------------------------

type ProfileForm = {
  prenom: string;
  nom: string;
  telephone: string;
  adresse: string;
  matriculeFiscale: string;
  activiteCategoryId: string;
};

function toForm(user: Utilisateur): ProfileForm {
  return {
    prenom: user.prenom ?? "",
    nom: user.nom ?? "",
    telephone: user.telephone ?? "",
    adresse: user.adresse ?? "",
    matriculeFiscale: user.matriculeFiscale ?? "",
    activiteCategoryId: user.activiteCategoryId ? String(user.activiteCategoryId) : "",
  };
}

function ProfilePanel({
  user,
  token,
  setUser,
}: {
  user: Utilisateur;
  token: string;
  setUser: (u: Utilisateur) => void;
}) {
  const toast = useToast();
  const { categories, selectCategory } = useCategory();
  const [form, setForm] = useState<ProfileForm>(() => toForm(user));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const set =
    (key: keyof ProfileForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const useCurrentLocation = () => {
    if (locating) return;
    if (!window.isSecureContext || !navigator.geolocation) {
      setError("La localisation GPS nécessite HTTPS. Vous pouvez saisir l'adresse manuellement.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const query = new URLSearchParams({ lat: String(coords.latitude), lon: String(coords.longitude), format: "jsonv2", "accept-language": "fr" });
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${query}`);
        const data = (await response.json()) as { display_name?: string };
        if (!data.display_name) throw new Error();
        setForm((current) => ({ ...current, adresse: data.display_name! }));
      } catch { setError("Position trouvée, mais l'adresse n'a pas pu être récupérée."); }
      finally { setLocating(false); }
    }, () => { setError("Autorisez la localisation ou saisissez l'adresse manuellement."); setLocating(false); }, { enableHighAccuracy: true, timeout: 10000 });
  };

  const dirty =
    form.prenom.trim() !== (user.prenom ?? "") ||
    form.nom.trim() !== (user.nom ?? "") ||
    form.telephone.trim() !== (user.telephone ?? "") ||
    form.adresse.trim() !== (user.adresse ?? "") ||
    form.matriculeFiscale.trim() !== (user.matriculeFiscale ?? "") ||
    form.activiteCategoryId !== (user.activiteCategoryId ? String(user.activiteCategoryId) : "");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!dirty || saving) return;
    setError(null);
    setSaving(true);
    try {
      const updated = await updateMe(token, {
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        telephone: form.telephone.trim(),
        adresse: form.adresse.trim(),
        matriculeFiscale: form.matriculeFiscale.trim(),
        activiteCategoryId: form.activiteCategoryId ? Number(form.activiteCategoryId) : undefined,
      });
      setUser(updated);
      setForm(toForm(updated));
      if (updated.activiteCategoryId) {
        const cat = categories.find((c) => c.id === updated.activiteCategoryId);
        if (cat) selectCategory(cat);
      }
      toast.success("Profil mis à jour avec succès.");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "La mise à jour a échoué. Veuillez réessayer.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6"
      >
        <h2 className="text-base font-bold text-navy-900">Informations personnelles</h2>
        <p className="mt-1 text-sm text-muted">
          Ces informations sont utilisées pour vos livraisons et factures.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2.5 rounded-lg border border-error/20 bg-error-light px-3.5 py-3 text-sm text-error-dark"
          >
            <AlertCircleIcon size={18} className="mt-0.5 shrink-0 text-error" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" htmlFor="p-prenom">
            <input
              id="p-prenom"
              type="text"
              autoComplete="given-name"
              value={form.prenom}
              onChange={set("prenom")}
              className={fieldClass}
            />
          </Field>
          <Field label="Nom" htmlFor="p-nom">
            <input
              id="p-nom"
              type="text"
              autoComplete="family-name"
              value={form.nom}
              onChange={set("nom")}
              className={fieldClass}
            />
          </Field>
          <Field label="E-mail" htmlFor="p-email" className="sm:col-span-2">
            <input
              id="p-email"
              type="email"
              value={user.email}
              disabled
              className={fieldClass}
            />
          </Field>
          <Field label="Téléphone" htmlFor="p-tel">
            <input
              id="p-tel"
              type="tel"
              autoComplete="tel"
              value={form.telephone}
              onChange={set("telephone")}
              className={fieldClass}
            />
          </Field>
          <Field label="Activité (Catégorie principale)" htmlFor="p-activite">
            <select
              id="p-activite"
              value={form.activiteCategoryId}
              onChange={set("activiteCategoryId")}
              className={fieldClass}
            >
              <option value="">Sélectionner une activité</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nom}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Matricule fiscal" htmlFor="p-mf" optional className="sm:col-span-2">
            <input
              id="p-mf"
              type="text"
              value={form.matriculeFiscale}
              onChange={set("matriculeFiscale")}
              className={fieldClass}
            />
          </Field>
          <Field label="Adresse" htmlFor="p-adresse" optional className="sm:col-span-2">
            <textarea
              id="p-adresse"
              autoComplete="street-address"
              rows={3}
              placeholder="Rue, ville, code postal…"
              value={form.adresse}
              onChange={set("adresse")}
              className={textareaClass}
            />
            <button type="button" onClick={useCurrentLocation} disabled={locating} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-azure-600 disabled:opacity-60">
              <MapPinIcon size={15} /> {locating ? "Recherche de votre position…" : "Utiliser ma position GPS"}
            </button>
          </Field>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
            Enregistrer
          </Button>
        </div>
      </form>

      <PasswordPanel token={token} />
    </div>
  );
}

function PasswordPanel({ token }: { token: string }) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError(null);

    if (next.length < 6) {
      setError("Le nouveau mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (next !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setSaving(true);
    try {
      await updateMe(token, { currentPassword: current, newPassword: next });
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Mot de passe modifié.");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "La modification a échoué. Veuillez réessayer.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6"
    >
      <h2 className="text-base font-bold text-navy-900">Mot de passe</h2>
      <p className="mt-1 text-sm text-muted">
        Modifiez votre mot de passe pour sécuriser votre compte.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2.5 rounded-lg border border-error/20 bg-error-light px-3.5 py-3 text-sm text-error-dark"
        >
          <AlertCircleIcon size={18} className="mt-0.5 shrink-0 text-error" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Mot de passe actuel" htmlFor="pw-current" className="sm:col-span-2">
          <div className="relative">
            <input
              id="pw-current"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={cn(fieldClass, "pr-11")}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Masquer les mots de passe" : "Afficher les mots de passe"}
              aria-pressed={show}
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-faint transition-colors hover:bg-navy-50 hover:text-navy-700"
            >
              <EyeIcon size={18} />
            </button>
          </div>
        </Field>
        <Field label="Nouveau mot de passe" htmlFor="pw-new" hint="6 caractères minimum">
          <input
            id="pw-new"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="Confirmer" htmlFor="pw-confirm">
          <input
            id="pw-confirm"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={fieldClass}
          />
        </Field>
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          type="submit"
          variant="outline"
          loading={saving}
          disabled={!current || !next || !confirm}
        >
          Modifier le mot de passe
        </Button>
      </div>
    </form>
  );
}

// --- Commandes ---------------------------------------------------------------

function OrdersPanel({ token }: { token: string }) {
  const [orders, setOrders] = useState<Commande[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    setOrders(null);
    try {
      const data = await getMyOrders(token);
      setOrders(data);
    } catch {
      setError(true);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-2 shadow-sm">
        <ErrorState
          title="Impossible de charger vos commandes"
          description="Une erreur est survenue. Veuillez réessayer."
          retry={load}
        />
      </div>
    );
  }

  if (orders === null) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-40 w-full rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface shadow-sm">
        <EmptyState
          icon={<PackageIcon size={30} />}
          title="Aucune commande pour le moment"
          description="Vos commandes apparaîtront ici une fois validées."
          action={
            <Link
              href="/catalogue"
              className="text-sm font-semibold text-azure-600 transition-colors hover:text-azure-700"
            >
              Parcourir le catalogue →
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} token={token} />
      ))}
    </div>
  );
}

function OrderCard({ order, token }: { order: Commande; token: string }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleDownloadInvoice = async () => {
    if (!order.facture) return;
    setDownloading(true);
    try {
      await downloadInvoicePdf(token, order.facture.id, order.facture.numero);
    } catch (err: any) {
      toast.error(err.message || "Impossible de télécharger la facture.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-2 px-5 py-4">
        <div>
          <p className="font-semibold text-navy-900">{orderNumber(order.id)}</p>
          <p className="text-xs text-muted">{formatDate(order.creeLe)}</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant={STATUT_VARIANT[order.statut]}>
            {STATUT_LABELS[order.statut] ?? order.statut}
          </Badge>
          <span className="font-display text-lg font-bold tabular-nums text-navy-900">
            {formatTND(order.total)}
          </span>
        </div>
      </header>

      <ul className="divide-y divide-border">
        {order.lignes.map((ligne) => {
          const img = ligne.produit?.images?.[0];
          const ref = ligne.produit?.reference;
          const name = ligne.produit?.nom ?? `Produit #${ligne.produitId}`;
          const thumb = (
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-white">
              {img ? (
                <Image
                  src={imageUrl(img)}
                  alt={name}
                  fill
                  sizes="56px"
                  className="object-contain p-1"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-faint">
                  <PackageIcon size={20} />
                </span>
              )}
            </div>
          );

          return (
            <li key={ligne.id} className="flex items-center gap-3.5 px-5 py-3.5">
              {ref ? (
                <Link href={`/produit/${encodeURIComponent(ref)}`} className="shrink-0">
                  {thumb}
                </Link>
              ) : (
                thumb
              )}
              <div className="min-w-0 flex-1">
                {ref ? (
                  <Link
                    href={`/produit/${encodeURIComponent(ref)}`}
                    className="line-clamp-1 text-sm font-medium text-navy-900 transition-colors hover:text-azure-600"
                  >
                    {name}
                  </Link>
                ) : (
                  <p className="line-clamp-1 text-sm font-medium text-navy-900">{name}</p>
                )}
                <p className="text-xs text-muted">
                  {ligne.quantite} × {formatTND(ligne.prixUnitaire)}
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums text-navy-900">
                {formatTND(Math.round(ligne.prixUnitaire * ligne.quantite * 100) / 100)}
              </p>
            </li>
          );
        })}
      </ul>

      {(order.bonsLivraison?.length || order.facture) && (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-2 px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
            {order.bonsLivraison?.map((bon) => (
              <p key={bon.id}>
                Bon de livraison <span className="font-semibold text-navy-900">{bon.code}</span>
                <span className="ml-2 text-xs">({bon.statut})</span>
              </p>
            ))}
            {order.facture && (
              <p>
                Facture <span className="font-semibold text-navy-900">N° {order.facture.numero}</span>
              </p>
            )}
          </div>
          {order.facture && (
          <button
            type="button"
            onClick={handleDownloadInvoice}
            disabled={downloading}
            className="inline-flex items-center gap-2 text-sm font-semibold text-azure-600 transition-colors hover:text-azure-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? (
              <span className="h-4 w-4 shrink-0 rounded-full border-2 border-azure-600 border-t-transparent animate-spin" />
            ) : (
              <DownloadIcon size={16} />
            )}
            Télécharger la facture
          </button>
          )}
        </footer>
      )}
    </article>
  );
}

// --- Factures ----------------------------------------------------------------

function FacturesPanel({ token }: { token: string }) {
  const [invoices, setInvoices] = useState<any[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    setInvoices(null);
    try {
      const data = await getMyInvoices(token);
      setInvoices(data);
    } catch {
      setError(true);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-2 shadow-sm">
        <ErrorState
          title="Impossible de charger vos factures"
          description="Une erreur est survenue. Veuillez réessayer."
          retry={load}
        />
      </div>
    );
  }

  if (invoices === null) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-24 w-full rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface shadow-sm">
        <EmptyState
          icon={<FileTextIcon size={30} />}
          title="Aucune facture"
          description="Vos factures validées apparaîtront ici."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {invoices.map((invoice) => (
        <InvoiceCard key={invoice.id} invoice={invoice} token={token} />
      ))}
    </div>
  );
}

function InvoiceCard({ invoice, token }: { invoice: any; token: string }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadInvoicePdf(token, invoice.id, invoice.numero);
    } catch (err: any) {
      toast.error(err.message || "Impossible de télécharger la facture.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <div className="flex items-center gap-3">
            <FileTextIcon size={20} className="text-navy-900" />
            <h3 className="font-semibold text-navy-900">Facture N° {invoice.numero}</h3>
          </div>
          <p className="mt-1 text-sm text-muted">
            {formatDate(invoice.creeLe)}
            {invoice.commande && ` • Commande ${orderNumber(invoice.commande.id)}`}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs text-muted mb-0.5">Total TTC</p>
            <p className="font-display font-bold tabular-nums text-navy-900">
              {formatTND(invoice.montantTTC)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-azure-50 text-azure-600 transition-colors hover:bg-azure-100 disabled:opacity-50"
            title="Télécharger le PDF"
          >
            {downloading ? (
              <span className="h-5 w-5 shrink-0 rounded-full border-2 border-azure-600 border-t-transparent animate-spin" />
            ) : (
              <DownloadIcon size={20} />
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
