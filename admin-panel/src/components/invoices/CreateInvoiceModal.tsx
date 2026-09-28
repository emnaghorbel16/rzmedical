"use client";

import React, { useState, useEffect, useRef } from "react";
import { getApiUrl } from "@/utils/api";
import { useAuth } from "@/hooks/useAuth";

const API_URL = getApiUrl();

interface CreateInvoiceModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateInvoiceModal({ onClose, onSuccess }: CreateInvoiceModalProps) {
  const { getToken } = useAuth();
  
  // Step 1: Type
  const [typeFacture, setTypeFacture] = useState<"PRODUITS" | "BON_LIVRAISON" | "SERVICE" | null>(null);
  const [step, setStep] = useState(1);

  // Common Form
  const [numero, setNumero] = useState("");
  const [dateEmission, setDateEmission] = useState(new Date().toISOString().split("T")[0]);
  const [timbreFiscal, setTimbreFiscal] = useState(1.000);
  const [clientNom, setClientNom] = useState("");
  const [clientMF, setClientMF] = useState("");
  const [clientAdresse, setClientAdresse] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  
  // Products/Services Lines
  const [lignes, setLignes] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [allServices, setAllServices] = useState<any[]>([]);
  const [allBLs, setAllBLs] = useState<any[]>([]);
  const [selectedBLId, setSelectedBLId] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchNumber = async () => {
      try {
        const token = getToken();
        const res = await fetch(`${API_URL}/invoices/admin/generate-number`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setNumero(data.numero);
        }
      } catch (err) {}
    };
    fetchNumber();
  }, [getToken]);

  useEffect(() => {
    if (typeFacture === "PRODUITS") {
      fetch(`${API_URL}/products`).then(r => r.json()).then(setAllProducts).catch(()=>console.log);
    } else if (typeFacture === "SERVICE") {
      const token = getToken();
      fetch(`${API_URL}/services`, { headers: { Authorization: `Bearer ${token}` }})
        .then(r => r.json()).then(setAllServices).catch(()=>console.log);
    } else if (typeFacture === "BON_LIVRAISON") {
      const token = getToken();
      fetch(`${API_URL}/bons-livraison/admin`, { headers: { Authorization: `Bearer ${token}` }})
        .then(r => r.json()).then(data => {
          // Only show BLs that are not cancelled and not invoiced
          setAllBLs(data.filter((b: any) => b.statut !== "FACTURE" && b.statut !== "ANNULE"));
        }).catch(()=>console.log);
    }
  }, [typeFacture, getToken]);

  const handleBLSelection = (blId: number) => {
    const bl = allBLs.find(b => b.id === blId);
    if (!bl) return;
    setSelectedBLId(bl.id);
    setClientNom(bl.clientNom || (bl.utilisateur ? `${bl.utilisateur.nom} ${bl.utilisateur.prenom}` : ""));
    setClientMF(bl.clientMF || (bl.utilisateur?.matriculeFiscale) || "");
    setClientAdresse(bl.clientAdresse || (bl.utilisateur?.adresse) || "");
    setClientEmail(bl.clientEmail || (bl.utilisateur?.email) || "");
    
    // Auto-fill lines
    setLignes(bl.lignes.map((l: any) => ({
      designation: l.designation,
      quantite: l.quantiteLivree,
      prixUnitaireHT: Number(l.prixUnitaireHT),
      tauxTVA: Number(l.tauxTVA)
    })));
  };

  const addLine = () => {
    setLignes([...lignes, { produitId: null, designation: "", quantite: 1, prixUnitaireHT: 0, tauxTVA: 19 }]);
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLignes = [...lignes];
    newLignes[index][field] = value;
    
    if (typeFacture === "PRODUITS" && field === "produitId") {
      const pId = Number(value);
      const prod = allProducts.find(p => p.id === pId);
      if (prod) {
        newLignes[index].designation = prod.nom;
        const remise = Number(prod.remise) || 0;
        newLignes[index].tauxTVA = Number(prod.tva) || 19;
        newLignes[index].prixUnitaireHT = Math.round(((Number(prod.prix) / (1 + newLignes[index].tauxTVA / 100)) * (1 - remise/100)) * 1000) / 1000;
      }
    } else if (typeFacture === "SERVICE" && field === "serviceId") {
      const sId = Number(value);
      const serv = allServices.find(s => s.id === sId);
      if (serv) {
        newLignes[index].designation = serv.label;
      }
    }
    
    setLignes(newLignes);
  };

  const removeLine = (index: number) => {
    const newLignes = [...lignes];
    newLignes.splice(index, 1);
    setLignes(newLignes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numero || !clientNom) {
      setError("Le numéro et le nom du client sont obligatoires.");
      return;
    }
    if (lignes.length === 0) {
      setError("La facture doit contenir au moins une ligne.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const token = getToken();
      if (typeFacture === "BON_LIVRAISON" && selectedBLId) {
        // Use facturerBL endpoint
        const res = await fetch(`${API_URL}/bons-livraison/admin/${selectedBLId}/facturer`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            numero,
            dateEmission,
            timbreFiscal
          })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Erreur lors de la facturation du BL");
        }
      } else {
        // Use manual invoice endpoint
        const res = await fetch(`${API_URL}/invoices/admin/manual`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            numero,
            dateEmission,
            clientNom,
            clientMF,
            clientAdresse,
            clientEmail,
            timbreFiscal,
            typeFacture,
            lignes: lignes.map(l => ({
              produitId: l.produitId,
              designation: l.designation,
              quantite: Number(l.quantite),
              prixUnitaireHT: Number(l.prixUnitaireHT),
              tauxTVA: Number(l.tauxTVA)
            }))
          })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Erreur lors de la création de la facture");
        }
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const montantHT = lignes.reduce((acc, l) => acc + (Number(l.quantite) * Number(l.prixUnitaireHT)), 0);
  const montantTVA = lignes.reduce((acc, l) => acc + (Number(l.quantite) * Number(l.prixUnitaireHT) * (Number(l.tauxTVA)/100)), 0);
  const montantTTC = montantHT + montantTVA + Number(timbreFiscal);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Créer une facture</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-6 text-center">Que souhaitez-vous facturer ?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={() => { setTypeFacture("PRODUITS"); setStep(2); addLine(); }}
                  className="p-6 rounded-xl border-2 border-gray-200 hover:border-brand-500 hover:bg-brand-50 dark:border-gray-700 dark:hover:bg-gray-800 transition-all flex flex-col items-center gap-3 text-center"
                >
                  <span className="text-3xl">📦</span>
                  <span className="font-semibold text-gray-900 dark:text-white">Vente de produits</span>
                  <span className="text-xs text-gray-500">Créer une facture libre avec des produits du catalogue</span>
                </button>
                
                <button
                  onClick={() => { setTypeFacture("BON_LIVRAISON"); setStep(2); }}
                  className="p-6 rounded-xl border-2 border-gray-200 hover:border-brand-500 hover:bg-brand-50 dark:border-gray-700 dark:hover:bg-gray-800 transition-all flex flex-col items-center gap-3 text-center"
                >
                  <span className="text-3xl">🚚</span>
                  <span className="font-semibold text-gray-900 dark:text-white">Bon de livraison</span>
                  <span className="text-xs text-gray-500">Facturer un bon de livraison existant</span>
                </button>
                
                <button
                  onClick={() => { setTypeFacture("SERVICE"); setStep(2); addLine(); }}
                  className="p-6 rounded-xl border-2 border-gray-200 hover:border-brand-500 hover:bg-brand-50 dark:border-gray-700 dark:hover:bg-gray-800 transition-all flex flex-col items-center gap-3 text-center"
                >
                  <span className="text-3xl">🔧</span>
                  <span className="font-semibold text-gray-900 dark:text-white">Prestation de service</span>
                  <span className="text-xs text-gray-500">Facturer une réparation, livraison ou autre service</span>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <form id="invoice-form" onSubmit={handleSubmit} className="space-y-6">
              {/* Infos générales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">N° Facture *</label>
                  <input required type="text" value={numero} onChange={e => setNumero(e.target.value)} className="w-full border rounded-lg p-2 dark:bg-gray-800 dark:border-gray-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date *</label>
                  <input required type="date" value={dateEmission} onChange={e => setDateEmission(e.target.value)} className="w-full border rounded-lg p-2 dark:bg-gray-800 dark:border-gray-700" />
                </div>
              </div>

              {/* Source-specific */}
              {typeFacture === "BON_LIVRAISON" && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                  <label className="block text-sm font-medium mb-1">Sélectionner un Bon de Livraison *</label>
                  <select 
                    required 
                    className="w-full border rounded-lg p-2 dark:bg-gray-800 dark:border-gray-700"
                    onChange={(e) => handleBLSelection(Number(e.target.value))}
                    value={selectedBLId || ""}
                  >
                    <option value="" disabled>Choisir un BL...</option>
                    {allBLs.map(bl => (
                      <option key={bl.id} value={bl.id}>
                        {bl.code} - {bl.clientNom || (bl.utilisateur ? `${bl.utilisateur.nom} ${bl.utilisateur.prenom}` : "Client Inconnu")}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Client Info */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg space-y-4">
                <h4 className="font-semibold text-sm uppercase text-gray-500">Informations Client (Passager)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nom du client *</label>
                    <input required type="text" value={clientNom} onChange={e => setClientNom(e.target.value)} className="w-full border rounded-lg p-2 dark:bg-gray-800 dark:border-gray-700" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Matricule Fiscal</label>
                    <input type="text" value={clientMF} onChange={e => setClientMF(e.target.value)} className="w-full border rounded-lg p-2 dark:bg-gray-800 dark:border-gray-700" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Adresse</label>
                    <input type="text" value={clientAdresse} onChange={e => setClientAdresse(e.target.value)} className="w-full border rounded-lg p-2 dark:bg-gray-800 dark:border-gray-700" />
                  </div>
                </div>
              </div>

              {/* Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm uppercase text-gray-500">Détails de la facture</h4>
                  {typeFacture !== "BON_LIVRAISON" && (
                    <button type="button" onClick={addLine} className="text-sm text-brand-600 font-medium hover:underline">
                      + Ajouter une ligne
                    </button>
                  )}
                </div>
                
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="p-2">Désignation</th>
                        <th className="p-2 w-20 text-center">Qté</th>
                        <th className="p-2 w-28 text-right">PU HT</th>
                        <th className="p-2 w-20 text-center">TVA %</th>
                        <th className="p-2 w-28 text-right">Total HT</th>
                        {typeFacture !== "BON_LIVRAISON" && <th className="p-2 w-10"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {lignes.map((l, idx) => (
                        <tr key={idx}>
                          <td className="p-2">
                            {typeFacture === "PRODUITS" ? (
                              <select 
                                value={l.produitId || ""} 
                                onChange={e => updateLine(idx, "produitId", e.target.value)}
                                className="w-full border rounded p-1 mb-1 dark:bg-gray-700 dark:border-gray-600"
                              >
                                <option value="">Sélectionner un produit...</option>
                                {allProducts.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                              </select>
                            ) : typeFacture === "SERVICE" ? (
                              <select 
                                value={l.serviceId || ""} 
                                onChange={e => updateLine(idx, "serviceId", e.target.value)}
                                className="w-full border rounded p-1 mb-1 dark:bg-gray-700 dark:border-gray-600"
                              >
                                <option value="">Sélectionner un service...</option>
                                {allServices.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                              </select>
                            ) : null}
                            <input
                              type="text"
                              required
                              value={l.designation}
                              onChange={e => updateLine(idx, "designation", e.target.value)}
                              placeholder="Description libre"
                              className="w-full border rounded p-1 text-xs dark:bg-gray-700 dark:border-gray-600"
                              readOnly={typeFacture === "BON_LIVRAISON"}
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="number" required min="0.001" step="0.001" 
                              value={l.quantite} 
                              onChange={e => updateLine(idx, "quantite", e.target.value)}
                              className="w-full border rounded p-1 text-center dark:bg-gray-700 dark:border-gray-600"
                              readOnly={typeFacture === "BON_LIVRAISON"}
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="number" required min="0" step="0.001" 
                              value={l.prixUnitaireHT} 
                              onChange={e => updateLine(idx, "prixUnitaireHT", e.target.value)}
                              className="w-full border rounded p-1 text-right dark:bg-gray-700 dark:border-gray-600"
                              readOnly={typeFacture === "BON_LIVRAISON"}
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="number" required min="0" step="0.1" 
                              value={l.tauxTVA} 
                              onChange={e => updateLine(idx, "tauxTVA", e.target.value)}
                              className="w-full border rounded p-1 text-center dark:bg-gray-700 dark:border-gray-600"
                              readOnly={typeFacture === "BON_LIVRAISON"}
                            />
                          </td>
                          <td className="p-2 text-right font-medium">
                            {(Number(l.quantite) * Number(l.prixUnitaireHT)).toFixed(3)}
                          </td>
                          {typeFacture !== "BON_LIVRAISON" && (
                            <td className="p-2 text-center">
                              <button type="button" onClick={() => removeLine(idx)} className="text-red-500 hover:text-red-700 text-lg">×</button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2 text-sm bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <div className="flex justify-between"><span>Total HT</span><span>{montantHT.toFixed(3)} TND</span></div>
                  <div className="flex justify-between"><span>Total TVA</span><span>{montantTVA.toFixed(3)} TND</span></div>
                  <div className="flex justify-between items-center">
                    <span>Timbre Fiscal</span>
                    <input type="number" step="0.001" value={timbreFiscal} onChange={e => setTimbreFiscal(Number(e.target.value))} className="w-20 text-right border rounded p-1 text-xs dark:bg-gray-700 dark:border-gray-600" />
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-300 dark:border-gray-600">
                    <span>Total TTC</span><span className="text-brand-600 dark:text-brand-400">{montantTTC.toFixed(3)} TND</span>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 flex justify-end gap-3">
          {step === 2 && (
            <button
              onClick={() => { setStep(1); setTypeFacture(null); }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              Précédent
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            Annuler
          </button>
          {step === 2 && (
            <button
              type="submit"
              form="invoice-form"
              disabled={saving}
              className="px-6 py-2 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? "Création..." : "Créer la facture"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
