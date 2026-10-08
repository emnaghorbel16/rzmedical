"use client";
import { getApiUrl, getBaseUrl } from "@/utils/api";
import React, { useEffect, useState, useCallback } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";
import Select from "react-select";
import StockRepartitionModal from "./StockRepartitionModal";
import * as countries from "i18n-iso-countries";
import frLocale from "i18n-iso-countries/langs/fr.json";

countries.registerLocale(frLocale);

const API_URL = getApiUrl();

function renderDescriptionPreview(value: string) {
  const parts = value.split(/(\*[^*]+\*|_[^_]+_|\[(?:red|blue|green)\][\s\S]*?\[\/(?:red|blue|green)\])/g).filter(Boolean);
  return parts.map((part, index) => {
    const bold = part.match(/^\*([^*]+)\*$/); if (bold) return <strong key={index}>{bold[1]}</strong>;
    const italic = part.match(/^_([^_]+)_$/); if (italic) return <em key={index}>{italic[1]}</em>;
    const color = part.match(/^\[(red|blue|green)\]([\s\S]*?)\[\/\1\]$/); if (color) return <span key={index} style={{ color: color[1] }}>{color[2]}</span>;
    return <span key={index}>{part}</span>;
  });
}

interface Categorie { id: number; nom: string; }
interface SousCategorie { id: number; nom: string; categorie: Categorie; }
interface Marque { id: number; nom: string; }

interface Produit {
  id: number;
  nom: string;
  reference: string;
  prix: number;
  prixAchat?: number | null;
  cump?: number | null;
  mouvementsStock?: { unitPrice?: number | null }[];
  tva?: number | null;
  remise: number;
  stock: number;
  qteAchat?: number;
  qteVente?: number;
  disponibleALaVente?: boolean;
  disponible: boolean;
  paysFabrication?: string | null;
  misEnAvantSousCat?: boolean;
  description?: string;
  expirationDate?: string | null;
  images?: string[];
  ficheTechnique?: string;
  video?: string;
  motsCles?: string[];
  sousCategorieId: number;
  sousCategorie: SousCategorie;
  marqueId: number;
  marque: Marque;
}

