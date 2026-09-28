"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { pdf } from "@react-pdf/renderer";
import { InvoicePdfDocument, InvoiceData } from "./InvoicePdfDocument";
import { montantEnLettres } from "@/utils/numberToFrenchWords";
import { useCompanyInfo } from "@/context/CompanyInfoContext";
import { getApiUrl } from "@/utils/api";
import { useAuth } from "@/hooks/useAuth";

const API_URL = getApiUrl();

interface Client {
  id: number;
  email: string;
  nom: string | null;
  prenom: string | null;
  telephone: string | null;
  adresse: string | null;
  matriculeFiscale: string | null;
}

interface Product {
  id: number;
  nom: string;
  reference: string;
  prix: number; // TTC
  tva?: number | null;
  stock: number;
}

interface InvoiceLineForm {
  produitId: number;
  designation: string;
  quantite: number;
  prixUnitaireHT: number;
  tauxTVA: number;
  totalHT: number;
}

interface ValidationErrors {
  numero?: string;
  dateEmission?: string;
  utilisateurId?: string;
  clientNom?: string;
  timbreFiscal?: string;
  lignes?: string[];
  general?: string;
}

interface ManualInvoiceModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

const todayDDMMYYYY = () => {
  const now = new Date();
  const d = now.getDate().toString().padStart(2, "0");
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const y = now.getFullYear();
  return `${d}/${m}/${y}`;
};

const parseDate = (ddmmyyyy: string): Date | null => {
  const parts = ddmmyyyy.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return new Date(y, m - 1, d);
};

const readJsonResponse = async <T,>(res: Response, defaultMessage: string): Promise<T> => {
  const contentType = res.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(
      text ? `${defaultMessage} — ${text.slice(0, 180)}` : defaultMessage
    );
  }

  return res.json() as Promise<T>;
};

