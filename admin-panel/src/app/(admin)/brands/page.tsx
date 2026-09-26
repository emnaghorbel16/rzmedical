"use client";
import { getApiUrl, getBaseUrl } from "@/utils/api";
import React, { useEffect, useState, useCallback } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";

const API_URL = getApiUrl();

interface Categorie { id: number; nom: string; }
interface Marque {
  id: number;
  nom: string;
  logo?: string;
  categorieId: number;
  categorie: Categorie;
  creeLe: string;
  _count: { produits: number };
}

export default function BrandsPage() {
  const [items, setItems] = useState<Marque[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Marque | null>(null);
  const [formNom, setFormNom] = useState("");
  const [formLogo, setFormLogo] = useState("");
  const [formCatId, setFormCatId] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [resBrand, resCat] = await Promise.all([
        fetch(`${API_URL}/brands`),
        fetch(`${API_URL}/categories`)
      ]);
      if (!resBrand.ok || !resCat.ok) throw new Error("Erreur de chargement");
      setItems(await resBrand.json());
      setCategories(await resCat.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setFormError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/upload/single`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'upload");
      setFormLogo(data.url);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erreur d'upload");
    } finally {
      setUploading(false);
    }
  };

  const openAdd = () => {
    setEditing(null); setFormNom(""); setFormLogo(""); setFormCatId(categories.length > 0 ? categories[0].id.toString() : "");
    setFormError(null); setShowModal(true);
  };
  const openEdit = (item: Marque) => {
    setEditing(item); setFormNom(item.nom); setFormLogo(item.logo || ""); setFormCatId(item.categorieId.toString());
    setFormError(null); setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSave = async () => {
    if (!formNom.trim() || !formCatId) { setFormError("Nom et Catégorie requis"); return; }
    setSaving(true); setFormError(null);
    try {
      const url = editing ? `${API_URL}/brands/${editing.id}` : `${API_URL}/brands`;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: formNom.trim(), logo: formLogo.trim() || undefined, categorieId: formCatId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erreur d'enregistrement");
      closeModal(); fetchData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erreur");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/brands/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Erreur de suppression");
      setDeleteId(null); fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erreur");
    }
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Marques" />
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Gestion des marques</h3>
          <p className="text-sm text-gray-500">{items.length} marque(s)</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Rechercher une marque..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button onClick={() => openAdd()} className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors">
            Ajouter
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3"><p className="text-red-500">{error}</p><button onClick={fetchData} className="text-sm text-brand-500 underline">Réessayer</button></div>
        ) : items.filter(item => !searchQuery.trim() || item.nom.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3"><p className="text-gray-500">Aucune marque</p><button onClick={() => openAdd()} className="text-sm text-brand-500 underline">Créer</button></div>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-gray-100 dark:border-gray-800 border-y">
                <TableRow>
                  <TableCell isHeader className="px-6 py-3 text-start">Logo</TableCell>
                  <TableCell isHeader className="px-6 py-3 text-start">Nom</TableCell>
                  <TableCell isHeader className="px-6 py-3 text-start">Catégorie Parente</TableCell>
                  <TableCell isHeader className="px-6 py-3 text-start">Produits</TableCell>
                  <TableCell isHeader className="px-6 py-3 text-end">Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.filter(item => !searchQuery.trim() || item.nom.toLowerCase().includes(searchQuery.toLowerCase())).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="px-6 py-4">
                      {item.logo ? <img src={item.logo} alt={item.nom} className="h-10 w-10 object-contain rounded-md border" /> : <div className="h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center text-xs text-gray-400">-</div>}
                    </TableCell>
                    <TableCell className="px-6 py-4 font-medium text-gray-800 dark:text-white/90">{item.nom}</TableCell>
                    <TableCell className="px-6 py-4 text-sm text-gray-500">{item.categorie?.nom}</TableCell>
                    <TableCell className="px-6 py-4">
                      <Badge color={item._count.produits > 0 ? "success" : "warning"} size="sm">{item._count.produits} produits</Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-end">
                      <button onClick={() => openEdit(item)} className="text-sm text-brand-500 hover:underline mr-3">Modifier</button>
                      <button onClick={() => setDeleteId(item.id)} className="text-sm text-red-500 hover:underline">Supprimer</button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {showModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white dark:bg-gray-900 shadow-2xl p-6 border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-150 relative"
          >
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-lg font-bold text-gray-800 dark:text-white">
                {editing ? "Modifier la marque" : "Nouvelle Marque"}
              </h4>
              <button
                type="button"
                onClick={closeModal}
                className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors"
                aria-label="Fermer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Nom *</label>
              <input type="text" value={formNom} onChange={(e) => setFormNom(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" autoFocus />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Logo</label>
              <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleFileUpload} className="w-full rounded-xl border border-gray-300 p-2 text-xs dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
              {uploading && <p className="text-xs text-brand-500 mt-1">Téléversement en cours...</p>}
              {formLogo && (
                <div className="relative mt-2 inline-block">
                  <img
                    src={formLogo.startsWith("/") ? getBaseUrl() + formLogo : formLogo}
                    alt="Aperçu"
                    className="h-12 rounded-lg border object-contain p-1"
                  />
                  <button
                    type="button"
                    onClick={() => setFormLogo("")}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 transition-colors z-10 cursor-pointer"
                    title="Supprimer le logo"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Catégorie Parente *</label>
              <select value={formCatId} onChange={(e) => setFormCatId(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                <option value="" disabled>-- Sélectionner --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>

            {formError && <p className="mt-1.5 text-xs text-red-500 font-medium">{formError}</p>}

            <div className="flex justify-end gap-3 mt-6 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button onClick={closeModal} className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
              <button onClick={handleSave} disabled={saving} className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60 transition-colors">{saving ? "En cours..." : "Enregistrer"}</button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteId(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-gray-900 shadow-2xl p-6 border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-150 relative"
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-lg font-bold text-gray-900 dark:text-white">Confirmer la suppression</h4>
              <button
                onClick={() => setDeleteId(null)}
                className="h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-6">Cette action est irréversible et impactera les produits associés.</p>
            <div className="flex justify-end gap-2.5">
              <button onClick={() => setDeleteId(null)} className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
              <button onClick={() => handleDelete(deleteId)} className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
