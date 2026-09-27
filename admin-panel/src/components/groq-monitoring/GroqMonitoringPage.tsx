"use client";

import React, { useEffect, useState, useCallback } from "react";
import { getApiUrl } from "@/utils/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";

const API_URL = getApiUrl();

interface GroqResume {
  tokensUtilisesTotal: number;
  tokensPromptTotal: number;
  tokensCompletionTotal: number;
  totalRequetes: number;
  tokensRestants: number | null;
  pourcentage: number | null;
  indicateur: "normal" | "eleve" | "critique";
  modele: string | null;
  derniereMiseAJour: string | null;
  seuilEleve: number;
  seuilCritique: number;
}

interface GroqStats {
  resume: GroqResume;
  parModele: { modele: string; tokensTotal: number; requetes: number }[];
  historique: { heure: string; tokens: number; requetes: number }[];
}

function StatCard({
  label,
  value,
  sub,
  color = "blue",
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: "blue" | "green" | "orange" | "red" | "purple";
  icon: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "from-blue-500 to-blue-600",
    green: "from-emerald-500 to-emerald-600",
    orange: "from-orange-500 to-orange-600",
    red: "from-red-500 to-red-600",
    purple: "from-violet-500 to-violet-600",
  };
  const bg = colorMap[color] || colorMap.blue;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div
        className={`absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br ${bg} opacity-10`}
      />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white">
            {value}
          </p>
          {sub && (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{sub}</p>
          )}
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}

function IndicateurBadge({ indicateur }: { indicateur: string }) {
  if (indicateur === "critique")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        🔴 Critique
      </span>
    );
  if (indicateur === "eleve")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
        <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
        🟠 Élevée
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
      <span className="h-2 w-2 rounded-full bg-emerald-500" />
      🟢 Normale
    </span>
  );
}

function UsageBar({ pourcentage, seuilEleve, seuilCritique }: { pourcentage: number; seuilEleve: number; seuilCritique: number }) {
  const color =
    pourcentage >= seuilCritique
      ? "bg-red-500"
      : pourcentage >= seuilEleve
      ? "bg-orange-500"
      : "bg-emerald-500";

  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>0%</span>
        <span className="font-bold text-gray-800 dark:text-white text-sm">{pourcentage}%</span>
        <span>100%</span>
      </div>
      <div className="h-4 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.min(pourcentage, 100)}%` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[11px] text-gray-400">
        <span className="text-orange-500">⚠️ Élevé: {seuilEleve}%</span>
        <span className="text-red-500">🔴 Critique: {seuilCritique}%</span>
      </div>
    </div>
  );
}

