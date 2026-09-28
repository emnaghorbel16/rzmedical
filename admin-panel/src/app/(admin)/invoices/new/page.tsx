"use client";

import React, { useState, useEffect, useCallback, Suspense, useRef, useMemo } from "react";
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

interface BonLivraison {
  id: number;
  code: string;
  statut: string;
  clientNom?: string;
  utilisateurId?: number;
  utilisateur?: { id: number; nom: string; prenom: string; email: string };
  clientMF?: string;
  clientAdresse?: string;
  clientTel?: string;
  clientEmail?: string;
  factures?: { id: number; numero: string; statut: string }[];
  facturesJonction?: { factureId: number }[];
  lignes: {
    id: number;
    designation: string;
    quantiteCmd: number;
    quantiteLivree: number;
    prixUnitaireHT: number;
    tauxTVA: number;
  }[];
}

interface BonSortie {
  id: number;
  code: string;
  statut: string;
  commercialId: number;
  commercial: { nom: string; prenom: string };
  inventaires?: { id: number; statut: string }[];
  lignes?: {
    id: number;
    produitId: number;
    quantite: number;
    produit: {
      id: number;
      nom: string;
      prixVenteHT: number;
      prix: number;
      remise: number;
      tva: number;
    };
  }[];
}

interface InvoiceLine {
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

// ─── Tabs ──────────────────────────────────────────────────────────────────

type FactureType = "PRODUITS" | "SERVICE" | "BON_LIVRAISON";

const TABS: { type: FactureType; label: string }[] = [
  { type: "PRODUITS", label: "Produit" },
  { type: "SERVICE", label: "Service" },
  { type: "BON_LIVRAISON", label: "Bon Livraison" },
];

// ─── Main Component ────────────────────────────────────────────────────────

export default function AddFacturePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-gray-500 font-medium">Chargement du formulaire de facturation...</div>}>
      <AddFactureForm />
    </Suspense>
  );
}

function AddFactureForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get("orderId");
  const blIdParam = searchParams.get("blId");
  const { getToken } = useAuth();
  const { activeExercice } = useExercice();
  const { defaultTimbre, defaultTva, tvaRates, timbreRates } = useCompanyInfo();

  const [type, setType] = useState<FactureType>("PRODUITS");

  // ── Source Order Data (si créé depuis commande)
  const [commandeId, setCommandeId] = useState<number | null>(null);
  const [sourceOrder, setSourceOrder] = useState<any>(null);
  const [orderLoading, setOrderLoading] = useState(false);

  // ── Data
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [allBLs, setAllBLs] = useState<BonLivraison[]>([]);
  const [bonsSortie, setBonsSortie] = useState<BonSortie[]>([]);

  // ── Config Société (TVA + Timbre Fiscal depuis la base)
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
  const [statutBL, setStatutBL] = useState("LIVRE");
  const [statutPaiement, setStatutPaiement] = useState("NON_PAYEE");
  const [montantPaye, setMontantPaye] = useState<number>(0);
  const [dateEmission, setDateEmission] = useState(todayISO());
  const [minDateEmission, setMinDateEmission] = useState(""); // date de la dernière facture — les dates antérieures sont désactivées
  const [dateEcheance, setDateEcheance] = useState("");
  const [dateEstimation, setDateEstimation] = useState("");
  const [devise, setDevise] = useState("TND");
  const [timbreFiscal, setTimbreFiscal] = useState(defaultTimbre);
  const [addPaiementData, setAddPaiementData] = useState(false);
  const [recurrente, setRecurrente] = useState(false);
  const [addImage, setAddImage] = useState(false);
  // Paiement section
  const [moyensReglement, setMoyensReglement] = useState<string[]>([]);
  const [conditionPaiement, setConditionPaiement] = useState("");
  // Autres infos
  const [projet, setProjet] = useState("");
  const [commande, setCommande] = useState("");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [incoterm, setIncoterm] = useState("");
  const [origineDesProuits, setOrigineDesProuits] = useState("");
  const [commentaire, setCommentaire] = useState("");

  // ── Form — Lines (Produits / Services)
  const [lignes, setLignes] = useState<InvoiceLine[]>([
    { designation: "", quantite: 1, quantiteAv: 0, prixUnitaireHT: 0, remise: 0, tauxTVA: defaultTva },
  ]);

  // ── Form — BL multi-selection
  const [selectedBLIds, setSelectedBLIds] = useState<number[]>([]);
  const [clientBLs, setClientBLs] = useState<BonLivraison[]>([]);

  // ── Form — Bon de Sortie (optional)
  const [selectedBSId, setSelectedBSId] = useState<number | "">("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdBLSuccess, setCreatedBLSuccess] = useState<BonLivraison | null>(null);

  // ── Quick client creation
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [quickClientSaving, setQuickClientSaving] = useState(false);
  const [quickClientError, setQuickClientError] = useState("");
  const [qcNom, setQcNom] = useState("");
  const [qcPrenom, setQcPrenom] = useState("");
  const [qcAdresse, setQcAdresse] = useState("");
  const [qcTel, setQcTel] = useState("");
  const [qcMatriculeFiscale, setQcMatriculeFiscale] = useState("");

  // ── Searchable options memoized
  const clientOptions = useMemo(() => {
    return clients.map(c => ({
      value: c.id,
      label: `${c.nom || ""} ${c.prenom || ""}`.trim() || c.email,
      sublabel: [c.telephone, c.matriculeFiscale, c.email].filter(Boolean).join(" • "),
    }));
  }, [clients]);

  const productOptions = useMemo(() => {
    let filteredProducts = products;
    
    // Si un Bon de Sortie est sélectionné, on ne garde que les produits présents dans ce BS
    if (selectedBSId) {
      const bs = bonsSortie.find(b => b.id === selectedBSId);
      if (bs && Array.isArray(bs.lignes)) {
        const bsProductIds = bs.lignes.map(l => l.produitId);
        filteredProducts = products.filter(p => bsProductIds.includes(p.id));
      }
    }

    return filteredProducts.map(p => ({
      value: p.id,
      label: p.nom,
      sublabel: `Réf: ${p.reference} • Prix: ${Number(p.prix).toFixed(3)} TND • TVA: ${p.tva}%`,
    }));
  }, [products, selectedBSId, bonsSortie]);

  const serviceOptions = useMemo(() => {
    return services.filter(s => s.actif).map(s => ({
      value: s.id,
      label: s.label,
    }));
  }, [services]);

  // ── Fetch BLs
  const fetchBLs = useCallback(() => {
    const token = getToken();
    const headers = { Authorization: `Bearer ${token}` };
    fetch(`${API_URL}/bons-livraison/admin`, { headers })
      .then(r => r.json())
      .then((data: BonLivraison[]) => {
        if (Array.isArray(data)) {
          // Exclure uniquement les BLs annulés ; les BLs FACTURE restent affichés mais désactivés
          setAllBLs(data.filter(b => b.statut !== "ANNULE"));
        }
      })
      .catch(console.error);
  }, [getToken]);

  // Détermine si un BL est déjà facturé (statut FACTURE OU lié via jonction)
  const isBLAlreadyInvoiced = (bl: BonLivraison): boolean =>
    bl.statut === "FACTURE" ||
    (bl.factures?.length ?? 0) > 0 ||
    (bl.facturesJonction?.length ?? 0) > 0;

  // ── Handle BS Selection
  const handleBSSelection = (bsId: number | "") => {
    setSelectedBSId(bsId);
    
    // On vide les lignes actuelles pour forcer la sélection depuis le nouveau stock (BS ou Dépôt)
    setLignes([
      { designation: "", quantite: 1, quantiteAv: 0, prixUnitaireHT: 0, remise: 0, tauxTVA: defaultTva }
    ]);
  };

  // ── Fetch Initial Data
  useEffect(() => {
    const token = getToken();
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${API_URL}/clients`, { headers }).then(r => r.json()).then(setClients).catch(console.error);
    fetch(`${API_URL}/products`).then(r => r.json()).then(setProducts).catch(console.error);
    fetch(`${API_URL}/services`, { headers }).then(r => r.json()).then(setServices).catch(console.error);
    fetch(`${API_URL}/stock-commercial/bons-sortie`, { headers }).then(r => r.json()).then(data => {
      setBonsSortie(data.filter((bs: BonSortie) => bs.statut === "VALIDE"));
    }).catch(console.error);
    fetchBLs();

    // Charger la configuration société (taux TVA + timbre fiscal)
    fetch(`${API_URL}/company-info`)
      .then(r => r.json())
      .then(data => {
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
  }, [getToken, fetchBLs]);

  // ── Sync clientBLs with allBLs & selectedClientId
  useEffect(() => {
    if (selectedClientId) {
      const filtered = allBLs.filter(bl => bl.utilisateurId === Number(selectedClientId) || bl.utilisateur?.id === Number(selectedClientId));
      setClientBLs(filtered);
    } else {
      setClientBLs(allBLs);
    }
  }, [allBLs, selectedClientId]);

  // Ouvrir directement l'étape 2 lorsqu'un BL est choisi depuis la liste des factures.
  useEffect(() => {
    if (!blIdParam || allBLs.length === 0) return;
    const bl = allBLs.find(item => item.id === Number(blIdParam));
    if (!bl || isBLAlreadyInvoiced(bl)) return;

    setType("BON_LIVRAISON");
    setSelectedBLIds([bl.id]);
    if (bl.utilisateurId) setSelectedClientId(bl.utilisateurId);
    setClientNom(bl.clientNom || (bl.utilisateur ? `${bl.utilisateur.nom} ${bl.utilisateur.prenom}`.trim() : ""));
    setClientMF(bl.clientMF || "");
    setClientAdresse(bl.clientAdresse || "");
    setClientTel(bl.clientTel || "");
    setClientEmail(bl.clientEmail || "");
  }, [allBLs, blIdParam]);

  // ── Pre-fill from order if orderId is in query params
  useEffect(() => {
    if (!orderIdParam) return;
    const token = getToken();
    if (!token) return;

    setOrderLoading(true);
    fetch(`${API_URL}/orders/admin/${orderIdParam}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((ord) => {
        if (!ord) return;
        setSourceOrder(ord);
        setCommandeId(ord.id);
        setCommande(`#${ord.id.toString().padStart(5, "0")}`);
        setType("PRODUITS");

        // Client info
        const u = ord.utilisateur;
        if (u) {
          setSelectedClientId(u.id || "");
          setClientNom(`${u.nom || ""} ${u.prenom || ""}`.trim());
          setClientMF(u.matriculeFiscale || "");
          setClientAdresse(u.adresse || "");
          setClientTel(u.telephone || "");
          setClientEmail(u.email || "");
        }

        // Lines
        if (Array.isArray(ord.lignes) && ord.lignes.length > 0) {
          const ordLines: InvoiceLine[] = ord.lignes.map((l: any) => ({
            produitId: l.produitId,
            designation: l.produit?.nom || "Article",
            quantite: Number(l.quantite) || 1,
            quantiteAv: 0,
            prixUnitaireHT: Number(l.prixUnitaire) || Number(l.produit?.prix) || 0,
            remise: Number(l.produit?.remise) || 0,
            tauxTVA: Number(l.produit?.tva) || defaultTva,
          }));
          setLignes(ordLines);
        }
      })
      .catch(console.error)
      .finally(() => setOrderLoading(false));
  }, [orderIdParam, getToken]);

  // ── Fetch invoice number + last invoice date
  useEffect(() => {
    const token = getToken();
    const query = activeExercice ? `?exerciceAnnee=${activeExercice.annee}` : "";
    fetch(`${API_URL}/invoices/admin/generate-number${query}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setNumero(d.numero);
        // Default to the last invoice's date + block dates before it
        if (d.lastDateEmission) {
          setDateEmission(d.lastDateEmission);
          setMinDateEmission(d.lastDateEmission); // désactiver toutes les dates antérieures
        }
        // else keep todayISO() already set in initial state
      })
      .catch(() => setNumero(`${activeExercice?.annee ?? new Date().getFullYear()}0001`));
  }, [getToken, activeExercice]);


  // ── Quick client create handler
  const handleQuickClientCreate = async () => {
    if (!qcNom.trim() && !qcPrenom.trim()) {
      setQuickClientError("Veuillez saisir au moins un nom ou prénom.");
      return;
    }
    setQuickClientSaving(true);
    setQuickClientError("");
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/clients/quick`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nom: qcNom, prenom: qcPrenom, adresse: qcAdresse, telephone: qcTel, matriculeFiscale: qcMatriculeFiscale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de création");
      // Add the new client to the list and auto-select it
      const newClient: Client = {
        id: data.id,
        email: data.email,
        nom: data.nom,
        prenom: data.prenom,
        telephone: data.telephone,
        adresse: data.adresse,
        matriculeFiscale: data.matriculeFiscale || null,
      };
      setClients(prev => [newClient, ...prev]);
      handleClientChange(data.id);
      // Reset form
      setQcNom(""); setQcPrenom(""); setQcAdresse(""); setQcTel("");
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
      setClientNom(""); setClientMF(""); setClientAdresse(""); setClientEmail(""); setClientTel("");
      setClientBLs(allBLs); setSelectedBLIds([]);
      return;
    }
    const c = clients.find(x => x.id === Number(clientId));
    if (c) {
      setClientNom(`${c.nom || ""} ${c.prenom || ""}`.trim());
      setClientMF(c.matriculeFiscale || "");
      setClientAdresse(c.adresse || "");
      setClientEmail(c.email || "");
      setClientTel(c.telephone || "");
    }
    const filtered = allBLs.filter(bl => bl.utilisateurId === Number(clientId) || bl.utilisateur?.id === Number(clientId));
    setClientBLs(filtered);
    setSelectedBLIds([]);
  };

  // ── BL selection
  const toggleBL = (blId: number) => {
    setSelectedBLIds(prev =>
      prev.includes(blId) ? prev.filter(id => id !== blId) : [...prev, blId]
    );
  };

  const removeBL = (blId: number) => {
    setSelectedBLIds(prev => prev.filter(id => id !== blId));
  };

  // ── Lines
  const addLine = () => {
    setLignes(prev => [...prev, {
      designation: "", quantite: 1, quantiteAv: 0,
      prixUnitaireHT: 0, remise: 0, tauxTVA: defaultTva,
    }]);
  };

  const updateLine = (idx: number, field: keyof InvoiceLine, value: any) => {
    setLignes(prev => {
      const next = [...prev];
      const line = { ...next[idx], [field]: value };
      if (field === "produitId" && type === "PRODUITS") {
        const prod = products.find(p => p.id === Number(value));
        if (prod) {
          line.designation = prod.nom;
          line.tauxTVA = Number(prod.tva) || defaultTva;
          line.prixUnitaireHT = Math.round((Number(prod.prix) / (1 + line.tauxTVA / 100)) * 1000) / 1000;
          line.remise = Number(prod.remise) || 0;
        }
      }
      if (field === "serviceId" && type === "SERVICE") {
        const svc = services.find(s => s.id === Number(value));
        if (svc) line.designation = svc.label;
      }
      next[idx] = line;
      return next;
    });
  };

  // Calcul inverse : modifier le Total TTC calcule le Prix HT
  const updateLineTTC = (idx: number, newTotalTTC: number) => {
    setLignes(prev => {
      const next = [...prev];
      const line = { ...next[idx] };
      const qte = Number(line.quantite) || 1;
      const remise = Number(line.remise) || 0;
      const tva = Number(line.tauxTVA) || 0;

      // newTotalTTC = qte * puApresRemise * (1 + tva / 100)
      // puApresRemise = prixUnitaireHT * (1 - remise / 100)
      // Donc : prixUnitaireHT = newTotalTTC / [ (1 + tva / 100) * (1 - remise / 100) * qte ]
      const tvaFactor = 1 + (tva / 100);
      const remiseFactor = 1 - (remise / 100);
      const denominator = tvaFactor * (remiseFactor > 0 ? remiseFactor : 1) * (qte > 0 ? qte : 1);

      if (denominator > 0) {
        line.prixUnitaireHT = round3(newTotalTTC / denominator);
      }
      next[idx] = line;
      return next;
    });
  };

  const removeLine = (idx: number) => setLignes(prev => prev.filter((_, i) => i !== idx));

  // ── Calculations
  const computedLines = lignes.map(l => {
    const remise = Number(l.remise) || 0;
    const puApresRemise = round3(Number(l.prixUnitaireHT) * (1 - remise / 100));
    const ptHT = round3(Number(l.quantite) * puApresRemise);
    const totalTTC = round3(ptHT * (1 + Number(l.tauxTVA) / 100));
    return { ...l, puApresRemise, ptHT, totalTTC };
  });

  // For BL type — compute from selected BLs
  const selectedBLObjects = allBLs.filter(bl => selectedBLIds.includes(bl.id));
  const blLines = selectedBLObjects.flatMap(bl => bl.lignes);
  const blMontantHT = round3(blLines.reduce((s, l) => s + round3(Number(l.quantiteLivree) * Number(l.prixUnitaireHT)), 0));
  const blMontantTVA = round3(blLines.reduce((s, l) => s + round3(Number(l.quantiteLivree) * Number(l.prixUnitaireHT) * (Number(l.tauxTVA) / 100)), 0));

  const montantHT = type === "BON_LIVRAISON" ? blMontantHT : round3(computedLines.reduce((s, l) => s + l.ptHT, 0));
  const montantTVA = type === "BON_LIVRAISON" ? blMontantTVA : round3(computedLines.reduce((s, l) => s + round3(l.ptHT * l.tauxTVA / 100), 0));
  const currentTimbre = type === "BON_LIVRAISON" ? Number(timbreFiscal) : 0;
  const montantTTC = round3(montantHT + montantTVA + currentTimbre);
  const netAPayer = montantTTC;

  // ── Helper: enregistrer le paiement initial si l'état le demande
  const handleInitialPaiement = async (token: string, factureId: number) => {
    let montant = 0;
    if (statutPaiement === "PAYEE") montant = montantTTC;
    else if (statutPaiement === "PARTIELLEMENT_PAYEE") montant = montantPaye;
    if (montant <= 0) return;

    await fetch(`${API_URL}/invoices/admin/${factureId}/paiements`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        montant,
        modePaiement: moyensReglement.length > 0 ? moyensReglement.join(", ") : "Espèces",
        datePaiement: dateEmission,
        commentaire: "Paiement initial à la création de la facture",
      }),
    });
  };

  // ── Submit
  const handleSubmit = async () => {
    setError("");
    if (!clientNom.trim()) { setError("Veuillez sélectionner un tier"); return; }

    setSaving(true);
    try {
      const token = getToken();

      if (type === "BON_LIVRAISON") {
        if (!numero.trim()) { setError("Numéro de facture requis"); setSaving(false); return; }
        if (selectedBLIds.length === 0) { setError("Sélectionnez au moins un bon de livraison"); setSaving(false); return; }
        const res = await fetch(`${API_URL}/invoices/admin/from-bls`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            bonLivraisonIds: selectedBLIds,
            utilisateurId: selectedClientId || undefined,
            numero,
            dateEmission,
            dateEcheance: dateEcheance || undefined,
            timbreFiscal: Number(timbreFiscal),
            statut,
            statutPaiement,
            montantPaye: Number(montantPaye) || 0,
            modePaiement: moyensReglement.length > 0 ? moyensReglement.join(", ") : "Espèces",
            devise,
            commentaire: commentaire || undefined,
            projet: projet || undefined,
            incoterm: incoterm || undefined,
            origineDesProuits: origineDesProuits || undefined,
          }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Erreur lors de la création de la facture"); }
        router.push("/invoices");
      } else {
        // Mode PRODUITS ou SERVICE: Commande -> BL -> Facture
        const lignesValides = lignes.filter(l => l.designation.trim() !== "" || l.prixUnitaireHT > 0 || l.quantite > 0);
        if (lignesValides.length === 0) { setError("Ajoutez au moins une ligne"); setSaving(false); return; }
        const res = await fetch(`${API_URL}/invoices/admin/manual-with-bl`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            commandeId: commandeId || undefined,
            utilisateurId: selectedClientId || undefined,
            clientNom,
            clientMF,
            clientAdresse,
            clientEmail,
            clientTelephone: clientTel,
            numero,
            dateEmission,
            dateEcheance: dateEcheance || undefined,
            dateEstimationPaiement: dateEstimation || undefined,
            timbreFiscal: Number(timbreFiscal),
            typeFacture: type === "SERVICE" ? "SERVICE" : "PRODUITS",
            statut,
            statutPaiement,
            montantPaye: Number(montantPaye) || 0,
            devise,
            commentaire: commentaire || undefined,
            projet: projet || undefined,
            incoterm: incoterm || undefined,
            origineDesProuits: origineDesProuits || undefined,
            bonSortieId: selectedBSId || undefined,
            commercialId: selectedBSId ? bonsSortie.find(b => b.id === Number(selectedBSId))?.commercialId : undefined,
            lignes: lignesValides.map(l => ({
              produitId: l.produitId || undefined,
              designation: l.designation,
              quantite: Number(l.quantite),
              prixUnitaireHT: Number(l.prixUnitaireHT),
              remise: Number(l.remise),
              tauxTVA: Number(l.tauxTVA),
            })),
          }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Erreur lors de la création du bon de livraison"); }
        const createdBL = await res.json() as BonLivraison;
        setCreatedBLSuccess(createdBL);
      }
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header bar */}
      <div className="sticky top-0 z-40 bg-[#f5f0e8] dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <svg className="text-amber-700 dark:text-amber-500" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-sm font-bold uppercase tracking-widest text-gray-800 dark:text-gray-100">
              {type === "BON_LIVRAISON" ? "Ajouter une facture vente (depuis BL)" : "Création facture avec bon de livraison"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {TABS.map(tab => (
              <button
                key={tab.type}
                onClick={() => {
                  setType(tab.type);
                  if (tab.type === "BON_LIVRAISON") {
                    setLignes([]);
                  } else {
                    setSelectedBLIds([]);
                    setLignes([
                      { designation: "", quantite: 1, quantiteAv: 0, prixUnitaireHT: 0, remise: 0, tauxTVA: defaultTva },
                    ]);
                  }
                }}
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

        {/* Workflow Info Banner */}
        {type !== "BON_LIVRAISON" ? (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 flex items-start gap-3 shadow-sm">
            <span className="text-2xl">📦</span>
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Commande → Bon de livraison → Facture ({type === "PRODUITS" ? "Produit" : "Service"})
              </h4>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5 leading-relaxed">
                Un bon de livraison est créé ou réutilisé, puis la facture est créée et liée à ce bon.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-4 flex items-start gap-3 shadow-sm">
            <span className="text-2xl">🧾</span>
            <div>
              <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200">
                Étape 2 : Facturation depuis le champ Bon(s) de Livraison
              </h4>
              <p className="text-xs text-blue-800/90 dark:text-blue-300/90 mt-0.5 leading-relaxed">
                Sélectionnez un tier puis cochez le ou les bons de livraison à facturer dans le champ <strong>« Bon(s) de Livraison »</strong> ci-dessous.
                La facture sera créée et le(s) bon(s) sélectionné(s) passeront au statut <strong>Facturé</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Source Order Banner */}
        {sourceOrder && (
          <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                  <span>Création depuis la Commande #{sourceOrder.id.toString().padStart(5, "0")}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-semibold">
                    {sourceOrder.statut}
                  </span>
                </h4>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                  Client : <strong>{sourceOrder.utilisateur ? `${sourceOrder.utilisateur.nom} ${sourceOrder.utilisateur.prenom}` : sourceOrder.clientNom}</strong> — {sourceOrder.lignes?.length || 0} article(s) pré-remplis automatiquement pour la création du Bon de Livraison.
                </p>
              </div>
            </div>
            <span className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white font-semibold self-start sm:self-auto shadow-xs">
              Commande #{sourceOrder.id}
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ─── Générales ────────────────────────────────────── */}
        <Section title="Générales">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Tier */}
            <div className="xl:col-span-2">
              <FieldLabel required>Tier</FieldLabel>
              <div className="flex gap-2 items-center">
                <SearchableSelect
                  className="flex-1"
                  options={clientOptions}
                  value={selectedClientId}
                  onChange={val => handleClientChange(val === "" ? "" : Number(val))}
                  placeholder="Rechercher un client par nom, tél, email..."
                />
                <button
                  type="button"
                  title="Créer un nouveau client"
                  onClick={() => { setShowQuickClient(v => !v); setQuickClientError(""); }}
                  className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xl shadow transition-colors shrink-0"
                >
                  {showQuickClient ? "×" : "+"}
                </button>
              </div>

              {/* ── Quick-create client panel */}
              {showQuickClient && (
                <div className="mt-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-4 shadow-sm">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-200 mb-3 uppercase tracking-wide">✦ Nouveau client (sans compte)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nom</label>
                      <input
                        type="text" placeholder="Nom" value={qcNom}
                        onChange={e => setQcNom(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Prénom</label>
                      <input
                        type="text" placeholder="Prénom" value={qcPrenom}
                        onChange={e => setQcPrenom(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Adresse</label>
                      <input
                        type="text" placeholder="Adresse" value={qcAdresse}
                        onChange={e => setQcAdresse(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Téléphone</label>
                      <input
                        type="tel" placeholder="Téléphone" value={qcTel}
                        onChange={e => setQcTel(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Matricule fiscal</label>
                      <input
                        type="text" placeholder="Ex : 1234567/A/M/000" value={qcMatriculeFiscale}
                        onChange={e => setQcMatriculeFiscale(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  {quickClientError && (
                    <p className="mt-2 text-xs text-red-600">{quickClientError}</p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={handleQuickClientCreate}
                      disabled={quickClientSaving}
                      className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold shadow transition-colors disabled:opacity-60"
                    >
                      {quickClientSaving ? "Enregistrement..." : "Enregistrer le client"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowQuickClient(false); setQuickClientError(""); }}
                      className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <FieldLabel>Matricule fiscal du client</FieldLabel>
              <input
                type="text"
                className={inputCls}
                value={clientMF}
                onChange={e => setClientMF(e.target.value)}
                placeholder="Ex : 1234567/A/M/000"
              />
            </div>

            {/* Toggles */}
            <div className="flex flex-col gap-2 justify-center">
              {type === "BON_LIVRAISON" && (
                <Toggle label="Ajouter données paiement à cette facture ?" checked={addPaiementData} onChange={setAddPaiementData} />
              )}
              <Toggle label="Ajouter image produit ?" checked={addImage} onChange={setAddImage} />
              {type === "BON_LIVRAISON" && (
                <Toggle label="Facture récurrente ?" checked={recurrente} onChange={setRecurrente} />
              )}
            </div>

            {/* Statut */}
            {type === "BON_LIVRAISON" ? (
              <div>
                <FieldLabel required>Statut facture</FieldLabel>
                <select className={selectCls} value={statut} onChange={e => setStatut(e.target.value)}>
                  <option value="BROUILLON">Brouillon</option>
                  <option value="VALIDEE">Validée</option>
                </select>
              </div>
            ) : (
              <div>
                <FieldLabel required>Statut initial du BL</FieldLabel>
                <select className={selectCls} value={statutBL} onChange={e => setStatutBL(e.target.value)}>
                  <option value="LIVRE">Livré (Prêt à être facturé)</option>
                  <option value="BROUILLON">Brouillon</option>
                  <option value="PREPARE">Préparé</option>
                  <option value="EXPEDIE">Expédié</option>
                </select>
              </div>
            )}

            {/* Date */}
            <div>
              <FieldLabel required>{type === "BON_LIVRAISON" ? "Date Facture" : "Date Bon de Livraison"}</FieldLabel>
              <CustomDatePicker
                value={dateEmission}
                minDate={minDateEmission}
                onChange={setDateEmission}
              />
            </div>

            {/* Devise */}
            <div>
              <FieldLabel required>Devise</FieldLabel>
              <select className={selectCls} value={devise} onChange={e => setDevise(e.target.value)}>
                <option value="TND">TND</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>

            {/* Champs spécifiques FACTURE (mode BON_LIVRAISON) */}
            {type === "BON_LIVRAISON" && (
              <>
                {/* Etat de Facture = Paiement */}
                <div>
                  <FieldLabel required>Etat de Facture</FieldLabel>
                  <select className={selectCls} value={statutPaiement} onChange={e => { setStatutPaiement(e.target.value); if (e.target.value !== "PARTIELLEMENT_PAYEE") setMontantPaye(0); }}>
                    <option value="NON_PAYEE">Non payée</option>
                    <option value="PARTIELLEMENT_PAYEE">Partiellement payée</option>
                    <option value="PAYEE">Payée</option>
                  </select>
                </div>

                {/* Montant payé — affiché seulement si partiel */}
                {statutPaiement === "PARTIELLEMENT_PAYEE" && (
                  <div>
                    <FieldLabel required>Montant payé (TND)</FieldLabel>
                    <input
                      type="number" step="0.001" min="0"
                      className={inputCls}
                      value={montantPaye}
                      onChange={e => setMontantPaye(Number(e.target.value))}
                      placeholder="Ex: 500.000"
                    />
                  </div>
                )}

                {/* Timbre Fiscal — sélection parmi les valeurs définies dans la base */}
                <div>
                  <FieldLabel>Timbre Fiscal (TND)</FieldLabel>
                  <select
                    className={inputCls}
                    value={timbreFiscal}
                    onChange={e => setTimbreFiscal(Number(e.target.value))}
                  >
                    {companyTimbreRates.map(rate => (
                      <option key={rate} value={rate}>
                        {rate.toFixed(3)} TND
                      </option>
                    ))}
                    {!companyTimbreRates.includes(timbreFiscal) && (
                      <option value={timbreFiscal}>
                        {Number(timbreFiscal).toFixed(3)} TND (actuel)
                      </option>
                    )}
                  </select>
                </div>

                {/* Montant payé — si PAYEE */}
                {statutPaiement === "PAYEE" && (
                  <div className="xl:col-span-2">
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-2.5 text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                      ✓ Facture marquée comme entièrement payée — paiement automatique de {montantTTC.toFixed(3)} TND sera enregistré.
                    </div>
                  </div>
                )}

                {/* Numéro */}
                <div>
                  <FieldLabel required>N° Facture</FieldLabel>
                  <input type="text" className={inputCls} value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ex: 20260001" />
                </div>
              </>
            )}
          </div>
        </Section>

        {/* ─── Paiement (si toggle activé en mode Facture) ───── */}
        {type === "BON_LIVRAISON" && addPaiementData && (
          <Section title="Paiement">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="xl:col-span-2">
                <FieldLabel>Moyens de règlement</FieldLabel>
                <div className="flex flex-wrap gap-2 mt-1">
                  {["Virement", "Chèque", "Espèces", "CB", "Traite"].map(m => (
                    <label key={m} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={moyensReglement.includes(m)}
                        onChange={() => setMoyensReglement(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}
                        className="rounded"
                      />
                      {m}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel>Condition de paiement</FieldLabel>
                <select className={selectCls} value={conditionPaiement} onChange={e => setConditionPaiement(e.target.value)}>
                  <option value="">Choisir une condition.</option>
                  <option value="IMMEDIATE">Immédiat</option>
                  <option value="30J">30 jours</option>
                  <option value="60J">60 jours</option>
                  <option value="90J">90 jours</option>
                </select>
              </div>
              <div>
                <FieldLabel>Date Échéance</FieldLabel>
                <input type="date" className={inputCls} value={dateEcheance} onChange={e => setDateEcheance(e.target.value)} />
              </div>
              <div>
                <FieldLabel>Date Estimation de Paiement</FieldLabel>
                <input type="date" className={inputCls} value={dateEstimation} onChange={e => setDateEstimation(e.target.value)} />
              </div>
            </div>
          </Section>
        )}

        {/* ─── Autres informations ─────────────────────────── */}
        <Section title="Autres informations">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <FieldLabel>Projet</FieldLabel>
              <input type="text" className={inputCls} value={projet} onChange={e => setProjet(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Commande</FieldLabel>
              <input type="text" className={inputCls} value={commande} onChange={e => setCommande(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Du</FieldLabel>
              <input type="date" className={inputCls} value={du} onChange={e => setDu(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Au</FieldLabel>
              <input type="date" className={inputCls} value={au} onChange={e => setAu(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Incoterm</FieldLabel>
              <input type="text" className={inputCls} value={incoterm} onChange={e => setIncoterm(e.target.value)} placeholder="Ex: DAP, FOB..." />
            </div>
            <div className="xl:col-span-3">
              <FieldLabel>Origine des produits</FieldLabel>
              <input type="text" className={inputCls} value={origineDesProuits} onChange={e => setOrigineDesProuits(e.target.value)} />
            </div>
          </div>
        </Section>

        {/* ─── Produits (type PRODUITS / SERVICE) ──────────── */}
        {(type === "PRODUITS" || type === "SERVICE") && (
          <Section title={type === "PRODUITS" ? "Lignes Produits" : "Lignes Services"}>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-visible">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className={thCls}>Libellé Produit / Service</th>
                    <th className={thCls + " w-24 text-center"}>Quantité</th>
                    <th className={thCls + " w-24 text-center"}>Quantité Av.</th>
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
                              onChange={val => updateLine(idx, "produitId", val)}
                              showSelectedSublabel={false}
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
                              onChange={val => updateLine(idx, "serviceId", val)}
                              placeholder="🔍 Rechercher un service..."
                            />
                          </div>
                        )}
                        <input
                          type="text"
                          className={smallInputCls}
                          value={line.designation}
                          onChange={e => updateLine(idx, "designation", e.target.value)}
                          placeholder="Description..."
                        />
                      </td>
                      <td className="p-2">
                        <input type="number" min="1" step="1" inputMode="numeric" pattern="[0-9]*" className={smallInputCls + " text-center"} value={line.quantite} onChange={e => updateLine(idx, "quantite", Math.max(1, Math.trunc(Number(e.target.value) || 1)))} />
                      </td>
                      <td className="p-2">
                        <input type="number" min="0" step="1" inputMode="numeric" pattern="[0-9]*" className={smallInputCls + " text-center"} value={line.quantiteAv} onChange={e => updateLine(idx, "quantiteAv", Math.max(0, Math.trunc(Number(e.target.value) || 0)))} />
                      </td>
                      <td className="p-2">
                        <input type="number" min="0" step="0.001" className={smallInputCls + " text-right"} value={line.prixUnitaireHT} onChange={e => updateLine(idx, "prixUnitaireHT", Number(e.target.value))} />
                      </td>
                      <td className="p-2">
                        <input type="number" min="0" max="100" step="0.1" className={smallInputCls + " text-center"} value={line.remise} onChange={e => updateLine(idx, "remise", Number(e.target.value))} />
                      </td>
                      <td className="p-2 text-right font-medium text-gray-700 dark:text-gray-300">{line.puApresRemise.toFixed(3)}</td>
                      <td className="p-2 text-right font-medium text-gray-700 dark:text-gray-300">{line.ptHT.toFixed(3)}</td>
                      <td className="p-2">
                        <select
                          className={smallSelectCls + " text-center"}
                          value={line.tauxTVA}
                          onChange={e => updateLine(idx, "tauxTVA", Number(e.target.value))}
                        >
                          {companyTvaRates.map(rate => (
                            <option key={rate} value={rate}>{rate}%</option>
                          ))}
                          {/* Afficher le taux actuel même s'il n'est plus dans la liste */}
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
                          onChange={e => updateLineTTC(idx, Number(e.target.value))}
                          title="Modifier le Total TTC recalcule automatiquement le Prix HT"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-600 text-lg font-bold">×</button>
                      </td>
                    </tr>
                  ))}
                  {lignes.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-gray-400 italic text-sm">
                        Choisir un ou plusieurs {type === "PRODUITS" ? "produits" : "services"}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <button
              onClick={addLine}
              className="mt-3 text-sm font-medium text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200 flex items-center gap-1"
            >
              <span className="text-lg">+</span> Ajouter une ligne
            </button>

            {type === "PRODUITS" && (
              <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 max-w-md">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bon de Sortie (Optionnel - Pour les Commerciaux)
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  value={selectedBSId}
                  onChange={e => handleBSSelection(Number(e.target.value) || "")}
                >
                  <option value="">-- Aucun Bon de Sortie (Stock Dépôt) --</option>
                  {bonsSortie.map(bs => {
                    const hasValidatedInventory = bs.inventaires?.some((inv: any) => inv.statut === 'VALIDE');
                    return (
                      <option 
                        key={bs.id} 
                        value={bs.id} 
                        disabled={hasValidatedInventory}
                        className={hasValidatedInventory ? "text-gray-400 bg-gray-50 dark:bg-gray-700" : ""}
                      >
                        {bs.code} - {bs.commercial.prenom} {bs.commercial.nom} {hasValidatedInventory ? "(Inventaire Validé - Inutilisable)" : ""}
                      </option>
                    );
                  })}
                </select>
                <p className="text-xs text-gray-500 mt-1">Si vous sélectionnez un Bon de Sortie, le stock sera déduit de la voiture de ce commercial au lieu du stock principal.</p>
              </div>
            )}
          </Section>
        )}

        {/* ─── Bons de Livraison (type BON_LIVRAISON — Le champ BL) ── */}
        {type === "BON_LIVRAISON" && (
          <Section title="Bon(s) de Livraison (Champ BL)">
            <div className="space-y-4">
              {/* Selected BL tags */}
              {selectedBLIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedBLIds.map(blId => {
                    const bl = allBLs.find(b => b.id === blId);
                    return bl ? (
                      <span key={blId} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-sm font-medium border border-amber-200 dark:border-amber-700">
                        {bl.code}
                        <button onClick={() => removeBL(blId)} className="text-amber-600 hover:text-red-600 font-bold ml-1">×</button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}

              {/* BL List — filtered by client, or all if no client selected */}
              <div>
                <FieldLabel required>Choisir un ou plusieurs bons de livraison à facturer</FieldLabel>
                {selectedClientId === "" && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">💡 Sélectionnez un tier ci-dessus pour filtrer les BLs par client.</p>
                )}
                <div className="max-h-56 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                  {clientBLs.length === 0 ? (
                    <p className="p-4 text-sm text-gray-400 italic text-center">
                      {selectedClientId ? "Aucun bon de livraison non facturé disponible pour ce client." : "Aucun bon de livraison disponible."}
                    </p>
                  ) : (
                    clientBLs.map(bl => {
                      const alreadyInvoiced = isBLAlreadyInvoiced(bl);
                      return (
                        <label
                          key={bl.id}
                          className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                            alreadyInvoiced
                              ? "opacity-60 cursor-not-allowed bg-red-50/60 dark:bg-red-950/20"
                              : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedBLIds.includes(bl.id)}
                            onChange={() => !alreadyInvoiced && toggleBL(bl.id)}
                            disabled={alreadyInvoiced}
                            className="rounded accent-amber-700 disabled:opacity-50"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-sm text-gray-900 dark:text-white">{bl.code}</span>
                            {bl.clientNom && <span className="text-xs text-gray-500 ml-2">— {bl.clientNom}</span>}
                            <span className="text-xs text-gray-400 ml-2">({bl.lignes?.length || 0} article(s))</span>
                            {alreadyInvoiced && (
                              <span className="ml-2 text-xs font-semibold text-red-600 dark:text-red-400">
                                ⚠ Déjà facturé
                              </span>
                            )}
                          </div>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                            alreadyInvoiced ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" :
                            bl.statut === "LIVRE" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                            bl.statut === "EXPEDIE" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" :
                            bl.statut === "PREPARE" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                            "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                          }`}>
                            {alreadyInvoiced ? "Facturé" : bl.statut}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Preview of lines from selected BLs */}
              {selectedBLIds.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                      <tr>
                        <th className={thCls}>Désignation</th>
                        <th className={thCls + " w-20 text-center"}>Qté</th>
                        <th className={thCls + " w-28 text-right"}>P.U HT</th>
                        <th className={thCls + " w-20 text-center"}>TVA %</th>
                        <th className={thCls + " w-28 text-right"}>Total HT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {blLines.map((l, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/20">
                          <td className="p-2 text-gray-800 dark:text-gray-200">{l.designation}</td>
                          <td className="p-2 text-center font-medium">{l.quantiteLivree}</td>
                          <td className="p-2 text-right">{Number(l.prixUnitaireHT).toFixed(3)}</td>
                          <td className="p-2 text-center">{Number(l.tauxTVA)}%</td>
                          <td className="p-2 text-right font-medium">{round3(Number(l.quantiteLivree) * Number(l.prixUnitaireHT)).toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ─── Totaux ──────────────────────────────────────── */}
        <div className="flex justify-end">
          <div className="w-72 space-y-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <TotalRow label="Total HT :" value={montantHT} devise={devise} />
            <TotalRow label="Total TVA :" value={montantTVA} devise={devise} />
            {type === "BON_LIVRAISON" && (
              <TotalRow label="Timbre Fiscal :" value={Number(timbreFiscal)} devise={devise} />
            )}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
              <TotalRow label="Total TTC :" value={montantTTC} devise={devise} bold />
              {type === "BON_LIVRAISON" && (
                <TotalRow label="Net à payer :" value={netAPayer} devise={devise} bold highlight />
              )}
            </div>
          </div>
        </div>

        {/* ─── Commentaire ─────────────────────────────────── */}
        <Section title="Commentaire">
          <textarea
            rows={3}
            className={inputCls + " resize-none"}
            value={commentaire}
            onChange={e => setCommentaire(e.target.value)}
            placeholder="Ajouter un commentaire..."
          />
        </Section>

        {/* ─── Actions ─────────────────────────────────────── */}
        <div className="flex items-center justify-between pb-8">
          <button
            onClick={() => router.push(type === "BON_LIVRAISON" ? "/invoices" : "/bons-livraison")}
            className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-8 py-2.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors shadow-sm flex items-center gap-2"
          >
            {saving ? (
              <span>Traitement...</span>
            ) : type === "BON_LIVRAISON" ? (
              <><span>🧾</span> Créer la facture</>
            ) : (
              <><span>📦</span> Créer le Bon de Livraison (non facturé)</>
            )}
          </button>
        </div>
      </div>

      {/* ─── Modal Succès Création BL ────────────────────── */}
      {createdBLSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100 dark:border-gray-800 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center text-3xl font-bold">
              ✓
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Bon de livraison créé !</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                N° <strong className="text-amber-700 dark:text-amber-400 text-sm">{createdBLSuccess.code}</strong> — Statut : <span className="inline-block px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 font-semibold text-xs">Livré (Non facturé)</span>
              </p>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-lg text-left leading-relaxed">
              Ce bon de livraison n'est <strong>pas encore facturé</strong>. Vous pouvez le facturer immédiatement via le <strong>champ BL</strong> ci-dessous ou aller à la liste des Bons de Livraison.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => {
                  const bl = createdBLSuccess;
                  setCreatedBLSuccess(null);
                  setType("BON_LIVRAISON");
                  setSelectedBLIds([bl.id]);
                  fetchBLs();
                }}
                className="w-full py-2.5 px-4 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-lg text-sm transition shadow-sm flex items-center justify-center gap-2"
              >
                <span>🧾</span> Facturer maintenant (Champ BL)
              </button>
              <button
                onClick={() => router.push("/bons-livraison")}
                className="w-full py-2.5 px-4 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium rounded-lg text-sm transition"
              >
                Aller à la liste des Bons de Livraison
              </button>
              {commandeId && (
                <button
                  onClick={() => router.push("/orders")}
                  className="w-full py-2 px-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs font-semibold transition"
                >
                  ← Retourner à la liste des Commandes
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">{title}</h3>
      {children}
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

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-xs text-gray-600 dark:text-gray-400 flex-1">{label}</span>
      <div
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-amber-700" : "bg-gray-200 dark:bg-gray-700"}`}
      >
        <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
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

// ─── Shared CSS ────────────────────────────────────────────────────────────

const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition";
const selectCls = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition";
const smallInputCls = "w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-2 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-400 min-h-[36px]";
const smallSelectCls = "w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-2 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-400 min-h-[36px]";
const thCls = "px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400";
