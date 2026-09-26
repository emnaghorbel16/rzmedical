"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { factureCategorieMeta, type FactureFournisseurCategorie } from "../page";
import { getApiUrl } from "@/utils/api";
import { useAuth } from "@/hooks/useAuth";

const API_URL = getApiUrl();
const round3 = (x: number) => Math.round(x * 1000) / 1000;
const normalizeReference = (value: unknown) => String(value ?? "").toUpperCase().replace(/[\s-]+/g, "");

interface Fournisseur {
  id: number;
  nom: string;
  matriculeFiscale?: string | null;
  adresse?: string | null;
  telephone?: string | null;
  email?: string | null;
}

interface Product {
  id: number;
  nom: string;
  reference: string;
  prix?: number | null;
  prixAchat?: number | null;
  tva?: number | null;
}

interface FFLine {
  produitId?: number;
  designation: string;
  quantite: number;
  prixUnitaireHT: number;
  remise: number;
  tauxTVA: number;
  totalHT: number;
  totalTTC: number;
  totalTTCManuel?: number;
}

const initialLine = (): FFLine => ({
  designation: "",
  quantite: 1,
  prixUnitaireHT: 0,
  remise: 0,
  tauxTVA: 19,
  totalHT: 0,
  totalTTC: 0,
});

function calcLine(l: FFLine): FFLine {
  const puBrut = round3(l.quantite * l.prixUnitaireHT);
  const remiseMontant = round3(puBrut * l.remise / 100);
  const ht = round3(puBrut - remiseMontant);
  const ttc = round3(ht * (1 + l.tauxTVA / 100));
  return { ...l, totalHT: ht, totalTTC: l.totalTTCManuel ?? ttc };
}

