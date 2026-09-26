"use client";
import { getApiUrl, getBaseUrl } from "@/utils/api";
import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

const API_URL = getApiUrl();
const BASE_URL = getBaseUrl();

interface Commercial {
  id: number;
  email: string;
  prenom: string | null;
  nom: string | null;
  telephone: string | null;
  cin: string | null;
  photo: string | null;
  adresse: string | null;
  typeUtilisateur: string;
  creeLe: string;
  dernierLogin: string | null;
  matriculeVoiture: string | null;
  matriculeFiscale: string | null;
}

export default function CommerciauxPage() {
  const { getToken } = useAuth();
  const [commerciaux, setCommerciaux] = useState<Commercial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editCommercial, setEditCommercial] = useState<Commercial | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formPrenom, setFormPrenom] = useState("");
  const [formNom, setFormNom] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCin, setFormCin] = useState("");
  const [formMatriculeFiscale, setFormMatriculeFiscale] = useState("");
  const [formMatriculeY, setFormMatriculeY] = useState("");
  const [formMatriculeX, setFormMatriculeX] = useState("");
  const [formTelephone, setFormTelephone] = useState("");
  const [formAdresse, setFormAdresse] = useState("");

  const [pwdCommercial, setPwdCommercial] = useState<Commercial | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMessage, setPwdMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchCommerciaux = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) { window.location.href = "/signin"; return; }
      const res = await fetch(`${API_URL}/clients/commerciaux`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erreur lors du chargement des commerciaux");
      setCommerciaux(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { fetchCommerciaux(); }, [fetchCommerciaux]);

  const resetForm = () => {
    setFormPrenom(""); setFormNom(""); setFormEmail("");
    setFormCin(""); setFormMatriculeFiscale("");
    setFormMatriculeY(""); setFormMatriculeX(""); setFormTelephone(""); setFormAdresse("");
    setFormError(null);
  };

  const openAddModal = () => { setEditCommercial(null); resetForm(); setShowModal(true); };

  const openEditModal = (c: Commercial) => {
    setEditCommercial(c);
    setFormPrenom(c.prenom || ""); setFormNom(c.nom || ""); setFormEmail(c.email);
    setFormCin(c.cin || ""); setFormMatriculeFiscale(c.matriculeFiscale || "");
    if (c.matriculeVoiture) {
      const parts = c.matriculeVoiture.split(" تونس ");
      if (parts.length === 2) {
        setFormMatriculeY(parts[0]);
        setFormMatriculeX(parts[1]);
      } else {
        setFormMatriculeY(""); setFormMatriculeX("");
      }
    } else {
      setFormMatriculeY(""); setFormMatriculeX("");
    }
    setFormTelephone(c.telephone || ""); setFormAdresse(c.adresse || "");
    setFormError(null); setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditCommercial(null); resetForm(); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!editCommercial && !formEmail) { setFormError("Email requis"); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        prenom: formPrenom || null, nom: formNom || null, email: formEmail,
        cin: formCin || null,
        matriculeFiscale: formMatriculeFiscale || null,
        telephone: formTelephone || null, adresse: formAdresse || null, typeUtilisateur: "COMMERCIAL",
        matriculeVoiture: (formMatriculeY && formMatriculeX) ? `${formMatriculeY} تونس ${formMatriculeX}` : null,
      };
      if (editCommercial) {
        const res = await fetch(`${API_URL}/clients/${editCommercial.id}`, {
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
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur création");
      }
      closeModal(); fetchCommerciaux();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Erreur");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce commercial ? Cette action est irréversible.")) return;
    try {
      await fetch(`${API_URL}/clients/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } });
      fetchCommerciaux();
    } catch { alert("Erreur lors de la suppression"); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdCommercial || !newPassword || newPassword.length < 6) {
      setPwdMessage({ type: "error", text: "Le mot de passe doit comporter au moins 6 caractères" }); return;
    }
    setPwdSaving(true); setPwdMessage(null);
    try {
      const res = await fetch(`${API_URL}/clients/${pwdCommercial.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ nouveauMotDePasse: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setPwdMessage({ type: "success", text: "Mot de passe mis a jour avec succes." });
      setTimeout(() => { setPwdCommercial(null); setNewPassword(""); setPwdMessage(null); }, 1500);
    } catch (err: unknown) {
      setPwdMessage({ type: "error", text: err instanceof Error ? err.message : "Erreur" });
    } finally { setPwdSaving(false); }
  };

  const photoUrl = (p: string | null) => p ? (p.startsWith("/") ? BASE_URL + p : p) : null;

  const filtered = commerciaux.filter(c => {
    const q = search.toLowerCase();
    return (c.prenom || "").toLowerCase().includes(q) || (c.nom || "").toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) || (c.telephone || "").includes(q);
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="Commerciaux" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white/90">Gestion des Commerciaux</h2>
          <p className="text-sm text-gray-500 mt-1">{commerciaux.length} commercial{commerciaux.length !== 1 ? "x" : ""} enregistre{commerciaux.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={openAddModal} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nouveau Commercial
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/30 p-4">
          <span className="text-xs font-medium text-indigo-500 dark:text-indigo-400">Total Commerciaux</span>
          <h4 className="text-2xl font-bold text-indigo-700 dark:text-indigo-300 mt-1">{commerciaux.length}</h4>
          <span className="text-[11px] text-indigo-400">Comptes actifs</span>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-4">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Resultats filtres</span>
          <h4 className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{filtered.length}</h4>
          <span className="text-[11px] text-gray-400">Selon la recherche</span>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 p-4 col-span-2 lg:col-span-1">
          <span className="text-xs font-medium text-emerald-500">Connectes recemment</span>
          <h4 className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
            {commerciaux.filter(c => c.dernierLogin && new Date(c.dernierLogin) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length}
          </h4>
          <span className="text-[11px] text-emerald-400">Ces 30 derniers jours</span>
        </div>
      </div>

      <div className="mb-4">
        <input type="text" placeholder="Rechercher par nom, email ou telephone..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full sm:w-80 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" /></div>
      ) : error ? (
        <div className="text-red-500 text-center py-10 bg-white dark:bg-gray-800 rounded-2xl border p-6">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-400">
          <svg className="w-12 h-12 mb-3 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <p className="font-semibold text-gray-700 dark:text-gray-200">Aucun commercial trouve</p>
          <p className="text-xs mt-1 text-gray-400">{search ? "Essayez une autre recherche" : "Cliquez sur 'Nouveau Commercial' pour en ajouter un"}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
          <div className="max-w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                  {["Commercial", "Email", "Telephone", "Adresse", "Inscrit le", "Actions"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map(c => {
                  const avatar = photoUrl(c.photo);
                  const initials = ((c.prenom?.[0] || "") + (c.nom?.[0] || "C")).toUpperCase();
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full overflow-hidden border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm shrink-0">
                            {avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={avatar} alt="" className="h-full w-full object-cover" />
                            ) : <span>{initials}</span>}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {[c.prenom, c.nom].filter(Boolean).join(" ") || "Commercial #" + c.id}
                            </p>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 mt-0.5">COMMERCIAL</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <a href={`mailto:${c.email}`} className="text-xs text-gray-700 dark:text-gray-300 hover:text-indigo-500 hover:underline">{c.email}</a>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500 dark:text-gray-400">{c.telephone || "—"}</td>
                      <td className="px-5 py-4 text-xs text-gray-500 dark:text-gray-400 max-w-[180px] truncate">{c.adresse || "—"}</td>
                      <td className="px-5 py-4 text-xs text-gray-500">{new Date(c.creeLe).toLocaleDateString("fr-FR")}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <button onClick={() => openEditModal(c)} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 rounded-lg transition-colors">Modifier</button>
                          <button onClick={() => handleDelete(c.id)} className="text-xs text-red-500 hover:text-red-700 hover:underline px-1">Supprimer</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div onClick={e => { if (e.target === e.currentTarget) closeModal(); }} className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 sm:p-6">
          <div onClick={e => e.stopPropagation()} className="w-full max-w-lg rounded-3xl bg-white dark:bg-gray-900 shadow-2xl p-6 border border-gray-200 dark:border-gray-800 my-auto">
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-lg font-bold text-gray-800 dark:text-white">
                {editCommercial ? "Modifier le commercial" : "Nouveau Commercial"}
              </h4>
              <button type="button" onClick={closeModal} className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 transition-colors">x</button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Prenom</label>
                  <input type="text" value={formPrenom} onChange={e => setFormPrenom(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Prenom" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Nom</label>
                  <input type="text" value={formNom} onChange={e => setFormNom(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Nom" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Email *</label>
                <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="commercial@exemple.com" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">CIN</label>
                  <input type="text" value={formCin} onChange={e => setFormCin(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="12345678" maxLength={8} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Matricule Fiscale</label>
                  <input type="text" value={formMatriculeFiscale} onChange={e => setFormMatriculeFiscale(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="1742623LAM000" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Matricule de Voiture</label>
                <div className="flex items-center gap-3">
                  <input type="text" placeholder="(Y)" value={formMatriculeY} onChange={e => setFormMatriculeY(e.target.value)} className="w-20 px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center" />
                  <span className="font-bold text-gray-700 dark:text-gray-300">تونس</span>
                  <input type="text" placeholder="(X)" value={formMatriculeX} onChange={e => setFormMatriculeX(e.target.value)} className="w-24 px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Ex: 220 تونس 1234</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Telephone</label>
                <input type="text" value={formTelephone} onChange={e => setFormTelephone(e.target.value)} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="+216 XX XXX XXX" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Adresse</label>
                <textarea value={formAdresse} onChange={e => setFormAdresse(e.target.value)} rows={2} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white resize-none" placeholder="Rue, Ville..." />
              </div>
              {formError && <div className="rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 p-3 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">{formError}</div>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">Annuler</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                  {saving ? "Enregistrement..." : editCommercial ? "Enregistrer" : "Creer le commercial"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pwdCommercial && (
        <div onClick={e => { if (e.target === e.currentTarget) setPwdCommercial(null); }} className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white dark:bg-gray-900 shadow-2xl p-6 border border-gray-200 dark:border-gray-800 relative">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-gray-900 dark:text-white">Reinitialiser le mot de passe</h4>
              <button type="button" onClick={() => setPwdCommercial(null)} className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 transition-colors">x</button>
            </div>
            <p className="text-xs text-gray-500 mb-4">Commercial : <strong className="text-gray-800 dark:text-white">{[pwdCommercial.prenom, pwdCommercial.nom].filter(Boolean).join(" ") || pwdCommercial.email}</strong></p>
            <form onSubmit={handleResetPassword}>
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Nouveau mot de passe *</label>
                <input type="password" placeholder="Minimum 6 caracteres" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} autoFocus className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              {pwdMessage && <div className={`p-3 rounded-xl text-xs mb-4 ${pwdMessage.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>{pwdMessage.text}</div>}
              <div className="flex justify-end gap-2.5 pt-2">
                <button type="button" onClick={() => setPwdCommercial(null)} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
                <button type="submit" disabled={pwdSaving} className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{pwdSaving ? "Enregistrement..." : "Confirmer"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