export default function GroqMonitoringPage() {
  const [stats, setStats] = useState<GroqStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/groq-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erreur chargement stats Groq");
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60_000); // rafraîchir toutes les 60s
    return () => clearInterval(interval);
  }, [fetchStats]);

  const handleReset = async () => {
    if (!confirm("Réinitialiser toutes les statistiques Groq ? Cette action est irréversible.")) return;
    setResetting(true);
    try {
      await fetch(`${API_URL}/api/groq-stats/reset`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchStats();
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950/20">
        <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
        <button onClick={fetchStats} className="mt-3 text-sm text-brand-600 underline">
          Réessayer
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const { resume, parModele, historique } = stats;

  const histData = historique.map((h) => ({
    heure: new Date(h.heure).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    tokens: h.tokens,
    requetes: h.requetes,
  }));

  const chartColor =
    resume.indicateur === "critique"
      ? "#ef4444"
      : resume.indicateur === "eleve"
      ? "#f97316"
      : "#10b981";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            🤖 Groq API Monitoring
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Surveillance en temps réel de la consommation des tokens
          </p>
        </div>
        <div className="flex items-center gap-3">
          <IndicateurBadge indicateur={resume.indicateur} />
          <button
            onClick={fetchStats}
            title="Actualiser"
            className="rounded-xl border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            🔄
          </button>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
          >
            {resetting ? "..." : "🗑 Reset Stats"}
          </button>
        </div>
      </div>

      {/* Alerte banner si critique ou élevé */}
      {resume.indicateur !== "normal" && (
        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
            resume.indicateur === "critique"
              ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
              : "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-400"
          }`}
        >
          <span className="text-xl">{resume.indicateur === "critique" ? "🚨" : "⚠️"}</span>
          <span>
            Consommation {resume.indicateur === "critique" ? "critique" : "élevée"} — {resume.pourcentage}% des tokens utilisés.
            Un email d'alerte a été envoyé à l'administrateur.
          </span>
        </div>
      )}

      {/* Barre d'utilisation */}
      {resume.pourcentage !== null && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-800 dark:text-white">Utilisation globale</h2>
            <span className="text-xs text-gray-400">
              Modèle actif : <strong className="text-gray-700 dark:text-gray-200">{resume.modele ?? "—"}</strong>
            </span>
          </div>
          <UsageBar
            pourcentage={resume.pourcentage}
            seuilEleve={resume.seuilEleve}
            seuilCritique={resume.seuilCritique}
          />
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Tokens utilisés"
          value={resume.tokensUtilisesTotal.toLocaleString("fr-FR")}
          icon="📊"
          color="blue"
        />
        <StatCard
          label="Tokens restants"
          value={resume.tokensRestants !== null ? resume.tokensRestants.toLocaleString("fr-FR") : "—"}
          icon="🪫"
          color={resume.indicateur === "critique" ? "red" : resume.indicateur === "eleve" ? "orange" : "green"}
        />
        <StatCard
          label="Tokens prompt"
          value={resume.tokensPromptTotal.toLocaleString("fr-FR")}
          icon="💬"
          color="purple"
        />
        <StatCard
          label="Tokens complétion"
          value={resume.tokensCompletionTotal.toLocaleString("fr-FR")}
          icon="✍️"
          color="blue"
        />
        <StatCard
          label="Nb requêtes"
          value={resume.totalRequetes.toLocaleString("fr-FR")}
          icon="🔁"
          color="orange"
        />
        <StatCard
          label="Dernière mise à jour"
          value={
            resume.derniereMiseAJour
              ? new Date(resume.derniereMiseAJour).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
              : "—"
          }
          sub={
            resume.derniereMiseAJour
              ? new Date(resume.derniereMiseAJour).toLocaleDateString("fr-FR")
              : undefined
          }
          icon="🕐"
          color="green"
        />
      </div>

      {/* Graphique historique */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 font-semibold text-gray-800 dark:text-white">
          📈 Consommation sur les 24 dernières heures
        </h2>
        {histData.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-gray-400 text-sm">
            Aucune donnée disponible — les stats apparaîtront après la première conversation via RZBot.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={histData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis dataKey="heure" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-gray-900, #111)",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 12,
                }}
                formatter={(value: number, name: string) => [
                  value.toLocaleString("fr-FR"),
                  name === "tokens" ? "Tokens" : "Requêtes",
                ]}
              />
              <Area
                type="monotone"
                dataKey="tokens"
                stroke={chartColor}
                strokeWidth={2}
                fill="url(#colorTokens)"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Graphique par modèle */}
      {parModele.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 font-semibold text-gray-800 dark:text-white">
            🧠 Répartition par modèle Groq
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={parModele} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                dataKey="modele"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => v.split("/").pop() ?? v}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#111", border: "none", borderRadius: 8, color: "#fff", fontSize: 12 }}
                formatter={(value: number, name: string) => [
                  value.toLocaleString("fr-FR"),
                  name === "tokensTotal" ? "Tokens" : "Requêtes",
                ]}
              />
              <Legend formatter={(v) => (v === "tokensTotal" ? "Tokens" : "Requêtes")} />
              <Bar dataKey="tokensTotal" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="requetes" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tableau parModele */}
      {parModele.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 font-semibold text-gray-800 dark:text-white">📋 Détail par modèle</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 text-left font-semibold text-gray-500">Modèle</th>
                  <th className="py-2 text-right font-semibold text-gray-500">Tokens</th>
                  <th className="py-2 text-right font-semibold text-gray-500">Requêtes</th>
                  <th className="py-2 text-right font-semibold text-gray-500">Moy. tokens/req</th>
                </tr>
              </thead>
              <tbody>
                {parModele.map((m) => (
                  <tr key={m.modele} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2.5 font-mono text-xs text-gray-800 dark:text-gray-200">{m.modele}</td>
                    <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">
                      {m.tokensTotal.toLocaleString("fr-FR")}
                    </td>
                    <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">{m.requetes}</td>
                    <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">
                      {m.requetes > 0 ? Math.round(m.tokensTotal / m.requetes).toLocaleString("fr-FR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
