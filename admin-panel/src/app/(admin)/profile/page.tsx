"use client";
import { getApiUrl, getBaseUrl } from "@/utils/api";
import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const API_URL = getApiUrl();
const BASE_URL = getBaseUrl();

export default function ProfilePage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [email, setEmail] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [photo, setPhoto] = useState("");

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const fetchProfile = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem("rzm_token");
        localStorage.removeItem("rzm_user");
        window.location.href = "/signin";
        return;
      }
      if (!res.ok) throw new Error("Erreur lors du chargement du profil");
      const data = await res.json();
      setEmail(data.email || "");
      setPrenom(data.prenom || "");
      setNom(data.nom || "");
      setTelephone(data.telephone || "");
      setPhoto(data.photo || "");

      // Sync local storage
      const stored = localStorage.getItem("rzm_user");
      const currentStored = stored ? JSON.parse(stored) : {};
      localStorage.setItem("rzm_user", JSON.stringify({ ...currentStored, ...data }));
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Upload photo & auto-save to DB immediately
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resUpload = await fetch(`${API_URL}/upload/single`, {
        method: "POST",
        headers: { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
        body: formData,
      });
      const dataUpload = await resUpload.json();
      if (!resUpload.ok) throw new Error(dataUpload.error || "Erreur lors de l'upload de la photo");

      const photoUrl = dataUpload.url;
      setPhoto(photoUrl);

      const resSave = await fetch(`${API_URL}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ photo: photoUrl }),
      });
      const dataSave = await resSave.json();
      if (!resSave.ok) throw new Error(dataSave.error || "Erreur lors de la sauvegarde de la photo");

      const stored = localStorage.getItem("rzm_user");
      const currentStored = stored ? JSON.parse(stored) : {};
      localStorage.setItem("rzm_user", JSON.stringify({ ...currentStored, photo: photoUrl }));

      setMessage({ type: "success", text: "Photo de profil mise à jour !" });
      window.dispatchEvent(new Event("storage"));
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Erreur d'upload" });
    } finally {
      setUploading(false);
    }
  };

  // Remove photo
  const handleRemovePhoto = async () => {
    setPhoto("");
    try {
      await fetch(`${API_URL}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ photo: "" }),
      });
      const stored = localStorage.getItem("rzm_user");
      if (stored) {
        const u = JSON.parse(stored);
        localStorage.setItem("rzm_user", JSON.stringify({ ...u, photo: "" }));
      }
      setMessage({ type: "success", text: "Photo de profil supprimée !" });
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la suppression de la photo" });
    }
  };

  // Click Save -> Trigger Confirmation Modal
  const handleFormSubmitClick = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Le nouveau mot de passe et sa confirmation ne correspondent pas." });
      return;
    }

    setShowConfirmModal(true);
  };

  // Execute Save after user confirms in modal
  const executeSave = async () => {
    setShowConfirmModal(false);
    setSaving(true);
    try {
      const payload: any = {
        prenom,
        nom,
        telephone,
        photo,
      };

      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await fetch(`${API_URL}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.status === 401) {
        localStorage.removeItem("rzm_token");
        localStorage.removeItem("rzm_user");
        window.location.href = "/signin";
        return;
      }
      if (!res.ok) throw new Error(data.error || "Erreur de mise à jour");

      // Sync local storage
      const stored = localStorage.getItem("rzm_user");
      const currentStored = stored ? JSON.parse(stored) : {};
      localStorage.setItem("rzm_user", JSON.stringify({ ...currentStored, prenom, nom, telephone, photo }));

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Redirect to homepage
      router.push("/");
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Erreur lors de la mise à jour" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const avatarUrl = photo ? (photo.startsWith("/") ? BASE_URL + photo : photo) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90">Profil Administrateur</h2>
          <p className="text-sm text-gray-500 mt-1">Gérez vos informations personnelles et votre sécurité.</p>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border text-sm ${
            message.type === "success"
              ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400"
              : "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleFormSubmitClick} className="space-y-6">
        {/* Photo de profil Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">Photo de profil</h3>
          <div className="flex items-center gap-6">
            <div className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-gray-500 uppercase">
                  {(prenom?.[0] || "") + (nom?.[0] || "A")}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {uploading ? "Téléversement..." : "Changer la photo"}
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handlePhotoUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              {photo && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="block text-xs text-red-500 hover:underline"
                >
                  Supprimer la photo
                </button>
              )}
              <p className="text-xs text-gray-400">PNG, JPG ou WEBP. Enregistrement automatique dès l&apos;envoi.</p>
            </div>
          </div>
        </div>

        {/* Informations Personnelles */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Informations personnelles</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Prénom</label>
              <input
                type="text"
                value={prenom}
                onChange={e => setPrenom(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                placeholder="Votre prénom"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Nom</label>
              <input
                type="text"
                value={nom}
                onChange={e => setNom(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                placeholder="Votre nom"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Adresse Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full rounded-lg border border-gray-200 p-2.5 bg-gray-100 dark:bg-gray-800/50 dark:border-gray-700 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">L&apos;adresse email ne peut pas être modifiée.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Numéro de téléphone</label>
              <input
                type="text"
                value={telephone}
                onChange={e => setTelephone(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                placeholder="ex: +216 98 765 432"
              />
            </div>
          </div>
        </div>

        {/* Changer le mot de passe */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Changer de mot de passe (optionnel)</h3>

          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Mot de passe actuel</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Nouveau mot de passe</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                placeholder="Minimum 8 caractères"
                minLength={8}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Confirmer le nouveau mot de passe</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                placeholder="••••••••"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-brand-500 px-6 py-3 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-60"
          >
            {saving ? "Enregistrement..." : "Enregistrer les modifications"}
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl p-6 text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-950">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
              </div>

              <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">Confirmer la sauvegarde</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Voulez-vous enregistrer les modifications et retourner à l&apos;accueil ?
              </p>

              <div className="flex justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Non, rester ici
                </button>
                <button
                  type="button"
                  onClick={executeSave}
                  className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
                >
                  Oui, enregistrer et quitter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
