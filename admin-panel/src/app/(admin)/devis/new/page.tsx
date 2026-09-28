"use client";

import React, { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getApiUrl } from "@/utils/api";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyInfo } from "@/context/CompanyInfoContext";
import CustomDatePicker from "@/components/invoices/CustomDatePicker";
import SearchableSelect from "@/components/invoices/SearchableSelect";
import { useExercice } from "@/context/ExerciceContext";

const API_URL = getApiUrl();

// ─── Types ─────────────────────────────────────────────────────────────────

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
  prix: number;
  tva: number;
  remise: number;
  stock: number;
}

interface ServiceItem {
  id: number;
  label: string;
  actif: boolean;
}

interface DevisLine {
  produitId?: number;
  serviceId?: number;
  designation: string;
  quantite: number;
  quantiteAv: number;
  prixUnitaireHT: number;
  remise: number;
  tauxTVA: number;
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;
const todayISO = () => new Date().toISOString().split("T")[0];

type DevisType = "PRODUITS" | "SERVICE";

const TABS: { type: DevisType; label: string }[] = [
  { type: "PRODUITS", label: "Produit" },
  { type: "SERVICE", label: "Service" },
];

export default function AddDevisPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-gray-500 font-medium">Chargement du formulaire de devis...</div>}>
      <AddDevisForm />
    </Suspense>
  );
}

function AddDevisForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const copyFromId = searchParams.get("copyFrom");
  const editId = searchParams.get("editId");
  const { getToken } = useAuth();
  const { activeExercice } = useExercice();
  const { defaultTimbre, defaultTva, tvaRates, timbreRates } = useCompanyInfo();

  const [type, setType] = useState<DevisType>("PRODUITS");

  // ── Data
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);

  // ── Config Société
  const [companyTvaRates, setCompanyTvaRates] = useState<number[]>([0, 7, 13, 19]);
  const [companyTimbreRates, setCompanyTimbreRates] = useState<number[]>([0, 1]);
  const [companyTimbreFiscal, setCompanyTimbreFiscal] = useState<number>(defaultTimbre);

  // ── Form — Générales
  const [numero, setNumero] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | "">("");
  const [clientNom, setClientNom] = useState("");
  const [clientMF, setClientMF] = useState("");
  const [clientAdresse, setClientAdresse] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientTel, setClientTel] = useState("");
  const [statut, setStatut] = useState("BROUILLON");
  const [etat, setEtat] = useState("NORMAL");
  const [dateDevis, setDateDevis] = useState(todayISO());
  const [dateValidite, setDateValidite] = useState("");
  const [devise, setDevise] = useState("TND");
  const [timbreFiscal, setTimbreFiscal] = useState(defaultTimbre);
  const [commentaire, setCommentaire] = useState("");

  // ── Form — Lignes
  const [lignes, setLignes] = useState<DevisLine[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── Quick client creation
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [quickClientSaving, setQuickClientSaving] = useState(false);
  const [quickClientError, setQuickClientError] = useState("");
  const [qcNom, setQcNom] = useState("");
  const [qcPrenom, setQcPrenom] = useState("");
  const [qcAdresse, setQcAdresse] = useState("");
  const [qcTel, setQcTel] = useState("");

  // ── Searchable options memoized
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
      sublabel: `Réf: ${p.reference} • Prix: ${Number(p.prix).toFixed(3)} TND • TVA: ${p.tva}%`,
    }));
  }, [products]);

  const serviceOptions = useMemo(() => {
    return services.filter((s) => s.actif).map((s) => ({
      value: s.id,
      label: s.label,
    }));
  }, [services]);

  // ── Fetch Initial Data
  useEffect(() => {
    const token = getToken();
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${API_URL}/clients`, { headers }).then((r) => r.json()).then(setClients).catch(console.error);
    fetch(`${API_URL}/products`).then((r) => r.json()).then(setProducts).catch(console.error);
    fetch(`${API_URL}/services`, { headers }).then((r) => r.json()).then(setServices).catch(console.error);

    // Config société
    fetch(`${API_URL}/company-info`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.valeursTva) && data.valeursTva.length > 0) {
          setCompanyTvaRates(data.valeursTva.map(Number).sort((a: number, b: number) => a - b));
        }
        if (Array.isArray(data.valeursTimbre) && data.valeursTimbre.length > 0) {
          const rates = data.valeursTimbre.map(Number).sort((a: number, b: number) => a - b);
          setCompanyTimbreRates(rates);
          if (rates.length > 0) {
            setTimbreFiscal(rates[0]);
          }
        }
        if (data.timbreFiscal != null) {
          const tb = Number(data.timbreFiscal);
          setCompanyTimbreFiscal(tb);
          setTimbreFiscal(tb);
        }
      })
      .catch(console.error);

    // Numéro de devis
    if (!editId) {
      const query = activeExercice ? `?exerciceAnnee=${activeExercice.annee}` : "";
      fetch(`${API_URL}/devis/generate-number${query}`, { headers })
        .then((r) => r.json())
        .then((d) => {
          if (d.numero) setNumero(d.numero);
        })
        .catch(() => setNumero(`DEV-${activeExercice?.annee ?? new Date().getFullYear()}-0001`));
    }
  }, [getToken, editId, activeExercice]);

  // ── Pre-fill if editId or copyFrom
  useEffect(() => {
    const loadId = editId || copyFromId;
    if (!loadId) return;
    const token = getToken();
    if (!token) return;

    fetch(`${API_URL}/devis/${loadId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        if (editId) setNumero(d.numero);
        setDateDevis(d.dateDevis ? d.dateDevis.split("T")[0] : todayISO());
        if (d.dateValidite) setDateValidite(d.dateValidite.split("T")[0]);
        setStatut(editId ? d.statut : "BROUILLON");
        setEtat(d.etat || "NORMAL");
        setType(d.typeDevis === "SERVICE" ? "SERVICE" : "PRODUITS");
        setDevise(d.devise || "TND");
        setTimbreFiscal(Number(d.timbreFiscal) || defaultTimbre);
        setCommentaire(d.commentaire || "");

        // Client
        setSelectedClientId(d.utilisateurId || "");
        setClientNom(d.clientNom || "");
        setClientMF(d.clientMF || "");
        setClientAdresse(d.clientAdresse || "");
        setClientTel(d.clientTelephone || "");
        setClientEmail(d.clientEmail || "");

        // Lignes
        if (Array.isArray(d.lignes)) {
          setLignes(
            d.lignes.map((l: any) => ({
              produitId: l.produitId,
              serviceId: l.serviceId,
              designation: l.designation,
              quantite: Number(l.quantite) || 1,
              quantiteAv: 0,
              prixUnitaireHT: Number(l.prixUnitaireHT) || 0,
              remise: Number(l.remise) || 0,
              tauxTVA: Number(l.tauxTVA) || defaultTva,
            }))
          );
        }
      })
      .catch(console.error);
  }, [editId, copyFromId, getToken]);

  // ── Quick client create
  const handleQuickClientCreate = async () => {
    if (!qcNom.trim() && !qcPrenom.trim()) {
      setQuickClientError("Veuillez saisir au moins un nom ou prénom.");
      return;
    }
    setQuickClientSaving(true);
    setQuickClientError("");
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/clients/quick-create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nom: qcNom.trim(),
          prenom: qcPrenom.trim(),
          adresse: qcAdresse.trim(),
          telephone: qcTel.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de création");

      const newClient: Client = {
        id: data.id,
        email: data.email,
        nom: data.nom,
        prenom: data.prenom,
        telephone: data.telephone,
        adresse: data.adresse,
        matriculeFiscale: data.matriculeFiscale || null,
      };
      setClients((prev) => [newClient, ...prev]);
      handleClientChange(data.id);
      setQcNom("");
      setQcPrenom("");
      setQcAdresse("");
      setQcTel("");
      setShowQuickClient(false);
    } catch (e: any) {
      setQuickClientError(e.message || "Erreur inconnue");
    } finally {
      setQuickClientSaving(false);
    }
  };

  // ── Handle client selection
  const handleClientChange = (clientId: number | "") => {
    setSelectedClientId(clientId);
    if (!clientId) {
      setClientNom("");
      setClientMF("");
      setClientAdresse("");
      setClientEmail("");
      setClientTel("");
      return;
    }
    const c = clients.find((x) => x.id === Number(clientId));
    if (c) {
      setClientNom(`${c.nom || ""} ${c.prenom || ""}`.trim());
      setClientMF(c.matriculeFiscale || "");
      setClientAdresse(c.adresse || "");
      setClientEmail(c.email || "");
      setClientTel(c.telephone || "");
    }
  };

  // ── Lines
  const addLine = () => {
    setLignes((prev) => [
      ...prev,
      {
        designation: "",
        quantite: 1,
        quantiteAv: 0,
        prixUnitaireHT: 0,
        remise: 0,
        tauxTVA: defaultTva,
      },
    ]);
  };

  const updateLine = (idx: number, field: keyof DevisLine, value: any) => {
    setLignes((prev) => {
      const next = [...prev];
      const line = { ...next[idx], [field]: value };
      if (field === "produitId" && type === "PRODUITS") {
        const prod = products.find((p) => p.id === Number(value));
        if (prod) {
          line.designation = prod.nom;
          line.tauxTVA = Number(prod.tva) || ;
          line.prixUnitaireHT = Math.round((Number(prod.prix) / (1 + line.tauxTVA / 100)) * 1000) / 1000;
          line.remise = Number(prod.remise) || 0;
        }
      }
      if (field === "serviceId" && type === "SERVICE") {
        const svc = services.find((s) => s.id === Number(value));
        if (svc) line.designation = svc.label;
      }
      next[idx] = line;
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

  const removeLine = (idx: number) => setLignes((prev) => prev.filter((_, i) => i !== idx));

  // ── Calculations
  const computedLines = lignes.map((l) => {
    const qte = Number(l.quantite) || 1;
    const pu = Number(l.prixUnitaireHT) || 0;
    const remise = Number(l.remise) || 0;
    const brutHT = round3(qte * pu);
    const puApresRemise = round3(pu * (1 - remise / 100));
    const ptHT = round3(qte * puApresRemise);
    const totalTTC = round3(ptHT * (1 + Number(l.tauxTVA) / 100));
    return { ...l, brutHT, puApresRemise, ptHT, totalTTC };
  });

  const totalHTBrut = round3(computedLines.reduce((s, l) => s + l.brutHT, 0));
  const totalRemise = round3(computedLines.reduce((s, l) => s + (l.brutHT - l.ptHT), 0));
  const montantHT = round3(totalHTBrut - totalRemise);
  const montantTVA = round3(
    computedLines.reduce((s, l) => s + round3((l.ptHT * Number(l.tauxTVA)) / 100), 0)
  );
  const currentTimbre = Number(timbreFiscal) || 0;
  const montantTTC = round3(montantHT + montantTVA + currentTimbre);

  // ── Submit
  const handleSubmit = async () => {
    setError("");
    if (!clientNom.trim()) {
      setError("Veuillez sélectionner ou renseigner un client.");
      return;
    }
    if (!numero.trim()) {
      setError("Numéro de devis requis.");
      return;
    }
    if (lignes.length === 0) {
      setError("Veuillez ajouter au moins une ligne de devis.");
      return;
    }

    setSaving(true);
    try {
      const token = getToken();
      const payload = {
        numero: numero.trim(),
        dateDevis: dateDevis || undefined,
        dateValidite: dateValidite || null,
        statut,
        etat,
        typeDevis: type,
        devise,
        utilisateurId: selectedClientId ? Number(selectedClientId) : null,
        clientNom: clientNom.trim(),
        clientMF: clientMF.trim() || null,
        clientAdresse: clientAdresse.trim() || null,
        clientTelephone: clientTel.trim() || null,
        clientEmail: clientEmail.trim() || null,
        timbreFiscal: currentTimbre,
        commentaire: commentaire.trim() || null,
        lignes: lignes.map((l) => ({
          produitId: l.produitId ? Number(l.produitId) : null,
          serviceId: l.serviceId ? Number(l.serviceId) : null,
          designation: l.designation.trim() || "Article",
          quantite: Number(l.quantite),
          prixUnitaireHT: Number(l.prixUnitaireHT),
          remise: Number(l.remise || 0),
          tauxTVA: Number(l.tauxTVA || 0),
        })),
      };

      const url = editId ? `${API_URL}/devis/${editId}` : `${API_URL}/devis`;
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Erreur lors de l'enregistrement du devis");
      }

      router.push("/devis");
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header bar */}
      <div className="sticky top-0 z-40 bg-[#f5f0e8] dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">📄</span>
            <span className="text-sm font-bold uppercase tracking-widest text-gray-800 dark:text-gray-100">
              {editId ? `Modifier le Devis ${numero}` : "Création Devis Client"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.type}
                onClick={() => setType(tab.type)}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${
                  type === tab.type
                    ? "bg-amber-700 text-white shadow"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Info Workflow */}
        <div className="rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 p-4 flex items-start gap-3 shadow-sm">
          <span className="text-2xl">📋</span>
          <div>
            <h4 className="text-sm font-bold text-teal-900 dark:text-teal-200">
              Workflow commercial : Devis → Facture → Bon de Livraison
            </h4>
            <p className="text-xs text-teal-800/90 dark:text-teal-300/90 mt-0.5 leading-relaxed">
              Créez et personnalisez votre proposition commerciale. Dès l'acceptation par le client, vous pouvez <strong>facturer en 1 clic</strong> directement depuis la liste des devis pour créer la facture correspondante.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* ─── Générales ────────────────────────────────────── */}
        <Section title="Générales">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Tier */}
            <div className="xl:col-span-2">
              <FieldLabel required>Tier / Client</FieldLabel>
              <div className="flex gap-2 items-center">
                <SearchableSelect
                  className="flex-1"
                  options={clientOptions}
                  value={selectedClientId}
                  onChange={(val) => handleClientChange(val === "" ? "" : Number(val))}
                  placeholder="Rechercher un client par nom, tél, email..."
                />
                <button
                  type="button"
                  title="Créer un nouveau client"
                  onClick={() => {
                    setShowQuickClient((v) => !v);
                    setQuickClientError("");
                  }}
                  className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xl shadow transition-colors shrink-0"
                >
                  {showQuickClient ? "×" : "+"}
                </button>
              </div>

              {/* ── Quick-create client panel */}
              {showQuickClient && (
                <div className="mt-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-4 shadow-sm">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-200 mb-3 uppercase tracking-wide">
                    ✦ Nouveau client (sans compte)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Nom
                      </label>
                      <input
                        type="text"
                        placeholder="Nom"
                        value={qcNom}
                        onChange={(e) => setQcNom(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Prénom
                      </label>
                      <input
                        type="text"
                        placeholder="Prénom"
                        value={qcPrenom}
                        onChange={(e) => setQcPrenom(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Téléphone
                      </label>
                      <input
                        type="text"
                        placeholder="+216 ..."
                        value={qcTel}
                        onChange={(e) => setQcTel(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Adresse
                      </label>
                      <input
                        type="text"
                        placeholder="Adresse"
                        value={qcAdresse}
                        onChange={(e) => setQcAdresse(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  {quickClientError && (
                    <p className="text-xs text-red-600 font-medium mt-2">{quickClientError}</p>
                  )}
                  <div className="flex justify-end gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => setShowQuickClient(false)}
                      className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      disabled={quickClientSaving}
                      onClick={handleQuickClientCreate}
                      className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition disabled:opacity-50"
                    >
                      {quickClientSaving ? "Création..." : "Enregistrer le client"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Statut Devis */}
            <div>
              <FieldLabel>Statut du Devis</FieldLabel>
              <select
                className={selectCls}
                value={statut}
                onChange={(e) => setStatut(e.target.value)}
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

            {/* État Devis */}
            <div>
              <FieldLabel>État Devis</FieldLabel>
              <select
                className={selectCls}
                value={etat}
                onChange={(e) => setEtat(e.target.value)}
              >
                <option value="NORMAL">Normal</option>
                <option value="URGENT">Urgent</option>
                <option value="ESTIMATION">Estimation</option>
              </select>
            </div>

            {/* N° Devis */}
            <div>
              <FieldLabel required>N° Devis</FieldLabel>
              <input
                type="text"
                className={inputCls}
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="DEV-2026-0001"
              />
            </div>

            {/* Date du devis */}
            <div>
              <FieldLabel required>Date du Devis</FieldLabel>
              <CustomDatePicker value={dateDevis} onChange={setDateDevis} />
            </div>

            {/* Date de validité */}
            <div>
              <FieldLabel>Date de Validité</FieldLabel>
              <CustomDatePicker value={dateValidite} onChange={setDateValidite} />
            </div>

            {/* Devise */}
            <div>
              <FieldLabel>Devise</FieldLabel>
              <input
                type="text"
                className={inputCls}
                value={devise}
                onChange={(e) => setDevise(e.target.value)}
              />
            </div>

            {/* Timbre Fiscal */}
            <div>
              <FieldLabel>Timbre Fiscal (TND)</FieldLabel>
              <select
                className={inputCls}
                value={timbreFiscal}
                onChange={(e) => setTimbreFiscal(Number(e.target.value))}
              >
                {companyTimbreRates.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate.toFixed(3)} TND
                  </option>
                ))}
                {!companyTimbreRates.includes(timbreFiscal) && (
                  <option value={timbreFiscal}>{Number(timbreFiscal).toFixed(3)} TND (actuel)</option>
                )}
              </select>
            </div>

            {/* Matricule Fiscale */}
            <div>
              <FieldLabel>Matricule Fiscale</FieldLabel>
              <input
                type="text"
                className={inputCls}
                value={clientMF}
                onChange={(e) => setClientMF(e.target.value)}
                placeholder="Ex: 1234567/A/M/000"
              />
            </div>

            {/* Téléphone */}
            <div>
              <FieldLabel>Téléphone</FieldLabel>
              <input
                type="text"
                className={inputCls}
                value={clientTel}
                onChange={(e) => setClientTel(e.target.value)}
                placeholder="+216 ..."
              />
            </div>

            {/* Adresse */}
            <div className="xl:col-span-2">
              <FieldLabel>Adresse</FieldLabel>
              <input
                type="text"
                className={inputCls}
                value={clientAdresse}
                onChange={(e) => setClientAdresse(e.target.value)}
                placeholder="Adresse du client"
              />
            </div>

            {/* Email */}
            <div>
              <FieldLabel>Email</FieldLabel>
              <input
                type="email"
                className={inputCls}
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@domaine.com"
              />
            </div>
          </div>
        </Section>

        {/* ─── Lignes du devis ──────────────────────────────── */}
        <Section title={type === "PRODUITS" ? "Lignes Produits du Devis" : "Lignes Services du Devis"}>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-visible">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className={thCls}>Libellé Produit / Service</th>
                  <th className={thCls + " w-24 text-center"}>Quantité</th>
                  <th className={thCls + " w-28 text-right"}>Prix HT</th>
                  <th className={thCls + " w-24 text-center"}>Remise (%)</th>
                  <th className={thCls + " w-28 text-right"}>P.U Après Remise</th>
                  <th className={thCls + " w-28 text-right"}>P.T Hors TVA</th>
                  <th className={thCls + " w-20 text-center"}>TVA</th>
                  <th className={thCls + " w-28 text-right"}>Total TTC</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {computedLines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/20">
                    <td className="p-2 min-w-[240px]">
                      {type === "PRODUITS" ? (
                        <div className="mb-1">
                          <SearchableSelect
                            size="sm"
                            placement="top"
                            options={productOptions}
                            value={line.produitId || ""}
                            onChange={(val) => updateLine(idx, "produitId", val)}
                            placeholder="🔍 Rechercher un produit..."
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
                            placeholder="🔍 Rechercher un service..."
                          />
                        </div>
                      )}
                      <input
                        type="text"
                        className={smallInputCls}
                        value={line.designation}
                        onChange={(e) => updateLine(idx, "designation", e.target.value)}
                        placeholder="Description..."
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        className={smallInputCls + " text-center"}
                        value={line.quantite}
                        onChange={(e) => updateLine(idx, "quantite", Number(e.target.value))}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        className={smallInputCls + " text-right"}
                        value={line.prixUnitaireHT}
                        onChange={(e) => updateLine(idx, "prixUnitaireHT", Number(e.target.value))}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        className={smallInputCls + " text-center"}
                        value={line.remise}
                        onChange={(e) => updateLine(idx, "remise", Number(e.target.value))}
                      />
                    </td>
                    <td className="p-2 text-right font-medium text-gray-700 dark:text-gray-300">
                      {line.puApresRemise.toFixed(3)}
                    </td>
                    <td className="p-2 text-right font-medium text-gray-700 dark:text-gray-300">
                      {line.ptHT.toFixed(3)}
                    </td>
                    <td className="p-2">
                      <select
                        className={smallSelectCls + " text-center"}
                        value={line.tauxTVA}
                        onChange={(e) => updateLine(idx, "tauxTVA", Number(e.target.value))}
                      >
                        {companyTvaRates.map((rate) => (
                          <option key={rate} value={rate}>
                            {rate}%
                          </option>
                        ))}
                        {!companyTvaRates.includes(line.tauxTVA) && (
                          <option value={line.tauxTVA}>{line.tauxTVA}% (perso)</option>
                        )}
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        className={smallInputCls + " text-right font-semibold text-gray-900 dark:text-white"}
                        value={line.totalTTC}
                        onChange={(e) => updateLineTTC(idx, Number(e.target.value))}
                        title="Modifier le Total TTC recalcule automatiquement le Prix HT"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => removeLine(idx)}
                        className="text-red-400 hover:text-red-600 text-lg font-bold"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
                {lignes.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-gray-400 italic text-sm">
                      Cliquez sur "+ Ajouter une ligne" ci-dessous pour démarrer le devis.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <button
            onClick={addLine}
            className="mt-3 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium flex items-center gap-1.5"
          >
            <span>+</span> Ajouter une ligne
          </button>
        </Section>

        {/* ─── Commentaire & Totaux ─────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <Section title="Commentaire & Conditions">
            <textarea
              rows={5}
              className={inputCls}
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Conditions de livraison, délais, modalités de règlement, validité de l'offre commerciale..."
            />
          </Section>

          {/* Totaux */}
          <Section title="Récapitulatif & Totaux">
            <div className="space-y-3">
              <TotalRow label="Total HT Brut" value={totalHTBrut} devise={devise} />
              {totalRemise > 0 && (
                <div className="flex justify-between items-center text-sm font-semibold text-red-600">
                  <span>Total Remise</span>
                  <span>-{totalRemise.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {devise}</span>
                </div>
              )}
              <TotalRow label="Total HT Net" value={montantHT} devise={devise} />
              <TotalRow label="Total TVA" value={montantTVA} devise={devise} />
              <TotalRow label="Timbre Fiscal" value={currentTimbre} devise={devise} />
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <TotalRow label="Total TTC" value={montantTTC} devise={devise} bold highlight />
              </div>
            </div>
          </Section>
        </div>

        {/* ─── Actions ─────────────────────────────────────── */}
        <div className="flex items-center justify-between pb-8">
          <button
            onClick={() => router.push("/devis")}
            className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-8 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors shadow-sm flex items-center gap-2"
          >
            {saving ? (
              <span>Traitement...</span>
            ) : (
              <>
                <span>📄</span> {editId ? "Enregistrer les modifications" : "Créer le Devis"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative">
      <div className="border-b border-gray-100 dark:border-gray-800 px-5 py-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  );
}

function TotalRow({ label, value, devise, bold, highlight }: { label: string; value: number; devise: string; bold?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex justify-between items-center text-sm ${bold ? "font-bold" : ""}`}>
      <span className={highlight ? "text-amber-700 dark:text-amber-400" : "text-gray-600 dark:text-gray-400"}>{label}</span>
      <span className={highlight ? "text-amber-700 dark:text-amber-400 text-base" : "text-gray-900 dark:text-white"}>
        {value.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {devise}
      </span>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition";
const selectCls = inputCls;
const smallInputCls =
  "w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500";
const smallSelectCls =
  "w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-1 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500";
const thCls = "p-2 font-semibold text-gray-600 dark:text-gray-300";
