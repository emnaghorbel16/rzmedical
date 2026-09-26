"use client";
import { getApiUrl, getBaseUrl } from "@/utils/api";
import React, { useCallback, useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";
import { useAuth } from "@/hooks/useAuth";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

const API_URL = getApiUrl();
const BASE_URL = getBaseUrl();
const ACTIVITES_CLIENT = ["Dentiste", "Laboratoire", "Médecin", "Clinique", "Pharmacie", "Hôpital", "Centre médical", "Cabinet médical", "Autre"];

interface OrderItem {
  id: number;
  quantite: number;
  prixUnitaire: number;
  produit: {
    id: number;
    nom: string;
    reference: string;
    images?: string[];
    prix: number;
  };
}

interface ClientOrder {
  id: number;
  statut: string;
  total: number;
  creeLe: string;
  lignes: OrderItem[];
  factures?: Array<{
    id: number;
    numero: string;
    statut: string;
    montantTTC: number;
    fichierPdf?: string | null;
  }>;
}

interface Client {
  id: number;
  email: string;
  prenom: string | null;
  nom: string | null;
  telephone: string | null;
  photo: string | null;
  adresse: string | null;
  dateNaissance: string | null;
  remise: number;
  matriculeFiscale: string | null;
  activite: string | null;
  typeUtilisateur: "CLIENT" | "COMMERCIAL";
  creeLe: string;
  dernierLogin: string | null;
  _count: { commandes: number };
  totalDepense?: number;
  commandes?: ClientOrder[];
}

interface ClientStats {
  totalClients: number;
  newThisMonth: number;
  clientsWithOrders: number;
  totalRevenue: number;
}

export default function CustomersPage() {
  const { getToken } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "with_orders" | "no_orders" | "recent">("all");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [uploading, setUploading] = useState(false);

  // Detail Drawer State
  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Password Reset Modal State
  const [pwdClient, setPwdClient] = useState<Client | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMessage, setPwdMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form fields
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formPrenom, setFormPrenom] = useState("");
  const [formNom, setFormNom] = useState("");
  const [formTelephone, setFormTelephone] = useState("");
  const [formPhoto, setFormPhoto] = useState("");
  const [formAdresse, setFormAdresse] = useState("");
  const [formDateNaissance, setFormDateNaissance] = useState("");
  const [formRemise, setFormRemise] = useState("0");
  const [formMatriculeFiscale, setFormMatriculeFiscale] = useState("");
  const [formActivite, setFormActivite] = useState("");
  const [formActiviteAutre, setFormActiviteAutre] = useState("");
  const [formTypeUtilisateur, setFormTypeUtilisateur] = useState<"CLIENT" | "COMMERCIAL">("CLIENT");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingRemiseId, setSavingRemiseId] = useState<number | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) {
        window.location.href = "/signin";
        return;
      }

      const [resClients, resStats] = await Promise.all([
        fetch(`${API_URL}/clients`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/clients/stats`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (!resClients.ok) {
        if (resClients.status === 401) {
          window.location.href = "/signin";
          return;
        }
        const errJson = await resClients.json().catch(() => ({}));
        throw new Error(errJson.error || "Erreur lors du chargement des clients");
      }

      const data = await resClients.json();
      setClients(data);

      if (resStats.ok) {
        setStats(await resStats.json());
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Open Client Details Drawer / Modal
  const openDetail = async (client: Client) => {
    setDetailClient(client);
    setLoadingDetail(true);
    try {
      const res = await fetch(`${API_URL}/clients/${client.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const fullData = await res.json();
        setDetailClient(fullData);
      }
    } catch (e) {
      console.error("Erreur chargement détails:", e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const resetForm = () => {
    setFormEmail(""); setFormPassword(""); setFormPrenom(""); setFormNom("");
    setFormTelephone(""); setFormPhoto(""); setFormAdresse(""); setFormDateNaissance(""); setFormRemise("0"); setFormMatriculeFiscale(""); setFormActivite(""); setFormActiviteAutre("");
    setFormTypeUtilisateur("CLIENT");
    setFormError(null);
  };

  const openAddModal = () => {
    setEditClient(null);
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (client: Client) => {
    setEditClient(client);
    setFormEmail(client.email);
    setFormPassword("");
    setFormPrenom(client.prenom || "");
    setFormNom(client.nom || "");
    setFormTelephone(client.telephone || "");
    setFormPhoto(client.photo || "");
    setFormAdresse(client.adresse || "");
    setFormDateNaissance(
      client.dateNaissance ? new Date(client.dateNaissance).toISOString().split("T")[0] : ""
    );
    setFormRemise((client.remise ?? 0).toString());
    setFormMatriculeFiscale(client.matriculeFiscale || "");
    const knownActivity = ACTIVITES_CLIENT.includes(client.activite || "");
    setFormActivite(client.activite ? (knownActivity ? client.activite : "Autre") : "");
    setFormActiviteAutre(client.activite && !knownActivity ? client.activite : "");
    setFormTypeUtilisateur(client.typeUtilisateur || "CLIENT");
    setFormError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditClient(null);
    resetForm();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFormError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/upload/single`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur upload");
      setFormPhoto(data.url);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Erreur upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!editClient && (!formEmail || !formPassword)) {
      setFormError("Email et mot de passe requis");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        prenom: formPrenom || null,
        nom: formNom || null,
        telephone: formTelephone || null,
        photo: formPhoto || null,
        adresse: formAdresse || null,
        dateNaissance: formDateNaissance || null,
        remise: Math.min(100, Math.max(0, Number(formRemise) || 0)),
        matriculeFiscale: formMatriculeFiscale.trim() || null,
        activite: (formActivite === "Autre" ? formActiviteAutre : formActivite).trim() || null,
        email: formEmail,
        typeUtilisateur: formTypeUtilisateur,
      };

      if (editClient) {
        const res = await fetch(`${API_URL}/clients/${editClient.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur modification");
      } else {
        const res = await fetch(`${API_URL}/clients`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ ...payload, motDePasse: formPassword }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur création");
      }
      closeModal();
      fetchClients();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce client ? Cette action est irréversible.")) return;
    try {
      await fetch(`${API_URL}/clients/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      fetchClients();
      if (detailClient?.id === id) setDetailClient(null);
    } catch {
      alert("Erreur lors de la suppression");
    }
  };

  const saveClientRemise = async (client: Client, value: string) => {
    const remise = Math.min(100, Math.max(0, Number(value) || 0));
    if (remise === Number(client.remise || 0)) return;
    setSavingRemiseId(client.id);
    try {
      const res = await fetch(`${API_URL}/clients/${client.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ remise }) });
      if (!res.ok) throw new Error("Erreur lors de la modification de la remise");
      setClients(current => current.map(item => item.id === client.id ? { ...item, remise } : item));
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Erreur"); } finally { setSavingRemiseId(null); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdClient || !newPassword || newPassword.length < 6) {
      setPwdMessage({ type: "error", text: "Le mot de passe doit comporter au moins 6 caractères" });
      return;
    }
    setPwdSaving(true);
    setPwdMessage(null);
    try {
      const res = await fetch(`${API_URL}/clients/${pwdClient.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ nouveauMotDePasse: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur réinitialisation");
      setPwdMessage({ type: "success", text: "Mot de passe mis à jour avec succès." });
      setTimeout(() => {
        setPwdClient(null);
        setNewPassword("");
        setPwdMessage(null);
      }, 1500);
    } catch (err: unknown) {
      setPwdMessage({ type: "error", text: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setPwdSaving(false);
    }
  };

  // Export to CSV
  const exportCSV = () => {
    const headers = ["ID", "Prénom", "Nom", "Email", "Téléphone", "Adresse", "Commandes", "Dépenses (TND)", "Inscrit le"];
    const rows = filtered.map(c => [
      c.id,
      `"${c.prenom || ""}"`,
      `"${c.nom || ""}"`,
      `"${c.email}"`,
      `"${c.telephone || ""}"`,
      `"${c.adresse || ""}"`,
      c._count.commandes,
      (c.totalDepense || 0).toFixed(2),
      new Date(c.creeLe).toLocaleDateString("fr-FR"),
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `clients_rzmedical_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    const matchSearch =
      c.email.toLowerCase().includes(q) ||
      (c.prenom || "").toLowerCase().includes(q) ||
      (c.nom || "").toLowerCase().includes(q) ||
      (c.telephone || "").includes(q) ||
      (c.adresse || "").toLowerCase().includes(q);

    if (!matchSearch) return false;

    if (filterTab === "with_orders") return c._count.commandes > 0;
    if (filterTab === "no_orders") return c._count.commandes === 0;
    if (filterTab === "recent") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return new Date(c.creeLe) >= thirtyDaysAgo;
    }
    return true;
  });

  const photoUrl = (p: string | null) => p ? (p.startsWith("/") ? BASE_URL + p : p) : null;

  return (
    <div>
      <PageBreadcrumb pageTitle="Clients" />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white/90">Gestion des Clients</h2>
          <p className="text-sm text-gray-500 mt-1">Gérez votre base de clients, historique d&apos;achats et coordonnées</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={exportCSV}
            disabled={clients.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Exporter CSV
          </button>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-xs sm:text-sm font-medium text-white hover:bg-brand-600 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nouveau Client
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Clients</span>
            <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <h4 className="text-xl font-bold text-gray-800 dark:text-white mt-2">{stats?.totalClients ?? clients.length}</h4>
          <span className="text-[11px] text-gray-400">Comptes enregistrés</span>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Nouveaux ce mois</span>
            <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </div>
          </div>
          <h4 className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-2">+{stats?.newThisMonth ?? 0}</h4>
          <span className="text-[11px] text-gray-400">Inscriptions récentes</span>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Clients Actifs</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
          </div>
          <h4 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{stats?.clientsWithOrders ?? 0}</h4>
          <span className="text-[11px] text-gray-400">Ayant passé commande</span>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Revenus Clients</span>
            <div className="h-8 w-8 rounded-lg bg-brand-50 dark:bg-brand-950/50 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-xs">
              TND
            </div>
          </div>
          <h4 className="text-xl font-bold text-brand-500 mt-2">{(stats?.totalRevenue ?? 0).toFixed(2)} TND</h4>
          <span className="text-[11px] text-gray-400">Total commandes validées</span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setFilterTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filterTab === "all"
                ? "bg-brand-500 text-white shadow-sm"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            Tous ({clients.length})
          </button>
          <button
            onClick={() => setFilterTab("with_orders")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filterTab === "with_orders"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            Avec commandes ({clients.filter(c => c._count.commandes > 0).length})
          </button>
          <button
            onClick={() => setFilterTab("no_orders")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filterTab === "no_orders"
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            Sans commande ({clients.filter(c => c._count.commandes === 0).length})
          </button>
          <button
            onClick={() => setFilterTab("recent")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filterTab === "recent"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            Récents (30j)
          </button>
        </div>

        <div className="w-full md:w-72">
          <input
            type="text"
            placeholder="Rechercher nom, email, tél, ville..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Table View */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="text-red-500 text-center py-10 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-400">
          <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 mb-3">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <p className="font-semibold text-gray-700 dark:text-gray-200">Aucun client trouvé</p>
          <p className="text-xs text-gray-400 mt-1">{search ? "Essayez une autre recherche" : "Cliquez sur 'Nouveau Client' pour en ajouter un"}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-gray-100 dark:border-gray-800 border-y bg-gray-50/50 dark:bg-gray-800/50">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 text-start">Client</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start">Contact</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start">Adresse</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start">Commandes</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start">Total Dépensé</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start">Remise</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start">Inscrit le</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-end">Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((client) => {
                  const avatar = photoUrl(client.photo);
                  const initials = ((client.prenom?.[0] || "") + (client.nom?.[0] || "C")).toUpperCase();
                  const cleanPhone = client.telephone ? client.telephone.replace(/[^0-9+]/g, "") : "";

                  return (
                    <TableRow key={client.id} className="hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors">
                      <TableCell className="px-5 py-4">
                        <div
                          onClick={() => openDetail(client)}
                          className="flex items-center gap-3 cursor-pointer group"
                        >
                          <div className="h-10 w-10 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 bg-brand-50 dark:bg-brand-950 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-sm shrink-0">
                            {avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={avatar} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span>{initials}</span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900 dark:text-white group-hover:text-brand-500 transition-colors">
                                {[client.prenom, client.nom].filter(Boolean).join(" ") || "Client #" + client.id}
                              </p>
                              {client.typeUtilisateur === "COMMERCIAL" && (
                                <Badge color="primary" size="sm">Commercial</Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-400">ID #{client.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <div className="flex flex-col gap-0.5">
                          <a href={`mailto:${client.email}`} className="text-xs text-gray-700 dark:text-gray-300 hover:text-brand-500 hover:underline">
                            {client.email}
                          </a>
                          {client.telephone ? (
                            <div className="flex items-center gap-2 mt-0.5">
                              <a href={`tel:${cleanPhone}`} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-brand-500">
                                <svg className="w-3 h-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                </svg>
                                {client.telephone}
                              </a>
                              <a
                                href={`https://wa.me/${cleanPhone.replace("+", "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-green-600 hover:underline font-medium"
                                title="Ouvrir WhatsApp"
                              >
                                WhatsApp
                              </a>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-xs text-gray-500 dark:text-gray-400 max-w-[160px] truncate">
                        {client.adresse || "—"}
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <button
                          onClick={() => openDetail(client)}
                          className="text-left group"
                        >
                          <Badge color={client._count.commandes > 0 ? "success" : "warning"} size="sm">
                            {client._count.commandes} commande{client._count.commandes !== 1 ? "s" : ""}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <span className={`text-xs font-bold ${Number(client.totalDepense) > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`}>
                          {(client.totalDepense || 0).toFixed(2)} TND
                        </span>
                      </TableCell>
                      <TableCell className="px-5 py-4"><div className="flex items-center gap-1"><input type="number" min="0" max="100" step="0.01" defaultValue={Number(client.remise || 0)} onBlur={e => saveClientRemise(client, e.currentTarget.value)} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} disabled={savingRemiseId === client.id} className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white disabled:opacity-60" /><span className="text-xs text-gray-400">%</span></div></TableCell>
                      <TableCell className="px-5 py-4 text-xs text-gray-500">
                        {new Date(client.creeLe).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-end">
                        <div className="flex justify-end items-center gap-2 whitespace-nowrap">
                          <button
                            onClick={() => openDetail(client)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-brand-600 bg-brand-50 dark:bg-brand-950/40 hover:bg-brand-100 rounded-lg transition-colors"
                            title="Voir la fiche complète et commandes"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            Fiche
                          </button>
                          <button
                            onClick={() => {
                              setPwdClient(client);
                              setNewPassword("");
                              setPwdMessage(null);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Réinitialiser le mot de passe"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" />
                              <path d="m21 2-9.6 9.6" />
                              <circle cx="7.5" cy="15.5" r="5.5" />
                            </svg>
                            MDP
                          </button>
                          <button
                            onClick={() => openEditModal(client)}
                            className="text-xs text-gray-500 hover:text-brand-500 hover:underline px-1"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDelete(client.id)}
                            className="text-xs text-red-500 hover:text-red-700 hover:underline px-1"
                          >
                            Supprimer
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. Modal Fiche Client & Historique Commandes */}
      {/* ========================================================================= */}
      {detailClient && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailClient(null);
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl rounded-3xl bg-white dark:bg-gray-900 shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-brand-500 to-blue-600 p-6 text-white relative">
              <button
                onClick={() => setDetailClient(null)}
                className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                aria-label="Fermer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-white/80 bg-white/10 flex items-center justify-center text-white font-bold text-xl shrink-0 shadow-md">
                  {detailClient.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl(detailClient.photo) || ""} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span>{((detailClient.prenom?.[0] || "") + (detailClient.nom?.[0] || "C")).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold">
                      {[detailClient.prenom, detailClient.nom].filter(Boolean).join(" ") || "Client #" + detailClient.id}
                    </h3>
                    {detailClient.typeUtilisateur === "COMMERCIAL" && (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold uppercase">Commercial</span>
                    )}
                  </div>
                  <p className="text-xs text-white/80 mt-0.5">{detailClient.email}</p>
                  <p className="text-[11px] text-white/60 mt-1">Inscrit le {new Date(detailClient.creeLe).toLocaleDateString("fr-FR")}</p>
                </div>
              </div>
            </div>

            {/* Quick Action Contact Bar */}
            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {detailClient.telephone && (
                  <>
                    <a
                      href={`tel:${detailClient.telephone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100"
                    >
                      <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      Appeler
                    </a>
                    <a
                      href={`https://wa.me/${detailClient.telephone.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800 rounded-xl text-xs font-semibold hover:bg-green-100"
                    >
                      WhatsApp
                    </a>
                  </>
                )}
                <a
                  href={`mailto:${detailClient.email}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100"
                >
                  <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  Email
                </a>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const c = detailClient;
                    setDetailClient(null);
                    setPwdClient(c);
                  }}
                  className="text-xs text-gray-600 dark:text-gray-300 hover:underline inline-flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" />
                    <path d="m21 2-9.6 9.6" />
                    <circle cx="7.5" cy="15.5" r="5.5" />
                  </svg>
                  Changer Mot de passe
                </button>
                <button
                  onClick={() => {
                    const c = detailClient;
                    setDetailClient(null);
                    openEditModal(c);
                  }}
                  className="text-xs text-brand-500 font-semibold hover:underline inline-flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                  Modifier Profil
                </button>
              </div>
            </div>

            {/* Modal Body: Client Information & Orders */}
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
              {/* Coordonnées */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 text-xs">
                <div>
                  <span className="text-gray-400 uppercase font-semibold text-[10px]">Téléphone</span>
                  <p className="font-medium text-gray-800 dark:text-white mt-1">{detailClient.telephone || "Non renseigné"}</p>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-semibold text-[10px]">Date de Naissance</span>
                  <p className="font-medium text-gray-800 dark:text-white mt-1">
                    {detailClient.dateNaissance ? new Date(detailClient.dateNaissance).toLocaleDateString("fr-FR") : "Non renseignée"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-semibold text-[10px]">Total Dépensé</span>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {(detailClient.totalDepense || 0).toFixed(2)} TND
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <span className="text-gray-400 uppercase font-semibold text-[10px]">Adresse de livraison</span>
                  <p className="font-medium text-gray-800 dark:text-white mt-1">{detailClient.adresse || "Non renseignée"}</p>
                </div>
              </div>

              {/* Historique des Commandes */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <svg className="w-4 h-4 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                      <path d="M3 6h18" />
                      <path d="M16 10a4 4 0 0 1-8 0" />
                    </svg>
                    Historique des commandes
                    <span className="px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950 text-brand-600 text-xs font-semibold">
                      {detailClient.commandes?.length || 0}
                    </span>
                  </h4>
                </div>

                {loadingDetail ? (
                  <div className="py-10 text-center text-xs text-gray-400">Chargement des commandes...</div>
                ) : !detailClient.commandes || detailClient.commandes.length === 0 ? (
                  <div className="py-8 text-center bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400 text-xs">
                    Aucune commande passée par ce client pour le moment.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detailClient.commandes.map((cmd) => (
                      <div
                        key={cmd.id}
                        className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/60 shadow-sm"
                      >
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-gray-700">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-gray-900 dark:text-white">Commande #{cmd.id}</span>
                            <span className="text-xs text-gray-400">• {new Date(cmd.creeLe).toLocaleDateString("fr-FR")}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              color={
                                cmd.statut === "PAYEE" || cmd.statut === "LIVREE"
                                  ? "success"
                                  : cmd.statut === "ANNULEE"
                                  ? "error"
                                  : "warning"
                              }
                              size="sm"
                            >
                              {cmd.statut}
                            </Badge>
                            <span className="font-bold text-sm text-brand-500">
                              {Number(cmd.total).toFixed(2)} TND
                            </span>
                          </div>
                        </div>

                        {/* Articles de la commande */}
                        {cmd.lignes && cmd.lignes.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {cmd.lignes.map((line) => (
                              <div key={line.id} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                                <span>
                                  {line.quantite}x <strong className="text-gray-800 dark:text-white">{line.produit?.nom}</strong> (Réf: {line.produit?.reference})
                                </span>
                                <span>{(Number(line.prixUnitaire) * line.quantite).toFixed(2)} TND</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-800 flex justify-end">
              <button
                onClick={() => setDetailClient(null)}
                className="px-5 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-xs font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. Modal Réinitialisation Mot de Passe */}
      {/* ========================================================================= */}
      {pwdClient && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPwdClient(null);
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white dark:bg-gray-900 shadow-2xl p-6 border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-150 relative"
          >
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" />
                  <path d="m21 2-9.6 9.6" />
                  <circle cx="7.5" cy="15.5" r="5.5" />
                </svg>
                Réinitialiser le mot de passe
              </h4>
              <button
                type="button"
                onClick={() => setPwdClient(null)}
                className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Client : <strong className="text-gray-800 dark:text-white">{[pwdClient.prenom, pwdClient.nom].filter(Boolean).join(" ") || pwdClient.email}</strong>
            </p>

            <form onSubmit={handleResetPassword}>
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                  Nouveau mot de passe *
                </label>
                <input
                  type="password"
                  placeholder="Minimum 6 caractères"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {pwdMessage && (
                <div className={`p-3 rounded-xl text-xs mb-4 ${pwdMessage.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                  {pwdMessage.text}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPwdClient(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={pwdSaving}
                  className="px-4 py-2 rounded-xl bg-brand-500 text-xs font-semibold text-white hover:bg-brand-600 transition-colors disabled:opacity-60"
                >
                  {pwdSaving ? "Enregistrement..." : "Confirmer le changement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. Modal Ajout / Modification Client */}
      {/* ========================================================================= */}
      {showModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 sm:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-3xl bg-white dark:bg-gray-900 shadow-2xl p-6 border border-gray-200 dark:border-gray-800 my-auto animate-in fade-in zoom-in-95 duration-150 relative"
          >
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-lg font-bold text-gray-800 dark:text-white">
                {editClient ? "Modifier le client" : "Nouveau Client"}
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

            <form onSubmit={handleSave}>
              {/* Photo de profil */}
                <div className="mb-5 flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 border flex items-center justify-center text-gray-400 shrink-0">
                    {formPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoUrl(formPhoto) || ""} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-gray-100 dark:bg-gray-800 px-3.5 py-2 text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                      {uploading ? "Téléversement..." : "Choisir une photo"}
                      <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handlePhotoUpload} disabled={uploading} className="hidden" />
                    </label>
                    {formPhoto && (
                      <button type="button" onClick={() => setFormPhoto("")} className="ml-3 text-xs text-red-500 hover:underline">Supprimer</button>
                    )}
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG ou WEBP — Optionnel</p>
                  </div>
                </div>

                {/* Nom / Prénom */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Prénom</label>
                    <input type="text" value={formPrenom} onChange={e => setFormPrenom(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Prénom" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Nom</label>
                    <input type="text" value={formNom} onChange={e => setFormNom(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Nom" />
                  </div>
                </div>

                {/* Email et Type Utilisateur */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Email *</label>
                    <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                      placeholder="client@exemple.com" required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Rôle (Type)</label>
                    <select value={formTypeUtilisateur} onChange={e => setFormTypeUtilisateur(e.target.value as "CLIENT" | "COMMERCIAL")}
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                      <option value="CLIENT">Client</option>
                      <option value="COMMERCIAL">Commercial</option>
                    </select>
                  </div>
                </div>

                {/* Mot de passe (ajout uniquement) */}
                {!editClient && (
                  <div className="mb-4">
                    <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Mot de passe *</label>
                    <input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                      placeholder="Minimum 8 caractères" required minLength={8} />
                  </div>
                )}

                {/* Téléphone / Date de naissance */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Téléphone</label>
                    <input type="text" value={formTelephone} onChange={e => setFormTelephone(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="+216 XX XXX XXX" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Date de naissance</label>
                    <input type="date" value={formDateNaissance} onChange={e => setFormDateNaissance(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                  </div>
                </div>

                {/* Adresse */}
                <div className="grid grid-cols-2 gap-3 mb-4"><div><label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Matricule fiscale</label><input type="text" value={formMatriculeFiscale} onChange={e => setFormMatriculeFiscale(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" /></div><div><label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Activité</label><select value={formActivite} onChange={e => setFormActivite(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"><option value="">Sélectionner</option>{ACTIVITES_CLIENT.map(activite => <option key={activite} value={activite}>{activite}</option>)}</select></div></div>
                {formActivite === "Autre" && <div className="mb-4"><label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Préciser l'activité</label><input type="text" value={formActiviteAutre} onChange={e => setFormActiviteAutre(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" /></div>}
                <div className="mb-4"><label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Remise personnelle (%)</label><input type="number" min="0" max="100" step="0.01" value={formRemise} onChange={e => setFormRemise(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" /><p className="mt-1 text-xs text-gray-400">Appliquée aux futures commandes de ce client.</p></div>
                <div className="mb-4">
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Adresse</label>
                  <textarea
                    value={formAdresse}
                    onChange={e => setFormAdresse(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white resize-none"
                    placeholder="Rue, Ville, Code postal, Pays..."
                  />
                </div>

                {formError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 p-3 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 mb-4">
                    {formError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={closeModal}
                    className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">
                    Annuler
                  </button>
                  <button type="submit" disabled={saving}
                    className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
                    {saving ? "Enregistrement..." : editClient ? "Enregistrer" : "Créer le client"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}
