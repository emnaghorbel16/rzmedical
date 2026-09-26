"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { getApiUrl, downloadBonCommandePdf, exportToCsv } from "@/utils/api";
import { useAuth } from "@/hooks/useAuth";
import BonCommandeDetailModal from "@/components/achats/BonCommandeDetailModal";

const API_URL = getApiUrl();

interface BonCommande {
  id: number;
  code: string;
  dateCommande: string;
  dateLivraisonPrevue?: string | null;
  statut: "BROUILLON" | "ENVOYE" | "CONFIRME" | "RECEPTIONNE_PARTIEL" | "RECEPTIONNE" | "ANNULE";
  fournisseurNom?: string | null;
  montantHT: number;
  montantTTC: number;
  devise: string;
  _count?: { bonsReception: number };
  [key: string]: any;
}

const statutConfig: Record<string, { label: string; cls: string }> = {
  BROUILLON: { label: "Brouillon", cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  ENVOYE: { label: "Envoyé", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  CONFIRME: { label: "Confirmé", cls: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
  RECEPTIONNE_PARTIEL: { label: "Réc. Partiel", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  RECEPTIONNE: { label: "Réceptionné", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  ANNULE: { label: "Annulé", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

function fmt(n: number, devise = "TND") {
  return `${Number(n).toFixed(3)} ${devise}`;
}

export default function BonsCommandePage() {
  const { getToken } = useAuth();
  const [bons, setBons] = useState<BonCommande[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [transformingId, setTransformingId] = useState<number | null>(null);
  const [selectedBonForView, setSelectedBonForView] = useState<BonCommande | null>(null);
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error("Non authentifié");
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search && { search }),
        ...(filterStatut && { statut: filterStatut }),
      });
      const res = await fetch(`${API_URL}/achats/bons-commande?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erreur chargement");
      const data = await res.json();
      setBons(data.items);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getToken, page, search, filterStatut]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce bon de commande ?")) return;
    try {
      const token = getToken();
      await fetch(`${API_URL}/achats/bons-commande/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTransformerBR = async (id: number) => {
    if (!confirm("Transformer ce bon de commande en Bon de Réception ?")) return;
    setTransformingId(id);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/achats/bons-commande/${id}/transformer-br`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Erreur transformation");
      }
      const br = await res.json();
      alert(`Bon de Réception créé : ${br.code}`);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTransformingId(null);
    }
  };

  const handleExportExcel = () => {
    const headers = [
      "Code",
      "Statut",
      "Date Commande",
      "Livraison Prévue",
      "Fournisseur",
      "Total HT",
      "Total TTC",
      "Devise",
    ];
    const rows = bons.map((bc) => [
      bc.code,
      bc.statut,
      new Date(bc.dateCommande).toLocaleDateString("fr-FR"),
      bc.dateLivraisonPrevue ? new Date(bc.dateLivraisonPrevue).toLocaleDateString("fr-FR") : "",
      bc.fournisseurNom || "",
      Number(bc.montantHT).toFixed(3),
      Number(bc.montantTTC).toFixed(3),
      bc.devise,
    ]);
    exportToCsv(`bons-commande-${new Date().toISOString().split("T")[0]}`, headers, rows);
  };

  const totalPages = Math.ceil(total / limit);

  // Stats calculations (on current view)
  const totalBonsTTC = bons.reduce((acc, b) => acc + (b.montantTTC || 0), 0);
  const transformedCount = bons.filter(b => b.statut === "RECEPTIONNE" || b.statut === "RECEPTIONNE_PARTIEL").length;

  return (
    <div className="box-border flex h-[calc(100dvh-8rem)] w-full min-w-0 min-h-0 max-w-full flex-col overflow-hidden p-4 md:p-6">
      <div className="mb-2">
        <PageBreadcrumb pageTitle="Bons de Commande" />
      </div>

      {/* Stats Cards */}
      <div className="shrink-0 grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        {[
          { label: "Total BC (Liste actuelle)", value: bons.length, isCurrency: false },
          { label: "Montant Total TTC (Liste)", value: Number(totalBonsTTC).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }), isCurrency: true },
          { label: "BC Réceptionnés (Liste)", value: transformedCount, isCurrency: false, cls: "text-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3 shadow-sm">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
            <p className={`text-lg font-bold ${s.cls ?? "text-gray-800 dark:text-white"}`}>
              {s.value} {s.isCurrency ? "TND" : ""}
            </p>
          </div>
        ))}
      </div>

      <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            Bons de Commande Fournisseurs
            <span className="ml-2 text-sm font-normal text-gray-500">({total} total)</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Commandes d&apos;achats passées aux fournisseurs et transformation en réceptions
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-xs transition"
          >
            📊 Télécharger Excel
          </button>
          <Link
            href="/bons-commande/new"
            className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-xs"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/></svg>
            + NOUVEAU BON DE COMMANDE
          </Link>
        </div>
      </div>

      <div className="shrink-0 flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Rechercher (code, fournisseur...)"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
        />
        <select
          value={filterStatut}
          onChange={(e) => { setFilterStatut(e.target.value); setPage(1); }}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(statutConfig).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="relative h-0 min-h-0 w-full min-w-0 flex-1 basis-0 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-auto overscroll-contain">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : bons.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto mb-3 w-12 h-12 text-gray-300" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/>
            </svg>
            <p className="text-gray-500 dark:text-gray-400">Aucun bon de commande</p>
            <Link href="/bons-commande/new" className="mt-2 inline-block text-brand-500 text-sm hover:underline">
              + Créer le premier bon de commande
            </Link>
          </div>
        ) : (
          <table className="min-w-[1500px] w-full table-fixed text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                {["Code", "Statut", "Date", "Livraison prévue", "Fournisseur", "Total HT", "Total TTC", "BR Liés", "Actions"].map((h) => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {bons.map((bc) => (
                <tr key={bc.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-3 py-3 font-mono text-xs text-brand-600 dark:text-brand-400">
                    <button
                      onClick={() => setSelectedBonForView(bc)}
                      className="font-bold hover:underline text-left block"
                      title="Consulter"
                    >
                      {bc.code}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${(statutConfig[bc.statut] ?? statutConfig.BROUILLON).cls}`}>
                      {(statutConfig[bc.statut] ?? { label: bc.statut }).label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-300">
                    {new Date(bc.dateCommande).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">
                    {bc.dateLivraisonPrevue ? new Date(bc.dateLivraisonPrevue).toLocaleDateString("fr-FR") : "—"}
                  </td>
                  <td className="px-3 py-3 text-xs font-medium text-gray-800 dark:text-white">
                    {bc.fournisseurNom ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-right text-xs text-gray-600 dark:text-gray-300">
                    {fmt(bc.montantHT, bc.devise)}
                  </td>
                  <td className="px-3 py-3 text-right text-xs font-semibold text-gray-800 dark:text-white">
                    {fmt(bc.montantTTC, bc.devise)}
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-gray-500">
                    {bc._count?.bonsReception ?? 0}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {/* Consulter */}
                      <button
                        onClick={() => setSelectedBonForView(bc)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition-colors"
                        title="Consulter"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                      </button>

                      {/* Modifier */}
                      <Link
                        href={`/bons-commande/${bc.id}/edit`}
                        className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 transition-colors"
                        title="Modifier"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                      </Link>

                      {/* Télécharger PDF */}
                      <button
                        onClick={async () => {
                          try {
                            await downloadBonCommandePdf(bc.id, bc.code);
                          } catch (e: any) {
                            alert(e.message || "Erreur téléchargement PDF");
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
                        title="Télécharger PDF"
                      >
                        📄
                      </button>

                      {/* Transformer en BR */}
                      {bc.statut !== "ANNULE" && bc.statut !== "RECEPTIONNE" && (
                        <button
                          onClick={() => handleTransformerBR(bc.id)}
                          disabled={transformingId === bc.id}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 transition-colors disabled:opacity-50"
                          title="Transformer en Bon de Réception"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
                        </button>
                      )}

                      {/* Supprimer */}
                      <button
                        onClick={() => handleDelete(bc.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                        title="Supprimer"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Page {page} sur {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800">Précédent</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800">Suivant</button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedBonForView && (
        <BonCommandeDetailModal
          bon={selectedBonForView}
          onClose={() => setSelectedBonForView(null)}
          onEdit={(b) => {
            setSelectedBonForView(null);
            window.location.href = `/bons-commande/${b.id}/edit`;
          }}
          onTransformerBR={(bonId) => {
            setSelectedBonForView(null);
            handleTransformerBR(bonId);
          }}
        />
      )}
    </div>
  );
}
