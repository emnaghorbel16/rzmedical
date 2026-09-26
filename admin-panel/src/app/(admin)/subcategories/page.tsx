"use client";
import { getApiUrl, getBaseUrl } from "@/utils/api";
import React, { useEffect, useState, useCallback } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";

const API_URL = getApiUrl();

interface Categorie {
  id: number;
  nom: string;
}

interface SousCategorie {
  id: number;
  nom: string;
  categorieId: number;
  categorie: Categorie;
  description?: string | null;
  image?: string | null;
  creeLe: string;
  _count: { produits: number };
}

export default function SubcategoriesPage() {
  const [items, setItems] = useState<SousCategorie[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SousCategorie | null>(null);
  const [formNom, setFormNom] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formImage, setFormImage] = useState("");
  const [formCatId, setFormCatId] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resSub, resCat] = await Promise.all([
        fetch(`${API_URL}/subcategories`),
        fetch(`${API_URL}/categories`)
      ]);
      if (!resSub.ok || !resCat.ok) throw new Error("Erreur de chargement");
      
      const [dataSub, dataCat] = await Promise.all([resSub.json(), resCat.json()]);
      setItems(dataSub);
      setCategories(dataCat);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = (categorieId?: number) => {
    setEditing(null);
    setFormNom("");
    setFormDescription(""); setFormImage("");
    setFormCatId(categorieId?.toString() || "");
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (item: SousCategorie) => {
    setEditing(item);
    setFormNom(item.nom);
    setFormDescription(item.description || ""); setFormImage(item.image || "");
    setFormCatId(item.categorieId.toString());
    setFormError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!formNom.trim() || !formCatId) {
      setFormError("Nom et Catégorie requis");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const url = editing ? `${API_URL}/subcategories/${editing.id}` : `${API_URL}/subcategories`;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: formNom.trim(), description: formDescription.trim() || undefined, image: formImage || undefined, categorieId: formCatId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'enregistrement");
      closeModal();
      fetchData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/subcategories/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la suppression");
      }
      setDeleteId(null);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erreur de suppression");
    }
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Sous-Catégories" />
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Gestion des sous-catégories</h3>
          <p className="text-sm text-gray-500">{items.length} sous-catégorie(s)</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Rechercher une sous-catégorie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-52 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button onClick={() => openAdd()} className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors">
            Ajouter
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <button key={category.id} type="button" onClick={() => openAdd(category.id)} className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-500 hover:shadow-md dark:border-gray-800 dark:bg-white/[0.03]">
            <span className="font-semibold text-gray-800 dark:text-white/90">{category.nom}</span>
            <span className="mt-1 block text-xs text-gray-500">Cliquer pour ajouter une sous-catégorie</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3"><p className="text-red-500">{error}</p><button onClick={fetchData} className="text-sm text-brand-500 underline">Réessayer</button></div>
        ) : items.filter(item => !searchQuery.trim() || item.nom.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3"><p className="text-gray-500">Aucune sous-catégorie</p><button onClick={() => openAdd()} className="text-sm text-brand-500 underline">Créer</button></div>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-gray-100 dark:border-gray-800 border-y">
                <TableRow>
                  <TableCell isHeader className="px-6 py-3 text-start">Nom</TableCell>
                  <TableCell isHeader className="px-6 py-3 text-start">Image</TableCell>
                  <TableCell isHeader className="px-6 py-3 text-start">Catégorie Parente</TableCell>
                  <TableCell isHeader className="px-6 py-3 text-start">Produits</TableCell>
                  <TableCell isHeader className="px-6 py-3 text-end">Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.filter(item => !searchQuery.trim() || item.nom.toLowerCase().includes(searchQuery.toLowerCase())).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="px-6 py-4 font-medium text-gray-800 dark:text-white/90">{item.nom}</TableCell>
                    <TableCell className="px-6 py-4">{item.image ? <img src={item.image} alt={item.nom} className="h-12 w-12 rounded-lg object-cover" /> : <span className="text-xs text-gray-400">Aucune image</span>}</TableCell>
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
                {editing ? "Modifier la sous-catégorie" : "Nouvelle Sous-Catégorie"}
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

            <div className="mb-4"><label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Description</label><textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" /></div>
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Image</label>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 2 * 1024 * 1024) { setFormError("L’image doit faire au maximum 2 Mo"); return; } const reader = new FileReader(); reader.onload = () => setFormImage(String(reader.result)); reader.readAsDataURL(file); }} className="w-full text-sm" />
              {formImage && (
                <div className="relative mt-3 inline-block">
                  <img
                    src={formImage.startsWith("/") || formImage.startsWith("uploads") ? (formImage.startsWith("/") ? getBaseUrl() + formImage : getBaseUrl() + "/" + formImage) : formImage}
                    alt="Aperçu"
                    className="h-24 w-24 rounded-lg object-cover border"
                  />
                  <button
                    type="button"
                    onClick={() => setFormImage("")}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 transition-colors z-10 cursor-pointer"
                    title="Supprimer l'image"
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
