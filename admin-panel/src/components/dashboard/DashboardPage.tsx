"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getApiUrl, parseJsonSafe } from "@/utils/api";
import { useExercice } from "@/context/ExerciceContext";
import DashboardFilters, { DashboardFilter } from "./DashboardFilters";
import InvoiceKPICards from "./InvoiceKPICards";
import PaymentStatusChart from "./PaymentStatusChart";
import InvoiceStatusChart from "./InvoiceStatusChart";
import EvolutionChart from "./EvolutionChart";
import RecentInvoicesTable from "./RecentInvoicesTable";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatGroup {
  count: number;
  montant: number;
}

interface UnpaidClient {
  id: number; numero: string; clientNom: string; clientEmail?: string | null;
  dateEmission: string; dateEcheance?: string | null; montantTTC: number;
  montantPaye: number; solde: number; statutPaiement: string; devise: string;
  commande?: { id: number; statut: string } | null;
  bonLivraison?: { id: number; code: string } | null;
}

interface UnpaidSupplier {
  id: number; numero: string; fournisseurNom?: string | null;
  dateFacture: string; dateEcheance?: string | null; montantTTC: number;
  montantPaye: number; solde: number; statutPaiement: string; devise: string;
  bonCommande?: { id: number; code: string; statut: string } | null;
  bonReception?: { id: number; code: string } | null;
}

interface DashboardData {
  recouvrement: { clients: UnpaidClient[]; fournisseurs: UnpaidSupplier[] };
  ventes: { caHT: number; caTVA: number; caTTC: number; factures: number; bonsLivraison: number };
  achats: { totalHT: number; totalTVA: number; totalTTC: number; factures: number; receptions: number };
  rentabilite: { ventesHT: number; coutAchats: number; marge: number; charges: number; chargesTTC: number; facturesCharges: number; beneficeNet: number };
  stock: {
    total: number; valeur: number; negatifs: number; ruptures: number;
    entrees: number; sorties: number; ajustements: number; variation: number; coutSorties: number; marge: number; quantitePending: number;
    produitsCritiques: { id: number; nom: string; reference: string; stock: number; cump: number; valuation: number }[];
    derniersMouvements: { id: number; createdAt: string; type: string; stockDelta: number; stockAfter: number; reference?: string | null; product: { nom: string; reference: string } }[];
  };
  factures: {
    total: number;
    montantTotalHT: number;
    montantTotalTVA: number;
    montantTotalTimbre?: number;
    montantTotalRetenue?: number;
    montantTotalTTC: number;
    parStatutPaiement: Record<string, StatGroup>;
    parStatut: Record<string, StatGroup>;
    parEtat: Record<string, StatGroup>;
    recents: {
      id: number;
      numero: string;
      clientNom: string;
      dateEmission: string;
      montantTTC: number;
      statut: string;
      statutPaiement: string;
      devise: string;
      etat: string;
    }[];
  };
  paiements: {
    total: number;
    montantTotal: number;
    parMode: Record<string, StatGroup>;
  };
  devis: {
    total: number;
    montantTotal: number;
    parStatut: Record<string, StatGroup>;
  };
  evolution: { mois: string; montantFactures: number; montantPaiements: number }[];
  devises: string[];
}

