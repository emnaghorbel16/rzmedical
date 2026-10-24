"use client";
import { getApiUrl, getBaseUrl } from "@/utils/api";
import React, { useEffect, useState, useCallback } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";

const API_URL = getApiUrl();

interface Categorie { id: number; nom: string; }
interface SousCategorie { id: number; nom: string; categorieId: number; categorie?: Categorie; }

interface Marque {
  id: number;
  nom: string;
  logo?: string;
  categorieId: number;
  categorie: Categorie;
  creeLe: string;
  _count: { produits: number };
}

interface Produit {
  id: number;
  nom: string;
  reference: string;
  prix: number;
  prixAchat?: number | null;
  tva?: number | null;
  remise?: number;
  stock: number;
  disponible: boolean;
  disponibleALaVente?: boolean;
  images?: string[];
  paysFabrication?: string | null;
  description?: string;
  sousCategorieId: number;
  sousCategorie?: { id: number; nom: string };
  marqueId: number;
}

export default function BrandsPage() {
  const [items, setItems] = useState<Marque[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [subcategories, setSubcategories] = useState<SousCategorie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Brand modal
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

  // Brand Products Drawer/Modal state
  const [selectedBrand, setSelectedBrand] = useState<Marque | null>(null);
  const [brandProducts, setBrandProducts] = useState<Produit[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [brandProductSearch, setBrandProductSearch] = useState("");

  // Add / Edit Product for Brand state
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Produit | null>(null);
  const [pNom, setPNom] = useState("");
  const [pRef, setPRef] = useState("");
  const [pPrix, setPPrix] = useState("");
  const [pPrixAchat, setPPrixAchat] = useState("");
  const [pStock, setPStock] = useState("10");
  const [pSubCatId, setPSubCatId] = useState("");
  const [pPays, setPPays] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pDispo, setPDispo] = useState(true);
  const [pImages, setPImages] = useState<string[]>([]);
  const [pUploading, setPUploading] = useState(false);
  const [pSaving, setPSaving] = useState(false);
  const [pError, setPError] = useState<string | null>(null);
  const [productDeleteId, setProductDeleteId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [resBrand, resCat, resSub] = await Promise.all([
        fetch(`${API_URL}/brands`),
        fetch(`${API_URL}/categories`),
        fetch(`${API_URL}/subcategories`),
      ]);
      if (!resBrand.ok || !resCat.ok) throw new Error("Erreur de chargement");
      setItems(await resBrand.json());
      setCategories(await resCat.json());
      if (resSub.ok) {
        setSubcategories(await resSub.json());
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Récupérer les produits liés à une marque
  const fetchBrandProducts = useCallback(async (brandId: number) => {
    setLoadingProducts(true);
    try {
      const res = await fetch(`${API_URL}/products?marqueId=${brandId}`);
      if (res.ok) {
        const data = await res.json();
        // data peut être { products: [...] } ou un tableau [...]
        const prods = Array.isArray(data) ? data : (data.products || []);
        setBrandProducts(prods);
      } else {
        setBrandProducts([]);
      }
    } catch (err) {
      console.error("Erreur chargement produits de la marque:", err);
      setBrandProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const openBrandProducts = (brand: Marque) => {
    setSelectedBrand(brand);
    setBrandProductSearch("");
    fetchBrandProducts(brand.id);
  };

  const closeBrandProducts = () => {
    setSelectedBrand(null);
    setBrandProducts([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setFormError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = typeof window !== "undefined" ? (localStorage.getItem("rzm_token") || localStorage.getItem("token")) : null;
      const res = await fetch(`${API_URL}/upload/single`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
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
      const token = typeof window !== "undefined" ? (localStorage.getItem("rzm_token") || localStorage.getItem("token")) : null;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
      const token = typeof window !== "undefined" ? (localStorage.getItem("rzm_token") || localStorage.getItem("token")) : null;
      const res = await fetch(`${API_URL}/brands/${id}`, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error((await res.json()).error || "Erreur de suppression");
      setDeleteId(null); fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erreur");
    }
  };

  // --- Gestion de l'ajout/édition de produit pour la marque ---
  const openAddProduct = () => {
    if (!selectedBrand) return;
    setEditingProduct(null);
    setPNom("");
    // Référence suggérée
    const cleanPrefix = selectedBrand.nom.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "PRD";
    setPRef(`${cleanPrefix}-${Math.floor(1000 + Math.random() * 9000)}`);
    setPPrix("");
    setPPrixAchat("");
    setPStock("10");
    setPPays("");
    setPDesc("");
    setPDispo(true);
    setPImages([]);
    setPError(null);

    // Pré-sélectionner la première sous-catégorie correspondant à la catégorie de la marque
    const availableSubs = subcategories.filter(s => s.categorieId === selectedBrand.categorieId);
    if (availableSubs.length > 0) {
      setPSubCatId(availableSubs[0].id.toString());
    } else if (subcategories.length > 0) {
      setPSubCatId(subcategories[0].id.toString());
    } else {
      setPSubCatId("");
    }

    setShowProductModal(true);
  };

  const openEditProduct = (prod: Produit) => {
    setEditingProduct(prod);
    setPNom(prod.nom);
    setPRef(prod.reference);
    setPPrix(Number(prod.prix).toString());
    setPPrixAchat(prod.prixAchat != null ? Number(prod.prixAchat).toString() : "");
    setPStock(Number(prod.stock).toString());
    setPSubCatId(prod.sousCategorieId.toString());
    setPPays(prod.paysFabrication || "");
    setPDesc(prod.description || "");
    setPDispo(prod.disponible ?? true);
    setPImages(prod.images || []);
    setPError(null);
    setShowProductModal(true);
  };

  const closeProductModal = () => {
    setShowProductModal(false);
    setEditingProduct(null);
  };

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPUploading(true); setPError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = typeof window !== "undefined" ? (localStorage.getItem("rzm_token") || localStorage.getItem("token")) : null;
      const res = await fetch(`${API_URL}/upload/single`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'upload");
      setPImages([data.url]);
    } catch (err: unknown) {
      setPError(err instanceof Error ? err.message : "Erreur d'upload image");
    } finally {
      setPUploading(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!selectedBrand) return;
    if (!pNom.trim() || !pRef.trim() || !pPrix.trim() || !pSubCatId) {
      setPError("Nom, Référence, Sous-catégorie et Prix requis");
      return;
    }
    setPSaving(true); setPError(null);
    try {
      const token = typeof window !== "undefined" ? (localStorage.getItem("rzm_token") || localStorage.getItem("token")) : null;
      const url = editingProduct ? `${API_URL}/products/${editingProduct.id}` : `${API_URL}/products`;
      const res = await fetch(url, {
        method: editingProduct ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          nom: pNom.trim(),
          reference: pRef.trim().toUpperCase(),
          prix: Number(pPrix),
          prixAchat: pPrixAchat !== "" ? Number(pPrixAchat) : null,
          stock: Number(pStock) || 0,
          sousCategorieId: Number(pSubCatId),
          marqueId: selectedBrand.id,
          disponible: pDispo,
          disponibleALaVente: pDispo,
          paysFabrication: pPays.trim() || null,
          description: pDesc.trim() || undefined,
          images: pImages,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur d'enregistrement du produit");
      }
      closeProductModal();
      fetchBrandProducts(selectedBrand.id);
      fetchData(); // Met à jour le compteur de la marque dans la table principale
    } catch (err: unknown) {
      setPError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setPSaving(false);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!selectedBrand) return;
    try {
      const token = typeof window !== "undefined" ? (localStorage.getItem("rzm_token") || localStorage.getItem("token")) : null;
      const res = await fetch(`${API_URL}/products/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erreur de suppression");
      setProductDeleteId(null);
      fetchBrandProducts(selectedBrand.id);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erreur");
    }
  };

  // Sous-catégories filtrées pour la marque sélectionnée
  const filteredSubcategories = selectedBrand
    ? subcategories.filter(s => s.categorieId === selectedBrand.categorieId)
    : subcategories;

  // Filtrage des produits de la marque
  const displayedBrandProducts = brandProducts.filter(p => {
    if (!brandProductSearch.trim()) return true;
    const q = brandProductSearch.toLowerCase();
    return p.nom.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q);
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="Marques" />

      {/* En-tête de la page */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Gestion des marques</h3>
          <p className="text-sm text-gray-500">
            {items.length} marque(s) enregistrée(s) &bull; <span className="text-brand-500 font-medium">Cliquez sur une marque pour voir et gérer ses produits</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Rechercher une marque..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-56 px-3.5 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          <button
            onClick={() => openAdd()}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors shadow-sm cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
            Ajouter une marque
          </button>
        </div>
      </div>

      {/* Table des marques */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3"><p className="text-red-500">{error}</p><button onClick={fetchData} className="text-sm text-brand-500 underline">Réessayer</button></div>
        ) : items.filter(item => !searchQuery.trim() || item.nom.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3"><p className="text-gray-500">Aucune marque trouvée</p><button onClick={() => openAdd()} className="text-sm text-brand-500 underline">Créer une marque</button></div>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-gray-100 dark:border-gray-800 border-y bg-gray-50/50 dark:bg-gray-800/30">
                <TableRow>
                  <TableCell isHeader className="px-6 py-3 text-start">Logo</TableCell>
                  <TableCell isHeader className="px-6 py-3 text-start">Nom de la Marque</TableCell>
                  <TableCell isHeader className="px-6 py-3 text-start">Catégorie Parente</TableCell>
                  <TableCell isHeader className="px-6 py-3 text-start">Catalogue Produits</TableCell>
                  <TableCell isHeader className="px-6 py-3 text-end">Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.filter(item => !searchQuery.trim() || item.nom.toLowerCase().includes(searchQuery.toLowerCase())).map((item) => (
                  <TableRow
                    key={item.id}
                    onClick={() => openBrandProducts(item)}
                    className="hover:bg-brand-50/40 dark:hover:bg-brand-500/5 cursor-pointer transition-colors group"
                  >
                    <TableCell className="px-6 py-3.5">
                      {item.logo ? (
                        <img
                          src={item.logo.startsWith("/") ? getBaseUrl() + item.logo : item.logo}
                          alt={item.nom}
                          className="h-10 w-10 object-contain rounded-lg border border-gray-200 dark:border-gray-700 bg-white p-0.5"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
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
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-sm text-gray-500">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        {item.categorie?.nom || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-3.5">
                      <div className="inline-flex items-center gap-1.5">
                        <Badge color={item._count.produits > 0 ? "success" : "warning"} size="sm">
                          {item._count.produits} produit{item._count.produits > 1 ? "s" : ""}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-end">
                      <div className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openBrandProducts(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-brand-600 bg-brand-50 dark:bg-brand-500/10 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-500/20 transition-colors cursor-pointer"
                          title="Voir les produits de cette marque"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                          Produits
                        </button>
                        <button
                          onClick={() => openEdit(item)}
                          className="text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-brand-500 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => setDeleteId(item.id)}
                          className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
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

      {/* ============================================================ */}
      {/* MODAL / PANNEAU DES PRODUITS DE LA MARQUE SÉLECTIONNÉE       */}
      {/* ============================================================ */}
      {selectedBrand && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) closeBrandProducts();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl rounded-3xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 relative"
          >
            {/* Header du panneau */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
              <div className="flex items-center gap-3">
                {selectedBrand.logo ? (
                  <img
                    src={selectedBrand.logo.startsWith("/") ? getBaseUrl() + selectedBrand.logo : selectedBrand.logo}
                    alt={selectedBrand.nom}
                    className="h-12 w-12 object-contain rounded-xl border border-gray-200 dark:border-gray-700 bg-white p-1"
                  />
                ) : (
                  <div className="h-12 w-12 bg-brand-500/10 text-brand-600 rounded-xl flex items-center justify-center font-bold text-sm border border-brand-500/20">
                    {selectedBrand.nom.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {selectedBrand.nom}
                    </h3>
                    <Badge color="primary" size="sm">{selectedBrand.categorie?.nom}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {brandProducts.length} produit{brandProducts.length > 1 ? "s" : ""} associé{brandProducts.length > 1 ? "s" : ""} à cette marque
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* BOUTON D'AJOUT D'UN NOUVEAU PRODUIT */}
                <button
                  type="button"
                  onClick={openAddProduct}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 text-xs font-semibold shadow-md transition-all hover:shadow-lg cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                  Ajouter un nouveau produit
                </button>

                <button
                  type="button"
                  onClick={closeBrandProducts}
                  className="h-9 w-9 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors cursor-pointer"
                  title="Fermer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Barre de recherche dans les produits de la marque */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <input
                  type="text"
                  placeholder="Filtrer les produits par nom ou référence..."
                  value={brandProductSearch}
                  onChange={(e) => setBrandProductSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </div>
              <span className="text-xs text-gray-400">
                Affichage : {displayedBrandProducts.length} sur {brandProducts.length}
              </span>
            </div>

            {/* Corps : Liste des produits */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingProducts ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
                  <p className="text-xs text-gray-400">Chargement des produits...</p>
                </div>
              ) : displayedBrandProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-16 w-16 rounded-full bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-500 mb-3">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                  </div>
                  <h4 className="text-base font-semibold text-gray-800 dark:text-white">
                    {brandProductSearch ? "Aucun produit correspondant" : "Aucun produit pour cette marque"}
                  </h4>
                  <p className="text-xs text-gray-500 max-w-sm mt-1 mb-5">
                    {brandProductSearch
                      ? "Essayez une autre recherche."
                      : `Vous n'avez pas encore ajouté de produit associé à ${selectedBrand.nom}.`}
                  </p>
                  <button
                    onClick={openAddProduct}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 transition-colors cursor-pointer"
                  >
                    + Ajouter le premier produit
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-2.5">Produit</th>
                        <th className="px-4 py-2.5">Référence</th>
                        <th className="px-4 py-2.5">Sous-catégorie</th>
                        <th className="px-4 py-2.5">Prix</th>
                        <th className="px-4 py-2.5">Stock</th>
                        <th className="px-4 py-2.5">Disponibilité</th>
                        <th className="px-4 py-2.5 text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {displayedBrandProducts.map((p) => {
                        const firstImage = p.images && p.images.length > 0 ? p.images[0] : null;
                        const imgSrc = firstImage ? (firstImage.startsWith("/") ? getBaseUrl() + firstImage : firstImage) : null;
                        return (
                          <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-3">
                                {imgSrc ? (
                                  <img
                                    src={imgSrc}
                                    alt={p.nom}
                                    className="h-10 w-10 object-contain rounded-lg border border-gray-200 dark:border-gray-700 bg-white p-0.5 flex-shrink-0"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="h-10 w-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                                    📦
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white line-clamp-1">{p.nom}</p>
                                  {p.paysFabrication && (
                                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                      Fabriqué en : <strong className="text-gray-700 dark:text-gray-300">{p.paysFabrication}</strong>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="font-mono text-[11px] font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                                {p.reference}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                              {p.sousCategorie?.nom || "—"}
                            </td>
                            <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-white">
                              {Number(p.prix).toFixed(2)} DT
                              {Number(p.remise ?? 0) > 0 ? (
                                <span className="ml-1 text-[10px] text-red-500 font-normal">(-{p.remise}%)</span>
                              ) : null}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                p.stock > 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                              }`}>
                                {p.stock > 0 ? `${p.stock} en stock` : "Épuisé"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                (p.disponible ?? true) ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                              }`}>
                                {(p.disponible ?? true) ? "En vente" : "Désactivé"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-end">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditProduct(p)}
                                  className="px-2 py-1 text-xs text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded transition-colors cursor-pointer"
                                >
                                  Modifier
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setProductDeleteId(p.id)}
                                  className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                                >
                                  Supprimer
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer du panneau */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex justify-between items-center text-xs text-gray-500">
              <span>Marque : <strong>{selectedBrand.nom}</strong> &bull; Catégorie : <strong>{selectedBrand.categorie?.nom}</strong></span>
              <button
                onClick={closeBrandProducts}
                className="px-4 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL D'AJOUT / ÉDITION DE PRODUIT POUR LA MARQUE            */}
      {/* ============================================================ */}
      {showProductModal && selectedBrand && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) closeProductModal();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-3xl bg-white dark:bg-gray-900 shadow-2xl p-6 border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 duration-150 relative max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4 border-b pb-3 dark:border-gray-800">
              <div>
                <h4 className="text-lg font-bold text-gray-800 dark:text-white">
                  {editingProduct ? "Modifier le produit" : "Ajouter un produit"}
                </h4>
                <p className="text-xs text-gray-500">
                  Marque : <span className="font-semibold text-brand-500">{selectedBrand.nom}</span> ({selectedBrand.categorie?.nom})
                </p>
              </div>
              <button
                type="button"
                onClick={closeProductModal}
                className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Nom du produit */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Nom du produit *</label>
                <input
                  type="text"
                  value={pNom}
                  onChange={(e) => setPNom(e.target.value)}
                  placeholder="Ex: Pâte à polir diamantée..."
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  autoFocus
                />
              </div>

              {/* Référence et Sous-catégorie */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Référence *</label>
                  <input
                    type="text"
                    value={pRef}
                    onChange={(e) => setPRef(e.target.value)}
                    placeholder="Ex: CD-102938"
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-xs dark:bg-gray-800 dark:border-gray-700 dark:text-white font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Sous-catégorie *</label>
                  <select
                    value={pSubCatId}
                    onChange={(e) => setPSubCatId(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-xs dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  >
                    <option value="" disabled>-- Sélectionner --</option>
                    {filteredSubcategories.map((s) => (
                      <option key={s.id} value={s.id}>{s.nom}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Prix de vente, Prix d'achat, Stock */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Prix de vente (DT) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={pPrix}
                    onChange={(e) => setPPrix(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-xs dark:bg-gray-800 dark:border-gray-700 dark:text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Prix d'achat (DT)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={pPrixAchat}
                    onChange={(e) => setPPrixAchat(e.target.value)}
                    placeholder="Optionnel"
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-xs dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Stock Initial</label>
                  <input
                    type="number"
                    min="0"
                    value={pStock}
                    onChange={(e) => setPStock(e.target.value)}
                    placeholder="10"
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-xs dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  />
                </div>
              </div>

              {/* Pays de fabrication */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Pays de fabrication</label>
                <input
                  type="text"
                  value={pPays}
                  onChange={(e) => setPPays(e.target.value)}
                  placeholder="Ex: Turquie, France, Allemagne, Suisse..."
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                />
              </div>

              {/* Image du produit */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Image du produit</label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleProductImageUpload}
                  className="w-full rounded-xl border border-gray-300 p-2 text-xs dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                />
                {pUploading && <p className="text-xs text-brand-500 mt-1">Téléversement en cours...</p>}
                {pImages.length > 0 && (
                  <div className="relative mt-2 inline-block">
                    <img
                      src={pImages[0].startsWith("/") ? getBaseUrl() + pImages[0] : pImages[0]}
                      alt="Aperçu produit"
                      className="h-16 w-16 object-contain rounded-lg border p-1 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setPImages([])}
                      className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600 transition-colors cursor-pointer"
                      title="Supprimer l'image"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={pDesc}
                  onChange={(e) => setPDesc(e.target.value)}
                  placeholder="Description détaillée du produit..."
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                />
              </div>

              {/* Toggle Disponible à la vente */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="disponibleCheck"
                  checked={pDispo}
                  onChange={(e) => setPDispo(e.target.checked)}
                  className="h-4 w-4 rounded text-brand-500 focus:ring-brand-500 border-gray-300 cursor-pointer"
                />
                <label htmlFor="disponibleCheck" className="text-xs text-gray-700 dark:text-gray-300 font-medium cursor-pointer">
                  Activer immédiatement ce produit à la vente sur la boutique
                </label>
              </div>
            </div>

            {pError && <p className="mt-3 text-xs text-red-500 font-medium">{pError}</p>}

            <div className="flex justify-end gap-3 mt-6 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={closeProductModal}
                className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveProduct}
                disabled={pSaving}
                className="rounded-xl bg-brand-500 px-5 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60 transition-colors shadow-sm cursor-pointer"
              >
                {pSaving ? "Enregistrement..." : (editingProduct ? "Mettre à jour" : "Ajouter le produit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation suppression produit */}
      {productDeleteId && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setProductDeleteId(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-gray-900 shadow-2xl p-6 border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 duration-150"
          >
            <h4 className="text-base font-bold text-gray-900 dark:text-white mb-2">Confirmer la suppression du produit</h4>
            <p className="text-xs text-gray-500 mb-6">Êtes-vous sûr de vouloir supprimer définitivement ce produit ?</p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setProductDeleteId(null)}
                className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDeleteProduct(productDeleteId)}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL D'AJOUT / ÉDITION DE MARQUE                             */}
      {/* ============================================================ */}
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
                className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors cursor-pointer"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Nom de la marque *</label>
              <input type="text" value={formNom} onChange={(e) => setFormNom(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white uppercase" autoFocus />
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
                    className="h-12 rounded-lg border object-contain p-1 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setFormLogo("")}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 transition-colors z-10 cursor-pointer"
                    title="Supprimer le logo"
                  >
                    ✕
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
              <button onClick={closeModal} className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">Annuler</button>
              <button onClick={handleSave} disabled={saving} className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60 transition-colors cursor-pointer">{saving ? "En cours..." : "Enregistrer"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation suppression marque */}
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
                className="h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-6">Cette action est irréversible et impactera les produits associés.</p>
            <div className="flex justify-end gap-2.5">
              <button onClick={() => setDeleteId(null)} className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">Annuler</button>
              <button onClick={() => handleDelete(deleteId)} className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
