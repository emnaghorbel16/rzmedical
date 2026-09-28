"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getApiUrl } from "@/utils/api";
import { useAuth } from "@/hooks/useAuth";
import CustomDatePicker from "@/components/invoices/CustomDatePicker";
import SearchableSelect from "@/components/invoices/SearchableSelect";

const API_URL = getApiUrl();

export interface DevisEditProps {
  devis?: any; // si présent => modification, sinon création
  onClose: () => void;
  onSuccess: (savedDevis: any) => void;
}

interface DevisLineItem {
  produitId?: number;
  serviceId?: number;
  designation: string;
  quantite: number;
  prixUnitaireHT: number;
  remise: number;
  tauxTVA: number;
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;
const todayISO = () => new Date().toISOString().split("T")[0];

export default function DevisFormModal({
  devis,
  onClose,
  onSuccess,
}: DevisEditProps) {
  const { getToken } = useAuth();
  const isEdit = !!devis;

  // General fields
  const [numero, setNumero] = useState(devis?.numero || "");
  const [dateDevis, setDateDevis] = useState(
    devis?.dateDevis ? devis.dateDevis.split("T")[0] : todayISO()
  );
  const [dateValidite, setDateValidite] = useState(
    devis?.dateValidite ? devis.dateValidite.split("T")[0] : ""
  );
  const [statut, setStatut] = useState(devis?.statut || "BROUILLON");
  const [etat, setEtat] = useState(devis?.etat || "NORMAL");
  const [typeDevis, setTypeDevis] = useState(devis?.typeDevis || "PRODUITS");
  const [devise, setDevise] = useState(devis?.devise || "TND");

  // Client info
  const [selectedClientId, setSelectedClientId] = useState<number | "">(
    devis?.utilisateurId || ""
  );
  const [clientNom, setClientNom] = useState(devis?.clientNom || "");
  const [clientMF, setClientMF] = useState(devis?.clientMF || "");
  const [clientAdresse, setClientAdresse] = useState(devis?.clientAdresse || "");
  const [clientTelephone, setClientTelephone] = useState(devis?.clientTelephone || "");
  const [clientEmail, setClientEmail] = useState(devis?.clientEmail || "");

  // Financials
  const [timbreFiscal, setTimbreFiscal] = useState<number>(
    devis?.timbreFiscal !== undefined ? Number(devis.timbreFiscal) : 1.0
  );
  const [commentaire, setCommentaire] = useState(devis?.commentaire || "");

  // Lines
  const [lignes, setLignes] = useState<DevisLineItem[]>(() => {
    if (devis?.lignes && devis.lignes.length > 0) {
      return devis.lignes.map((l: any) => ({
        produitId: l.produitId,
        serviceId: l.serviceId,
        designation: l.designation,
        quantite: Number(l.quantite) || 1,
        prixUnitaireHT: Number(l.prixUnitaireHT) || 0,
        remise: Number(l.remise) || 0,
        tauxTVA: Number(l.tauxTVA) || 19,
      }));
    }
    return [
      {
        designation: "",
        quantite: 1,
        prixUnitaireHT: 0,
        remise: 0,
        tauxTVA: 19,
      },
    ];
  });

  // Catalogs
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [companyTvaRates, setCompanyTvaRates] = useState<number[]>([0, 7, 13, 19]);
  const [companyTimbreRates, setCompanyTimbreRates] = useState<number[]>([0, 1]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Fetch initial data
  useEffect(() => {
    const token = getToken();
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${API_URL}/clients`, { headers })
      .then((r) => r.json())
      .then(setClients)
      .catch(console.error);

    fetch(`${API_URL}/products`)
      .then((r) => r.json())
      .then(setProducts)
      .catch(console.error);

    fetch(`${API_URL}/services`, { headers })
      .then((r) => r.json())
      .then(setServices)
      .catch(console.error);

    fetch(`${API_URL}/company-info`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.valeursTva) && data.valeursTva.length > 0) {
          setCompanyTvaRates(data.valeursTva.map(Number).sort((a: number, b: number) => a - b));
        }
        if (Array.isArray(data.valeursTimbre) && data.valeursTimbre.length > 0) {
          setCompanyTimbreRates(data.valeursTimbre.map(Number).sort((a: number, b: number) => a - b));
        }
        if (!isEdit && data.timbreFiscal != null) {
          setTimbreFiscal(Number(data.timbreFiscal));
        }
      })
      .catch(console.error);

  }, [getToken, isEdit]);

  // Options for searchable select
  const clientOptions = useMemo(() => {
    return clients.map((c) => ({
      value: c.id,
      label: `${c.nom || ""} ${c.prenom || ""}`.trim() || c.email,
      sublabel: [c.telephone, c.matriculeFiscale, c.email].filter(Boolean).join(" • "),
    }));
  }, [clients]);

  const productOptions = useMemo(() => {
    return products.map((p) => ({
      value: p.id,
      label: p.nom,
      sublabel: `Réf: ${p.reference} • P.U: ${Number(p.prix).toFixed(3)} TND • TVA: ${p.tva}%`,
    }));
  }, [products]);

  const serviceOptions = useMemo(() => {
    return services.filter((s) => s.actif).map((s) => ({
      value: s.id,
      label: s.label,
    }));
  }, [services]);

  const handleClientChange = (clientId: number | "") => {
    setSelectedClientId(clientId);
    if (!clientId) {
      setClientNom("");
      setClientMF("");
      setClientAdresse("");
      setClientTelephone("");
      setClientEmail("");
      return;
    }
    const c = clients.find((x) => x.id === Number(clientId));
    if (c) {
      setClientNom(`${c.nom || ""} ${c.prenom || ""}`.trim());
      setClientMF(c.matriculeFiscale || "");
      setClientAdresse(c.adresse || "");
      setClientTelephone(c.telephone || "");
      setClientEmail(c.email || "");
    }
  };

  // Line operations
  const addLine = () => {
    setLignes((prev) => [
      ...prev,
      {
        designation: "",
        quantite: 1,
        prixUnitaireHT: 0,
        remise: 0,
        tauxTVA: 19,
      },
    ]);
  };

  const removeLine = (idx: number) => {
    if (lignes.length <= 1) {
      alert("Le devis doit comporter au moins une ligne.");
      return;
    }
    setLignes((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof DevisLineItem, val: any) => {
    setLignes((prev) => {
      const next = [...prev];
      const item = { ...next[idx], [field]: val };

      if (field === "produitId" && typeDevis === "PRODUITS") {
        const prod = products.find((p) => p.id === Number(val));
        if (prod) {
          item.designation = prod.nom;
          item.tauxTVA = Number(prod.tva) || ;
          item.prixUnitaireHT = Math.round((Number(prod.prix) / (1 + item.tauxTVA / 100)) * 1000) / 1000 || 0;
          item.remise = Number(prod.remise) || 0;
        }
      }
      if (field === "serviceId" && typeDevis === "SERVICE") {
        const svc = services.find((s) => s.id === Number(val));
        if (svc) item.designation = svc.label;
      }

      next[idx] = item;
      return next;
    });
  };

  // Calcul inverse : modifier le Total TTC calcule le Prix HT
  const updateLineTTC = (idx: number, newTotalTTC: number) => {
    setLignes((prev) => {
      const next = [...prev];
      const line = { ...next[idx] };
      const qte = Number(line.quantite) || 1;
      const remise = Number(line.remise) || 0;
      const tva = Number(line.tauxTVA) || 0;

      const tvaFactor = 1 + tva / 100;
      const remiseFactor = 1 - remise / 100;
      const denominator = tvaFactor * (remiseFactor > 0 ? remiseFactor : 1) * (qte > 0 ? qte : 1);

      if (denominator > 0) {
        line.prixUnitaireHT = round3(newTotalTTC / denominator);
      }
      next[idx] = line;
      return next;
    });
  };

  // Calculations
  const computedLines = lignes.map((l) => {
    const qte = Number(l.quantite) || 1;
    const pu = Number(l.prixUnitaireHT) || 0;
    const rem = Number(l.remise) || 0;
    const tva = Number(l.tauxTVA) || 0;

    const brutHT = round3(qte * pu);
    const puApresRemise = round3(pu * (1 - rem / 100));
    const netHT = round3(qte * puApresRemise);
    const totalTTC = round3(netHT * (1 + tva / 100));

    return {
      ...l,
      brutHT,
      puApresRemise,
      netHT,
      totalTTC,
    };
  });

  const totalHTBrut = round3(computedLines.reduce((s, l) => s + l.brutHT, 0));
  const totalRemise = round3(computedLines.reduce((s, l) => s + (l.brutHT - l.netHT), 0));
  const totalHTNet = round3(totalHTBrut - totalRemise);
  const totalTVA = round3(
    computedLines.reduce((s, l) => s + round3(l.netHT * (Number(l.tauxTVA) / 100)), 0)
  );
  const totalTTC = round3(totalHTNet + totalTVA + Number(timbreFiscal || 0));

  const fmt = (n: number) =>
    Number(n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  // Save handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientNom.trim()) {
      setError("Le nom du client est requis.");
      return;
    }
    for (let i = 0; i < lignes.length; i++) {
      if (!lignes[i].designation.trim()) {
        setError(`Veuillez renseigner la désignation de la ligne ${i + 1}.`);
        return;
      }
      if (Number(lignes[i].quantite) <= 0) {
        setError(`La quantité de la ligne ${i + 1} doit être supérieure à 0.`);
        return;
      }
    }

    setSaving(true);
    setError("");

    try {
      const token = getToken();
      const payload = {
        ...(isEdit ? { numero: numero.trim() || undefined } : {}),
        dateDevis: dateDevis || undefined,
        dateValidite: dateValidite || null,
        statut,
        etat,
        typeDevis,
        devise,
        utilisateurId: selectedClientId ? Number(selectedClientId) : null,
        clientNom: clientNom.trim(),
        clientMF: clientMF.trim() || null,
        clientAdresse: clientAdresse.trim() || null,
        clientTelephone: clientTelephone.trim() || null,
        clientEmail: clientEmail.trim() || null,
        timbreFiscal: Number(timbreFiscal),
        commentaire: commentaire.trim() || null,
        lignes: lignes.map((l) => ({
          produitId: l.produitId ? Number(l.produitId) : null,
          serviceId: l.serviceId ? Number(l.serviceId) : null,
          designation: l.designation.trim(),
          quantite: Number(l.quantite),
          prixUnitaireHT: Number(l.prixUnitaireHT),
          remise: Number(l.remise || 0),
          tauxTVA: Number(l.tauxTVA || 0),
        })),
      };

      const url = isEdit ? `${API_URL}/devis/${devis.id}` : `${API_URL}/devis`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Erreur lors de l'enregistrement du devis");
      }

      const saved = await res.json();
      onSuccess(saved);
    } catch (err: any) {
      setError(err.message || "Erreur de connexion");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";
  const smallInputCls =
    "w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500";
  const smallSelectCls =
    "w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 py-1 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden border border-gray-200 dark:border-gray-800 flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-teal-50/60 dark:bg-teal-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center text-lg font-bold shadow-xs">
              {isEdit ? "✏️" : "➕"}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {isEdit ? `Modifier le Devis ${devis.numero}` : "Nouveau Devis Client"}
              </h3>
              <p className="text-xs text-gray-500">
                Saisissez les informations du client, les articles et appliquez le workflow Devis → Facture / BL
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 font-medium">
                ⚠️ {error}
              </div>
            )}

            {/* General Info Grid */}
            <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-3">
              <h4 className="font-bold uppercase tracking-wider text-gray-500 text-[11px]">
                Informations Générales
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    N° Devis <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    placeholder="DEV-2026-0001"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date du Devis
                  </label>
                  <CustomDatePicker
                    value={dateDevis}
                    onChange={setDateDevis}
                    className="w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date de Validité
                  </label>
                  <CustomDatePicker
                    value={dateValidite}
                    onChange={setDateValidite}
                    className="w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Statut
                  </label>
                  <select
                    value={statut}
                    onChange={(e) => setStatut(e.target.value)}
                    className={inputCls}
                  >
                    <option value="BROUILLON">Brouillon</option>
                    <option value="EN_ATTENTE">En attente</option>
                    <option value="ACCEPTE">Accepté</option>
                    <option value="REFUSE">Refusé</option>
                    <option value="EXPIRE">Expiré</option>
                    <option value="FACTURE">Facturé</option>
                    <option value="CONVERTI_BL">Converti en BL</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    État du Devis
                  </label>
                  <select
                    value={etat}
                    onChange={(e) => setEtat(e.target.value)}
                    className={inputCls}
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="URGENT">Urgent</option>
                    <option value="ESTIMATION">Estimation</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type de Devis
                  </label>
                  <select
                    value={typeDevis}
                    onChange={(e) => setTypeDevis(e.target.value)}
                    className={inputCls}
                  >
                    <option value="PRODUITS">Produit</option>
                    <option value="SERVICE">Service</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Devise
                  </label>
                  <input
                    type="text"
                    value={devise}
                    onChange={(e) => setDevise(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Timbre Fiscal (TND)
                  </label>
                  <select
                    value={timbreFiscal}
                    onChange={(e) => setTimbreFiscal(parseFloat(e.target.value) || 0)}
                    className={inputCls}
                  >
                    {companyTimbreRates.map((rate) => (
                      <option key={rate} value={rate}>
                        {rate.toFixed(3)} TND
                      </option>
                    ))}
                    {!companyTimbreRates.includes(timbreFiscal) && (
                      <option value={timbreFiscal}>{Number(timbreFiscal).toFixed(3)} TND</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* Client / Tier Grid */}
            <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-3">
              <h4 className="font-bold uppercase tracking-wider text-gray-500 text-[11px]">
                Client / Tier
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Rechercher un client existant
                  </label>
                  <SearchableSelect
                    options={clientOptions}
                    value={selectedClientId}
                    onChange={(val) => handleClientChange(val === "" ? "" : Number(val))}
                    placeholder="Choisir un client..."
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nom / Raison Sociale <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={clientNom}
                    onChange={(e) => setClientNom(e.target.value)}
                    placeholder="Nom complet ou société"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Matricule Fiscale
                  </label>
                  <input
                    type="text"
                    value={clientMF}
                    onChange={(e) => setClientMF(e.target.value)}
                    placeholder="Ex: 1234567LAM000"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Téléphone
                  </label>
                  <input
                    type="text"
                    value={clientTelephone}
                    onChange={(e) => setClientTelephone(e.target.value)}
                    placeholder="+216 ..."
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="client@domaine.com"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Adresse
                  </label>
                  <input
                    type="text"
                    value={clientAdresse}
                    onChange={(e) => setClientAdresse(e.target.value)}
                    placeholder="Adresse complète"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            {/* Articles Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold uppercase tracking-wider text-gray-500 text-[11px]">
                  Articles / Lignes du Devis
                </h4>
                <button
                  type="button"
                  onClick={addLine}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800 dark:text-teal-400"
                >
                  <span>+</span> Ajouter une ligne
                </button>
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-visible">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="p-2.5 text-left min-w-[200px]">Désignation / Article</th>
                      <th className="p-2.5 text-center w-20">Qté</th>
                      <th className="p-2.5 text-right w-24">P.U HT</th>
                      <th className="p-2.5 text-center w-20">Remise (%)</th>
                      <th className="p-2.5 text-right w-24">P.U Remisé</th>
                      <th className="p-2.5 text-center w-20">TVA (%)</th>
                      <th className="p-2.5 text-right w-24">Total TTC</th>
                      <th className="p-2.5 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {computedLines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="p-2 min-w-[200px]">
                          {typeDevis === "PRODUITS" ? (
                            <div className="mb-1">
                              <SearchableSelect
                                size="sm"
                                placement="top"
                                options={productOptions}
                                value={line.produitId || ""}
                                onChange={(val) => updateLine(idx, "produitId", val)}
                                placeholder="🔍 Sélectionner un produit..."
                              />
                            </div>
                          ) : (
                            <div className="mb-1">
                              <SearchableSelect
                                size="sm"
                                placement="top"
                                options={serviceOptions}
                                value={line.serviceId || ""}
                                onChange={(val) => updateLine(idx, "serviceId", val)}
                                placeholder="🔍 Sélectionner un service..."
                              />
                            </div>
                          )}
                          <input
                            type="text"
                            required
                            placeholder="Description / libellé..."
                            value={line.designation}
                            onChange={(e) => updateLine(idx, "designation", e.target.value)}
                            className={smallInputCls}
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={line.quantite}
                            onChange={(e) =>
                              updateLine(idx, "quantite", parseFloat(e.target.value) || 1)
                            }
                            className={smallInputCls + " text-center"}
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={line.prixUnitaireHT}
                            onChange={(e) =>
                              updateLine(idx, "prixUnitaireHT", parseFloat(e.target.value) || 0)
                            }
                            className={smallInputCls + " text-right"}
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={line.remise}
                            onChange={(e) =>
                              updateLine(idx, "remise", parseFloat(e.target.value) || 0)
                            }
                            className={smallInputCls + " text-center"}
                          />
                        </td>
                        <td className="p-2 text-right font-medium text-gray-700 dark:text-gray-300">
                          {fmt(line.puApresRemise)}
                        </td>
                        <td className="p-2 text-center">
                          <select
                            value={line.tauxTVA}
                            onChange={(e) =>
                              updateLine(idx, "tauxTVA", parseFloat(e.target.value) || 0)
                            }
                            className={smallSelectCls + " text-center"}
                          >
                            {companyTvaRates.map((rate) => (
                              <option key={rate} value={rate}>
                                {rate}%
                              </option>
                            ))}
                            {!companyTvaRates.includes(Number(line.tauxTVA)) && (
                              <option value={line.tauxTVA}>{line.tauxTVA}%</option>
                            )}
                          </select>
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={line.totalTTC}
                            onChange={(e) =>
                              updateLineTTC(idx, parseFloat(e.target.value) || 0)
                            }
                            title="Modifier le TTC recalcule automatiquement le Prix HT"
                            className={
                              smallInputCls +
                              " text-right font-semibold text-gray-900 dark:text-white"
                            }
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            className="text-red-400 hover:text-red-600 font-bold text-base p-1"
                            title="Supprimer la ligne"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Commentaire & Totals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Commentaire / Modalités du Devis
                </label>
                <textarea
                  rows={4}
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  placeholder="Modalités de paiement, délais de livraison, validité de l'offre..."
                  className={inputCls}
                />
              </div>

              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 space-y-2 text-xs">
                <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                  <span>Total HT Brut</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {fmt(totalHTBrut)} {devise}
                  </span>
                </div>
                {totalRemise > 0 && (
                  <div className="flex justify-between items-center text-red-600">
                    <span>Total Remise</span>
                    <span className="font-semibold">-{fmt(totalRemise)} {devise}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                  <span>Total HT Net</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {fmt(totalHTNet)} {devise}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                  <span>Total TVA</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {fmt(totalTVA)} {devise}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                  <span>Timbre Fiscal</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {fmt(timbreFiscal)} {devise}
                  </span>
                </div>
                <div className="flex justify-between items-center font-bold text-sm text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700 pt-2">
                  <span>Total TTC</span>
                  <span className="text-teal-700 dark:text-teal-400 text-base">
                    {fmt(totalTTC)} {devise}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3 bg-gray-50 dark:bg-gray-800/40">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-100 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition shadow-sm flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>{isEdit ? "Enregistrer les modifications" : "Créer le Devis"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
