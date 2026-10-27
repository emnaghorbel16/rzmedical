"use client";

import { useEffect, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { getApiUrl } from "@/utils/api";

const API_URL = getApiUrl();

type Bon = {
  id: number;
  code: string;
  statut: "BROUILLON" | "VALIDE" | "ANNULE";
  creeLe: string;
  clientNom: string | null;
  commercial: { id: number; nom: string; prenom: string };
  lignes: { produit: { nom: string }; quantite: number }[];
};

export default function BonsLivraisonCommercialPage() {
  const [bons, setBons] = useState<Bon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("rzm_token") : null;
      const response = await fetch(`${API_URL}/stock-commercial/bons-livraison`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) setBons(await response.json());
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const valider = async (id: number) => {
    if (!confirm("Valider cette livraison ? Le stock du commercial sera diminué.")) return;
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("rzm_token") : null;
      const response = await fetch(`${API_URL}/stock-commercial/bons-livraison/${id}/valider`, {
        method: "PATCH",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error((await response.json()).error || "Erreur");
      alert("Livraison validée avec succès");
      load();
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Bons de Livraison (Commercial → Client)" />
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Livraisons des commerciaux</h1>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Rechercher code, commercial, client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button onClick={load} className="text-sm font-medium text-brand-500 hover:text-brand-600">Rafraîchir</button>
          </div>
        </div>
        
        {loading ? <div className="py-10 text-center">Chargement...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
              <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Commercial</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Contenu</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {bons.filter(bon => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return bon.code.toLowerCase().includes(q) ||
                    `${bon.commercial.prenom} ${bon.commercial.nom}`.toLowerCase().includes(q) ||
                    (bon.clientNom || "").toLowerCase().includes(q);
                }).map((bon) => (
                  <tr key={bon.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{bon.code}</td>
                    <td className="px-4 py-3">{new Date(bon.creeLe).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{bon.commercial.prenom} {bon.commercial.nom}</td>
                    <td className="px-4 py-3">{bon.clientNom || "-"}</td>
                    <td className="px-4 py-3">
                      {bon.lignes.map((l, i) => (
                        <div key={i} className="text-xs">{l.quantite}x {l.produit.nom}</div>
                      ))}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        bon.statut === "VALIDE" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      }`}>
                        {bon.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {bon.statut === "BROUILLON" && (
                        <button onClick={() => valider(bon.id)} className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600">
                          Valider
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {bons.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center">Aucune livraison enregistrée. Utilisez l'API.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
