"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import {
  submitReview,
  getClientProductReviews,
  type AvisClient,
  type AvisStats,
} from "@/lib/api";

interface ProductReviewsProps {
  produitId: number;
  initialStats?: AvisStats | null;
}

export function ProductReviews({ produitId, initialStats }: ProductReviewsProps) {
  const { user, token, isAuthenticated } = useAuth();
  const { success, error } = useToast();

  const [stats, setStats] = useState<AvisStats>({
    avis: initialStats?.avis || [],
    notemoyenne: initialStats?.notemoyenne ?? null,
    totalAvis: initialStats?.totalAvis ?? 0,
  });

  // Synchronisation côté client : recharge toujours les derniers avis
  useEffect(() => {
    let active = true;
    getClientProductReviews(produitId)
      .then((data) => {
        if (active && data) {
          setStats(data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [produitId]);

  const [isOpenForm, setIsOpenForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Form states
  const [note, setNote] = useState<number>(5);
  const [hoverNote, setHoverNote] = useState<number | null>(null);
  const [nomAuteur, setNomAuteur] = useState("");
  const [titre, setTitre] = useState("");
  const [commentaire, setCommentaire] = useState("");

  const ratingLabels: Record<number, string> = {
    1: "Très décevant",
    2: "Passable",
    3: "Correct",
    4: "Très bien",
    5: "Excellent",
  };

  const activeNote = hoverNote ?? note;

  // Calcul répartition notes 1 à 5
  const distribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = stats.avis.filter((a) => a.note === stars).length;
    const percentage = stats.totalAvis > 0 ? (count / stats.totalAvis) * 100 : 0;
    return { stars, count, percentage };
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentaire.trim() || commentaire.trim().length < 5) {
      error("Votre avis doit comporter au moins 5 caractères.");
      return;
    }

    if (!isAuthenticated && !nomAuteur.trim()) {
      error("Veuillez renseigner votre nom ou pseudonyme.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitReview(
        {
          produitId,
          note,
          titre: titre.trim() || undefined,
          commentaire: commentaire.trim(),
          nomAuteur: nomAuteur.trim() || undefined,
        },
        token || undefined
      );

      success(res.message);

      // Mise à jour immédiate de l'affichage local sans attendre de rechargement
      if (res.avis) {
        setStats((prev) => {
          const updatedAvis = [res.avis, ...prev.avis.filter((a) => a.id !== res.avis.id)];
          const total = updatedAvis.length;
          const sum = updatedAvis.reduce((acc, a) => acc + a.note, 0);
          return {
            avis: updatedAvis,
            totalAvis: total,
            notemoyenne: total > 0 ? Math.round((sum / total) * 10) / 10 : null,
          };
        });
      }

      setFormSubmitted(true);
      setIsOpenForm(false);
      setCommentaire("");
      setTitre("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'envoi de votre avis.";
      error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-12 rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8 lg:p-10" id="avis">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-navy-900 sm:text-2xl">
              Avis et Témoignages
            </h2>
            {stats.totalAvis > 0 && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                {stats.totalAvis} {stats.totalAvis > 1 ? "avis" : "avis"}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-navy-600">
            Retours d&apos;expérience des professionnels de santé et des particuliers.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsOpenForm((prev) => !prev)}
          className="inline-flex items-center justify-center rounded-xl bg-azure-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-azure-700 active:scale-[0.98]"
        >
          {isOpenForm ? "Fermer le formulaire" : "Donner mon avis"}
        </button>
      </div>

      {formSubmitted && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Merci pour votre retour !</p>
          <p className="text-emerald-800">
            Votre avis a bien été enregistré et apparaîtra en ligne dès sa validation par notre équipe de modération.
          </p>
        </div>
      )}

      {/* Formulaire de soumission d'avis */}
      {isOpenForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-xl border border-azure-100 bg-azure-50/40 p-5 sm:p-7"
        >
          <h3 className="text-base font-semibold text-navy-900">
            Partagez votre expérience sur ce produit
          </h3>

          <div className="mt-4 space-y-4">
            {/* Note étoiles */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700">
                Votre note globale *
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverNote(star)}
                      onMouseLeave={() => setHoverNote(null)}
                      onClick={() => setNote(star)}
                      className="p-1 transition-transform hover:scale-110 focus:outline-none"
                    >
                      <svg
                        className={`h-7 w-7 transition-colors ${
                          star <= activeNote
                            ? "fill-amber-400 text-amber-400"
                            : "fill-transparent text-gray-300"
                        }`}
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                        />
                      </svg>
                    </button>
                  ))}
                </div>
                <span className="text-sm font-medium text-navy-700">
                  {ratingLabels[activeNote]}
                </span>
              </div>
            </div>

            {/* Auteur si non connecté */}
            {!isAuthenticated ? (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700">
                  Votre nom ou qualité *
                </label>
                <input
                  type="text"
                  required
                  value={nomAuteur}
                  onChange={(e) => setNomAuteur(e.target.value)}
                  placeholder="Ex : Dr. Ben Salem, Cabinet RZ, Mohamed..."
                  className="mt-1.5 w-full rounded-lg border border-border bg-white px-3.5 py-2 text-sm text-navy-900 placeholder:text-navy-400 focus:border-azure-500 focus:outline-none focus:ring-2 focus:ring-azure-200"
                />
              </div>
            ) : (
              <p className="text-xs text-navy-600">
                Vous publiez en tant que :{" "}
                <strong className="text-navy-900">
                  {user?.prenom} {user?.nom}
                </strong>
              </p>
            )}

            {/* Titre optionnel */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700">
                Titre de votre avis (optionnel)
              </label>
              <input
                type="text"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Ex : Matériel fiable et conforme aux attentes"
                className="mt-1.5 w-full rounded-lg border border-border bg-white px-3.5 py-2 text-sm text-navy-900 placeholder:text-navy-400 focus:border-azure-500 focus:outline-none focus:ring-2 focus:ring-azure-200"
              />
            </div>

            {/* Commentaire */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700">
                Votre avis détaillé *
              </label>
              <textarea
                required
                rows={3}
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                placeholder="Précisez la qualité, la facilité d'utilisation, l'efficacité clinique ou technique..."
                className="mt-1.5 w-full rounded-lg border border-border bg-white px-3.5 py-2 text-sm text-navy-900 placeholder:text-navy-400 focus:border-azure-500 focus:outline-none focus:ring-2 focus:ring-azure-200"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsOpenForm(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-navy-600 hover:bg-white"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center rounded-lg bg-azure-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-azure-700 disabled:opacity-50"
              >
                {submitting ? "Envoi en cours..." : "Soumettre mon avis"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Résumé & Répartition */}
      {stats.totalAvis > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-8 border-b border-border pb-8 md:grid-cols-12 md:items-center">
          <div className="flex flex-col items-center justify-center text-center md:col-span-4 md:border-r md:border-border md:pr-8">
            <span className="text-5xl font-extrabold tracking-tight text-navy-900">
              {stats.notemoyenne ? stats.notemoyenne.toFixed(1) : "5.0"}
            </span>
            <div className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <svg
                  key={s}
                  className={`h-5 w-5 ${
                    s <= Math.round(stats.notemoyenne ?? 5)
                      ? "fill-amber-400 text-amber-400"
                      : "fill-gray-200 text-gray-200"
                  }`}
                  viewBox="0 0 24 24"
                >
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
              ))}
            </div>
            <p className="mt-1 text-xs text-navy-600">
              Basé sur {stats.totalAvis} {stats.totalAvis > 1 ? "avis clients" : "avis client"}
            </p>
          </div>

          <div className="space-y-2 md:col-span-8">
            {distribution.map(({ stars, count, percentage }) => (
              <div key={stars} className="flex items-center gap-3 text-xs">
                <span className="w-12 font-medium text-navy-700">{stars} étoiles</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="w-8 text-right font-medium text-navy-600">{count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-slate-50/60 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-azure-50 text-azure-600">
            <svg className="h-6 w-6 fill-none stroke-currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
              />
            </svg>
          </div>
          <p className="mt-3 text-base font-semibold text-navy-900">
            Aucun avis pour l&apos;instant
          </p>
          <p className="mt-1 text-sm text-navy-600">
            Vous avez utilisé ou commandé ce produit ? Partagez votre expérience clinique ou technique pour orienter d&apos;autres praticiens.
          </p>
          {!isOpenForm && (
            <button
              type="button"
              onClick={() => setIsOpenForm(true)}
              className="mt-4 inline-flex items-center rounded-lg bg-navy-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-navy-800"
            >
              Écrire le premier avis
            </button>
          )}
        </div>
      )}

      {/* Liste des avis */}
      {stats.avis.length > 0 && (
        <div className="mt-8 space-y-6">
          {stats.avis.map((avis) => (
            <article
              key={avis.id}
              className="rounded-xl border border-border/70 bg-white p-5 transition hover:border-border"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-azure-100 text-sm font-bold text-azure-700">
                    {avis.nomAuteur.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-navy-900">
                        {avis.nomAuteur}
                      </span>
                      {avis.verifieAchat && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          <svg className="h-3 w-3 fill-emerald-600" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Achat vérifié
                        </span>
                      )}
                    </div>
                    <time className="text-xs text-navy-400">
                      {new Date(avis.creeLe).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </time>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      className={`h-4 w-4 ${
                        star <= avis.note
                          ? "fill-amber-400 text-amber-400"
                          : "fill-gray-200 text-gray-200"
                      }`}
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  ))}
                </div>
              </div>

              {avis.titre && (
                <h4 className="mt-3 text-sm font-bold text-navy-900">
                  {avis.titre}
                </h4>
              )}

              <p className="mt-2 text-sm leading-relaxed text-navy-700">
                {avis.commentaire}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
