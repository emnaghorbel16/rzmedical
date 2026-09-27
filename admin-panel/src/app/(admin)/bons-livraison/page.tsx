"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getApiUrl } from "@/utils/api";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

const API_URL = getApiUrl();

interface BonLivraison {
  id: number;
  code: string;
  commandeId?: number;
  utilisateurId?: number;
  clientNom?: string;
  clientMF?: string;
  clientAdresse?: string;
  clientTel?: string;
  clientEmail?: string;
  utilisateur?: { id: number; nom: string; prenom: string; email: string };
  dateLivraison?: string;
  statut: string;
  commentaire?: string;
  creeLe: string;
  lignes: { id: number; designation: string; quantiteLivree: number; prixUnitaireHT: number; tauxTVA: number }[];
  factures: { id: number; numero: string; statut: string }[];
}

const statutConfig: Record<string, { label: string; cls: string }> = {
  BROUILLON: { label: "Brouillon", cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  PREPARE: { label: "Préparé", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  EXPEDIE: { label: "Expédié", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
  LIVRE: { label: "Livré", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  FACTURE: { label: "Facturé", cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  ANNULE: { label: "Annulé", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

// ─── Facture rapide modal ─────────────────────────────────────────────────────

function FacturerModal({ bl, onClose, onSuccess }: { bl: BonLivraison; onClose: () => void; onSuccess: () => void }) {
  const { getToken } = useAuth();
  const [numero, setNumero] = useState("");
  const [timbre, setTimbre] = useState(1);
  const [timbreRates, setTimbreRates] = useState<number[]>([]);
  const [timbreLoading, setTimbreLoading] = useState(true);
  const [dateEmission, setDateEmission] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getToken();
    fetch(`${API_URL}/invoices/admin/generate-number`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setNumero(d.numero))
      .catch(() => setNumero(`${new Date().getFullYear()}0001`));
  }, [getToken]);

  useEffect(() => {
    let active = true;

    fetch(`${API_URL}/company-info`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const rates = Array.isArray(data.valeursTimbre)
          ? data.valeursTimbre.map(Number).filter(Number.isFinite).sort((a: number, b: number) => a - b)
          : [];

        if (!active) return;
        setTimbreRates(rates);
        if (rates.length > 0) {
          setTimbre((current) => rates.includes(current) ? current : rates[0]);
        }
      })
      .catch(() => {
        if (active) setTimbreRates([]);
      })
      .finally(() => {
        if (active) setTimbreLoading(false);
      });

    return () => { active = false; };
  }, []);

  const handleFacturer = async () => {
    if (!numero.trim()) { setError("Numéro de facture requis"); return; }
    if (!timbreRates.includes(timbre)) {
      setError("Sélectionnez un timbre fiscal configuré.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/bons-livraison/admin/${bl.id}/facturer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ numero, timbreFiscal: Number(timbre), dateEmission }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Erreur"); }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const montantHT = bl.lignes.reduce((s, l) => s + l.quantiteLivree * Number(l.prixUnitaireHT), 0);
  const montantTVA = bl.lignes.reduce((s, l) => s + l.quantiteLivree * Number(l.prixUnitaireHT) * (Number(l.tauxTVA) / 100), 0);
  const montantTTC = montantHT + montantTVA + Number(timbre);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Facturer le BL</h3>
            <p className="text-xs text-gray-500 mt-0.5">{bl.code}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">N° Facture *</label>
            <input type="text" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" value={numero} onChange={e => setNumero(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date d'émission</label>
            <input type="date" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" value={dateEmission} onChange={e => setDateEmission(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Timbre Fiscal configuré (TND)</label>
            <select
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
              value={timbre}
              disabled={timbreLoading || timbreRates.length === 0}
              onChange={e => setTimbre(Number(e.target.value))}
            >
              {timbreRates.length === 0 ? (
                <option value={timbre}>{timbreLoading ? "Chargement des valeurs..." : "Aucun timbre configuré"}</option>
              ) : (
                timbreRates.map(rate => <option key={rate} value={rate}>{rate.toFixed(3)} TND</option>)
              )}
            </select>
          </div>

          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Total HT</span><span>{montantHT.toFixed(3)} TND</span></div>
            <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Total TVA</span><span>{montantTVA.toFixed(3)} TND</span></div>
            <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Timbre</span><span>{Number(timbre).toFixed(3)} TND</span></div>
            <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700 pt-1 mt-1"><span>Total TTC</span><span>{montantTTC.toFixed(3)} TND</span></div>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
          <button onClick={handleFacturer} disabled={saving || timbreLoading || timbreRates.length === 0} className="flex-1 px-4 py-2 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-semibold rounded-lg text-sm">
            {saving ? "Facturation..." : timbreLoading ? "Chargement..." : "Créer la facture"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit BL Modal ────────────────────────────────────────────────────────────

function EditBLModal({ bl, onClose, onSuccess }: { bl: BonLivraison; onClose: () => void; onSuccess: () => void }) {
  const { getToken } = useAuth();
  const [statut, setStatut] = useState(bl.statut);
  const [clientNom, setClientNom] = useState(bl.clientNom || "");
  const [clientMF, setClientMF] = useState(bl.clientMF || "");
  const [clientAdresse, setClientAdresse] = useState(bl.clientAdresse || "");
  const [clientTel, setClientTel] = useState(bl.clientTel || "");
  const [clientEmail, setClientEmail] = useState(bl.clientEmail || "");
  const [commentaire, setCommentaire] = useState(bl.commentaire || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/bons-livraison/admin/${bl.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ statut, clientNom: clientNom || undefined, clientMF: clientMF || undefined, clientAdresse: clientAdresse || undefined, clientTel: clientTel || undefined, clientEmail: clientEmail || undefined, commentaire: commentaire || undefined }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Erreur"); }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Modifier le BL</h3>
            <p className="text-xs text-gray-500 mt-0.5">{bl.code}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

          {/* Statut */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Statut</label>
            <select className={inputCls} value={statut} onChange={e => setStatut(e.target.value)}>
              <option value="BROUILLON">Brouillon</option>
              <option value="PREPARE">Préparé</option>
              <option value="EXPEDIE">Expédié</option>
              <option value="LIVRE">Livré</option>
              <option value="ANNULE">Annulé</option>
            </select>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Informations client</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nom client</label>
                <input className={inputCls} value={clientNom} onChange={e => setClientNom(e.target.value)} placeholder="Nom complet" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Matricule Fiscal</label>
                <input className={inputCls} value={clientMF} onChange={e => setClientMF(e.target.value)} placeholder="MF" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Téléphone</label>
                <input className={inputCls} value={clientTel} onChange={e => setClientTel(e.target.value)} placeholder="+216..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label>
                <input className={inputCls} type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="email@..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Adresse</label>
                <input className={inputCls} value={clientAdresse} onChange={e => setClientAdresse(e.target.value)} placeholder="Adresse" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Commentaire</label>
            <textarea className={inputCls} rows={3} value={commentaire} onChange={e => setCommentaire(e.target.value)} placeholder="Notes, observations..." />
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-semibold rounded-lg text-sm">
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edition Dropdown ─────────────────────────────────────────────────────────

function EditionMenu({ bl, onRefresh }: { bl: BonLivraison; onRefresh: () => void }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showFacturer, setShowFacturer] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const updateStatut = async (newStatut: string) => {
    setOpen(false);
    try {
      const token = getToken();
      await fetch(`${API_URL}/bons-livraison/admin/${bl.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ statut: newStatut }),
      });
      onRefresh();
    } catch { }
  };

  const handleDelete = async () => {
    setOpen(false);
    if (!confirm(`Supprimer le bon de livraison ${bl.code} ? La commande et tous les documents associés seront également supprimés.`)) return;
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/bons-livraison/admin/${bl.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Erreur lors de la suppression");
        return;
      }
      onRefresh();
    } catch {
      alert("Erreur lors de la suppression");
    }
  };

  const handleDownloadPdf = async () => {
    setOpen(false);
    setDownloading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/bons-livraison/admin/${bl.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { alert("Erreur lors du téléchargement"); return; }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${bl.code}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch { alert("Erreur lors du téléchargement"); }
    finally { setDownloading(false); }
  };

  const isFacture = bl.statut === "FACTURE";
  const isAnnule = bl.statut === "ANNULE";

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(v => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
        >
          Edition
          <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 py-1.5 text-sm">
            {/* Payée */}
            <button
              onClick={() => { setOpen(false); updateStatut("LIVRE"); }}
              disabled={bl.statut === "LIVRE" || isFacture || isAnnule}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span>✓</span> Marquer Livré
            </button>

            <div className="border-t border-gray-100 dark:border-gray-700 my-1" />

            {/* Consulter */}
            <button
              onClick={() => { setOpen(false); router.push(`/bons-livraison/${bl.id}`); }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <span>🔍</span> Consulter
            </button>

            {/* Modifier */}
            <button
              onClick={() => { setOpen(false); setShowEdit(true); }}
              disabled={isAnnule}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span>✏️</span> Modifier
            </button>

            {/* Facturer */}
            <button
              onClick={() => { setOpen(false); setShowFacturer(true); }}
              disabled={isFacture || isAnnule}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span>🧾</span> Facturer
            </button>

            <div className="border-t border-gray-100 dark:border-gray-700 my-1" />

            {/* Télécharger PDF */}
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-60 transition-colors"
            >
              <span>{downloading ? "⏳" : "📄"}</span>
              {downloading ? "Génération..." : "Télécharger PDF"}
            </button>

            <div className="border-t border-gray-100 dark:border-gray-700 my-1" />

            {/* Supprimer */}
            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <span>🗑</span> Supprimer
            </button>
          </div>
        )}
      </div>

      {/* Modal Facturer */}
      {showFacturer && (
        <FacturerModal
          bl={bl}
          onClose={() => setShowFacturer(false)}
          onSuccess={onRefresh}
        />
      )}

      {/* Modal Modifier */}
      {showEdit && (
        <EditBLModal
          bl={bl}
          onClose={() => setShowEdit(false)}
          onSuccess={onRefresh}
        />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BonsLivraisonPage() {
  const { getToken } = useAuth();
  const [bls, setBls] = useState<BonLivraison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchBLs = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/bons-livraison/admin`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBls(await res.json());
      else throw new Error("Erreur de chargement");
    } catch {
      setError("Impossible de charger les bons de livraison");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { fetchBLs(); }, [fetchBLs]);

  // Stats calculations
  const filteredBls = bls.filter(b => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const clientName = (b.clientNom || (b.utilisateur ? `${b.utilisateur.nom || ""} ${b.utilisateur.prenom || ""}`.trim() : "")).toLowerCase();
    return b.code.toLowerCase().includes(q) || clientName.includes(q);
  });

  const validBLs = filteredBls.filter(b => b.statut !== "ANNULEE");
  const totalBLsTTC = validBLs.reduce(
    (acc, bonLivraison) => acc + bonLivraison.lignes.reduce(
      (total, ligne) => total + Number(ligne.quantiteLivree) * Number(ligne.prixUnitaireHT) * (1 + Number(ligne.tauxTVA) / 100),
      0,
    ),
    0,
  );
  const facturesCount = validBLs.filter((bonLivraison) => bonLivraison.factures.length > 0).length;

  return (
    <div className="box-border mx-auto flex h-[calc(100dvh-8rem)] w-full min-w-0 max-w-7xl min-h-0 flex-col gap-3 overflow-hidden p-4">
      <div className="mb-1">
        <PageBreadcrumb pageTitle="Bons de Livraison" />
      </div>

      {/* Stats Cards */}
      <div className="shrink-0 grid grid-cols-2 md:grid-cols-3 gap-2 mb-1">
        {[
          { label: "Total BL (Actifs)", value: validBLs.length, isCurrency: false },
          { label: "Montant Total TTC", value: Number(totalBLsTTC).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }), isCurrency: true },
          { label: "BL Facturés", value: facturesCount, isCurrency: false, cls: "text-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-2 shadow-sm">
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">{s.label}</p>
            <p className={`text-base font-bold ${s.cls ?? "text-gray-800 dark:text-white"}`}>
              {s.value} {s.isCurrency ? "TND" : ""}
            </p>
          </div>
        ))}
      </div>

      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Bons de Livraison</h2>
          <p className="text-xs text-gray-500 mt-0.5">{filteredBls.length} bon(s) de livraison</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Rechercher code, client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <Link
            href="/invoices/new"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-700 hover:bg-amber-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors shadow-sm whitespace-nowrap"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nouveau BL / Facture
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-200">{error}</div>
      )}

      <div className="min-h-0 w-full min-w-0 flex-1 basis-0 rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="h-full w-full min-w-0 overflow-auto overscroll-contain">
          <table className="min-w-[1400px] w-full table-fixed text-left text-sm text-gray-600 dark:text-gray-400">
            <thead className="sticky top-0 z-10 bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Référence</th>
                <th className="px-5 py-3.5 font-semibold">Date</th>
                <th className="px-5 py-3.5 font-semibold">Client</th>
                <th className="px-5 py-3.5 font-semibold">Commande / BS</th>
                <th className="px-5 py-3.5 font-semibold">Factures</th>
                <th className="px-5 py-3.5 font-semibold text-center">Statut</th>
                <th className="px-5 py-3.5 font-semibold text-right">Edition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400">Chargement...</td></tr>
              ) : filteredBls.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400">Aucun bon de livraison trouvé.</td></tr>
              ) : (
                filteredBls.map((bl) => {
                  const clientName = bl.clientNom || (bl.utilisateur ? `${bl.utilisateur.nom || ""} ${bl.utilisateur.prenom || ""}`.trim() : "—");
                  const sCfg = statutConfig[bl.statut] ?? { label: bl.statut, cls: "bg-gray-100 text-gray-600" };
                  return (
                    <tr key={bl.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-gray-900 dark:text-white">{bl.code}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-gray-500">
                        {new Date(bl.creeLe).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700 dark:text-gray-300 max-w-[160px] truncate">{clientName}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          {bl.commandeId ? (
                            <Link href={`/orders/${bl.commandeId}`} className="text-amber-700 hover:underline font-medium text-xs">
                              CMD-{bl.commandeId.toString().padStart(5, "0")}
                            </Link>
                          ) : null}
                          {(bl as any).bonSortie ? (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-medium w-fit">
                              {(bl as any).bonSortie.code}
                            </span>
                          ) : null}
                          {(bl as any).commercial ? (
                            <span className="text-xs text-gray-500">{(bl as any).commercial.prenom} {(bl as any).commercial.nom}</span>
                          ) : null}
                          {!bl.commandeId && !(bl as any).bonSortie && (
                            <span className="text-gray-400 italic text-xs">Aucune</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {bl.factures.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {bl.factures.map(f => (
                              <span key={f.id} className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-medium">
                                {f.numero}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${sCfg.cls}`}>
                          {sCfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <EditionMenu bl={bl} onRefresh={fetchBLs} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
