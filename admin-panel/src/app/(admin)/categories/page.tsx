"use client";
import { getApiUrl, getBaseUrl } from "@/utils/api";
import React, { useEffect, useState, useCallback } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";

const API_URL = getApiUrl();

interface SousCategorie {
  id: number;
  nom: string;
}

interface Categorie {
  id: number;
  nom: string;
  creeLe: string;
  _count: { sousCategories: number };
  sousCategories: SousCategorie[];
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Categorie | null>(null);
  const [formNom, setFormNom] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Delete confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/categories`);
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const data = await res.json();
      setCategories(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openAdd = () => {
    setEditing(null);
    setFormNom("");
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (cat: Categorie) => {
    setEditing(cat);
    setFormNom(cat.nom);
    setFormError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setFormNom("");
    setFormError(null);
  };

  const handleSave = async () => {
    if (!formNom.trim()) {
      setFormError("Le nom est requis");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const url = editing
        ? `${API_URL}/categories/${editing.id}`
        : `${API_URL}/categories`;
      const method = editing ? "PUT" : "POST";
      const token = typeof window !== "undefined" ? (localStorage.getItem("rzm_token") || localStorage.getItem("token")) : null;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ nom: formNom.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'enregistrement");
      closeModal();
      fetchCategories();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = typeof window !== "undefined" ? (localStorage.getItem("rzm_token") || localStorage.getItem("token")) : null;
      const res = await fetch(`${API_URL}/categories/${id}`, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la suppression");
      }
      setDeleteId(null);
      fetchCategories();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erreur de suppression");
    }
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Catégories" />

      {/* Header + Bouton Ajouter */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Gestion des catégories
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {categories.length} catégorie{categories.length !== 1 ? "s" : ""} au total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Rechercher une catégorie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-56 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            onClick={() => openAdd()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Ajouter une catégorie
          </button>
        </div>
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-red-500 font-medium">{error}</p>
            <button onClick={fetchCategories} className="text-sm text-brand-500 underline">
              Réessayer
            </button>
          </div>
        ) : categories.filter(cat => !searchQuery.trim() || cat.nom.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-gray-500 dark:text-gray-400">Aucune catégorie trouvée</p>
            <button onClick={() => openAdd()} className="text-sm text-brand-500 underline">
              Créer la première catégorie
            </button>
          </div>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-gray-100 dark:border-gray-800 border-y">
                <TableRow>
                  <TableCell isHeader className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 text-start">#</TableCell>
                  <TableCell isHeader className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 text-start">Nom</TableCell>
                  <TableCell isHeader className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 text-start">Sous-catégories</TableCell>
                  <TableCell isHeader className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 text-start">Date de création</TableCell>
                  <TableCell isHeader className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 text-end">Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {categories.filter(cat => !searchQuery.trim() || cat.nom.toLowerCase().includes(searchQuery.toLowerCase())).map((cat) => (
                  <TableRow key={cat.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <TableCell className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{cat.id}</TableCell>
                    <TableCell className="px-6 py-4">
                      <span className="font-medium text-gray-800 dark:text-white/90 text-sm">{cat.nom}</span>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {cat.sousCategories.length === 0 ? (
                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">Aucune</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {(expandedCats.has(cat.id) ? cat.sousCategories : cat.sousCategories.slice(0, 3)).map(sc => (
                            <span
                              key={sc.id}
                              className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                            >
                              {sc.nom}
                            </span>
                          ))}
                          {cat.sousCategories.length > 3 && (
                            <button
                              onClick={() => toggleExpand(cat.id)}
                              className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                            >
                              {expandedCats.has(cat.id)
                                ? "Réduire"
                                : `+${cat.sousCategories.length - 3} de plus`}
                            </button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(cat.creeLe).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(cat)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.05] transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                          </svg>
                          Modifier
                        </button>
                        <button
                          onClick={() => setDeleteId(cat.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                          Supprimer
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

      {/* Modale Ajouter / Modifier */}
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
              <h4 className="text-lg font-bold text-gray-800 dark:text-white/90">
                {editing ? "Modifier la catégorie" : "Nouvelle catégorie"}
              </h4>
              <button
                type="button"
                onClick={closeModal}
                className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors"
                aria-label="Fermer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                Nom de la catégorie *
              </label>
              <input
                type="text"
                value={formNom}
                onChange={(e) => setFormNom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="Ex: Cardiologie, Consommables..."
                className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                autoFocus
              />
              {formError && (
                <p className="mt-1.5 text-xs text-red-500 font-medium">{formError}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={closeModal}
                className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60 transition-colors"
              >
                {saving ? "Enregistrement..." : editing ? "Modifier" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de confirmation de suppression */}
      {deleteId !== null && (
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
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-bold text-gray-800 dark:text-white/90">
                Confirmer la suppression
              </h4>
              <button
                onClick={() => setDeleteId(null)}
                className="h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
              Êtes-vous sûr de vouloir supprimer cette catégorie ? Toutes les sous-catégories et produits associés seront impactés.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
