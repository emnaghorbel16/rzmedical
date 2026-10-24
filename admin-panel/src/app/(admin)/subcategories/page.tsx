"use client";
import { getApiUrl, getBaseUrl } from "@/utils/api";
import React, { useEffect, useState, useCallback } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";
import FeaturedProductsModal from "./FeaturedProductsModal";

const API_URL = getApiUrl();

interface Categorie { id: number; nom: string; }
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
interface Marque { id: number; nom: string; categorieId: number; }
interface Produit {
  id: number;
  nom: string;
  reference: string;
  prix: number;
  prixAchat?: number | null;
  stock: number;
  disponible: boolean;
  disponibleALaVente?: boolean;
  images?: string[];
  paysFabrication?: string | null;
  description?: string;
  sousCategorieId: number;
  marqueId: number;
  marque?: { id: number; nom: string };
}

export default function SubcategoriesPage() {
  const [items, setItems] = useState<SousCategorie[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [marques, setMarques] = useState<Marque[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Subcategory form
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SousCategorie | null>(null);
  const [formNom, setFormNom] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formImage, setFormImage] = useState("");
  const [formCatId, setFormCatId] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [featuredModalId, setFeaturedModalId] = useState<SousCategorie | null>(null);

  // Products panel
  const [selectedSub, setSelectedSub] = useState<SousCategorie | null>(null);
  const [subProducts, setSubProducts] = useState<Produit[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  // Product form
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Produit | null>(null);
  const [pNom, setPNom] = useState("");
  const [pRef, setPRef] = useState("");
  const [pPrix, setPPrix] = useState("");
  const [pPrixAchat, setPPrixAchat] = useState("");
  const [pStock, setPStock] = useState("10");
  const [pMarqueId, setPMarqueId] = useState("");
  const [pSubCatId, setPSubCatId] = useState("");
  const [pPays, setPPays] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pDispo, setPDispo] = useState(true);
  const [pImages, setPImages] = useState<string[]>([]);
  const [pUploading, setPUploading] = useState(false);
  const [pSaving, setPSaving] = useState(false);
  const [pError, setPError] = useState<string | null>(null);
  const [productDeleteId, setProductDeleteId] = useState<number | null>(null);

  // Block scroll when product modal is open
  useEffect(() => {
    if (showProductModal) {
      document.body.style.overflow = "hidden";
      const aside = document.querySelector("aside");
      if (aside) aside.style.display = "none";
    } else {
      document.body.style.overflow = "";
      const aside = document.querySelector("aside");
      if (aside) aside.style.display = "";
    }
    return () => {
      document.body.style.overflow = "";
      const aside = document.querySelector("aside");
      if (aside) aside.style.display = "";
    };
  }, [showProductModal]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [resSub, resCat, resMar] = await Promise.all([
        fetch(`${API_URL}/subcategories`),
        fetch(`${API_URL}/categories`),
        fetch(`${API_URL}/brands`),
      ]);
      if (!resSub.ok || !resCat.ok) throw new Error("Erreur de chargement");
      const [dataSub, dataCat] = await Promise.all([resSub.json(), resCat.json()]);
      setItems(dataSub);
      setCategories(dataCat);
      if (resMar.ok) setMarques(await resMar.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Fetch products of a subcategory ──────────────────────────────────────
  const fetchSubProducts = useCallback(async (subId: number) => {
    setLoadingProducts(true);
    try {
      const res = await fetch(`${API_URL}/products?sousCategorieId=${subId}&limit=500`);
      if (res.ok) {
        const data = await res.json();
        setSubProducts(Array.isArray(data) ? data : (data.products || []));
      } else {
        setSubProducts([]);
      }
    } catch {
      setSubProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const openSubProducts = (sub: SousCategorie) => {
    setSelectedSub(sub);
    setProductSearch("");
    fetchSubProducts(sub.id);
  };

  const closeSubProducts = () => {
    setSelectedSub(null);
    setSubProducts([]);
  };

  // ── Subcategory CRUD ──────────────────────────────────────────────────────
  const openAdd = (categorieId?: number) => {
    setEditing(null); setFormNom(""); setFormDescription(""); setFormImage("");
    setFormCatId(categorieId?.toString() || ""); setFormError(null); setShowModal(true);
  };
  const openEdit = (item: SousCategorie) => {
    setEditing(item); setFormNom(item.nom); setFormDescription(item.description || "");
    setFormImage(item.image || ""); setFormCatId(item.categorieId.toString());
    setFormError(null); setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSave = async () => {
    if (!formNom.trim() || !formCatId) { setFormError("Nom et Catégorie requis"); return; }
    setSaving(true); setFormError(null);
    try {
      const token = typeof window !== "undefined" ? (localStorage.getItem("rzm_token") || localStorage.getItem("token")) : null;
      const url = editing ? `${API_URL}/subcategories/${editing.id}` : `${API_URL}/subcategories`;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ nom: formNom.trim(), description: formDescription.trim() || undefined, image: formImage || undefined, categorieId: formCatId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'enregistrement");
      closeModal(); fetchData();
      if (editing && selectedSub?.id === editing.id) {
        setSelectedSub(prev => prev ? { ...prev, nom: formNom.trim(), description: formDescription.trim() } : null);
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erreur");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = typeof window !== "undefined" ? (localStorage.getItem("rzm_token") || localStorage.getItem("token")) : null;
      const res = await fetch(`${API_URL}/subcategories/${id}`, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error((await res.json()).error || "Erreur de suppression");
      setDeleteId(null); fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erreur de suppression");
    }
  };

  // ── Product CRUD ──────────────────────────────────────────────────────────
  const openAddProduct = () => {
    if (!selectedSub) return;
    setEditingProduct(null);
    setPNom(""); setPRef(`PRD-${Math.floor(1000 + Math.random() * 9000)}`);
    setPPrix(""); setPPrixAchat(""); setPStock("10");
    setPMarqueId(marques.find(m => m.categorieId === selectedSub.categorieId)?.id.toString() || "");
    setPSubCatId(selectedSub.id.toString());
    setPPays(""); setPDesc(""); setPDispo(true); setPImages([]); setPError(null);
    setShowProductModal(true);
  };

  const openEditProduct = (prod: Produit) => {
    setEditingProduct(prod);
    setPNom(prod.nom); setPRef(prod.reference);
    setPPrix(Number(prod.prix).toString());
    setPPrixAchat(prod.prixAchat != null ? Number(prod.prixAchat).toString() : "");
    setPStock(Number(prod.stock).toString());
    setPMarqueId((prod.marqueId || "").toString());
    setPSubCatId(prod.sousCategorieId.toString());
    setPPays(prod.paysFabrication || ""); setPDesc(prod.description || "");
    setPDispo(prod.disponible ?? true); setPImages(prod.images || []);
    setPError(null); setShowProductModal(true);
  };

  const closeProductModal = () => { setShowProductModal(false); setEditingProduct(null); };

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setPUploading(true); setPError(null);
    try {
      const formData = new FormData(); formData.append("file", file);
      const token = typeof window !== "undefined" ? (localStorage.getItem("rzm_token") || localStorage.getItem("token")) : null;
      const res = await fetch(`${API_URL}/upload/single`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'upload");
      setPImages([data.url]);
    } catch (err: unknown) {
      setPError(err instanceof Error ? err.message : "Erreur d'upload");
    } finally { setPUploading(false); }
  };

  const handleSaveProduct = async () => {
    if (!selectedSub) return;
    if (!pNom.trim() || !pRef.trim() || !pPrix.trim() || !pSubCatId) {
      setPError("Nom, Référence, Sous-catégorie et Prix requis"); return;
    }
    setPSaving(true); setPError(null);
    try {
      const token = typeof window !== "undefined" ? (localStorage.getItem("rzm_token") || localStorage.getItem("token")) : null;
      const url = editingProduct ? `${API_URL}/products/${editingProduct.id}` : `${API_URL}/products`;
      const res = await fetch(url, {
        method: editingProduct ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          nom: pNom.trim(), reference: pRef.trim().toUpperCase(),
          prix: Number(pPrix), prixAchat: pPrixAchat !== "" ? Number(pPrixAchat) : null,
          stock: Number(pStock) || 0,
          sousCategorieId: Number(pSubCatId),
          marqueId: Number(pMarqueId) || undefined,
          disponible: pDispo, disponibleALaVente: pDispo,
          paysFabrication: pPays.trim() || null,
          description: pDesc.trim() || undefined,
          images: pImages,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erreur d'enregistrement");
      closeProductModal();
      fetchSubProducts(selectedSub.id);
      fetchData();
    } catch (err: unknown) {
      setPError(err instanceof Error ? err.message : "Erreur");
    } finally { setPSaving(false); }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!selectedSub) return;
    try {
      const token = typeof window !== "undefined" ? (localStorage.getItem("rzm_token") || localStorage.getItem("token")) : null;
      const res = await fetch(`${API_URL}/products/${id}`, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error((await res.json()).error || "Erreur de suppression");
      setProductDeleteId(null);
      fetchSubProducts(selectedSub.id);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erreur");
    }
  };

  const displayedProducts = subProducts.filter(p => {
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase();
    return p.nom.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q);
  });

  const filteredItems = items.filter(item =>
    !searchQuery.trim() || item.nom.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Marques disponibles pour la sous-catégorie sélectionnée
  const marquesDisponibles = selectedSub
    ? marques.filter(m => m.categorieId === selectedSub.categorieId)
    : marques;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageBreadcrumb pageTitle="Sous-Catégories" />

      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Gestion des sous-catégories</h3>
          <p className="text-sm text-gray-500">
            {items.length} sous-catégorie(s) &bull;{" "}
            <span className="text-brand-500 font-medium">Cliquez sur une ligne pour voir ses produits</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-52 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            onClick={() => openAdd()}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
            Ajouter
          </button>
        </div>
      </div>

      {/* Quick-add buttons by category */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <button key={category.id} type="button" onClick={() => openAdd(category.id)}
            className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-500 hover:shadow-md dark:border-gray-800 dark:bg-white/[0.03]">
            <span className="font-semibold text-gray-800 dark:text-white/90">{category.nom}</span>
            <span className="mt-1 block text-xs text-gray-500">Cliquer pour ajouter une sous-catégorie</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-red-500">{error}</p>
            <button onClick={fetchData} className="text-sm text-brand-500 underline">Réessayer</button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-gray-500">Aucune sous-catégorie</p>
            <button onClick={() => openAdd()} className="text-sm text-brand-500 underline">Créer</button>
          </div>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-gray-100 dark:border-gray-800 border-y bg-gray-50/50 dark:bg-gray-800/30">
                <TableRow>
                  <TableCell isHeader className="px-6 py-3 text-start">Image</TableCell>
                  <TableCell isHeader className="px-6 py-3 text-start">Nom</TableCell>
                  <TableCell isHeader className="px-6 py-3 text-start">Catégorie Parente</TableCell>
                  <TableCell isHeader className="px-6 py-3 text-start">Produits</TableCell>
                  <TableCell isHeader className="px-6 py-3 text-end">Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredItems.map((item) => (
                  <TableRow
                    key={item.id}
                    onClick={() => openSubProducts(item)}
                    className="hover:bg-brand-50/40 dark:hover:bg-brand-500/5 cursor-pointer transition-colors group"
                  >
                    <TableCell className="px-6 py-3.5">
                      {item.image ? (
                        <img
                          src={item.image.startsWith("/") ? getBaseUrl() + item.image : item.image}
                          alt={item.nom}
                          className="h-10 w-10 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                        />
                      ) : (
                        <div className="h-10 w-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center text-xs font-bold text-gray-400 border border-gray-200 dark:border-gray-700">
                          {item.nom.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-3.5">
                      <div className="font-semibold text-gray-800 dark:text-white/90 group-hover:text-brand-500 transition-colors flex items-center gap-2">
                        {item.nom}
                        <span className="text-[11px] text-gray-400 font-normal opacity-0 group-hover:opacity-100 transition-opacity">
                          &bull; Voir les produits &rarr;
                        </span>
                      </div>
                      {item.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{item.description}</p>}
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-sm text-gray-500">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        {item.categorie?.nom || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-3.5">
                      <Badge color={item._count.produits > 0 ? "success" : "warning"} size="sm">
                        {item._count.produits} produit{item._count.produits > 1 ? "s" : ""}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-end">
                      <div className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openSubProducts(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-brand-600 bg-brand-50 dark:bg-brand-500/10 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-500/20 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                          Produits
                        </button>
                        <button
                          onClick={() => setFeaturedModalId(item)}
                          className="text-xs font-medium text-amber-500 hover:text-amber-700 px-2 py-1 rounded hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                        >
                          En avant
                        </button>
                        <button
                          onClick={() => openEdit(item)}
                          className="text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-brand-500 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => setDeleteId(item.id)}
                          className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        >
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

      {/* ── Products Panel (slide-over) ──────────────────────────────────── */}
      {selectedSub && (
        <div className="fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={closeSubProducts} />
          {/* Panel */}
          <div className="w-full max-w-3xl bg-white dark:bg-gray-900 h-full overflow-y-auto shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-800 animate-in slide-in-from-right duration-200">
            {/* Panel header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">{selectedSub.nom}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedSub.categorie?.nom} &bull; {subProducts.length} produit(s)
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { openEdit(selectedSub); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  Modifier la sous-catégorie
                </button>
                <button
                  onClick={openAddProduct}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-brand-500 hover:bg-brand-600 transition-colors shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                  Nouveau produit
                </button>
                <button onClick={closeSubProducts} className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-800">
              <input
                type="text"
                placeholder="Rechercher dans cette sous-catégorie..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            {/* Products list */}
            <div className="flex-1 px-6 py-4">
              {loadingProducts ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
                </div>
              ) : displayedProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="h-16 w-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-3xl">📦</div>
                  <p className="text-gray-500 text-sm">Aucun produit dans cette sous-catégorie</p>
                  <button onClick={openAddProduct} className="text-sm text-brand-500 font-medium hover:underline">+ Ajouter le premier produit</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedProducts.map((prod) => (
                    <div
                      key={prod.id}
                      className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-brand-200 dark:hover:border-brand-500/30 hover:bg-brand-50/30 dark:hover:bg-brand-500/5 transition-all group"
                    >
                      {/* Image */}
                      {prod.images && prod.images.length > 0 ? (
                        <img
                          src={prod.images[0].startsWith("/") ? getBaseUrl() + prod.images[0] : prod.images[0]}
                          alt={prod.nom}
                          className="h-14 w-14 object-cover rounded-xl border border-gray-200 dark:border-gray-700 shrink-0"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://via.placeholder.com/56?text=?"; }}
                        />
                      ) : (
                        <div className="h-14 w-14 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-xl border border-gray-200 dark:border-gray-700 shrink-0">📦</div>
                      )}
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 dark:text-white text-sm truncate">{prod.nom}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-gray-400 font-mono">{prod.reference}</span>
                          {prod.marque && (
                            <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded font-medium">{prod.marque.nom}</span>
                          )}
                          {prod.paysFabrication && (
                            <span className="text-xs text-gray-400">🌍 {prod.paysFabrication}</span>
                          )}
                        </div>
                      </div>
                      {/* Price & Stock */}
                      <div className="text-right shrink-0">
                        <p className="font-bold text-gray-900 dark:text-white text-sm">{Number(prod.prix).toFixed(3)} DT</p>
                        <p className={`text-xs mt-0.5 font-medium ${prod.disponible ? "text-emerald-500" : "text-red-500"}`}>
                          {prod.disponible ? `Stock: ${prod.stock}` : "Indisponible"}
                        </p>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => openEditProduct(prod)}
                          className="h-8 w-8 rounded-lg bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-500 hover:bg-brand-100 transition-colors"
                          title="Modifier"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button
                          onClick={() => setProductDeleteId(prod.id)}
                          className="h-8 w-8 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors"
                          title="Supprimer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Subcategory Form Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white dark:bg-gray-900 shadow-2xl p-6 border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-lg font-bold text-gray-800 dark:text-white">{editing ? "Modifier la sous-catégorie" : "Nouvelle Sous-Catégorie"}</h4>
              <button onClick={closeModal} className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white">✕</button>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Nom *</label>
              <input type="text" value={formNom} onChange={(e) => setFormNom(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" autoFocus />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Description</label>
              <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Image</label>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setFormImage(String(reader.result)); reader.readAsDataURL(file); }} className="w-full text-sm" />
              {formImage && (
                <div className="relative mt-3 inline-block">
                  <img src={formImage.startsWith("/") ? getBaseUrl() + formImage : formImage} alt="Aperçu" className="h-24 w-24 rounded-lg object-cover border" />
                  <button type="button" onClick={() => setFormImage("")} className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs hover:bg-red-600">✕</button>
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
              <button onClick={handleSave} disabled={saving} className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60">{saving ? "En cours..." : "Enregistrer"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Subcategory Confirm ─────────────────────────────────────── */}
      {deleteId && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setDeleteId(null); }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-white dark:bg-gray-900 shadow-2xl p-6 border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-lg font-bold text-gray-900 dark:text-white">Confirmer la suppression</h4>
              <button onClick={() => setDeleteId(null)} className="h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-white">✕</button>
            </div>
            <p className="text-xs text-gray-500 mb-6">Cette action est irréversible et impactera les produits associés.</p>
            <div className="flex justify-end gap-2.5">
              <button onClick={() => setDeleteId(null)} className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
              <button onClick={() => handleDelete(deleteId)} className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Product Form Modal ─────────────────────────────────────────────── */}
      {showProductModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-3xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-150 overflow-y-auto max-h-[90vh]">
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
              <h4 className="text-base font-bold text-gray-800 dark:text-white">{editingProduct ? "Modifier le produit" : "Nouveau produit"}</h4>
              <button onClick={closeProductModal} className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Nom */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Nom du produit *</label>
                <input type="text" value={pNom} onChange={(e) => setPNom(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" autoFocus />
              </div>
              {/* Ref + Prix + PrixAchat */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Référence *</label>
                  <input type="text" value={pRef} onChange={(e) => setPRef(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Prix vente (DT) *</label>
                  <input type="number" step="0.001" min="0" value={pPrix} onChange={(e) => setPPrix(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Prix achat (DT)</label>
                  <input type="number" step="0.001" min="0" value={pPrixAchat} onChange={(e) => setPPrixAchat(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                </div>
              </div>
              {/* Marque + Sous-catégorie + Stock */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Marque</label>
                  <select value={pMarqueId} onChange={(e) => setPMarqueId(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                    <option value="">-- Sans marque --</option>
                    {marquesDisponibles.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Sous-catégorie *</label>
                  <select value={pSubCatId} onChange={(e) => setPSubCatId(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                    <option value="" disabled>-- Sélectionner --</option>
                    {items.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Stock</label>
                  <input type="number" min="0" value={pStock} onChange={(e) => setPStock(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                </div>
              </div>
              {/* Pays + Disponibilité */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Pays de fabrication</label>
                  <input type="text" value={pPays} onChange={(e) => setPPays(e.target.value)} placeholder="ex: Allemagne" className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Disponibilité</label>
                  <label className="flex items-center gap-2 mt-2.5 cursor-pointer">
                    <input type="checkbox" checked={pDispo} onChange={(e) => setPDispo(e.target.checked)} className="w-4 h-4 rounded accent-brand-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{pDispo ? "Disponible" : "Indisponible"}</span>
                  </label>
                </div>
              </div>
              {/* Description */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Description</label>
                <textarea value={pDesc} onChange={(e) => setPDesc(e.target.value)} rows={3} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
              </div>
              {/* Image */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Image produit</label>
                <input type="file" accept="image/*" onChange={handleProductImageUpload} className="w-full text-sm" disabled={pUploading} />
                {pUploading && <p className="text-xs text-gray-400 mt-1">Upload en cours...</p>}
                {pImages.length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {pImages.map((img, idx) => (
                      <div key={idx} className="relative">
                        <img src={img.startsWith("/") ? getBaseUrl() + img : img} alt="produit" className="h-20 w-20 object-cover rounded-xl border border-gray-200 dark:border-gray-700" />
                        <button onClick={() => setPImages(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {pError && <p className="text-xs text-red-500 font-medium">{pError}</p>}
            </div>
            <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex justify-end gap-3 rounded-b-3xl">
              <button onClick={closeProductModal} className="rounded-xl border border-gray-300 dark:border-gray-700 px-5 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
              <button onClick={handleSaveProduct} disabled={pSaving} className="rounded-xl bg-brand-500 px-5 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60 transition-colors">
                {pSaving ? "Enregistrement..." : editingProduct ? "Mettre à jour" : "Créer le produit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Product Confirm ─────────────────────────────────────────── */}
      {productDeleteId && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setProductDeleteId(null); }} className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-white dark:bg-gray-900 shadow-2xl p-6 border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-lg font-bold text-gray-900 dark:text-white">Supprimer ce produit ?</h4>
              <button onClick={() => setProductDeleteId(null)} className="h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-white">✕</button>
            </div>
            <p className="text-xs text-gray-500 mb-6">Cette action est irréversible.</p>
            <div className="flex justify-end gap-2.5">
              <button onClick={() => setProductDeleteId(null)} className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
              <button onClick={() => handleDeleteProduct(productDeleteId)} className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Featured products modal */}
      {featuredModalId && (
        <FeaturedProductsModal
          subcategoryId={featuredModalId.id}
          subcategoryName={featuredModalId.nom}
          onClose={() => { setFeaturedModalId(null); fetchData(); }}
        />
      )}
    </div>
  );
}
