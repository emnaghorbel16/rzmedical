"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { getApiUrl } from "@/utils/api";

const API_URL = getApiUrl();
type LigneForm = { produitId: string; quantite: string };
type Produit = { id: number; nom: string; stock: number };
type Commercial = { id: number; prenom: string; nom: string };

export default function EditBonSortiePage() {
  const { id } = useParams();
  const router = useRouter();
  const [commerciaux, setCommerciaux] = useState<Commercial[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [commercialId, setCommercialId] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [lignes, setLignes] = useState<LigneForm[]>([{ produitId: "", quantite: "1" }]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem("token") || localStorage.getItem("rzm_token");
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const [bonRes, commercialRes, productRes] = await Promise.all([
          fetch(`${API_URL}/stock-commercial/bons-sortie/${id}`, { headers }),
          fetch(`${API_URL}/clients/commerciaux`, { headers }),
          fetch(`${API_URL}/products?limit=1000`, { headers }),
        ]);
        const bon = await bonRes.json();
        if (!bonRes.ok) throw new Error(bon.error || "Bon de sortie introuvable");
        if (bon.statut !== "BROUILLON") throw new Error("Un bon validé ne peut pas être modifié");
        setCommercialId(String(bon.commercialId));
        setCommentaire(bon.commentaire || "");
        setLignes(bon.lignes.map((ligne: any) => ({ produitId: String(ligne.produitId), quantite: String(ligne.quantite) })));
        if (commercialRes.ok) setCommerciaux(await commercialRes.json());
        if (productRes.ok) { const data = await productRes.json(); setProduits(data.items || data || []); }
      } catch (err) { setError(err instanceof Error ? err.message : "Erreur de chargement"); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  const updateLine = (index: number, field: keyof LigneForm, value: string) => setLignes((current) => current.map((line, i) => i === index ? { ...line, [field]: value } : line));
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null);
    const validLines = lignes.filter((line) => line.produitId && Number(line.quantite) > 0);
    if (!commercialId || !validLines.length) return setError("Sélectionnez un commercial et au moins un produit.");
    if (new Set(validLines.map((line) => line.produitId)).size !== validLines.length) return setError("Un produit ne peut apparaître qu’une seule fois.");
    setSaving(true);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("rzm_token");
      const response = await fetch(`${API_URL}/stock-commercial/bons-sortie/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ commercialId: Number(commercialId), commentaire, lignes: validLines.map((line) => ({ produitId: Number(line.produitId), quantite: Number(line.quantite) })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors de l'enregistrement");
      router.push(`/bons-sortie/${id}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Chargement...</div>;
  return <div><PageBreadcrumb pageTitle="Modifier le Bon de Sortie" /><div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]"><div className="mb-5 flex items-center justify-between"><h1 className="text-xl font-bold text-gray-900 dark:text-white">Modifier le Bon de Sortie</h1><Link href={`/bons-sortie/${id}`} className="text-sm text-gray-500">Annuler</Link></div><form onSubmit={save} className="space-y-5"><label className="block text-sm font-medium">Commercial<select required value={commercialId} onChange={(event) => setCommercialId(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 dark:border-gray-700 dark:bg-gray-800"><option value="">-- Sélectionner --</option>{commerciaux.map((commercial) => <option key={commercial.id} value={commercial.id}>{commercial.prenom} {commercial.nom}</option>)}</select></label><label className="block text-sm font-medium">Commentaire<textarea value={commentaire} onChange={(event) => setCommentaire(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 dark:border-gray-700 dark:bg-gray-800" /></label><div><div className="mb-2 flex items-center justify-between"><label className="text-sm font-medium">Produits</label><button type="button" onClick={() => setLignes((current) => [...current, { produitId: "", quantite: "1" }])} className="text-sm font-medium text-brand-500">+ Ajouter une ligne</button></div><div className="space-y-2">{lignes.map((ligne, index) => <div key={index} className="flex gap-2"><select required value={ligne.produitId} onChange={(event) => updateLine(index, "produitId", event.target.value)} className="min-w-0 flex-1 rounded-lg border border-gray-300 p-2.5 dark:border-gray-700 dark:bg-gray-800"><option value="">-- Produit --</option>{produits.map((produit) => <option key={produit.id} value={produit.id}>{produit.nom} (stock : {produit.stock})</option>)}</select><input required min="1" type="number" value={ligne.quantite} onChange={(event) => updateLine(index, "quantite", event.target.value)} className="w-24 rounded-lg border border-gray-300 p-2.5 text-center dark:border-gray-700 dark:bg-gray-800" />{lignes.length > 1 && <button type="button" onClick={() => setLignes((current) => current.filter((_, i) => i !== index))} className="rounded-lg px-3 text-red-500">×</button>}</div>)}</div></div>{error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="flex justify-end"><button disabled={saving} className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">{saving ? "Enregistrement..." : "Enregistrer"}</button></div></form></div></div>;
}
