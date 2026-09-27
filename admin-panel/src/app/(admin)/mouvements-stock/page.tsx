"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { getApiUrl } from "@/utils/api";

const API_URL = getApiUrl();
const types = ["", "PURCHASE", "SALE", "ADJUSTMENT", "INVENTORY"];

type Movement = {
  id: number;
  createdAt: string;
  depot: string;
  nature?: string;
  type: string;
  quantity: number;
  stockDelta: number;
  unitPrice?: number | null;
  cump?: number | null;
  stockAfter: number;
  valuation?: number | null;
  reference?: string | null;
  documentType?: string | null;
  sourceType?: string | null;
  sourceId?: number | null;
  product: { nom: string; reference: string };
};

type Result = { items: Movement[]; total: number; page: number; limit: number; totalPages: number };

const labelType = (type: string) => ({ PURCHASE: "ENTREE", SALE: "SORTIE", ADJUSTMENT: "AJUSTEMENT", INVENTORY: "INVENTAIRE", RETURN_CLIENT: "RETOUR CLIENT", RETURN_SUPPLIER: "RETOUR FOURNISSEUR", TRANSFER: "TRANSFERT" }[type] ?? type);

const renderDocumentLink = (movement: Movement) => {
  const label = movement.reference ?? movement.documentType ?? "-";
  if (!movement.sourceId || !movement.sourceType || label === "-") return <span>{label}</span>;
  
  let href = "";
  if (movement.sourceType === "BON_LIVRAISON") href = `/bons-livraison/${movement.sourceId}`;
  else if (movement.sourceType === "COMMANDE") href = `/orders/${movement.sourceId}`;
  else if (movement.sourceType === "FACTURE") href = `/invoices/${movement.sourceId}`;
  else if (movement.sourceType === "ACHAT") href = `/achats/${movement.sourceId}`;
  
  if (href) {
    return (
      <Link href={href} className="font-medium text-brand-600 hover:text-brand-700 hover:underline">
        {label}
      </Link>
    );
  }
  return <span>{label}</span>;
};

export default function MouvementsStockPage() {
  const [result, setResult] = useState<Result>({ items: [], total: 0, page: 1, limit: 25, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ page: String(page), limit: "25" });
      if (search.trim()) query.set("search", search.trim());
      if (type) query.set("type", type);
      if (dateFrom) query.set("dateFrom", dateFrom);
      if (dateTo) query.set("dateTo", dateTo);
      const response = await fetch(`${API_URL}/stock/movements?${query}`);
      if (!response.ok) throw new Error("Impossible de charger les mouvements");
      setResult(await response.json());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div>
      <PageBreadcrumb pageTitle="Mouvements de stock" />
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Stocks</p>
            <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">Mouvements articles</h1>
          </div>
          <span className="text-sm text-gray-500">{result.total} mouvement{result.total > 1 ? "s" : ""}</span>
        </div>
        <div className="mb-5 grid gap-3 md:grid-cols-5">
          <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void load()} placeholder="Facture, article, famille..." className="rounded-lg border border-gray-200 px-3 py-2 text-sm md:col-span-2 dark:border-gray-700 dark:bg-gray-900" />
          <select value={type} onChange={(event) => { setType(event.target.value); void load(); }} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
            {types.map((value) => <option key={value} value={value}>{value ? labelType(value) : "Toutes les natures"}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void load()} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
        </div>
        <div className="mb-4 flex justify-end"><button onClick={() => void load()} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">Rechercher</button></div>
        {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-y border-gray-100 text-xs uppercase text-gray-500 dark:border-gray-800">
              <tr>{["N°", "Date", "Dépôt", "Nature", "Produit", "Qté", "P.U.", "Total", "CUMP", "Stock après", "Valorisation", "Document"].map((heading) => <th key={heading} className="px-3 py-3 font-semibold">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? <tr><td colSpan={12} className="px-3 py-10 text-center text-gray-500">Chargement...</td></tr> : result.items.length === 0 ? <tr><td colSpan={12} className="px-3 py-10 text-center text-gray-500">Aucun mouvement</td></tr> : result.items.map((movement) => <tr key={movement.id}>
                <td className="px-3 py-3 font-mono text-xs text-gray-500">{movement.id}</td>
                <td className="px-3 py-3 whitespace-nowrap">{new Date(movement.createdAt).toLocaleDateString("fr-FR")}</td>
                <td className="px-3 py-3">{movement.depot}</td>
                <td className={`px-3 py-3 font-semibold ${movement.stockDelta >= 0 ? "text-emerald-600" : "text-red-600"}`}>{labelType(movement.type)}</td>
                <td className="px-3 py-3"><div className="font-medium">{movement.product.nom}</div><div className="text-xs text-gray-500">{movement.product.reference}</div></td>
                <td className="px-3 py-3">{movement.stockDelta > 0 ? "+" : ""}{movement.stockDelta}</td>
                <td className="px-3 py-3">{movement.unitPrice == null ? "-" : `${Number(movement.unitPrice).toFixed(3)} TND`}</td>
                <td className="px-3 py-3">{movement.unitPrice == null ? "-" : `${(Math.abs(movement.stockDelta) * Number(movement.unitPrice)).toFixed(3)} TND`}</td>
                <td className="px-3 py-3">{movement.cump == null ? "-" : `${Number(movement.cump).toFixed(3)} TND`}</td>
                <td className="px-3 py-3 font-medium">{movement.stockAfter}</td>
                <td className="px-3 py-3">{movement.valuation == null ? "-" : `${Number(movement.valuation).toFixed(3)} TND`}</td>
                <td className="px-3 py-3">{renderDocumentLink(movement)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500"><span>Page {result.page} / {result.totalPages}</span><div className="flex gap-2"><button disabled={result.page <= 1} onClick={() => void load(result.page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Précédent</button><button disabled={result.page >= result.totalPages} onClick={() => void load(result.page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Suivant</button></div></div>
      </div>
    </div>
  );
}