export default function ManualInvoiceModal({
  onClose,
  onSuccess,
}: ManualInvoiceModalProps) {
  const { getToken } = useAuth();
  const { companyInfo, defaultTimbre, defaultTva } = useCompanyInfo();

  // ── Database Data ──
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);

  // ── Form State ──
  const [utilisateurId, setUtilisateurId] = useState<number | "">("");
  const [numero, setNumero] = useState("");
  const [dateEmission, setDateEmission] = useState(todayDDMMYYYY());
  const [clientNom, setClientNom] = useState("");
  const [clientMF, setClientMF] = useState("");
  const [clientAdresse, setClientAdresse] = useState("");
  const [clientTelephone, setClientTelephone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [timbreFiscal, setTimbreFiscal] = useState(defaultTimbre);
  const [lignes, setLignes] = useState<InvoiceLineForm[]>([]);
  const [companyTvaRates, setCompanyTvaRates] = useState<number[]>([]);
  const [companyTimbreRates, setCompanyTimbreRates] = useState<number[]>([]);

  // ── UI State ──
  const [loadingNumber, setLoadingNumber] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [successMsg, setSuccessMsg] = useState("");
  const previewBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/company-info`)
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((config) => {
        const tvaRates = Array.isArray(config.valeursTva)
          ? config.valeursTva.map(Number).filter(Number.isFinite).sort((a: number, b: number) => a - b)
          : [];
        const timbreRates = Array.isArray(config.valeursTimbre)
          ? config.valeursTimbre.map(Number).filter(Number.isFinite).sort((a: number, b: number) => a - b)
          : [];
        setCompanyTvaRates(tvaRates);
        setCompanyTimbreRates(timbreRates);
        if (tvaRates.length) setLignes((prev) => prev.map((line) => ({ ...line, tauxTVA: tvaRates.includes(line.tauxTVA) ? line.tauxTVA : tvaRates[0] })));
        if (timbreRates.length) setTimbreFiscal((value) => timbreRates.includes(value) ? value : timbreRates[0]);
      })
      .catch(() => undefined);
  }, []);

  // ── Fetch Clients & Products ──
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const token = getToken();
        const res = await fetch(`${API_URL}/clients`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setClients(data);
        }
      } catch (err) {
        console.error("Failed to fetch clients", err);
      } finally {
        setClientsLoading(false);
      }
    };

    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_URL}/products`);
        if (res.ok) {
          const data = await res.json();
          setProducts(data);
        }
      } catch (err) {
        console.error("Failed to fetch products", err);
      } finally {
        setProductsLoading(false);
      }
    };

    fetchClients();
    fetchProducts();
  }, [getToken]);

  // The final legal number is allocated by the backend inside the creation transaction.
  useEffect(() => {
    setLoadingNumber(false);
  }, []);

  // ── Handle Client Change ──
  const handleClientChange = (clientIdStr: string) => {
    if (clientIdStr === "") {
      setUtilisateurId("");
      setClientNom("");
      setClientMF("");
      setClientAdresse("");
      setClientTelephone("");
      setClientEmail("");
      return;
    }

    const id = parseInt(clientIdStr, 10);
    const client = clients.find((c) => c.id === id);
    if (client) {
      setUtilisateurId(id);
      setClientNom(`${client.nom || ""} ${client.prenom || ""}`.trim());
      setClientMF(client.matriculeFiscale || "");
      setClientAdresse(client.adresse || "");
      setClientTelephone(client.telephone || "");
      setClientEmail(client.email || "");
    }
  };

  // ── Live Calculation ──
  const montantHT = round3(lignes.reduce((s, l) => s + l.totalHT, 0));
  const montantTVA = round3(
    lignes.reduce((s, l) => s + round3(l.totalHT * (l.tauxTVA / 100)), 0)
  );
  const montantTTC = round3(montantHT + montantTVA + timbreFiscal);

  // ── Line Updates ──
  const updateLine = (idx: number, field: keyof InvoiceLineForm, value: any) => {
    setLignes((prev) => {
      const next = [...prev];
      // Always coerce numeric fields to numbers
      let coercedValue = value;
      if (field === "produitId") coercedValue = parseInt(value, 10) || 0;
      if (field === "quantite") coercedValue = Number(value);
      if (field === "prixUnitaireHT") coercedValue = Number(value);
      if (field === "tauxTVA") coercedValue = Number(value);

      let updatedObj = { ...next[idx], [field]: coercedValue };

      if (field === "produitId") {
        const pId = coercedValue as number;
        const prod = products.find((p) => p.id === pId);
        if (prod) {
          updatedObj.designation = prod.nom;
          if (prod.tva != null) { updatedObj.tauxTVA = Number(prod.tva); }
          // Auto fill HT price based on TTC price in DB
          updatedObj.prixUnitaireHT = round3(Number(prod.prix) / (1 + updatedObj.tauxTVA / 100));
        }
      }

      // Recalculate totalHT
      const qty = updatedObj.quantite;
      const pu = updatedObj.prixUnitaireHT;
      updatedObj.totalHT = round3(Number(qty) * Number(pu));

      next[idx] = updatedObj;
      return next;
    });
  };

  const addLine = () => {
    setLignes((prev) => [
      ...prev,
      {
        produitId: 0,
        designation: "",
        quantite: 1,
        prixUnitaireHT: 0,
        tauxTVA: defaultTva,
        totalHT: 0,
      },
    ]);
  };

  const removeLine = (idx: number) => {
    setLignes((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Validation ──
  const validate = (): boolean => {
    const errs: ValidationErrors = {};

    if (!utilisateurId) errs.utilisateurId = "Veuillez sélectionner un client";
    if (!dateEmission.trim())
      errs.dateEmission = "La date est requise";
    else if (!parseDate(dateEmission))
      errs.dateEmission = "Format invalide (DD/MM/YYYY)";

    if (!clientNom.trim()) errs.clientNom = "Le nom du client est requis";

    if (!companyTimbreRates.includes(timbreFiscal))
      errs.timbreFiscal = "Sélectionnez un timbre fiscal configuré";

    const lineErrors: string[] = lignes.map((l, i) => {
      if (!l.produitId) return `Ligne ${i + 1}: produit requis`;
      if (!l.designation.trim()) return `Ligne ${i + 1}: désignation requise`;
      if (!Number.isInteger(l.quantite) || l.quantite <= 0) return `Ligne ${i + 1}: quantité entière invalide`;
      if (l.prixUnitaireHT < 0) return `Ligne ${i + 1}: prix HT invalide`;
      if (!companyTvaRates.includes(l.tauxTVA)) return `Ligne ${i + 1}: TVA non configurée`;
      return "";
    });
    const hasLineErrors = lineErrors.some(Boolean);
    if (hasLineErrors) errs.lignes = lineErrors.filter(Boolean);

    if (lignes.length === 0) errs.general = "La facture doit avoir au moins une ligne";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Build InvoiceData for PDF ──
  const buildInvoiceData = useCallback((): InvoiceData => ({
    numero: numero.trim(),
    dateEmission: dateEmission.trim(),
    clientNom: clientNom.trim(),
    clientMF: clientMF.trim() || undefined,
    clientAdresse: clientAdresse.trim() || undefined,
    clientTelephone: clientTelephone.trim() || undefined,
    clientEmail: clientEmail.trim() || undefined,
    lignes: lignes.map((l) => ({
      designation: l.designation.trim(),
      quantite: Number(l.quantite),
      prixUnitaireHT: Number(l.prixUnitaireHT),
      tauxTVA: Number(l.tauxTVA),
      totalHT: l.totalHT,
    })),
    timbreFiscal,
    montantHT,
    montantTVA,
    montantTTC,
  }), [numero, dateEmission, clientNom, clientMF, clientAdresse, clientTelephone, clientEmail, lignes, timbreFiscal, montantHT, montantTVA, montantTTC]);

  // ── Generate PDF Blob ──
  const generatePdfBlob = async (): Promise<Blob> => {
    const data = buildInvoiceData();
    const blob = await pdf(<InvoicePdfDocument data={data} company={companyInfo} />).toBlob();
    return blob;
  };

  // ── Preview ──
  const handlePreview = async () => {
    if (!validate()) return;
    setPreviewLoading(true);
    try {
      const blob = await generatePdfBlob();
      previewBlobRef.current = blob;
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setShowPreview(true);
    } catch (err) {
      setErrors({ general: "Erreur lors de la génération de l'aperçu PDF" });
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Final Creation ──
  const handleCreate = async () => {
    if (!validate()) {
      setShowPreview(false);
      return;
    }

    setSaving(true);
    setErrors({});

    try {
      const token = getToken();
      if (!token) throw new Error("Non authentifié");

      // 1. Generate PDF blob
      console.log('[DEBUG handleCreate] Generating PDF blob...');
      const blob = await generatePdfBlob();
      console.log('[DEBUG handleCreate] PDF blob size:', blob.size);

      // 2. Upload PDF to backend
      const formData = new FormData();
      formData.append(
        "file",
        blob,
        `facture-${numero.trim()}.pdf`
      );
      console.log('[DEBUG handleCreate] Uploading PDF to:', `${API_URL}/upload/single`);
      const uploadRes = await fetch(`${API_URL}/upload/single`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      console.log('[DEBUG handleCreate] Upload response status:', uploadRes.status);
      if (!uploadRes.ok) {
        const errBody = await readJsonResponse<{ error?: string }>(uploadRes, "Erreur d'upload du PDF");
        console.error('[DEBUG handleCreate] Upload failed:', errBody);
        throw new Error(errBody.error || "Erreur d'upload du PDF");
      }
      const uploadData = await readJsonResponse<{ url: string }>(uploadRes, "Réponse upload invalide");
      console.log('[DEBUG handleCreate] Upload success, url:', uploadData.url);
      const fichierPdf = uploadData.url;

      // 3. Create manual invoice & order in DB
      const data = buildInvoiceData();
      const invoicePayload = {
        utilisateurId: Number(utilisateurId),
        dateEmission: parseDate(data.dateEmission)?.toISOString() || new Date().toISOString(),
        clientNom: data.clientNom,
        clientMF: data.clientMF || null,
        clientAdresse: data.clientAdresse || null,
        clientTelephone: data.clientTelephone || null,
        clientEmail: data.clientEmail || null,
        timbreFiscal: Number(data.timbreFiscal),
        montantHT: Number(data.montantHT),
        montantTVA: Number(data.montantTVA),
        montantTTC: Number(data.montantTTC),
        montantEnLettres: montantEnLettres(data.montantTTC),
        fichierPdf,
        lignes: lignes.map((l) => ({
          produitId: Number(l.produitId),   // ← always a number
          designation: l.designation.trim(),
          quantite: Number(l.quantite),
          prixUnitaireHT: Number(l.prixUnitaireHT),
          tauxTVA: Number(l.tauxTVA),
        })),
      };

      const createRes = await fetch(`${API_URL}/invoices/admin/manual`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(invoicePayload),
      });

      if (!createRes.ok) {
        const errBody = await readJsonResponse<{ error?: string }>(createRes, "Erreur lors de la création de la facture");
        throw new Error(errBody.error || "Erreur lors de la création de la facture");
      }

      const result = await readJsonResponse<any>(createRes, "Réponse de création de facture invalide");
      console.log('[DEBUG handleCreate] Created invoice:', result);

      // ✅ Show immediate success alert
      alert(`✅ Facture N° ${result.numero} créée avec succès !\n\nLa commande N° ${result.commandeId?.toString().padStart(5, '0') ?? result.commande?.id?.toString().padStart(5, '0') ?? '?'} a également été générée automatiquement.`);

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrors({ general: err.message || "Erreur inattendue" });
    } finally {
      setSaving(false);
    }
  };

  // ── Cleanup preview URL ──
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-6">
      <div className="relative w-full max-w-5xl mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col border border-gray-200 dark:border-gray-800">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-emerald-700 to-emerald-600 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">
              Créer une Facture Manuelle
            </h2>
            <p className="text-emerald-100 text-sm mt-0.5">
              Génère une commande automatiquement à partir des informations de cette facture
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        {showPreview && previewUrl ? (
          /* ── PDF Preview ── */
          <div className="flex flex-col h-[80vh]">
            {(errors.general || errors.lignes?.length) && (
              <div className="border-b border-red-200 bg-red-50 p-3">
                {errors.general && <div className="text-sm text-red-700">{errors.general}</div>}
                {errors.lignes?.length ? (
                  <div className="mt-1 space-y-1 text-sm text-red-700">
                    {errors.lignes.map((err, i) => (
                      <div key={i}>{err}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200">
                Aperçu de la facture
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPreview(false);
                    if (previewUrl) {
                      URL.revokeObjectURL(previewUrl);
                      setPreviewUrl(null);
                    }
                  }}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  ← Retour à la modification
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-60 transition-colors flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Création...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Valider et Créer
                    </>
                  )}
                </button>
              </div>
            </div>
            <iframe
              src={previewUrl}
              className="flex-1 w-full"
              title="Aperçu PDF"
            />
          </div>
        ) : (
          /* ── Editor Form ── */
          <div className="p-6 space-y-7 overflow-y-auto max-h-[85vh]">
            {/* Success */}
            {successMsg && (
              <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {successMsg}
              </div>
            )}

            {/* General Errors */}
            {errors.general && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {errors.general}
              </div>
            )}

            {/* ── Client Selection & Invoice Meta ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
              {/* Client Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Client *
                </label>
                {clientsLoading ? (
                  <div className="text-sm text-gray-500">Chargement des clients...</div>
                ) : (
                  <select
                    value={utilisateurId}
                    onChange={(e) => handleClientChange(e.target.value)}
                    className={`w-full h-11 px-3 border rounded-xl bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      errors.utilisateurId ? "border-red-500" : "border-gray-300 dark:border-gray-700"
                    }`}
                  >
                    <option value="">-- Sélectionner un client --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom} {c.prenom} ({c.email})
                      </option>
                    ))}
                  </select>
                )}
                {errors.utilisateurId && (
                  <p className="text-red-500 text-xs mt-1">{errors.utilisateurId}</p>
                )}
              </div>

              {/* Invoice Number */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Numéro de Facture *
                </label>
                <input
                  type="text"
                  value="Attribué automatiquement à la création"
                  readOnly
                  className="w-full h-11 px-3 border rounded-xl bg-gray-50 dark:bg-gray-900 text-sm text-gray-500 border-gray-300 dark:border-gray-700"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Date d&apos;émission *
                </label>
                <input
                  type="text"
                  value={dateEmission}
                  onChange={(e) => setDateEmission(e.target.value)}
                  placeholder="DD/MM/YYYY"
                  className={`w-full h-11 px-3 border rounded-xl bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    errors.dateEmission ? "border-red-500" : "border-gray-300 dark:border-gray-700"
                  }`}
                />
                {errors.dateEmission && (
                  <p className="text-red-500 text-xs mt-1">{errors.dateEmission}</p>
                )}
              </div>
            </div>

            {/* ── Client Details (Editable) ── */}
            {utilisateurId && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-gray-800 pb-2">
                  Informations Client (Figées sur la facture)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nom du client *</label>
                    <input
                      type="text"
                      value={clientNom}
                      onChange={(e) => setClientNom(e.target.value)}
                      className="w-full h-10 px-3 border border-gray-300 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                    />
                    {errors.clientNom && <p className="text-red-500 text-xs mt-1">{errors.clientNom}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Matricule Fiscale</label>
                    <input
                      type="text"
                      value={clientMF}
                      onChange={(e) => setClientMF(e.target.value)}
                      className="w-full h-10 px-3 border border-gray-300 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 font-sans">Adresse</label>
                    <input
                      type="text"
                      value={clientAdresse}
                      onChange={(e) => setClientAdresse(e.target.value)}
                      className="w-full h-10 px-3 border border-gray-300 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Téléphone</label>
                    <input
                      type="text"
                      value={clientTelephone}
                      onChange={(e) => setClientTelephone(e.target.value)}
                      className="w-full h-10 px-3 border border-gray-300 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email</label>
                    <input
                      type="text"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="w-full h-10 px-3 border border-gray-300 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Invoice Lines ── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  Lignes de Facturation *
                </h3>
                <button
                  type="button"
                  onClick={addLine}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Ajouter une ligne
                </button>
              </div>

              {errors.lignes && errors.lignes.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 space-y-1">
                  {errors.lignes.map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </div>
              )}

              {lignes.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl text-gray-400 text-sm">
                  Aucune ligne facturée. Cliquez sur &quot;Ajouter une ligne&quot;.
                </div>
              ) : (
                <div className="space-y-4">
                  {lignes.map((line, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center bg-gray-50/50 dark:bg-gray-800/10 p-4 rounded-xl border border-gray-200 dark:border-gray-800"
                    >
                      {/* Product Selector */}
                      <div className="lg:col-span-3">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          Produit *
                        </label>
                        {productsLoading ? (
                          <div className="text-xs text-gray-500">Chargement...</div>
                        ) : (
                          <select
                            value={line.produitId}
                            onChange={(e) => updateLine(idx, "produitId", e.target.value)}
                            className="w-full h-10 px-3 border border-gray-300 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                          >
                            <option value="0">-- Choisir un produit --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nom} ({p.reference}) - {p.prix} DT
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Designation */}
                      <div className="lg:col-span-3">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          Désignation
                        </label>
                        <input
                          type="text"
                          value={line.designation}
                          onChange={(e) => updateLine(idx, "designation", e.target.value)}
                          className="w-full h-10 px-3 border border-gray-300 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                          placeholder="Nom de l'article"
                        />
                      </div>

                      {/* Quantite */}
                      <div className="lg:col-span-1">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          Qté
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={line.quantite}
                          onChange={(e) => updateLine(idx, "quantite", Math.max(1, Math.trunc(Number(e.target.value) || 1)))}
                          className="w-full h-10 px-3 border border-gray-300 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                        />
                      </div>

                      {/* Prix Unitaire HT */}
                      <div className="lg:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          PU HT (DT)
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          value={line.prixUnitaireHT}
                          onChange={(e) => updateLine(idx, "prixUnitaireHT", Number(e.target.value))}
                          className="w-full h-10 px-3 border border-gray-300 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                        />
                      </div>

                      {/* TVA */}
                      <div className="lg:col-span-1">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          TVA %
                        </label>
                        <select
                          value={line.tauxTVA}
                          onChange={(e) => updateLine(idx, "tauxTVA", Number(e.target.value))}
                          className="w-full h-10 px-3 border border-gray-300 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                        >
                          {companyTvaRates.map((rate) => <option key={rate} value={rate}>{rate}%</option>)}
                        </select>
                      </div>

                      {/* Total Line HT */}
                      <div className="lg:col-span-1 font-semibold text-gray-800 dark:text-gray-200 text-right pr-2">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 text-left">
                          Total HT
                        </span>
                        {line.totalHT.toFixed(3)}
                      </div>

                      {/* Actions */}
                      <div className="lg:col-span-1 text-center mt-4 lg:mt-0">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors inline-block"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Summary & Timbre Fiscal ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-100 dark:border-gray-800 pt-6">
              {/* Left: Timbre Fiscal */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Timbre Fiscal (DT)
                </label>
                <select
                  value={timbreFiscal}
                  onChange={(e) => setTimbreFiscal(Number(e.target.value))}
                  className={`w-32 h-11 px-3 border rounded-xl bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    errors.timbreFiscal ? "border-red-500" : "border-gray-300 dark:border-gray-700"
                  }`}
                >
                  {companyTimbreRates.map((rate) => <option key={rate} value={rate}>{rate.toFixed(3)} DT</option>)}
                </select>
                {errors.timbreFiscal && (
                  <p className="text-red-500 text-xs mt-1">{errors.timbreFiscal}</p>
                )}
              </div>

              {/* Right: Calculations */}
              <div className="bg-gray-50 dark:bg-gray-800/20 p-5 rounded-2xl border border-gray-200 dark:border-gray-800/80 space-y-3.5">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Total HT :</span>
                  <span className="font-semibold tabular-nums text-gray-800 dark:text-gray-200">
                    {montantHT.toFixed(3)} DT
                  </span>
                </div>
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Total TVA :</span>
                  <span className="font-semibold tabular-nums text-gray-800 dark:text-gray-200">
                    {montantTVA.toFixed(3)} DT
                  </span>
                </div>
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Timbre Fiscal :</span>
                  <span className="font-semibold tabular-nums text-gray-800 dark:text-gray-200">
                    {timbreFiscal.toFixed(3)} DT
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-800 pt-3.5">
                  <span>Total TTC :</span>
                  <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                    {montantTTC.toFixed(3)} DT
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        {!showPreview && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 rounded-b-2xl">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handlePreview}
              disabled={previewLoading || saving}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-60 transition-colors flex items-center gap-2"
            >
              {previewLoading ? "Génération..." : "Aperçu de la Facture"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
