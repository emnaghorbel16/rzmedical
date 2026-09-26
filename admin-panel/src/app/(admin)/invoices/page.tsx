"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { getApiUrl, downloadInvoicePdf } from "@/utils/api";
import { useAuth } from "@/hooks/useAuth";
import PaymentModal from "@/components/invoices/PaymentModal";
import InvoiceDetailModal from "@/components/invoices/InvoiceDetailModal";
import InvoiceEditModal from "@/components/invoices/InvoiceEditModal";
import { useExercice } from "@/context/ExerciceContext";

const API_URL = getApiUrl();

interface Invoice {
  id: number;
  numero: string;
  dateEmission: string;
  dateEcheance?: string | null;
  clientNom: string;
  clientMF?: string | null;
  clientAdresse?: string | null;
  clientTelephone?: string | null;
  clientEmail?: string | null;
  montantHT: number;
  montantTVA: number;
  timbreFiscal: number;
  montantTTC: number;
  retenueSurce: number;
  statut: "BROUILLON" | "VALIDEE" | "ENVOYEE" | "ANNULEE" | "EMISE" | "BL_NON_FACTURE";
  statutPaiement: "NON_PAYEE" | "PARTIELLEMENT_PAYEE" | "PAYEE";
  typeFacture: "PRODUITS" | "BON_LIVRAISON" | "FACTURE" | "SERVICE";
  etat?: "NORMALE" | "PROFORMA" | "AVOIR";
  fichierPdf: string | null;
  commentaire?: string | null;
  lignes?: any[];
  paiements: { id?: number; montant: number; modePaiement?: string; datePaiement?: string; reference?: string }[];
  commande?: { id: number };
  bonLivraison?: { id?: number; code: string; statut?: string };
  bonsLivraison?: { id: number; code: string; statut: string }[];
  isPendingBL?: boolean;
  bonLivraisonId?: number;
  montantPaye?: number;
  solde?: number;
}

interface PendingBL {
  id: number;
  code: string;
  statut: string;
  dateLivraison?: string | null;
  creeLe?: string;
  clientNom?: string | null;
  utilisateur?: { nom?: string | null; prenom?: string | null } | null;
  lignes?: { quantiteLivree: number; prixUnitaireHT: number; tauxTVA: number }[];
  factures?: unknown[];
  facturesJonction?: unknown[];
}

