"use client";

import React, { useState, useEffect } from "react";
import { API_URL, getBaseUrl } from "@/utils/api";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyInfo } from "@/context/CompanyInfoContext";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

const INPUT_CLS = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none";
const LABEL_CLS = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

export default function ConfigurationPage() {
  const { getToken } = useAuth();
  const { refresh: refreshContext } = useCompanyInfo();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Infos Société
  const [formData, setFormData] = useState({
    nomSociete: "",
    matriculeFiscale: "",
    telephone: "",
    fax: "",
    email: "",
    adresse: "",
    siteWeb: "",
    banque: "",
    rib: "",
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // TVA
  const [valeursTva, setValeursTva] = useState<number[]>([0, 7, 13, 19]);
  const [newTva, setNewTva] = useState("");

  // Timbre Fiscal (liste de valeurs)
  const [valeursTimbre, setValeursTimbre] = useState<number[]>([1]);
  const [newTimbre, setNewTimbre] = useState("");

  // Frais et Timbre par défaut
  const [tauxFrais, setTauxFrais] = useState("");
  const [timbreFiscal, setTimbreFiscal] = useState("1.000");

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/company-info`);
      if (res.ok) {
        const data = await res.json();
        
        setFormData({
          nomSociete: data.nomSociete || "",
          matriculeFiscale: data.matriculeFiscale || "",
          telephone: data.telephone || "",
          fax: data.fax || "",
          email: data.email || "",
          adresse: data.adresse || "",
          siteWeb: data.siteWeb || "",
          banque: data.banque || "",
          rib: data.rib || "",
        });
        setLogoUrl(data.logoUrl);

        if (Array.isArray(data.valeursTva) && data.valeursTva.length > 0) {
          setValeursTva(data.valeursTva.map(Number));
        }
        if (Array.isArray(data.valeursTimbre) && data.valeursTimbre.length > 0) {
          setValeursTimbre(data.valeursTimbre.map(Number));
        } else if (data.timbreFiscal != null) {
          // Migration : initialiser avec la valeur singleton si aucune liste
          setValeursTimbre([Number(data.timbreFiscal)]);
        }
        if (data.tauxFrais != null) {
          setTauxFrais(data.tauxFrais.toString());
        }
        if (data.timbreFiscal != null) {
          setTimbreFiscal(data.timbreFiscal.toString());
        }
      }
    } catch (err) {
      console.error("Erreur chargement config:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const data = new FormData();
    data.append("file", file);
    setUploading(true);
    try {
      const res = await fetch(`${API_URL}/upload/single`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: data,
      });
      if (!res.ok) throw new Error("Erreur lors de l'upload");
      const result = await res.json();
      setLogoUrl(result.url);
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Erreur lors de l'upload du logo." });
    } finally {
      setUploading(false);
    }
  };

  const addTvaRate = () => {
    const val = parseFloat(newTva);
    if (isNaN(val) || val < 0 || val > 100) return;
    if (valeursTva.includes(val)) return;
    setValeursTva(prev => [...prev, val].sort((a, b) => a - b));
    setNewTva("");
  };

  const removeTvaRate = (val: number) => {
    setValeursTva(prev => prev.filter(v => v !== val));
  };

  const addTimbreRate = () => {
    const val = parseFloat(newTimbre);
    if (isNaN(val) || val < 0) return;
    if (valeursTimbre.includes(val)) return;
    setValeursTimbre(prev => [...prev, val].sort((a, b) => a - b));
    setNewTimbre("");
  };

  const removeTimbreRate = (val: number) => {
    setValeursTimbre(prev => prev.filter(v => v !== val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/company-info`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          ...formData,
          logoUrl,
          valeursTva,
          valeursTimbre,
          tauxFrais: tauxFrais !== "" ? Number(tauxFrais) : null,
          timbreFiscal: timbreFiscal !== "" ? Number(timbreFiscal) : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Erreur ${res.status}`);
      }
      await refreshContext();
      setMessage({ type: "success", text: "Configuration enregistrée avec succès !" });
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Une erreur est survenue." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6">Chargement...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageBreadcrumb pageTitle="Configuration Générale" />

      {message && (
        <div className={`my-4 p-4 rounded-lg ${message.type === "success" ? "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400"}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8 mt-6">

        {/* ── Section Infos Société ── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 border-b border-gray-100 dark:border-gray-700 pb-2">Informations de la Société</h2>
          
          <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-4">Logo de la boutique</h3>
          <div className="flex items-center gap-6 mb-8">
            <div className="w-28 h-28 bg-gray-100 dark:bg-gray-900 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img
                  src={logoUrl.startsWith("http") ? logoUrl : `${getBaseUrl()}${logoUrl}`}
                  alt="Logo"
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <span className="text-gray-400 text-sm text-center px-2">Aucun logo</span>
              )}
            </div>
            <div>
              <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors inline-block font-medium">
                {uploading ? "Upload en cours..." : "Changer de logo"}
                <input type="file" className="hidden" accept="image/*" onChange={handleUpload} disabled={uploading} />
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Format recommandé : PNG transparent.</p>
            </div>
          </div>

          <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-4">Coordonnées</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={LABEL_CLS}>Nom de la société</label>
              <input type="text" value={formData.nomSociete} onChange={e => setFormData({ ...formData, nomSociete: e.target.value })} className={INPUT_CLS} required />
            </div>
            <div>
              <label className={LABEL_CLS}>Matricule Fiscale (M.F)</label>
              <input type="text" value={formData.matriculeFiscale} onChange={e => setFormData({ ...formData, matriculeFiscale: e.target.value })} placeholder="Ex : 1742623LAM000" className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Téléphone</label>
              <input type="text" value={formData.telephone} onChange={e => setFormData({ ...formData, telephone: e.target.value })} className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Fax</label>
              <input type="text" value={formData.fax} onChange={e => setFormData({ ...formData, fax: e.target.value })} className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Email de contact</label>
              <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Site Web</label>
              <input type="url" value={formData.siteWeb} onChange={e => setFormData({ ...formData, siteWeb: e.target.value })} className={INPUT_CLS} />
            </div>
            <div className="md:col-span-2">
              <label className={LABEL_CLS}>Adresse</label>
              <textarea value={formData.adresse} onChange={e => setFormData({ ...formData, adresse: e.target.value })} rows={3} className={INPUT_CLS} />
            </div>
          </div>

          <h3 className="text-base font-semibold text-gray-800 dark:text-white mt-8 mb-4">Coordonnées Bancaires</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={LABEL_CLS}>Nom de la Banque</label>
              <input type="text" value={formData.banque} onChange={e => setFormData({ ...formData, banque: e.target.value })} placeholder="Ex : UIB BANK" className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>RIB / N° de Compte</label>
              <input type="text" value={formData.rib} onChange={e => setFormData({ ...formData, rib: e.target.value })} placeholder="Ex : 12023000003303530971" className={INPUT_CLS} />
            </div>
          </div>
        </div>

        {/* ── Section Fiscalité et Frais ── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 border-b border-gray-100 dark:border-gray-700 pb-2">Fiscalité et Frais</h2>
          
          <div className="mb-8">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-1">Taux de TVA</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Ces valeurs alimentent le sélecteur TVA dans le formulaire de création de produit.
            </p>

            <div className="flex flex-wrap gap-2 mb-4 min-h-[36px]">
              {valeursTva.length === 0 && (
                <span className="text-sm text-gray-400 italic">Aucun taux défini</span>
              )}
              {valeursTva.map(val => (
                <span
                  key={val}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 text-sm font-medium"
                >
                  {val}%
                  <button
                    type="button"
                    onClick={() => removeTvaRate(val)}
                    className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full text-blue-400 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/40 dark:hover:text-red-400 transition-colors leading-none"
                    aria-label={`Supprimer ${val}%`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={newTva}
                onChange={e => setNewTva(e.target.value)}
                placeholder="Ex : 19"
                className={`w-32 ${INPUT_CLS}`}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTvaRate(); } }}
              />
              <span className="text-sm text-gray-500 mr-2">%</span>
              <button
                type="button"
                onClick={addTvaRate}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
              >
                + Ajouter
              </button>
            </div>
          </div>

          {/* ── Valeurs Timbre Fiscal ── */}
          <div className="mb-8">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-1">Valeurs du Timbre Fiscal</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Ces montants alimentent le sélecteur Timbre Fiscal dans les formulaires de facturation.
            </p>

            <div className="flex flex-wrap gap-2 mb-4 min-h-[36px]">
              {valeursTimbre.length === 0 && (
                <span className="text-sm text-gray-400 italic">Aucune valeur définie</span>
              )}
              {valeursTimbre.map(val => (
                <span
                  key={val}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 text-sm font-medium"
                >
                  {val.toFixed(3)} TND
                  <button
                    type="button"
                    onClick={() => removeTimbreRate(val)}
                    className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full text-amber-400 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/40 dark:hover:text-red-400 transition-colors leading-none"
                    aria-label={`Supprimer ${val} TND`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.001"
                value={newTimbre}
                onChange={e => setNewTimbre(e.target.value)}
                placeholder="Ex : 1.000"
                className={`w-36 ${INPUT_CLS}`}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTimbreRate(); } }}
              />
              <span className="text-sm text-gray-500 mr-2">TND</span>
              <button
                type="button"
                onClick={addTimbreRate}
                className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg font-medium transition-colors"
              >
                + Ajouter
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-1">Frais de livraison</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Montant standard des frais appliqués aux commandes.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={LABEL_CLS}>Frais de livraison (TND)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tauxFrais}
                    onChange={e => setTauxFrais(e.target.value)}
                    placeholder="Ex : 7.00"
                    className={`w-full max-w-[200px] ${INPUT_CLS}`}
                  />
                  <span className="text-sm text-gray-500 mt-2">TND</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">Laisser vide pour gratuit.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-8">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {saving ? "Sauvegarde en cours..." : "Enregistrer la configuration"}
          </button>
        </div>
      </form>
    </div>
  );
}
