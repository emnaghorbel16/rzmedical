"use client";

import React, { useEffect, useState, useCallback } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { getApiUrl, getBaseUrl } from "@/utils/api";

const API_URL = getApiUrl();
const BASE_URL = getBaseUrl();

function imageFullUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

interface Categorie {
  id: number;
  nom: string;
}

interface SousCategorie {
  id: number;
  nom: string;
  categorieId: number;
  description?: string | null;
  image?: string | null;
  ordre: number;
  _count?: { produits: number };
}

export default function ReorderSubcategoriesPage() {
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [subcategories, setSubcategories] = useState<SousCategorie[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load categories
  useEffect(() => {
    fetch(`${API_URL}/categories`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCategories(data);
          if (data.length > 0) setSelectedCatId(data[0].id);
        }
      })
      .catch((err) => showToast("Erreur de chargement des catégories: " + err.message, "error"))
      .finally(() => setLoadingCats(false));
  }, []);

  // Load subcategories when selectedCatId changes
  const fetchSubcategories = useCallback((catId: number) => {
    setLoadingSubs(true);
    fetch(`${API_URL}/subcategories?categorieId=${catId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSubcategories(data);
        }
      })
      .catch((err) => showToast("Erreur de chargement des sous-catégories: " + err.message, "error"))
      .finally(() => setLoadingSubs(false));
  }, []);

  useEffect(() => {
    if (selectedCatId !== null) {
      fetchSubcategories(selectedCatId);
    }
  }, [selectedCatId, fetchSubcategories]);

  // Reorder helpers
  const moveItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= subcategories.length) return;
    const updated = [...subcategories];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setSubcategories(updated);
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    moveItem(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Save new order to backend
  const handleSaveOrder = async () => {
    if (subcategories.length === 0) return;
    setSaving(true);
    try {
      const itemsToUpdate = subcategories.map((sc, idx) => ({
        id: sc.id,
        ordre: idx,
      }));

      const token = typeof window !== "undefined" ? (localStorage.getItem("rzm_token") || localStorage.getItem("token")) : null;
      const res = await fetch(`${API_URL}/subcategories/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ items: itemsToUpdate }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur de sauvegarde");
      }

      showToast("Ordre des sous-catégories enregistré avec succès !", "success");
    } catch (err: any) {
      showToast(err.message || "Erreur lors de la mise à jour de l'ordre.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Ordre des sous-catégories" />

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-3 rounded-xl px-5 py-3 text-sm font-semibold shadow-2xl text-white transition-all ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.type === "success" ? "✓" : "✕"} {toast.msg}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          Organiser l&apos;affichage des sous-catégories par catégorie
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Sélectionnez une catégorie ci-dessous, puis utilisez la souris (glisser-déposer ou boutons fléchés) pour modifier l&apos;ordre d&apos;affichage des sous-catégories sur le site web.
        </p>

        {/* Category selector tabs */}
        <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-100 dark:border-gray-800 pb-4">
          {loadingCats ? (
            <span className="text-sm text-gray-400">Chargement des catégories...</span>
          ) : (
            categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCatId(cat.id)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                  selectedCatId === cat.id
                    ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                {cat.nom}
              </button>
            ))
          )}
        </div>

        {/* Subcategories reordering list */}
        {loadingSubs ? (
          <div className="py-12 text-center text-sm text-gray-400">
            Chargement des sous-catégories...
          </div>
        ) : subcategories.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400 border border-dashed rounded-xl border-gray-200 dark:border-gray-800">
            Aucune sous-catégorie enregistrée dans cette catégorie.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {subcategories.length} sous-catégorie(s) à ordonner
              </span>
              <button
                onClick={handleSaveOrder}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-brand-600 disabled:opacity-50 cursor-pointer"
              >
                {saving && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
                {saving ? "Enregistrement..." : "💾 Enregistrer cet ordre"}
              </button>
            </div>

            {/* List */}
            <div className="space-y-2.5">
              {subcategories.map((sc, index) => (
                <div
                  key={sc.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center justify-between rounded-xl border p-3.5 transition-all select-none ${
                    draggedIndex === index
                      ? "border-brand-500 bg-brand-50 shadow-lg dark:bg-brand-950/20 scale-[1.01]"
                      : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900/50"
                  }`}
                >
                  {/* Left: Drag Handle & Rank & Image & Name */}
                  <div className="flex items-center gap-4">
                    {/* Drag Handle Icon */}
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 cursor-grab active:cursor-grabbing"
                      title="Glisser pour réordonner"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="9" cy="5" r="1.5" />
                        <circle cx="15" cy="5" r="1.5" />
                        <circle cx="9" cy="12" r="1.5" />
                        <circle cx="15" cy="12" r="1.5" />
                        <circle cx="9" cy="19" r="1.5" />
                        <circle cx="15" cy="19" r="1.5" />
                      </svg>
                    </div>

                    {/* Rank Badge */}
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {index + 1}
                    </span>

                    {/* Image Thumbnail */}
                    {sc.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageFullUrl(sc.image)}
                        alt={sc.nom}
                        className="h-10 w-10 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-lg dark:bg-gray-800">
                        📦
                      </div>
                    )}

                    {/* Subcategory Details */}
                    <div>
                      <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                        {sc.nom}
                      </h3>
                      {sc.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                          {sc.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Controls & Product Count */}
                  <div className="flex items-center gap-3">
                    {sc._count?.produits !== undefined && (
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {sc._count.produits} produit(s)
                      </span>
                    )}

                    {/* Move Up / Move Down buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveItem(index, index - 1)}
                        disabled={index === 0}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition-all hover:bg-gray-50 disabled:opacity-30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 cursor-pointer"
                        title="Monter la sous-catégorie"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveItem(index, index + 1)}
                        disabled={index === subcategories.length - 1}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition-all hover:bg-gray-50 disabled:opacity-30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 cursor-pointer"
                        title="Descendre la sous-catégorie"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Save Action */}
            <div className="pt-4 flex justify-end">
              <button
                onClick={handleSaveOrder}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-brand-600 disabled:opacity-50 cursor-pointer"
              >
                {saving && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
                {saving ? "Enregistrement..." : "💾 Enregistrer cet ordre"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