const statusConfig: Record<string, { label: string; cls: string }> = {
  BROUILLON: { label: "Brouillon", cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  EMISE: { label: "Emise", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  VALIDEE: { label: "Validée", cls: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
  ENVOYEE: { label: "Envoyée", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  ANNULEE: { label: "Annulée", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  BL_NON_FACTURE: { label: "BL non facturé", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
};

const paiementConfig: Record<string, { label: string; cls: string }> = {
  NON_PAYEE: { label: "Non payée", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  PARTIELLEMENT_PAYEE: { label: "Partiel", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  PAYEE: { label: "Payée", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
};

const typeConfig: Record<string, string> = {
  PRODUITS: "Produit",
  BON_LIVRAISON: "Bon Livraison",
  FACTURE: "Facture",
  SERVICE: "Service",
};

export default function InvoicesPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { activeExercice, isAllSelected } = useExercice();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<Invoice | null>(null);
  const [selectedInvoiceForEdit, setSelectedInvoiceForEdit] = useState<Invoice | null>(null);

  const [activeFilter, setActiveFilter] = useState<"ACTIVES" | "BROUILLON" | "VALIDEE" | "PAYEE" | "TOUTES">("ACTIVES");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error("Non authentifié");
      const url =
        !isAllSelected && activeExercice
          ? `${API_URL}/invoices/admin/all?exerciceAnnee=${activeExercice.annee}`
          : `${API_URL}/invoices/admin/all`;
      const headers = { Authorization: `Bearer ${token}` };
      const [res, blRes] = await Promise.all([
        fetch(url, { headers }),
        fetch(`${API_URL}/bons-livraison/admin`, { headers }),
      ]);
      if (!res.ok) throw new Error("Erreur lors du chargement des factures");
      const data: Invoice[] = await res.json();
      const bls: PendingBL[] = blRes.ok ? await blRes.json() : [];
      const pendingBLs: Invoice[] = bls
        .filter(bl => bl.statut !== "FACTURE" && bl.statut !== "ANNULE" && !(bl.factures?.length) && !(bl.facturesJonction?.length))
        .map(bl => {
          const montantHT = (bl.lignes || []).reduce(
            (total, ligne) => total + Number(ligne.quantiteLivree) * Number(ligne.prixUnitaireHT),
            0,
          );
          const montantTVA = (bl.lignes || []).reduce(
            (total, ligne) => total + Number(ligne.quantiteLivree) * Number(ligne.prixUnitaireHT) * Number(ligne.tauxTVA) / 100,
            0,
          );
          return {
            id: -bl.id,
            bonLivraisonId: bl.id,
            isPendingBL: true,
            numero: bl.code,
            dateEmission: bl.dateLivraison || bl.creeLe || "",
            clientNom: bl.clientNom || `${bl.utilisateur?.nom || ""} ${bl.utilisateur?.prenom || ""}`.trim(),
            montantHT,
            montantTVA,
            timbreFiscal: 0,
            montantTTC: montantHT + montantTVA,
            retenueSurce: 0,
            statut: "BL_NON_FACTURE",
            statutPaiement: "NON_PAYEE",
            typeFacture: "BON_LIVRAISON",
            fichierPdf: null,
            paiements: [],
          };
        });
      setInvoices([...pendingBLs, ...data]);
    } catch (err: any) {
      setError(err.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, [getToken, activeExercice, isAllSelected]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const updateStatut = async (id: number, newStatut: string) => {
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/invoices/admin/${id}/statut`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ statut: newStatut }),
      });
      if (res.ok) {
        fetchInvoices();
      } else {
        const d = await res.json();
        alert(d.error || "Erreur lors du changement de statut");
      }
    } catch {
      alert("Erreur de connexion");
    }
  };

  const fmt = (n: number) =>
    Number(n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  // Counts
  const cancelledCount = invoices.filter((i) => i.statut === "ANNULEE").length;
  const activeInvoices = invoices.filter((i) => i.statut !== "ANNULEE");
  const brouillonCount = invoices.filter((i) => i.statut === "BROUILLON").length;
  const valideeCount = invoices.filter((i) => i.statut === "VALIDEE" || i.statut === "ENVOYEE").length;
  const payeeCount = invoices.filter((i) => i.statutPaiement === "PAYEE" && i.statut !== "ANNULEE").length;

  // Filtered list
  const displayedInvoices = invoices.filter((inv) => {
    if (activeFilter === "ACTIVES" && inv.statut === "ANNULEE") return false;
    if (activeFilter === "BROUILLON" && inv.statut !== "BROUILLON") return false;
    if (activeFilter === "VALIDEE" && inv.statut !== "VALIDEE" && inv.statut !== "ENVOYEE") return false;
    if (activeFilter === "PAYEE" && (inv.statutPaiement !== "PAYEE" || inv.statut === "ANNULEE")) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        inv.numero?.toLowerCase().includes(q) ||
        inv.clientNom?.toLowerCase().includes(q) ||
        inv.clientMF?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Stats calculations
  const totalCA_TTC = activeInvoices.reduce((acc, inv) => acc + (inv.montantTTC || 0), 0);
  const totalPaye = activeInvoices.reduce((acc, inv) => acc + (inv.montantPaye || 0), 0);
  const totalImpaye = activeInvoices.reduce((acc, inv) => acc + (inv.solde || 0), 0);

  return (
    <div className="box-border flex h-[calc(100dvh-8rem)] w-full min-w-0 max-w-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0">
        <PageBreadcrumb pageTitle="Factures" />
      </div>

      {/* Stats Cards */}
      <div className="shrink-0 grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total Factures Actives", value: activeInvoices.length, isCurrency: false },
          { label: "Chiffre d'Affaires TTC", value: fmt(totalCA_TTC), isCurrency: true },
          { label: "Total Encaissé", value: fmt(totalPaye), isCurrency: true, cls: "text-emerald-600" },
          { label: "Reste à recouvrer", value: fmt(totalImpaye), isCurrency: true, cls: "text-rose-600", link: "/impayes" },
        ].map((s) => (
          s.link ? (
            <Link href={s.link} key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3 shadow-sm hover:border-rose-300 dark:hover:border-rose-800 transition-colors cursor-pointer group block">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex justify-between items-center">
                {s.label}
                <span className="text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">➔</span>
              </p>
              <p className={`text-lg font-bold ${s.cls ?? "text-gray-800 dark:text-white"}`}>
                {s.value} {s.isCurrency ? "TND" : ""}
              </p>
            </Link>
          ) : (
            <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3 shadow-sm">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
              <p className={`text-lg font-bold ${s.cls ?? "text-gray-800 dark:text-white"}`}>
                {s.value} {s.isCurrency ? "TND" : ""}
              </p>
            </div>
          )
        ))}
      </div>

      {/* Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Factures Clients</h2>
            {!isAllSelected && activeExercice ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Exercice {activeExercice.annee}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
                🌐 Tous les exercices
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">{activeInvoices.length} facture(s) active(s)</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/invoices/annulees"
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/80 dark:bg-red-950/20 px-4 py-2.5 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition shadow-sm"
          >
            <span>❌</span> Factures Annulées
            {cancelledCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-200 dark:bg-red-900 text-xs font-bold text-red-800 dark:text-red-200">
                {cancelledCount}
              </span>
            )}
          </Link>
          <Link
            href="/invoices/new"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-700 hover:bg-amber-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors shadow-sm"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Ajouter une facture
          </Link>
        </div>
      </div>

      {error && (
        <div className="shrink-0 mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchInvoices} className="underline font-medium hover:text-red-800">
            Réessayer
          </button>
        </div>
      )}

      {/* Filter Tabs + Search */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        <button
          onClick={() => setActiveFilter("ACTIVES")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${activeFilter === "ACTIVES"
            ? "bg-amber-700 text-white shadow-sm"
            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 border border-gray-200 dark:border-gray-700"
            }`}
        >
          Toutes les actives ({activeInvoices.length})
        </button>
        <button
          onClick={() => setActiveFilter("BROUILLON")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${activeFilter === "BROUILLON"
            ? "bg-amber-700 text-white shadow-sm"
            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 border border-gray-200 dark:border-gray-700"
            }`}
        >
          Brouillons ({brouillonCount})
        </button>
        <button
          onClick={() => setActiveFilter("VALIDEE")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${activeFilter === "VALIDEE"
            ? "bg-amber-700 text-white shadow-sm"
            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 border border-gray-200 dark:border-gray-700"
            }`}
        >
          Validées ({valideeCount})
        </button>
        <button
          onClick={() => setActiveFilter("PAYEE")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${activeFilter === "PAYEE"
            ? "bg-amber-700 text-white shadow-sm"
            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 border border-gray-200 dark:border-gray-700"
            }`}
        >
          Entièrement payées ({payeeCount})
        </button>
        <button
          onClick={() => setActiveFilter("TOUTES")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${activeFilter === "TOUTES"
            ? "bg-amber-700 text-white shadow-sm"
            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 border border-gray-200 dark:border-gray-700"
            }`}
        >
          Tout inclure ({invoices.length})
        </button>
        <div className="sm:ml-auto w-full sm:w-56">
          <input
            type="text"
            placeholder="Rechercher numéro, client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Table — the only scrollable region on this page */}
      <div className="min-h-0 w-full min-w-0 flex-1 basis-0 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-sm overflow-hidden">
        <div className="invoice-table-scroll h-full w-full min-w-0 overflow-auto overscroll-contain">
          <table className="min-w-[1780px] w-full table-fixed text-left text-sm">
            <colgroup>
              {["140px", "120px", "95px", "115px", "105px", "220px", "130px", "130px", "120px", "140px", "140px", "130px", "155px"].map((width, index) => (
                <col key={index} style={{ width }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
              <tr>
                {[
                  "Numéro",
                  "Statut",
                  "Etat",
                  "Date",
                  "Type",
                  "Client",
                  "Total HT",
                  "Total TTC",
                  "Retenue",
                  "Net à payer",
                  "Paiements",
                  "Solde",
                  "Edition",
                ].map((h) => (
                  <th
                    key={h}
                    className="sticky top-0 z-10 bg-gray-50 px-3 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap dark:bg-gray-800 dark:text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && invoices.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-gray-400">
                    Chargement des factures...
                  </td>
                </tr>
              ) : displayedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-gray-400 italic">
                    Aucune facture dans cette vue
                  </td>
                </tr>
              ) : (
                displayedInvoices.map((inv) => {
                  const sCfg = statusConfig[inv.statut] || { label: inv.statut, cls: "bg-gray-100 text-gray-600" };
                  const pCfg = paiementConfig[inv.statutPaiement] || { label: inv.statutPaiement, cls: "bg-gray-100 text-gray-600" };
                  const totalPaye = (inv.paiements || []).reduce((s, p) => s + Number(p.montant), 0);
                  const netAPayer = Number(inv.montantTTC) - Number(inv.retenueSurce || 0);
                  const solde = Math.max(0, netAPayer - totalPaye);
                  const dateStr = inv.dateEmission ? new Date(inv.dateEmission).toLocaleDateString("fr-FR") : "—";
                  const isAnnulee = inv.statut === "ANNULEE";

                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-gray-50/60 dark:hover:bg-gray-800/20 transition-colors ${isAnnulee ? "opacity-60 bg-red-50/10" : ""
                        }`}
                    >
                      {/* Numéro */}
                      <td className="px-3 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                        <button
                          onClick={() => inv.isPendingBL && inv.bonLivraisonId
                            ? router.push(`/invoices/new?blId=${inv.bonLivraisonId}`)
                            : setSelectedInvoiceForView(inv)}
                          className={`hover:underline cursor-pointer ${isAnnulee ? "line-through text-gray-400" : "text-amber-700 dark:text-amber-400"}`}
                        >
                          {inv.numero}
                        </button>
                      </td>
                      {/* Statut */}
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${sCfg.cls}`}>
                          {sCfg.label}
                        </span>
                      </td>
                      {/* Etat */}
                      <td className="px-3 py-3">
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {inv.etat || "Normale"}
                        </span>
                      </td>
                      {/* Date */}
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {dateStr}
                      </td>
                      {/* Type */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium">
                          {typeConfig[inv.typeFacture] || inv.typeFacture}
                        </span>
                      </td>
                      {/* Client */}
                      <td className="px-3 py-3 text-gray-900 dark:text-white font-medium">
                        {inv.clientNom || "—"}
                      </td>
                      {/* Total HT */}
                      <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {fmt(Number(inv.montantHT))}
                      </td>
                      {/* Total TTC */}
                      <td className="px-3 py-3 text-right tabular-nums font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                        {fmt(Number(inv.montantTTC))}
                      </td>
                      {/* Retenue */}
                      <td className="px-3 py-3 text-right tabular-nums text-gray-500 whitespace-nowrap">
                        {fmt(Number(inv.retenueSurce || 0))}
                      </td>
                      {/* Net à payer */}
                      <td className="px-3 py-3 text-right tabular-nums font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                        {fmt(netAPayer)}
                      </td>
                      {/* Paiements */}
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pCfg.cls}`}>
                          {pCfg.label}
                        </span>
                      </td>
                      {/* Solde */}
                      <td
                        className={`px-3 py-3 text-right tabular-nums font-medium whitespace-nowrap ${solde > 0.001
                          ? "text-red-600 dark:text-red-400"
                          : "text-emerald-600 dark:text-emerald-400"
                          }`}
                      >
                        {fmt(solde)}
                      </td>
                      {/* Action Menu (Edition) */}
                      <td className="px-3 py-3">
                        <InvoiceActionMenu
                          invoice={inv}
                          onFacturerBL={(blId) => router.push(`/invoices/new?blId=${blId}`)}
                          onView={(targetInv) => setSelectedInvoiceForView(targetInv)}
                          onEdit={(targetInv) => setSelectedInvoiceForEdit(targetInv)}
                          onPay={(targetInv) => setSelectedInvoiceForPayment(targetInv)}
                          onStatusChange={updateStatut}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <style jsx>{`
          .invoice-table-scroll {
            scrollbar-width: thin;
            scrollbar-color: #0f766e #e5e0d5;
          }
          .invoice-table-scroll::-webkit-scrollbar {
            height: 10px;
            width: 10px;
          }
          .invoice-table-scroll::-webkit-scrollbar-track {
            background: #e5e0d5;
            border-radius: 9999px;
          }
          .invoice-table-scroll::-webkit-scrollbar-thumb {
            background-color: #0f766e;
            border-radius: 9999px;
            border: 2px solid #e5e0d5;
          }
          .invoice-table-scroll::-webkit-scrollbar-thumb:hover {
            background-color: #0d5f58;
          }
        `}</style>
      </div>

      {/* Invoice Detail View Modal */}
      {selectedInvoiceForView && (
        <InvoiceDetailModal
          invoice={selectedInvoiceForView}
          onClose={() => setSelectedInvoiceForView(null)}
          onEdit={(inv) => {
            setSelectedInvoiceForView(null);
            setSelectedInvoiceForEdit(inv);
          }}
          onPay={(inv) => {
            setSelectedInvoiceForView(null);
            setSelectedInvoiceForPayment(inv);
          }}
        />
      )}

      {/* Invoice Edit Modal */}
      {selectedInvoiceForEdit && (
        <InvoiceEditModal
          invoice={selectedInvoiceForEdit}
          allInvoices={invoices}
          onClose={() => setSelectedInvoiceForEdit(null)}
          onSuccess={() => {
            setSelectedInvoiceForEdit(null);
            fetchInvoices();
          }}
        />
      )}

      {/* Payment Modal */}
      {selectedInvoiceForPayment && (
        <PaymentModal
          invoice={selectedInvoiceForPayment as any}
          onClose={() => setSelectedInvoiceForPayment(null)}
          onSuccess={() => {
            fetchInvoices();
            setSelectedInvoiceForPayment(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Dropdown Component (Edition) ────────────────────────────────────────────

function InvoiceActionMenu({
  invoice,
  onFacturerBL,
  onView,
  onEdit,
  onPay,
  onStatusChange,
}: {
  invoice: Invoice;
  onFacturerBL: (blId: number) => void;
  onView: (inv: Invoice) => void;
  onEdit: (inv: Invoice) => void;
  onPay: (inv: Invoice) => void;
  onStatusChange: (id: number, newStatut: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside ref
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isAnnulee = invoice.statut === "ANNULEE";
  const isPayee = invoice.statutPaiement === "PAYEE";

  if (invoice.isPendingBL && invoice.bonLivraisonId) {
    return (
      <MenuItem
        icon="🧾"
        label="Facturer le BL"
        onClick={() => onFacturerBL(invoice.bonLivraisonId!)}
      />
    );
  }

  return (
    <div className={`relative inline-block text-left ${open ? "z-50" : "z-10"}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-xs cursor-pointer"
      >
        <span>Edition</span>
        <svg
          width="11"
          height="11"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          viewBox="0 0 24 24"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-100">
          {/* Consulter */}
          <MenuItem
            icon="🔍"
            label="Consulter"
            onClick={() => {
              setOpen(false);
              onView(invoice);
            }}
          />

          {/* Modifier */}
          {!isAnnulee && (
            <MenuItem
              icon="✏️"
              label="Modifier"
              onClick={() => {
                setOpen(false);
                onEdit(invoice);
              }}
            />
          )}

          {/* Payer */}
          {!isAnnulee && (
            <MenuItem
              icon="💰"
              label="Payer"
              disabled={isPayee}
              onClick={() => {
                setOpen(false);
                onPay(invoice);
              }}
            />
          )}

          {/* Statut shortcuts */}
          {invoice.statut === "BROUILLON" && (
            <MenuItem
              icon="✓"
              label="Valider la facture"
              onClick={async () => {
                setOpen(false);
                await onStatusChange(invoice.id, "VALIDEE");
              }}
            />
          )}
          {invoice.statut === "VALIDEE" && (
            <MenuItem
              icon="📨"
              label="Marquer Envoyée"
              onClick={async () => {
                setOpen(false);
                await onStatusChange(invoice.id, "ENVOYEE");
              }}
            />
          )}

          <div className="border-t border-gray-100 dark:border-gray-700 my-1" />

          {/* PDF */}
          <MenuItem
            icon="📄"
            label="Télécharger PDF"
            onClick={async () => {
              setOpen(false);
              try {
                await downloadInvoicePdf(invoice.id, invoice.numero);
              } catch (err) {
                console.error(err);
                alert("Erreur lors du téléchargement du PDF");
              }
            }}
          />

          <div className="border-t border-gray-100 dark:border-gray-700 my-1" />

          {/* Annuler / Rétablir */}
          {!isAnnulee ? (
            <MenuItem
              icon="❌"
              label="Annuler la facture"
              danger
              onClick={async () => {
                setOpen(false);
                if (
                  !confirm(
                    `Annuler la facture ${invoice.numero} ?\n\nElle restera enregistrée dans vos données (consultable dans « Factures Annulées ») et son/ses bon(s) de livraison associés seront libérés.`
                  )
                )
                  return;
                await onStatusChange(invoice.id, "ANNULEE");
              }}
            />
          ) : (
            <MenuItem
              icon="🔄"
              label="Rétablir en Brouillon"
              onClick={async () => {
                setOpen(false);
                if (!confirm(`Rétablir la facture ${invoice.numero} en statut Brouillon ?`)) return;
                await onStatusChange(invoice.id, "BROUILLON");
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors font-medium ${disabled
        ? "opacity-40 cursor-not-allowed text-gray-400"
        : danger
          ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
        }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