const EMPTY_DATA: DashboardData = {
  recouvrement: { clients: [], fournisseurs: [] },
  ventes: { caHT: 0, caTVA: 0, caTTC: 0, factures: 0, bonsLivraison: 0 },
  achats: { totalHT: 0, totalTVA: 0, totalTTC: 0, factures: 0, receptions: 0 },
  rentabilite: { ventesHT: 0, coutAchats: 0, marge: 0, charges: 0, chargesTTC: 0, facturesCharges: 0, beneficeNet: 0 },
  stock: { total: 0, valeur: 0, negatifs: 0, ruptures: 0, entrees: 0, sorties: 0, ajustements: 0, variation: 0, coutSorties: 0, marge: 0, quantitePending: 0, produitsCritiques: [], derniersMouvements: [] },
  factures: {
    total: 0,
    montantTotalHT: 0,
    montantTotalTVA: 0,
    montantTotalTimbre: 0,
    montantTotalRetenue: 0,
    montantTotalTTC: 0,
    parStatutPaiement: {},
    parStatut: {},
    parEtat: {},
    recents: [],
  },
  paiements: { total: 0, montantTotal: 0, parMode: {} },
  devis: { total: 0, montantTotal: 0, parStatut: {} },
  evolution: [],
  devises: [],
};

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { activeExercice } = useExercice();
  const API_URL = getApiUrl();

  const [filter, setFilter] = useState<DashboardFilter>({
    devise: "",
    periode: "annee",
    exerciceAnnee: activeExercice?.annee,
  });

  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailPanel, setDetailPanel] = useState<"clients" | "fournisseurs" | null>(null);

  // Keep exercice in sync with global context
  useEffect(() => {
    if (activeExercice?.annee && filter.exerciceAnnee !== activeExercice.annee) {
      setFilter((f) => ({ ...f, exerciceAnnee: activeExercice.annee }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeExercice?.annee]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter.devise) params.set("devise", filter.devise);
      if (filter.exerciceAnnee) {
        params.set("exerciceAnnee", String(filter.exerciceAnnee));
      } else {
        params.set("periode", filter.periode);
        if (filter.periode === "custom" && filter.dateDebut && filter.dateFin) {
          params.set("dateDebut", filter.dateDebut);
          params.set("dateFin", filter.dateFin);
        }
      }

      const token = typeof window !== "undefined" ? (localStorage.getItem("rzm_token") || localStorage.getItem("token")) : null;
      const res = await fetch(`${API_URL}/stats/dashboard?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await parseJsonSafe<Partial<DashboardData>>(res);
      if (!res.ok || !json || typeof json !== "object" || !json.factures) {
        throw new Error("Réponse dashboard invalide");
      }
      setData({
        ...EMPTY_DATA,
        ...json,
        ventes: { ...EMPTY_DATA.ventes, ...(json.ventes ?? {}) },
        achats: { ...EMPTY_DATA.achats, ...(json.achats ?? {}) },
        rentabilite: { ...EMPTY_DATA.rentabilite, ...(json.rentabilite ?? {}) },
        stock: { ...EMPTY_DATA.stock, ...(json.stock ?? {}) },
        recouvrement: { ...EMPTY_DATA.recouvrement, ...(json.recouvrement ?? {}) },
      });
    } catch (err: any) {
      console.error("Dashboard fetch error:", err);
      setError("Impossible de charger les statistiques. Vérifiez que le serveur backend est démarré.");
    } finally {
      setLoading(false);
    }
  }, [filter, API_URL]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleFilterChange = (f: DashboardFilter) => {
    setFilter(f);
  };

  const devisLabel = filter.devise || data.devises[0] || "TND";

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white/90">
            Tableau de Bord
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Statistiques financières en temps réel
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchStats()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
          >
            <svg
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualiser
          </button>
          <Link
            href="/invoices"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
          >
            Voir les factures
          </Link>
        </div>
      </div>

      {/* ── Filtres ─────────────────────────────────────────────────────── */}
      <DashboardFilters
        devises={data.devises}
        value={filter}
        onChange={handleFilterChange}
        loading={loading}
      />

      {/* ── Erreur ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <InvoiceKPICards
        factures={data.factures}
        paiements={data.paiements}
        devis={data.devis}
        devise={devisLabel}
        loading={loading}
      />

      <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/20 dark:to-gray-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-800 dark:text-emerald-300">Rentabilité</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Calculée selon les filtres sélectionnés.</p>
          </div>
          <Link href="/charges" className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-gray-900 dark:text-emerald-300">
            Voir les charges
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["Ventes HT", data.rentabilite.ventesHT, "text-blue-700 dark:text-blue-300"],
            ["Coût achats", data.rentabilite.coutAchats, "text-amber-700 dark:text-amber-300"],
            ["Marge", data.rentabilite.marge, "text-emerald-700 dark:text-emerald-300"],
          ].map(([label, value, color]) => (
            <div key={String(label)} className="rounded-xl border border-white/80 bg-white/80 p-4 dark:border-gray-800 dark:bg-gray-900/70">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
              <p className={`mt-1 text-xl font-bold ${color}`}>{Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} TND</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Link href="/charges" className="rounded-xl border border-rose-200 bg-rose-50 p-4 transition hover:border-rose-400 dark:border-rose-900/50 dark:bg-rose-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300">Charges</p>
            <p className="mt-1 text-xl font-bold text-rose-700 dark:text-rose-200">{data.rentabilite.charges.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} TND</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{data.rentabilite.facturesCharges} facture(s), y compris CNSS et 9ba4a</p>
          </Link>
          <div className="rounded-xl bg-emerald-700 p-4 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">Bénéfice net</p>
            <p className="mt-1 text-2xl font-bold">{data.rentabilite.beneficeNet.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} TND</p>
            <p className="mt-1 text-xs text-emerald-100">Marge − charges</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <button type="button" onClick={() => setDetailPanel("clients")} className="rounded-2xl border border-rose-200 bg-white p-5 text-left shadow-sm transition hover:border-rose-400 hover:bg-rose-50/40 dark:border-rose-900/50 dark:bg-white/[0.03] dark:hover:bg-rose-950/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Ventes à recouvrer</p>
          <p className="mt-2 text-2xl font-bold text-rose-700">{data.recouvrement.clients.reduce((sum, item) => sum + item.solde, 0).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} TND</p>
          <p className="mt-1 text-sm text-gray-500">{data.recouvrement.clients.length} facture(s) client non ou partiellement payée(s). Cliquer pour voir les clients et commandes.</p>
        </button>
        <button type="button" onClick={() => setDetailPanel("fournisseurs")} className="rounded-2xl border border-amber-200 bg-white p-5 text-left shadow-sm transition hover:border-amber-400 hover:bg-amber-50/40 dark:border-amber-900/50 dark:bg-white/[0.03] dark:hover:bg-amber-950/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Achats à payer</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{data.recouvrement.fournisseurs.reduce((sum, item) => sum + item.solde, 0).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} TND</p>
          <p className="mt-1 text-sm text-gray-500">{data.recouvrement.fournisseurs.length} facture(s) fournisseur non ou partiellement payée(s). Cliquer pour voir les fournisseurs et bons.</p>
        </button>
      </div>

      {detailPanel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
              <div><h2 className="text-lg font-semibold text-gray-900 dark:text-white">{detailPanel === "clients" ? "Clients à recouvrer" : "Fournisseurs à payer"}</h2><p className="text-xs text-gray-500">Détails correspondant à la période sélectionnée</p></div>
              <button type="button" onClick={() => setDetailPanel(null)} className="rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">Fermer</button>
            </div>
            <div className="max-h-[70vh] overflow-auto p-5">
              {detailPanel === "clients" ? (
                <table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b text-xs uppercase text-gray-500"><tr>{["Client", "Facture", "Commande / BL", "Total", "Payé", "Reste"].map((heading) => <th key={heading} className="px-3 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y">{data.recouvrement.clients.map((item) => <tr key={item.id}><td className="px-3 py-3"><p className="font-medium">{item.clientNom}</p><p className="text-xs text-gray-500">{item.clientEmail ?? ""}</p></td><td className="px-3 py-3">{item.numero}<p className="text-xs text-gray-500">{new Date(item.dateEmission).toLocaleDateString("fr-FR")}</p></td><td className="px-3 py-3">{item.commande ? `Commande #${item.commande.id}` : "-"}{item.bonLivraison ? ` · ${item.bonLivraison.code}` : ""}</td><td className="px-3 py-3">{item.montantTTC.toFixed(3)} {item.devise}</td><td className="px-3 py-3 text-emerald-600">{item.montantPaye.toFixed(3)} {item.devise}</td><td className="px-3 py-3 font-bold text-rose-600">{item.solde.toFixed(3)} {item.devise}</td></tr>)}</tbody></table>
              ) : (
                <table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b text-xs uppercase text-gray-500"><tr>{["Fournisseur", "Facture", "Bon commande / réception", "Total", "Payé", "Reste"].map((heading) => <th key={heading} className="px-3 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y">{data.recouvrement.fournisseurs.map((item) => <tr key={item.id}><td className="px-3 py-3 font-medium">{item.fournisseurNom ?? "Fournisseur non renseigné"}</td><td className="px-3 py-3">{item.numero}<p className="text-xs text-gray-500">{new Date(item.dateFacture).toLocaleDateString("fr-FR")}</p></td><td className="px-3 py-3">{item.bonCommande?.code ?? "-"}{item.bonReception ? ` · ${item.bonReception.code}` : ""}</td><td className="px-3 py-3">{item.montantTTC.toFixed(3)} {item.devise}</td><td className="px-3 py-3 text-emerald-600">{item.montantPaye.toFixed(3)} {item.devise}</td><td className="px-3 py-3 font-bold text-amber-600">{item.solde.toFixed(3)} {item.devise}</td></tr>)}</tbody></table>
              )}
              {((detailPanel === "clients" && data.recouvrement.clients.length === 0) || (detailPanel === "fournisseurs" && data.recouvrement.fournisseurs.length === 0)) && <p className="py-10 text-center text-sm text-gray-500">Aucun montant en attente.</p>}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {[
          ["CA ventes", data.ventes.caTTC, "text-blue-600"],
          ["Achats", data.achats.totalTTC, "text-amber-600"],
          ["Marge brute", data.stock.marge, "text-emerald-600"],
          ["Valeur stock", data.stock.valeur, "text-violet-600"],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
            <p className={`mt-2 text-2xl font-bold ${color}`}>{Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} TND</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {[{ title: "Ventes", values: [["CA HT", data.ventes.caHT], ["TVA", data.ventes.caTVA], ["CA TTC", data.ventes.caTTC], ["Factures / BL", `${data.ventes.factures} / ${data.ventes.bonsLivraison}`]] }, { title: "Achats", values: [["Achats HT", data.achats.totalHT], ["TVA", data.achats.totalTVA], ["Achats TTC", data.achats.totalTTC], ["Factures / réceptions", `${data.achats.factures} / ${data.achats.receptions}`]] }].map((section) => (
          <div key={section.title} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"><h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">{section.title}</h3><div className="grid grid-cols-2 gap-4">{section.values.map(([label, value]) => <div key={String(label)}><p className="text-xs text-gray-500">{label}</p><p className="mt-1 font-semibold text-gray-900 dark:text-white">{typeof value === "number" ? `${value.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} TND` : value}</p></div>)}</div></div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"><div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Etat du stock</h3><Link href="/mouvements-stock" className="text-xs font-medium text-brand-600">Voir les mouvements</Link></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{[["Stock total", `${data.stock.total} unités`], ["Valeur", `${data.stock.valeur.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} TND`], ["Ruptures", data.stock.ruptures], ["Négatifs", data.stock.negatifs], ["Marge pending", `${data.stock.quantitePending} unités`]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{value}</p></div>)}</div><div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><span>Entrées <b className="text-emerald-600">+{data.stock.entrees}</b></span><span>Sorties <b className="text-red-600">-{data.stock.sorties}</b></span><span>Ajustements <b>{data.stock.ajustements}</b></span><span>Variation <b>{data.stock.variation > 0 ? "+" : ""}{data.stock.variation}</b></span></div></div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2"><div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"><h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Produits critiques</h3><div className="divide-y divide-gray-100 dark:divide-gray-800">{data.stock.produitsCritiques.map((product) => <div key={product.id} className="flex items-center justify-between py-3"><div><p className="font-medium text-gray-800 dark:text-white">{product.nom}</p><p className="text-xs text-gray-500">{product.reference}</p></div><div className="text-right"><p className={product.stock < 0 ? "font-bold text-red-600" : "font-semibold text-amber-600"}>{product.stock} unités</p><p className="text-xs text-gray-500">{product.valuation.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} TND</p></div></div>)}{data.stock.produitsCritiques.length === 0 && <p className="py-5 text-sm text-gray-500">Aucun produit critique</p>}</div></div><div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"><h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Derniers mouvements</h3><div className="divide-y divide-gray-100 dark:divide-gray-800">{data.stock.derniersMouvements.map((movement) => <div key={movement.id} className="flex items-center justify-between py-3 text-sm"><div><p className="font-medium text-gray-800 dark:text-white">{movement.product.nom}</p><p className="text-xs text-gray-500">{new Date(movement.createdAt).toLocaleDateString("fr-FR")} · {movement.reference ?? "-"}</p></div><span className={movement.stockDelta >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>{movement.stockDelta > 0 ? "+" : ""}{movement.stockDelta}</span></div>)}{data.stock.derniersMouvements.length === 0 && <p className="py-5 text-sm text-gray-500">Aucun mouvement</p>}</div></div></div>

      {/* ── Summary stat row ─────────────────────────────────────────────── */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "Devis en cours",
              value: data.devis.parStatut?.["BROUILLON"]?.count ?? 0,
              href: "/devis",
              color: "text-amber-600",
            },
            {
              label: "Devis acceptés",
              value: data.devis.parStatut?.["ACCEPTE"]?.count ?? 0,
              href: "/devis",
              color: "text-emerald-600",
            },
            {
              label: "Factures brouillon",
              value: data.factures.parStatut?.["BROUILLON"]?.count ?? 0,
              href: "/invoices",
              color: "text-amber-600",
            },
            {
              label: "Factures validées",
              value: data.factures.parStatut?.["VALIDEE"]?.count ?? 0,
              href: "/invoices",
              color: "text-emerald-600",
            },
          ].map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-brand-300 hover:bg-brand-50 transition-colors dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-brand-700 dark:hover:bg-brand-950/20"
            >
              <span className="text-xs text-gray-500 dark:text-gray-400">{s.label}</span>
              <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
            </Link>
          ))}
        </div>
      )}

      {/* ── Charts Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* États paiement — Donut */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              États de paiement
            </h3>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {data.factures.total} factures
            </span>
          </div>
          <PaymentStatusChart
            data={data.factures.parStatutPaiement}
            title="États de paiement"
            loading={loading}
            devise={devisLabel}
          />
        </div>

        {/* Montants par état — Donut */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Montants par état
            </h3>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {devisLabel}
            </span>
          </div>
          <PaymentStatusChart
            data={data.factures.parStatutPaiement}
            title="Montants par état"
            loading={loading}
            showMontant
            devise={devisLabel}
          />
        </div>

        {/* Devis par statut — Donut */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Devis par statut
            </h3>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {data.devis.total} devis
            </span>
          </div>
          <PaymentStatusChart
            data={data.devis.parStatut}
            title="Devis par statut"
            loading={loading}
            colorMap={{
              BROUILLON: "#f59e0b",
              EN_ATTENTE: "#6366f1",
              ACCEPTE: "#10b981",
              REFUSE: "#f43f5e",
              EXPIRE: "#9ca3af",
              FACTURE: "#3b82f6",
              CONVERTI_BL: "#8b5cf6",
            }}
          />
        </div>
      </div>

      {/* ── Statuts & Types factures ─────────────────────────────────────── */}
      <InvoiceStatusChart
        statutData={data.factures.parStatut}
        etatData={data.factures.parEtat}
        loading={loading}
      />

      {/* ── Évolution mensuelle ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Évolution mensuelle
          </h3>
          <span className="text-xs text-gray-400">Factures émises vs Paiements reçus</span>
        </div>
        <EvolutionChart data={data.evolution} loading={loading} devise={devisLabel} />
      </div>

      {/* ── Dernières factures ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-4 pt-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Dernières factures
          </h3>
          <Link
            href="/invoices"
            className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            Voir toutes →
          </Link>
        </div>
        <RecentInvoicesTable factures={data.factures.recents} loading={loading} />
      </div>
    </div>
  );
}
