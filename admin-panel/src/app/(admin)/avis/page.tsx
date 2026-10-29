"use client";

import React, { useEffect, useState, useCallback } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";
import { getApiUrl } from "@/utils/api";

const API_URL = getApiUrl();

interface AvisItem {
  id: number;
  produitId: number;
  nomAuteur: string;
  note: number;
  titre?: string | null;
  commentaire: string;
  verifieAchat: boolean;
  statut: "APPROUVE" | "EN_ATTENTE" | "REJETE";
  creeLe: string;
  produit?: {
    nom: string;
    reference: string;
  };
  utilisateur?: {
    prenom: string;
    nom: string;
    email: string;
  } | null;
}

export default function AvisAdminPage() {
  const [avisList, setAvisList] = useState<AvisItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statutFilter, setStatutFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const getToken = () => {
    return typeof window !== "undefined"
      ? localStorage.getItem("rzm_token") || localStorage.getItem("token")
      : null;
  };

  const fetchAvis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/avis/admin`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error(`Erreur ${res.status}: impossible de charger les avis.`);
      }
      const data = await res.json();
      setAvisList(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvis();
  }, [fetchAvis]);

  const handleUpdateStatut = async (id: number, statut: "APPROUVE" | "REJETE" | "EN_ATTENTE") => {
    setActionLoading(id);
    try {
      const token = getToken();
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/avis/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ statut }),
      });
      if (!res.ok) throw new Error("Erreur lors de la mise à jour");
      setAvisList((prev) =>
        prev.map((item) => (item.id === id ? { ...item, statut } : item))
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erreur de mise à jour");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer définitivement cet avis ?")) {
      return;
    }
    setActionLoading(id);
    try {
      const token = getToken();
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/avis/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Erreur lors de la suppression");
      setAvisList((prev) => prev.filter((item) => item.id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erreur de suppression");
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = avisList.filter((a) => {
    const matchStatus = statutFilter === "ALL" || a.statut === statutFilter;
    const q = searchQuery.toLowerCase();
    const matchQuery =
      !q ||
      a.nomAuteur.toLowerCase().includes(q) ||
      (a.titre && a.titre.toLowerCase().includes(q)) ||
      a.commentaire.toLowerCase().includes(q) ||
      (a.produit?.nom && a.produit.nom.toLowerCase().includes(q)) ||
      (a.produit?.reference && a.produit.reference.toLowerCase().includes(q));
    return matchStatus && matchQuery;
  });

  const getStatusBadge = (statut: string) => {
    switch (statut) {
      case "APPROUVE":
        return <Badge color="success">Approuvé</Badge>;
      case "EN_ATTENTE":
        return <Badge color="warning">En attente</Badge>;
      case "REJETE":
        return <Badge color="error">Rejeté / Masqué</Badge>;
      default:
        return <Badge color="light">{statut}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle="Modération des Avis Clients" />

      {/* Barre d'outils et filtres */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "ALL", label: `Tous (${avisList.length})` },
              { id: "APPROUVE", label: `Approuvés (${avisList.filter((a) => a.statut === "APPROUVE").length})` },
              { id: "EN_ATTENTE", label: `En attente (${avisList.filter((a) => a.statut === "EN_ATTENTE").length})` },
              { id: "REJETE", label: `Rejetés (${avisList.filter((a) => a.statut === "REJETE").length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatutFilter(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                statutFilter === tab.id
                  ? "bg-brand-500 text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par auteur, produit..."
            className="w-full sm:w-64 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm placeholder-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <button
            onClick={fetchAvis}
            title="Rafraîchir"
            className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-750"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tableau des avis */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-gray-800">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Chargement des avis...</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-600">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">
            Aucun avis trouvé pour les filtres actuels.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader className="w-28">Date</TableCell>
                  <TableCell isHeader className="w-48">Produit</TableCell>
                  <TableCell isHeader className="w-40">Auteur</TableCell>
                  <TableCell isHeader className="w-28">Note</TableCell>
                  <TableCell isHeader>Avis & Commentaire</TableCell>
                  <TableCell isHeader className="w-28">Statut</TableCell>
                  <TableCell isHeader className="w-36 text-right">Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs text-gray-500">
                      {new Date(item.creeLe).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </TableCell>

                    <TableCell>
                      <div className="font-medium text-gray-900 dark:text-white text-xs">
                        {item.produit?.nom || `ID: ${item.produitId}`}
                      </div>
                      {item.produit?.reference && (
                        <div className="text-[11px] text-gray-400">
                          Réf: {item.produit.reference}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-gray-800 dark:text-gray-200">
                          {item.nomAuteur}
                        </span>
                        {item.verifieAchat && (
                          <span
                            title="Achat vérifié"
                            className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700"
                          >
                            ✓ Achat
                          </span>
                        )}
                      </div>
                      {item.utilisateur?.email && (
                        <div className="text-[11px] text-gray-400">
                          {item.utilisateur.email}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <svg
                            key={star}
                            className={`h-3.5 w-3.5 ${
                              star <= item.note ? "text-amber-400 fill-amber-400" : "text-gray-300 fill-gray-200"
                            }`}
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                    </TableCell>

                    <TableCell>
                      {item.titre && (
                        <div className="text-xs font-bold text-gray-800 dark:text-gray-200">
                          {item.titre}
                        </div>
                      )}
                      <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3">
                        {item.commentaire}
                      </p>
                    </TableCell>

                    <TableCell>{getStatusBadge(item.statut)}</TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.statut !== "APPROUVE" && (
                          <button
                            disabled={actionLoading === item.id}
                            onClick={() => handleUpdateStatut(item.id, "APPROUVE")}
                            title="Approuver et publier sur le site"
                            className="rounded p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}

                        {item.statut !== "REJETE" && (
                          <button
                            disabled={actionLoading === item.id}
                            onClick={() => handleUpdateStatut(item.id, "REJETE")}
                            title="Rejeter / Masquer du site"
                            className="rounded p-1 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        )}

                        <button
                          disabled={actionLoading === item.id}
                          onClick={() => handleDelete(item.id)}
                          title="Supprimer définitivement"
                          className="rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
