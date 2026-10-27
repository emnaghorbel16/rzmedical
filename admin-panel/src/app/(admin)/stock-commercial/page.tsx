"use client";

import { useEffect, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { getApiUrl } from "@/utils/api";

const API_URL = getApiUrl();

type StockCommercial = {
  id: number;
  quantite: number;
  misAJourLe: string;
  produit: { id: number; nom: string; reference: string };
  commercial: { id: number; nom: string; prenom: string; email: string };
};

export default function StockCommercialDashboard() {
  const [stocks, setStocks] = useState<StockCommercial[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("rzm_token") : null;
      const response = await fetch(`${API_URL}/stock-commercial`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        setStocks(await response.json());
      }
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Group by commercial
  const byCommercial = stocks.reduce((acc, stock) => {
    const key = stock.commercial.id;
    if (!acc[key]) acc[key] = { commercial: stock.commercial, items: [] };
    acc[key].items.push(stock);
    return acc;
  }, {} as Record<number, { commercial: any; items: StockCommercial[] }>);

  return (
    <div>
      <PageBreadcrumb pageTitle="Stock des Commerciaux" />
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">État des stocks par commercial</h1>
          <button onClick={load} className="text-sm font-medium text-brand-500 hover:text-brand-600">Rafraîchir</button>
        </div>
        
        {loading ? (
          <div className="py-10 text-center text-sm text-gray-500">Chargement...</div>
        ) : Object.values(byCommercial).length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">Aucun stock commercialisé enregistré.</div>
        ) : (
          <div className="space-y-8">
            {Object.values(byCommercial).map(({ commercial, items }) => (
              <div key={commercial.id} className="rounded-xl border border-gray-100 p-4 shadow-sm dark:border-gray-800">
                <h2 className="mb-4 text-lg font-medium text-gray-800 dark:text-gray-100">
                  {commercial.prenom} {commercial.nom} <span className="text-sm text-gray-400">({commercial.email})</span>
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                      <tr>
                        <th className="px-4 py-3">Produit</th>
                        <th className="px-4 py-3">Référence</th>
                        <th className="px-4 py-3 text-right">Quantité restante</th>
                        <th className="px-4 py-3 text-right">Dernière MAJ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {items.map((stock) => (
                        <tr key={stock.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{stock.produit.nom}</td>
                          <td className="px-4 py-3">{stock.produit.reference}</td>
                          <td className="px-4 py-3 text-right font-bold text-brand-500">{stock.quantite}</td>
                          <td className="px-4 py-3 text-right">{new Date(stock.misAJourLe).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