export default function NewFactureFournisseurPage({ categorie = "FOURNISSEUR" }: { categorie?: FactureFournisseurCategorie }) {
  const router = useRouter();
  const categoryMeta = factureCategorieMeta[categorie];
  const { getToken } = useAuth();

  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companyTvaRates, setCompanyTvaRates] = useState<number[]>([]);
  const [companyTimbreRates, setCompanyTimbreRates] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [fournisseurId, setFournisseurId] = useState<number | "">("");
  const [fournisseurSearch, setFournisseurSearch] = useState("");
  const [showFournisseurDropdown, setShowFournisseurDropdown] = useState(false);
  const [selectedFournisseur, setSelectedFournisseur] = useState<Fournisseur | null>(null);
  const [fournisseurMF, setFournisseurMF] = useState("");

  const [numeroFF, setNumeroFF] = useState("");
  const [dateFacture, setDateFacture] = useState(new Date().toISOString().split("T")[0]);
  const [dateEcheance, setDateEcheance] = useState("");
  const [statut, setStatut] = useState<"BROUILLON" | "VALIDEE">("BROUILLON");
  const [typeFacture, setTypeFacture] = useState<"PRODUIT" | "SERVICE">("PRODUIT");
  const [etat, setEtat] = useState<"NORMALE" | "AVOIR" | "PROFORMA">("NORMALE");
  const [devise, setDevise] = useState("TND");
  const [timbreFiscal, setTimbreFiscal] = useState(1);
  const [equilibre, setEquilibre] = useState(0);
  const [calculManuel, setCalculManuel] = useState(false);
  const [montantTTCManuel, setMontantTTCManuel] = useState(0);
  const [commentaire, setCommentaire] = useState("");

  const [lignes, setLignes] = useState<FFLine[]>([initialLine()]);
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const [ocrState, setOcrState] = useState<"idle" | "processing" | "success" | "warning" | "error">("idle");
  const [ocrWarnings, setOcrWarnings] = useState<string[]>([]);
  const [ocrMessage, setOcrMessage] = useState("");
  const [ocrRawText, setOcrRawText] = useState("");

  // Computed totals
  const montantHT = round3(lignes.reduce((s, l) => s + l.totalHT, 0));
  const montantTVA = round3(lignes.reduce((s, l) => s + round3(l.totalHT * l.tauxTVA / 100), 0));
  const montantRemise = round3(lignes.reduce((s, l) => s + round3(l.quantite * l.prixUnitaireHT * l.remise / 100), 0));
  const montantTTCAuto = round3(montantHT + montantTVA + timbreFiscal + equilibre);
  const hasManualLineTTC = lignes.some((l) => l.totalTTCManuel !== undefined);
  const montantTTC = hasManualLineTTC
    ? round3(lignes.reduce((s, l) => s + Number(l.totalTTC || 0), 0) + timbreFiscal + equilibre)
    : calculManuel ? Number(montantTTCManuel) || 0 : montantTTCAuto;

  const fetchData = useCallback(async () => {
    try {
      const token = getToken();
      const [fRes, pRes, configRes] = await Promise.all([
        fetch(`${API_URL}/fournisseurs?limit=200`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/products?limit=500`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/company-info`),
      ]);
      if (fRes.ok) {
        const fd = await fRes.json();
        setFournisseurs(fd.items ?? fd);
      }
      if (pRes.ok) {
        const pd = await pRes.json();
        setProducts(pd.items ?? pd.products ?? pd.produits ?? pd);
      }
      if (configRes.ok) {
        const config = await configRes.json();
        if (Array.isArray(config.valeursTva) && config.valeursTva.length > 0) {
          const rates = config.valeursTva.map(Number).filter(Number.isFinite).sort((a: number, b: number) => a - b);
          setCompanyTvaRates(rates);
          setLignes((prev) => prev.map((line) => calcLine({ ...line, tauxTVA: rates.includes(line.tauxTVA) ? line.tauxTVA : rates[0] })));
        }
        if (Array.isArray(config.valeursTimbre) && config.valeursTimbre.length > 0) {
          const rates = config.valeursTimbre.map(Number).sort((a: number, b: number) => a - b);
          setCompanyTimbreRates(rates);
          setTimbreFiscal((value) => rates.includes(value) ? value : rates[0]);
        }
      }
    } catch {}
  }, [getToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredFournisseurs = fournisseurs.filter(
    (f) =>
      fournisseurSearch === "" ||
      f.nom.toLowerCase().includes(fournisseurSearch.toLowerCase()) ||
      (f.matriculeFiscale ?? "").toLowerCase().includes(fournisseurSearch.toLowerCase()),
  );

  const selectFournisseur = (f: Fournisseur) => {
    setFournisseurId(f.id);
    setSelectedFournisseur(f);
    setFournisseurSearch(f.nom);
    setFournisseurMF(f.matriculeFiscale ?? "");
    setShowFournisseurDropdown(false);
  };

  const updateLine = (i: number, partial: Partial<FFLine>) => {
    setLignes((prev) => {
      const next = [...prev];
      next[i] = calcLine({ ...next[i], ...partial });
      return next;
    });
  };

  const addLine = () => setLignes((prev) => [...prev, initialLine()]);
  const removeLine = (i: number) => setLignes((prev) => prev.filter((_, j) => j !== i));

  const handleProductSelect = (lineIndex: number, productId: number) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    updateLine(lineIndex, {
      produitId: p.id,
      designation: p.nom,
      prixUnitaireHT: Number(p.prixAchat ?? p.prix ?? 0),
      tauxTVA: companyTvaRates.includes(Number(p.tva)) ? Number(p.tva) : companyTvaRates[0] ?? 0,
    });
  };

  const handleOCRFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setOcrState("error"); setOcrMessage("Format accepté : image ou PDF"); return;
    }
    setOcrFile(file);
    setOcrPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
    setOcrState("idle"); setOcrWarnings([]); setOcrMessage(""); setOcrRawText("");
  };

  const analyzeOCR = async () => {
    if (!ocrFile) return;
    setOcrState("processing"); setOcrMessage("Analyse de la facture et identification des produits...");
    try {
      const formData = new FormData();
      formData.append("file", ocrFile);
      const response = await fetch(`${API_URL}/achats/factures/ocr`, {
        method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: formData,
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "OCR indisponible");
      const result = payload.data;
      setOcrRawText(typeof result.rawText === "string" ? result.rawText : "");
      const invoice = result.invoice;
      if (invoice.numeroFacture?.value) setNumeroFF(invoice.numeroFacture.value);
      if (invoice.dateFacture?.value) {
        const parts = invoice.dateFacture.value.split(/[/-]/);
        if (parts.length === 3) setDateFacture(parts[2].length === 4 ? `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}` : invoice.dateFacture.value);
      }
      const ocrTotalTTC = Number(invoice.totalTTC?.value);
      if (Number.isFinite(ocrTotalTTC) && ocrTotalTTC > 0) {
        setCalculManuel(true); setMontantTTCManuel(ocrTotalTTC);
      }
      if (invoice.timbreFiscal?.value !== null && invoice.timbreFiscal?.value !== undefined) {
        setTimbreFiscal(Number(invoice.timbreFiscal.value));
      }
      if (result.matchedSupplier) {
        selectFournisseur(fournisseurs.find((item) => item.id === result.matchedSupplier.id) ?? result.matchedSupplier);
      } else if (invoice.fournisseur?.value) {
        // Keep the OCR name visible even when no exact supplier exists in the database.
        setFournisseurSearch(String(invoice.fournisseur.value).trim());
      }
      if (Array.isArray(result.lines) && result.lines.length > 0) {
        setLignes(result.lines.map((line: any) => {
          const ocrReference = line.referenceProduit?.value ?? "";
          const matchedProduct = line.productId
            ? products.find((product) => product.id === Number(line.productId))
            : products.find((product) => normalizeReference(product.reference) === normalizeReference(ocrReference));
          return calcLine({
            ...initialLine(),
            produitId: line.productId ?? matchedProduct?.id,
            designation: matchedProduct?.nom || line.designation?.value || "",
            quantite: Number(line.quantite?.value ?? 1),
            prixUnitaireHT: Number(line.prixUnitaireHT?.value ?? 0),
            remise: Number(line.remise?.value ?? 0),
            tauxTVA: Number(line.tauxTVA?.value ?? 19),
            totalTTCManuel: (() => {
              const ocrLineTTC = Number(line.totalTTC?.value);
              return Number.isFinite(ocrLineTTC) && ocrLineTTC > 0
                ? ocrLineTTC
                : undefined;
            })(),
          });
        }));
      }
      const warnings = Array.from(new Set<string>(result.warnings ?? []));
      setOcrWarnings(warnings); setOcrState(warnings.length ? "warning" : "success");
      setOcrMessage("Facture analysée. Vérifiez les champs avant l'enregistrement.");
    } catch (err: any) {
      setOcrState("error"); setOcrMessage(err.message || "Impossible de lire la facture");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lignes.length || lignes.every((l) => !l.designation)) {
      setError("Veuillez ajouter au moins une ligne");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/achats/factures`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fournisseurId: fournisseurId || null,
          fournisseurMF,
          numeroFactureFournisseur: numeroFF || null,
          dateFacture,
          dateEcheance: dateEcheance || null,
          statut,
          typeFacture,
          categorie,
          etat,
          devise,
          timbreFiscal: Number(timbreFiscal),
          equilibre: Number(equilibre),
          calculManuel,
          montantTTC: calculManuel ? Number(montantTTCManuel) : undefined,
          commentaire: commentaire || null,
          lignes: lignes.filter((l) => l.designation),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Erreur lors de la création");
      }
      router.push(categoryMeta.path);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="sticky top-0 z-40 bg-[#f5f0e8] dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <svg className="text-amber-700 dark:text-amber-500" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 2h9l3 3v17H6V2zm9 0v4h4M9 12h6M9 16h6M9 8h2" />
            </svg>
            <div>
              <h1 className="text-sm font-bold uppercase tracking-widest text-gray-800 dark:text-gray-100">Nouvelle facture {categoryMeta.title}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Saisissez les informations de la facture</p>
            </div>
          </div>
          <Link
            href={categoryMeta.path}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white/70 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-colors"
          >
            ← Retour
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <PageBreadcrumb pageTitle={`Nouvelle facture ${categoryMeta.title}`} />

        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 flex items-start gap-3 shadow-sm">
          <span className="text-2xl">🧾</span>
          <div>
            <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200">Création d'une facture fournisseur</h2>
            <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5 leading-relaxed">
              Sélectionnez le fournisseur et les produits achetés, puis vérifiez les montants avant l'enregistrement.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-900 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-sm font-bold text-gray-800 dark:text-white">Scanner une facture</h2><p className="text-xs text-gray-500">Importez une photo ou un PDF, puis vérifiez toujours les données extraites.</p></div>
            <label className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">📷 Importer une facture<input type="file" accept="image/*,.pdf" capture="environment" className="hidden" onChange={(event) => handleOCRFile(event.target.files?.[0])} /></label>
          </div>
          {ocrFile && <div className="mt-4 flex flex-wrap items-center gap-4">{ocrPreview ? <img src={ocrPreview} alt="Aperçu facture" className="h-28 max-w-[220px] rounded-lg border object-contain" /> : <div className="flex h-28 w-44 items-center justify-center rounded-lg border bg-gray-50 text-sm text-gray-500">PDF sélectionné</div>}<div className="space-y-2"><p className="text-xs text-gray-600 dark:text-gray-300">{ocrFile.name}</p><button type="button" onClick={() => void analyzeOCR()} disabled={ocrState === "processing"} className="rounded-lg border border-blue-600 px-3 py-2 text-sm font-medium text-blue-700 disabled:opacity-50">{ocrState === "processing" ? "Analyse en cours..." : "Analyser avec OCR"}</button></div></div>}
          {ocrMessage && <p className={`mt-3 text-sm ${ocrState === "error" ? "text-red-600" : ocrState === "warning" ? "text-amber-700" : "text-emerald-600"}`}>{ocrMessage}</p>}
          {ocrWarnings.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-amber-700">{ocrWarnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>}
          {ocrRawText && <details className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-800"><summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-200">Texte brut détecté par l&apos;OCR</summary><pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-gray-700 dark:text-gray-300">{ocrRawText}</pre></details>}
        </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section: Fournisseur + Référence */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">Fournisseur</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Fournisseur searchable */}
            <div className="relative">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Fournisseur</label>
              <input
                type="text"
                value={fournisseurSearch}
                onChange={(e) => { setFournisseurSearch(e.target.value); setShowFournisseurDropdown(true); }}
                onFocus={() => setShowFournisseurDropdown(true)}
                onBlur={() => setTimeout(() => setShowFournisseurDropdown(false), 200)}
                placeholder="Rechercher un fournisseur..."
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
              />
              {showFournisseurDropdown && filteredFournisseurs.length > 0 && (
                <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {filteredFournisseurs.slice(0, 10).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onMouseDown={() => selectFournisseur(f)}
                      className="w-full text-left px-3 py-2 hover:bg-brand-50 dark:hover:bg-brand-900/20 text-sm"
                    >
                      <span className="font-medium text-gray-800 dark:text-white">{f.nom}</span>
                      {f.matriculeFiscale && (
                        <span className="ml-2 text-xs text-gray-500">MF: {f.matriculeFiscale}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Matricule fiscal</label>
              <input
                type="text"
                value={fournisseurMF}
                onChange={(e) => setFournisseurMF(e.target.value)}
                placeholder="Ex : 1234567/A/M/000"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
              />
            </div>

            {/* Snapshot */}
            {selectedFournisseur && (
              <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                <p><span className="font-medium">Nom :</span> {selectedFournisseur.nom}</p>
                {selectedFournisseur.matriculeFiscale && <p><span className="font-medium">MF :</span> {selectedFournisseur.matriculeFiscale}</p>}
                {selectedFournisseur.telephone && <p><span className="font-medium">Tél :</span> {selectedFournisseur.telephone}</p>}
                {selectedFournisseur.email && <p><span className="font-medium">Email :</span> {selectedFournisseur.email}</p>}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">N° Facture Fournisseur</label>
              <input
                type="text"
                value={numeroFF}
                onChange={(e) => setNumeroFF(e.target.value)}
                placeholder="N° imprimé sur la facture"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Section: Dates + Statuts */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">Paramètres</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date facture</label>
              <input
                type="date"
                value={dateFacture}
                onChange={(e) => setDateFacture(e.target.value)}
                required
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date échéance</label>
              <input
                type="date"
                value={dateEcheance}
                onChange={(e) => setDateEcheance(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Statut</label>
              <select
                value={statut}
                onChange={(e) => setStatut(e.target.value as any)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
              >
                <option value="BROUILLON">Brouillon</option>
                <option value="VALIDEE">Validée</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
              <select
                value={typeFacture}
                onChange={(e) => setTypeFacture(e.target.value as any)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
              >
                <option value="PRODUIT">Produit</option>
                <option value="SERVICE">Service</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">État</label>
              <select
                value={etat}
                onChange={(e) => setEtat(e.target.value as any)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
              >
                <option value="NORMALE">Normale</option>
                <option value="AVOIR">Avoir</option>
                <option value="PROFORMA">Proforma</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Devise</label>
              <select
                value={devise}
                onChange={(e) => setDevise(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
              >
                <option value="TND">TND</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Timbre fiscal configuré</label>
              <select
                value={timbreFiscal}
                onChange={(e) => setTimbreFiscal(Number(e.target.value))}
                aria-label="Sélectionner le timbre fiscal"
                className="w-full cursor-pointer border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {companyTimbreRates.length === 0 ? <option>Chargement des valeurs…</option> : companyTimbreRates.map((rate) => <option key={rate} value={rate}>Timbre : {rate.toFixed(3)} {devise}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Équilibre</label>
              <input
                type="number"
                step="0.001"
                value={equilibre}
                onChange={(e) => setEquilibre(Number(e.target.value))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
              />
            </div>
          </div>
          <div className="mt-3 max-w-xs">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Total TTC ({devise})
            </label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={calculManuel ? montantTTCManuel : montantTTCAuto}
              onChange={(e) => {
                setCalculManuel(true);
                setMontantTTCManuel(Number(e.target.value));
              }}
              className="w-full border border-amber-400 dark:border-amber-600 rounded-lg px-3 py-2 text-sm font-semibold bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
            />
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              Modifiable manuellement
            </p>
          </div>
        </div>

        {/* Section: Lignes d'articles */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Lignes d'articles</h2>
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400 hover:text-amber-800 font-medium"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/></svg>
              Ajouter une ligne
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Produit</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium min-w-[200px]">Désignation</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Qté</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Prix HT</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Remise %</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Après remise</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Total HT</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">TVA %</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Total TTC</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {lignes.map((l, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    <td className="px-3 py-2">
                      <select
                        value={l.produitId ?? ""}
                        onChange={(e) => e.target.value && handleProductSelect(i, Number(e.target.value))}
                        className="w-36 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                      >
                        <option value="">— Choisir —</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nom} ({p.reference}) — {Number(p.prixAchat ?? p.prix ?? 0).toFixed(3)} DT
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={l.designation}
                        onChange={(e) => updateLine(i, { designation: e.target.value })}
                        placeholder="Désignation..."
                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                        required
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={l.quantite}
                        onChange={(e) => updateLine(i, { quantite: Math.max(1, Math.trunc(Number(e.target.value) || 1)) })}
                        className="w-20 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs text-right bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={l.prixUnitaireHT}
                        onChange={(e) => updateLine(i, { prixUnitaireHT: Number(e.target.value) })}
                        className="w-24 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs text-right bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={l.remise}
                        onChange={(e) => updateLine(i, { remise: Number(e.target.value) })}
                        className="w-16 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs text-right bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {round3(l.prixUnitaireHT * (1 - l.remise / 100)).toFixed(3)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-medium text-gray-800 dark:text-white whitespace-nowrap">
                      {l.totalHT.toFixed(3)}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={l.tauxTVA}
                        onChange={(e) => updateLine(i, { tauxTVA: Number(e.target.value) })}
                        aria-label="Sélectionner le taux de TVA"
                        className="w-24 cursor-pointer border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        {companyTvaRates.length === 0 ? <option>TVA…</option> : companyTvaRates.map((t) => (
                          <option key={t} value={t}>TVA : {t}%</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={l.totalTTC}
                        onChange={(e) => {
                          const targetTTC = Number(e.target.value) || 0;
                          const brutHT = Number(l.quantite) * Number(l.prixUnitaireHT);
                          const taux = 1 + Number(l.tauxTVA) / 100;
                          const targetHT = taux > 0 ? targetTTC / taux : targetTTC;
                          const remise = brutHT > 0
                            ? Math.max(0, Math.min(100, ((brutHT - targetHT) / brutHT) * 100))
                            : 0;
                          setCalculManuel(true);
                          updateLine(i, {
                            remise,
                            totalTTC: targetTTC,
                            totalTTCManuel: targetTTC,
                          });
                        }}
                        className="w-24 border border-amber-400 dark:border-amber-600 rounded px-2 py-1.5 text-xs text-right font-semibold bg-white dark:bg-gray-800 text-amber-700 dark:text-amber-400"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {lignes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          className="p-1 text-red-400 hover:text-red-600 transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section: Totaux + Commentaire */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Commentaire */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Commentaire</h2>
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={4}
              placeholder="Notes internes, observations..."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white resize-none"
            />
          </div>

          {/* Totaux */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">Récapitulatif</h2>
            <div className="space-y-2 text-sm">
              {[
                { label: "Total HT Brut", value: round3(lignes.reduce((s, l) => s + l.quantite * l.prixUnitaireHT, 0)).toFixed(3) },
                { label: "Remise totale", value: `-${montantRemise.toFixed(3)}`, cls: "text-orange-500" },
                { label: "Total HT Net", value: montantHT.toFixed(3), cls: "font-semibold" },
                { label: "Total TVA", value: montantTVA.toFixed(3) },
                { label: "Timbre Fiscal", value: Number(timbreFiscal).toFixed(3) },
                { label: "Équilibre", value: Number(equilibre).toFixed(3) },
              ].map((row) => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{row.label}</span>
                  <span className={`font-medium text-gray-800 dark:text-white ${row.cls ?? ""}`}>{row.value} {devise}</span>
                </div>
              ))}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between">
                <span className="font-bold text-gray-800 dark:text-white">Total TTC</span>
                <span className="font-bold text-lg text-amber-700 dark:text-amber-400">{montantTTC.toFixed(3)} {devise}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-6">
          <Link
            href={categoryMeta.path}
            className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enregistrement...
              </>
            ) : (
              "Créer la Facture"
            )}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}