export default function ProductsPage() {
  const [items, setItems] = useState<Produit[]>([]);
  const [subcategories, setSubcategories] = useState<SousCategorie[]>([]);
  const [brands, setBrands] = useState<Marque[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Produit | null>(null);

  // Form fields
  const [formNom, setFormNom] = useState("");
  const [formRef, setFormRef] = useState("");
  const [formPrix, setFormPrix] = useState("");
  const [formPrixAchat, setFormPrixAchat] = useState("");
  const [formTva, setFormTva] = useState("0");
  const [formRemise, setFormRemise] = useState("0");
  const [formStock, setFormStock] = useState("0");
  const [formSubCatId, setFormSubCatId] = useState("");
  const [formBrandId, setFormBrandId] = useState("");
  const [formDispo, setFormDispo] = useState(true);
  const [formPays, setFormPays] = useState("");
  const [formMisEnAvant, setFormMisEnAvant] = useState(false);
  const [formDesc, setFormDesc] = useState("");
  const [formExpirationDate, setFormExpirationDate] = useState("");
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formFicheTechnique, setFormFicheTechnique] = useState("");
  const [formVideo, setFormVideo] = useState("");
  const [formMotsCles, setFormMotsCles] = useState("");
  const [formTags, setFormTags] = useState<string[]>([]);

  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Inline edit price & discount state
  const [inlineEditId, setInlineEditId] = useState<number | null>(null);
  const [inlinePrix, setInlinePrix] = useState("");
  const [inlineRemise, setInlineRemise] = useState("0");
  const [inlineSaving, setInlineSaving] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Inline edit stock state
  const [inlineStockEditId, setInlineStockEditId] = useState<number | null>(null);
  const [inlineStock, setInlineStock] = useState("0");
  const [inlineStockSaving, setInlineStockSaving] = useState(false);
  const [inlineStockError, setInlineStockError] = useState<string | null>(null);
  const [availabilitySavingId, setAvailabilitySavingId] = useState<number | null>(null);
  const [availabilityError, setAvailabilityError] = useState<number | null>(null);
  const [repartitionModalId, setRepartitionModalId] = useState<number | null>(null);

  // Quick filters & search
  const [activeFilter, setActiveFilter] = useState<"all" | "new" | "promo" | "rupture" | "indisponible">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [resProd, resSub, resBrand] = await Promise.all([
        fetch(`${API_URL}/products`),
        fetch(`${API_URL}/subcategories`),
        fetch(`${API_URL}/brands`)
      ]);
      if (!resProd.ok || !resSub.ok || !resBrand.ok) throw new Error("Erreur de chargement");
      setItems(await resProd.json());
      const subs = await resSub.json();
      setSubcategories(subs);
      const brds = await resBrand.json();
      setBrands(brds);

      if (!formSubCatId && subs.length > 0) setFormSubCatId(subs[0].id.toString());
      if (!formBrandId && brds.length > 0) setFormBrandId(brds[0].id.toString());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSingleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setFormError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const t = typeof window !== "undefined" ? (localStorage.getItem("rzm_token") || localStorage.getItem("token")) : null;
      const res = await fetch(`${API_URL}/upload/single`, { method: "POST", body: formData, headers: t ? { Authorization: `Bearer ${t}` } : {} });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'upload");
      setFormFicheTechnique(data.url);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erreur d'upload");
    } finally { setUploading(false); }
  };

  const handleMultipleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true); setFormError(null);
    try {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append("files", f));
      const t = typeof window !== "undefined" ? (localStorage.getItem("rzm_token") || localStorage.getItem("token")) : null;
      const res = await fetch(`${API_URL}/upload/multiple`, { method: "POST", body: formData, headers: t ? { Authorization: `Bearer ${t}` } : {} });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'upload");
      setFormImages(prev => [...prev, ...data.urls]);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erreur d'upload");
    } finally { setUploading(false); }
  };
  const setMainImage = (index: number) => setFormImages((current) => index === 0 ? current : [current[index], ...current.filter((_, i) => i !== index)]);

  const openAdd = (brandId?: number) => {
    setEditing(null);
    setFormNom(""); setFormRef(""); setFormPrix(""); setFormPrixAchat(""); setFormTva("0"); setFormRemise("0"); setFormStock("0"); setFormDispo(true); setFormMisEnAvant(false);
    setFormDesc(""); setFormExpirationDate(""); setFormImages([]); setFormFicheTechnique(""); setFormVideo(""); setFormMotsCles(""); setFormTags([]);
    setFormSubCatId(subcategories.length > 0 ? subcategories[0].id.toString() : "");
    setFormBrandId(brandId?.toString() || (brands.length > 0 ? brands[0].id.toString() : ""));
    setFormError(null); setShowModal(true);
  };

  const openEdit = (item: Produit) => {
    setEditing(item);
    setFormNom(item.nom); setFormRef(item.reference); setFormPrix(item.prix?.toString() || "");
    setFormPrixAchat(item.prixAchat != null ? item.prixAchat.toString() : "");
    setFormTva(item.tva != null ? item.tva.toString() : "0");
    setFormRemise((item.remise ?? 0).toString());
    setFormStock(item.stock?.toString() || "0"); setFormDispo(item.disponible); setFormMisEnAvant(item.misEnAvantSousCat ?? false);
    setFormDesc(item.description || "");
    setFormExpirationDate(item.expirationDate ? item.expirationDate.slice(0, 10) : "");
    setFormImages(item.images || []);
    setFormFicheTechnique(item.ficheTechnique || "");
    setFormVideo(item.video || "");
    setFormMotsCles(""); setFormTags(item.motsCles || []);
    setFormSubCatId(item.sousCategorieId?.toString() || "");
    setFormBrandId(item.marqueId?.toString() || "");
    setFormError(null); setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSave = async () => {
    if (!formNom || !formRef || !formPrix || !formSubCatId || !formBrandId) {
      setFormError("Veuillez remplir tous les champs obligatoires");
      return;
    }
    setSaving(true); setFormError(null);
    try {
      const url = editing ? `${API_URL}/products/${editing.id}` : `${API_URL}/products`;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(typeof window !== "undefined" && (localStorage.getItem("rzm_token") || localStorage.getItem("token")) ? { Authorization: `Bearer ${localStorage.getItem("rzm_token") || localStorage.getItem("token")}` } : {})
        },
        body: JSON.stringify({
          nom: formNom.trim(),
          reference: formRef.trim(),
          prix: Number(formPrix),
          prixAchat: formPrixAchat !== "" ? Number(formPrixAchat) : null,
          tva: Number(formTva) || 0,
          remise: Number(formRemise) || 0,
          stock: Number(formStock),
          disponible: formDispo,
          paysFabrication: formPays || null,
          misEnAvantSousCat: formMisEnAvant,
          description: formDesc.trim() || undefined,
          expirationDate: formExpirationDate || null,
          images: formImages,
          ficheTechnique: formFicheTechnique.trim() || undefined,
          video: formVideo.trim() || undefined,
          motsCles: [...formTags, formMotsCles.trim()].filter((tag, index, all) => tag && all.findIndex(value => value.toLowerCase() === tag.toLowerCase()) === index),
          sousCategorieId: formSubCatId,
          marqueId: formBrandId
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erreur d'enregistrement");
      closeModal(); fetchData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erreur");
    } finally { setSaving(false); }
  };

  const startInlineEdit = (item: Produit, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setInlineEditId(item.id);
    setInlinePrix(item.prix.toString());
    setInlineRemise((item.remise ?? 0).toString());
    setInlineError(null);
  };

  const cancelInlineEdit = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setInlineEditId(null);
    setInlineError(null);
  };

  const saveInlineEdit = async (item: Produit, e?: React.MouseEvent | React.FormEvent) => {
    if (e) e.stopPropagation();
    const prixNum = parseFloat(inlinePrix);
    const remiseNum = parseFloat(inlineRemise) || 0;
    if (isNaN(prixNum) || prixNum < 0) {
      setInlineError("Prix invalide");
      return;
    }
    if (remiseNum < 0 || remiseNum > 100) {
      setInlineError("Remise 0-100%");
      return;
    }
    setInlineSaving(true);
    setInlineError(null);
    try {
      const res = await fetch(`${API_URL}/products/${item.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          ...(typeof window !== "undefined" && (localStorage.getItem("rzm_token") || localStorage.getItem("token")) ? { Authorization: `Bearer ${localStorage.getItem("rzm_token") || localStorage.getItem("token")}` } : {})
        },
        body: JSON.stringify({
          nom: item.nom,
          reference: item.reference,
          prix: prixNum,
          remise: remiseNum,
          stock: item.stock,
          disponible: item.disponible,
          paysFabrication: item.paysFabrication || null,
          description: item.description,
          images: item.images,
          ficheTechnique: item.ficheTechnique,
          video: item.video,
          motsCles: item.motsCles,
          sousCategorieId: item.sousCategorieId,
          marqueId: item.marqueId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur de mise à jour");
      }
      setItems(prev => prev.map(p => (p.id === item.id ? { ...p, prix: prixNum, remise: remiseNum } : p)));
      setInlineEditId(null);
    } catch (err: unknown) {
      setInlineError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setInlineSaving(false);
    }
  };

  const startInlineStockEdit = (item: Produit, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setInlineStockEditId(item.id);
    setInlineStock(item.stock.toString());
    setInlineStockError(null);
  };

  const cancelInlineStockEdit = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setInlineStockEditId(null);
    setInlineStockError(null);
  };

  const saveInlineStockEdit = async (item: Produit, newStockVal?: number, e?: React.MouseEvent | React.FormEvent) => {
    if (e) e.stopPropagation();
    const stockNum = newStockVal !== undefined ? newStockVal : parseInt(inlineStock, 10);
    if (isNaN(stockNum)) {
      setInlineStockError("Stock invalide");
      return;
    }
    setInlineStockSaving(true);
    setInlineStockError(null);
    try {
      const res = await fetch(`${API_URL}/products/${item.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          ...(typeof window !== "undefined" && (localStorage.getItem("rzm_token") || localStorage.getItem("token")) ? { Authorization: `Bearer ${localStorage.getItem("rzm_token") || localStorage.getItem("token")}` } : {})
        },
        body: JSON.stringify({
          nom: item.nom,
          reference: item.reference,
          prix: item.prix,
          remise: item.remise,
          stock: stockNum,
          disponible: item.disponible,
          description: item.description,
          images: item.images,
          ficheTechnique: item.ficheTechnique,
          video: item.video,
          motsCles: item.motsCles,
          sousCategorieId: item.sousCategorieId,
          marqueId: item.marqueId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur de mise à jour");
      }
      setItems(prev => prev.map(p => (p.id === item.id ? { ...p, stock: stockNum } : p)));
      setInlineStockEditId(null);
    } catch (err: unknown) {
      setInlineStockError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setInlineStockSaving(false);
    }
  };

  const toggleAvailability = async (item: Produit, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextValue = !(item.disponibleALaVente !== false);
    setAvailabilitySavingId(item.id);
    setAvailabilityError(null);
    try {
      const res = await fetch(`${API_URL}/products/${item.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          ...(typeof window !== "undefined" && (localStorage.getItem("rzm_token") || localStorage.getItem("token")) ? { Authorization: `Bearer ${localStorage.getItem("rzm_token") || localStorage.getItem("token")}` } : {})
        },
        body: JSON.stringify({ disponible: nextValue, disponibleALaVente: nextValue }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur de disponibilité");
      }
      setItems((current) => current.map((product) => product.id === item.id
        ? { ...product, disponible: nextValue, disponibleALaVente: nextValue }
        : product));
    } catch {
      setAvailabilityError(item.id);
    } finally {
      setAvailabilitySavingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const t = typeof window !== "undefined" ? (localStorage.getItem("rzm_token") || localStorage.getItem("token")) : null;
      const res = await fetch(`${API_URL}/products/${id}`, { method: "DELETE", headers: t ? { Authorization: `Bearer ${t}` } : {} });
      if (!res.ok) throw new Error((await res.json()).error || "Erreur de suppression");
      setDeleteId(null); fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erreur");
    }
  };

  const countPromo = items.filter(p => Number(p.remise) > 0).length;
  const countNew = Math.min(items.length, 20);
  const countRupture = items.filter(p => p.stock === 0).length;
  const countIndispo = items.filter(p => !p.disponible).length;

  const filteredItems = items.filter((item, index) => {
    if (activeFilter === "new" && index >= 20) return false;
    if (activeFilter === "promo" && Number(item.remise) <= 0) return false;
    if (activeFilter === "rupture" && item.stock > 0) return false;
    if (activeFilter === "indisponible" && item.disponible) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNom = item.nom.toLowerCase().includes(q);
      const matchRef = item.reference.toLowerCase().includes(q);
      const matchCat = item.sousCategorie?.nom.toLowerCase().includes(q);
      const matchMarque = item.marque?.nom.toLowerCase().includes(q);
      return matchNom || matchRef || matchCat || matchMarque;
    }
    return true;
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="Produits" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Gestion des produits</h3>
          <p className="text-sm text-gray-500">{filteredItems.length} sur {items.length} produit(s)</p>
        </div>
        <button onClick={() => openAdd()} className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors self-start sm:self-auto">
          + Nouveau Produit
        </button>
      </div>

      <div className="mb-6">
        <p className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Ajouter un produit par marque</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {brands.map((brand) => (
            <button key={brand.id} type="button" onClick={() => openAdd(brand.id)} className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-500 hover:shadow-md dark:border-gray-800 dark:bg-white/[0.03]">
              <span className="font-semibold text-gray-800 dark:text-white/90">{brand.nom}</span>
              <span className="mt-1 block text-xs text-gray-500">Cliquer pour ajouter un produit</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs & Search Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${activeFilter === "all"
                ? "bg-brand-500 text-white shadow-sm"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
          >
            Tous ({items.length})
          </button>
          <button
            onClick={() => setActiveFilter("new")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${activeFilter === "new"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
          >
            Nouveautés ({countNew})
          </button>
          <button
            onClick={() => setActiveFilter("promo")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${activeFilter === "promo"
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
          >
            Promotions ({countPromo})
          </button>
          <button
            onClick={() => setActiveFilter("rupture")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${activeFilter === "rupture"
                ? "bg-red-500 text-white shadow-sm"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
          >
            En rupture ({countRupture})
          </button>
          <button
            onClick={() => setActiveFilter("indisponible")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${activeFilter === "indisponible"
                ? "bg-gray-700 text-white shadow-sm"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
          >
            Indisponibles ({countIndispo})
          </button>
        </div>

        <div className="w-full md:w-64">
          <input
            type="text"
            placeholder="Rechercher nom, réf, marque..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3"><p className="text-red-500">{error}</p><button onClick={fetchData} className="text-sm text-brand-500 underline">Réessayer</button></div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-gray-500">Aucun produit ne correspond à ces critères</p>
            {activeFilter !== "all" && (
              <button onClick={() => setActiveFilter("all")} className="text-sm text-brand-500 underline">
                Afficher tous les produits
              </button>
            )}
          </div>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-gray-100 dark:border-gray-800 border-y">
                <TableRow>
                  <TableCell isHeader className="px-4 py-3 text-start">Image</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start">Réf</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start">Nom</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-center">Pays</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start">Prix vente / Remise</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start">Prix achat</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start">CUMP</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start">Stock</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start">Qté achat</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start">Qté vente</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start">Marge</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start">Disponible</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start">Sous-Catégorie</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start">Marque</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-end">Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredItems.map((item) => {
                  const isInline = inlineEditId === item.id;
                  const previewPrix = parseFloat(inlinePrix);
                  const previewRemise = parseFloat(inlineRemise) || 0;
                  const finalCalculated = !isNaN(previewPrix) && previewPrix >= 0
                    ? (previewPrix * (1 - previewRemise / 100)).toFixed(2)
                    : null;

                  return (
                    <TableRow key={item.id} className={isInline ? "bg-brand-50/40 dark:bg-brand-950/20" : ""}>
                      <TableCell className="px-4 py-4">
                        {item.images && item.images.length > 0 ? (
                          <img src={item.images[0].startsWith("/") ? getBaseUrl() + item.images[0] : item.images[0]} alt={item.nom} className="h-10 w-10 object-cover rounded-md border" />
                        ) : (
                          <div className="h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center text-xs text-gray-400">-</div>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-xs font-mono text-gray-500">{item.reference}</TableCell>
                      <TableCell className="px-4 py-4 font-medium text-gray-800 dark:text-white/90">{item.nom}</TableCell>
                      <TableCell className="px-4 py-4 text-center">
                        <span title={item.paysFabrication || ""}>
                          {item.paysFabrication && countries.getAlpha2Code(item.paysFabrication, "fr") ? (
                            <img 
                              src={`https://flagcdn.com/w40/${countries.getAlpha2Code(item.paysFabrication, "fr")!.toLowerCase()}.png`}
                              alt={item.paysFabrication}
                              className="inline-block w-8 h-auto shadow-sm rounded-sm"
                            />
                          ) : "-"}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-4 min-w-[200px]">
                        {isInline ? (
                          <div className="flex flex-col gap-1.5 p-2 bg-white dark:bg-gray-800 rounded-xl border border-brand-300 dark:border-brand-700 shadow-sm">
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1">
                                <label className="block text-[10px] uppercase font-semibold text-gray-400 mb-0.5">Prix (TND)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  autoFocus
                                  value={inlinePrix}
                                  onChange={(e) => setInlinePrix(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveInlineEdit(item);
                                    if (e.key === "Escape") cancelInlineEdit();
                                  }}
                                  className="w-full px-2 py-1 text-xs font-bold text-gray-800 dark:text-white bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
                                  placeholder="Prix"
                                />
                              </div>
                              <div className="w-20">
                                <label className="block text-[10px] uppercase font-semibold text-gray-400 mb-0.5">Remise %</label>
                                <input
                                  type="number"
                                  step="1"
                                  min="0"
                                  max="100"
                                  value={inlineRemise}
                                  onChange={(e) => setInlineRemise(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveInlineEdit(item);
                                    if (e.key === "Escape") cancelInlineEdit();
                                  }}
                                  className="w-full px-2 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
                                  placeholder="0"
                                />
                              </div>
                            </div>

                            {finalCalculated && previewRemise > 0 && (
                              <div className="text-[11px] text-green-600 dark:text-green-400 font-medium">
                                Final : <span className="font-bold">{finalCalculated} TND</span> (-{previewRemise}%)
                              </div>
                            )}

                            {inlineError && <p className="text-[10px] text-red-500 font-medium">{inlineError}</p>}

                            <div className="flex items-center gap-1.5 pt-0.5">
                              <button
                                onClick={(e) => saveInlineEdit(item, e)}
                                disabled={inlineSaving}
                                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors disabled:opacity-50"
                              >
                                {inlineSaving ? "..." : "✓ Enregistrer"}
                              </button>
                              <button
                                onClick={cancelInlineEdit}
                                disabled={inlineSaving}
                                className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={(e) => startInlineEdit(item, e)}
                            className="group cursor-pointer flex items-center justify-between gap-2 p-1.5 -m-1.5 rounded-lg hover:bg-gray-100/80 dark:hover:bg-gray-800/80 transition-all"
                            title="Cliquer pour modifier rapidement le prix et la remise"
                          >
                            <div>
                              {Number(item.remise) > 0 ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs line-through text-gray-400">{item.prix} TND</span>
                                  <span className="font-semibold text-green-600 dark:text-green-400">
                                    {(item.prix * (1 - Number(item.remise) / 100)).toFixed(2)} TND
                                  </span>
                                  <Badge color="warning" size="sm">-{item.remise}%</Badge>
                                </div>
                              ) : (
                                <span className="font-semibold text-brand-500">{item.prix} TND</span>
                              )}
                            </div>
                            <span className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-[11px] text-brand-600 bg-brand-50 dark:bg-brand-950/40 px-1.5 py-0.5 rounded border border-brand-200 dark:border-brand-800 font-medium transition-opacity">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              </svg>
                              Éditer
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {item.mouvementsStock?.[0]?.unitPrice != null
                          ? `${Number(item.mouvementsStock[0].unitPrice).toFixed(3)} TND`
                          : item.prixAchat != null ? `${Number(item.prixAchat).toFixed(3)} TND` : "-"}
                        <span className="mt-1 block text-[10px] text-gray-400">Dernier achat</span>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {item.cump != null ? `${Number(item.cump).toFixed(3)} TND` : "-"}
                      </TableCell>
                      <TableCell className="px-4 py-4 min-w-[130px]">
                        {inlineStockEditId === item.id ? (
                          <div className="flex flex-col gap-1 p-1.5 bg-white dark:bg-gray-800 rounded-xl border border-brand-300 dark:border-brand-700 shadow-sm">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const current = parseInt(inlineStock, 10) || 0;
                                  setInlineStock((current - 1).toString());
                                }}
                                className="w-6 h-6 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                autoFocus
                                value={inlineStock}
                                onChange={(e) => setInlineStock(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveInlineStockEdit(item);
                                  if (e.key === "Escape") cancelInlineStockEdit();
                                }}
                                className="w-14 px-1.5 py-0.5 text-center text-xs font-bold text-gray-800 dark:text-white bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const current = parseInt(inlineStock, 10) || 0;
                                  setInlineStock((current + 1).toString());
                                }}
                                className="w-6 h-6 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                              >
                                +
                              </button>
                            </div>
                            {inlineStockError && <p className="text-[10px] text-red-500">{inlineStockError}</p>}
                            <div className="flex items-center gap-1 pt-0.5">
                              <button
                                onClick={(e) => saveInlineStockEdit(item, undefined, e)}
                                disabled={inlineStockSaving}
                                className="flex-1 px-1.5 py-0.5 text-[11px] font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors disabled:opacity-50"
                              >
                                {inlineStockSaving ? "..." : "Enregistrer"}
                              </button>
                              <button
                                onClick={cancelInlineStockEdit}
                                disabled={inlineStockSaving}
                                className="px-1.5 py-0.5 text-[11px] text-gray-600 hover:text-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={(e) => startInlineStockEdit(item, e)}
                            className="group cursor-pointer inline-flex items-center gap-1.5 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                            title="Cliquer pour modifier le stock directement"
                          >
                            <Badge color={item.stock > 10 ? "success" : item.stock > 0 ? "warning" : "error"} size="sm">
                              {item.stock}
                            </Badge>
                            <span className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-brand-500 transition-opacity">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              </svg>
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{item.qteAchat ?? 0}</TableCell>
                      <TableCell className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{item.qteVente ?? 0}</TableCell>
                      <TableCell className="px-4 py-4 text-sm">
                        {item.prixAchat != null ? `${(Number(item.prix) - Number(item.prixAchat)).toFixed(3)} TND` : "—"}
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <button
                          type="button"
                          onClick={(e) => void toggleAvailability(item, e)}
                          disabled={availabilitySavingId === item.id}
                          title="Modifier la disponibilité à la vente"
                          className="disabled:cursor-wait disabled:opacity-50"
                        >
                          <Badge color={item.disponibleALaVente !== false ? "success" : "error"} size="sm">
                            {availabilitySavingId === item.id ? "..." : item.disponibleALaVente !== false ? "Oui" : "Non"}
                          </Badge>
                        </button>
                        {availabilityError === item.id && <span className="mt-1 block text-[10px] text-red-500">Erreur</span>}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-sm text-gray-500">{item.sousCategorie?.nom} <span className="text-xs">({item.sousCategorie?.categorie?.nom})</span></TableCell>
                      <TableCell className="px-4 py-4 text-sm text-gray-500">{item.marque?.nom}</TableCell>
                      <TableCell className="px-4 py-4 text-xs">{(() => { if (!item.expirationDate) return <span className="text-gray-400">Pas de date</span>; const days = Math.ceil((new Date(item.expirationDate).getTime() - Date.now()) / 86400000); return days < 0 ? <span className="font-medium text-red-500">Date expirée</span> : days <= 30 ? <span className="font-medium text-amber-500">Date proche</span> : <span className="text-green-600">Date normale</span>; })()}</TableCell>
                      <TableCell className="px-4 py-4 text-end whitespace-nowrap">
                        <button onClick={() => setRepartitionModalId(item.id)} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mr-3 underline">Détails Stock</button>
                        <button onClick={() => openEdit(item)} className="text-sm text-brand-500 hover:underline mr-3">Modifier</button>
                        <button onClick={() => setDeleteId(item.id)} className="text-sm text-red-500 hover:underline">Supprimer</button>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
          className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 sm:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.target instanceof HTMLButtonElement) return;
              const tag = formMotsCles.trim();
              if (tag && !formTags.some((value) => value.toLowerCase() === tag.toLowerCase())) setFormTags((current) => [...current, tag]);
              if (tag) { e.preventDefault(); setFormMotsCles(""); }
            }}
            className="w-full max-w-2xl rounded-3xl bg-white dark:bg-gray-900 shadow-2xl p-6 border border-gray-200 dark:border-gray-800 my-auto animate-in fade-in zoom-in-95 duration-150 relative"
          >
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-lg font-bold text-gray-800 dark:text-white">
                {editing ? "Modifier Produit" : "Nouveau Produit"}
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

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Nom *</label>
                <input type="text" value={formNom} onChange={(e) => setFormNom(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Référence *</label>
                <input type="text" value={formRef} onChange={(e) => setFormRef(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Prix de vente (TND) *</label>
                <input type="number" step="0.01" min="0" value={formPrix} onChange={(e) => setFormPrix(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Prix d&apos;achat (TND)</label>
                <input type="number" step="0.001" min="0" value={formPrixAchat} onChange={(e) => setFormPrixAchat(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Optionnel" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">TVA (%)</label>
                <select value={formTva} onChange={(e) => setFormTva(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                  <option value="0">0% (Exonéré)</option>
                  <option value="7">7%</option>
                  <option value="13">13%</option>
                  <option value="19">19%</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Remise (%)</label>
                <input type="number" step="1" min="0" max="100" value={formRemise} onChange={(e) => setFormRemise(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Stock initial</label>
                <input type="number" value={formStock} onChange={(e) => setFormStock(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Sous-Catégorie *</label>
                <select value={formSubCatId} onChange={(e) => setFormSubCatId(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                  <option value="" disabled>-- Sélectionner --</option>
                  {subcategories.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.categorie?.nom})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Marque *</label>
                <select value={formBrandId} onChange={(e) => setFormBrandId(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                  <option value="" disabled>-- Sélectionner --</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Pays de fabrication</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select
                      instanceId="country-select"
                      options={Object.entries(countries.getNames("fr")).map(([code, name]) => ({
                        value: name,
                        label: name
                      }))}
                      value={formPays ? { value: formPays, label: formPays } : null}
                      onChange={(option) => setFormPays(option?.value || "")}
                      isClearable
                      placeholder="Sélectionner un pays"
                      noOptionsMessage={() => "Aucun pays trouvé"}
                      styles={{
                        control: (baseStyles, state) => ({
                          ...baseStyles,
                          borderRadius: '0.75rem',
                          borderColor: state.isFocused ? '#4f46e5' : '#d1d5db',
                          padding: '0.15rem',
                          boxShadow: 'none',
                          backgroundColor: 'var(--tw-bg-opacity)',
                        })
                      }}
                      classNames={{
                        control: () => "dark:bg-gray-800 dark:border-gray-700 dark:text-white hover:border-gray-400",
                        menu: () => "dark:bg-gray-800 dark:text-white border dark:border-gray-700",
                        option: (state) => state.isFocused ? "bg-gray-100 dark:bg-gray-700" : "dark:bg-gray-800",
                        singleValue: () => "dark:text-white"
                      }}
                    />
                  </div>
                  {formPays && (
                    <div className="flex items-center justify-center w-12 h-12 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                      {countries.getAlpha2Code(formPays, "fr") 
                        ? <img src={`https://flagcdn.com/w40/${countries.getAlpha2Code(formPays, "fr")!.toLowerCase()}.png`} alt={formPays} className="w-8 h-auto shadow-sm rounded-sm" />
                        : ""}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Description</label>
              <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white resize-none" rows={3}></textarea>
              {formDesc && <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">{renderDescriptionPreview(formDesc)}</div>}
            </div>
            <div className="mb-4"><label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Date d'expiration (optionnelle)</label><input type="date" value={formExpirationDate} onChange={(e) => setFormExpirationDate(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" /></div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Images du produit (PNG, JPG)</label>
                <input type="file" multiple accept="image/png, image/jpeg, image/webp" onChange={handleMultipleUpload} className="w-full rounded-xl border border-gray-300 p-2 text-xs dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                {uploading && <p className="text-xs text-brand-500 mt-1">Téléversement en cours...</p>}
                {formImages.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {formImages.map((img, i) => (
                      <div key={`image-${i}`} className="relative h-16 w-16">
                        <button
                          type="button"
                          onClick={() => setMainImage(i)}
                          className={`h-full w-full overflow-hidden rounded-lg border-2 ${i === 0 ? "border-brand-500" : "border-gray-200"
                            }`}
                          title="Choisir comme image principale (première image)"
                        >
                          <img
                            src={img.startsWith("/") ? getBaseUrl() + img : img}
                            alt="Aperçu"
                            className="h-full w-full object-cover"
                          />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormImages((prev) => prev.filter((_, idx) => idx !== i));
                          }}
                          className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 transition-colors z-10 cursor-pointer"
                          title="Supprimer l'image"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Fiche Technique (PDF ou Image)</label>
                <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/gif" onChange={handleSingleUpload} className="w-full rounded-xl border border-gray-300 p-2 text-xs dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                {formFicheTechnique && <a href={formFicheTechnique.startsWith("/") ? getBaseUrl() + formFicheTechnique : formFicheTechnique} target="_blank" rel="noreferrer" className="text-xs text-brand-500 mt-1 block hover:underline">Voir le fichier actuel</a>}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Vidéo (URL optionnelle, YouTube/Vimeo)</label>
              <input type="text" value={formVideo} onChange={(e) => setFormVideo(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="https://..." />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Mots-clés</label>
              <div className="flex min-h-11 w-full flex-wrap items-center gap-2 rounded-xl border border-gray-300 p-2.5 dark:border-gray-700 dark:bg-gray-800">
                {formTags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                    {tag}
                    <button type="button" onClick={() => setFormTags((current) => current.filter((value) => value !== tag))} className="text-sm leading-none hover:text-red-500" aria-label={`Supprimer ${tag}`}>×</button>
                  </span>
                ))}
                <input type="text" value={formMotsCles} onChange={(e) => setFormMotsCles(e.target.value)} className="min-w-32 flex-1 bg-transparent p-0 text-sm text-gray-800 outline-none dark:text-white" placeholder={formTags.length ? "Ajouter..." : "Écrire un mot-clé puis Entrée..."} />
              </div>
            </div>

            <div className="flex gap-6 mb-4">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" checked={formDispo} onChange={(e) => setFormDispo(e.target.checked)} className="rounded border-gray-300 w-4 h-4 text-brand-500 focus:ring-brand-500" />
                Produit disponible à la vente
              </label>
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" checked={formMisEnAvant} onChange={(e) => setFormMisEnAvant(e.target.checked)} className="rounded border-gray-300 w-4 h-4 text-brand-500 focus:ring-brand-500" />
                Mis en avant sur l'accueil de la sous-catégorie
              </label>
            </div>

            {formError && <p className="mt-1.5 text-xs text-red-500 font-medium">{formError}</p>}

            <div className="flex justify-end gap-3 mt-6 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button onClick={closeModal} className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
              <button onClick={handleSave} disabled={saving} className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60">{saving ? "En cours..." : "Enregistrer"}</button>
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
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-gray-900 shadow-2xl p-6 border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-150"
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
            <p className="text-xs text-gray-500 mb-6">Cette action est irréversible et supprimera définitivement le produit.</p>
            <div className="flex justify-end gap-2.5">
              <button onClick={() => setDeleteId(null)} className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
              <button onClick={() => handleDelete(deleteId)} className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {repartitionModalId && (
        <StockRepartitionModal
          produitId={repartitionModalId}
          onClose={() => setRepartitionModalId(null)}
        />
      )}
    </div>
  );
}
