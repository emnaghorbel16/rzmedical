"use client";

import React, { useEffect, useState, useCallback } from "react";
import { getApiUrl } from "@/utils/api";

interface Client {
  id: number;
  prenom: string | null;
  nom: string | null;
  email: string;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  creeLe: string;
}

interface Conversation {
  id: number;
  sessionId: string;
  clientId: number | null;
  client: Client | null;
  ipAddress: string | null;
  nbMessages: number;
  creeLe: string;
  misAJourLe: string;
  messages: Message[];
}

interface PaginatedResponse {
  conversations: Conversation[];
  total: number;
  page: number;
  totalPages: number;
}

export default function ChatLogsPage() {
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const getToken = () => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("rzm_token") || localStorage.getItem("token") || "";
  };

  const fetchList = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${getApiUrl()}/chat-logs?page=${p}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchList(page); }, [page, fetchList]);

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    const token = getToken();
    const res = await fetch(`${getApiUrl()}/chat-logs/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setSelected(await res.json());
    setDetailLoading(false);
  };

  const deleteConv = async (id: number) => {
    if (!confirm("Supprimer cette conversation ?")) return;
    setDeleting(id);
    const token = getToken();
    await fetch(`${getApiUrl()}/chat-logs/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setDeleting(null);
    if (selected?.id === id) setSelected(null);
    fetchList(page);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">🤖</span> Conversations RZBot
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {data?.total ?? 0} conversation{(data?.total ?? 0) > 1 ? "s" : ""} enregistrée{(data?.total ?? 0) > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Liste des conversations */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <h2 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">Liste des sessions</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400">Chargement…</div>
          ) : data?.conversations.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <p className="text-4xl mb-2">💬</p>
              <p>Aucune conversation enregistrée pour le moment.</p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {data?.conversations.map((conv) => (
                  <li
                    key={conv.id}
                    className={`px-4 py-3 cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors ${
                      selected?.id === conv.id ? "bg-blue-50 dark:bg-gray-700 border-l-4 border-blue-500" : ""
                    }`}
                    onClick={() => openDetail(conv.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-navy-800 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {conv.client
                              ? (conv.client.prenom?.[0] || conv.client.email[0]).toUpperCase()
                              : "?"}
                          </span>
                          <span className="font-medium text-gray-800 dark:text-gray-100 text-sm truncate">
                            {conv.client
                              ? `${conv.client.prenom || ""} ${conv.client.nom || ""}`.trim() || conv.client.email
                              : "Visiteur anonyme"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 truncate pl-9">
                          {conv.messages?.[0]?.content?.slice(0, 70) || "—"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs text-gray-400">{formatDate(conv.misAJourLe)}</span>
                        <div className="text-xs text-blue-500 font-medium mt-0.5">{conv.nbMessages} msgs</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Pagination */}
              {(data?.totalPages ?? 1) > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="text-sm px-3 py-1 rounded border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50"
                  >
                    ← Précédent
                  </button>
                  <span className="text-xs text-gray-500">
                    Page {data?.page} / {data?.totalPages}
                  </span>
                  <button
                    disabled={page === data?.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="text-sm px-3 py-1 rounded border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50"
                  >
                    Suivant →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Détail d'une conversation */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">
              {selected ? `Conversation #${selected.id}` : "Sélectionnez une conversation"}
            </h2>
            {selected && (
              <button
                onClick={() => deleteConv(selected.id)}
                disabled={deleting === selected.id}
                className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded px-2 py-1 transition-colors disabled:opacity-50"
              >
                {deleting === selected.id ? "…" : "🗑 Supprimer"}
              </button>
            )}
          </div>

          {!selected && !detailLoading && (
            <div className="flex-1 flex items-center justify-center text-gray-400 p-8 text-center">
              <div>
                <p className="text-4xl mb-2">👈</p>
                <p className="text-sm">Cliquez sur une conversation pour voir les messages</p>
              </div>
            </div>
          )}

          {detailLoading && (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              Chargement…
            </div>
          )}

          {selected && !detailLoading && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Info client */}
              <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 text-xs text-gray-600 dark:text-gray-300 flex flex-wrap gap-4">
                <span>
                  👤 <strong>Client :</strong>{" "}
                  {selected.client
                    ? `${selected.client.prenom || ""} ${selected.client.nom || ""}`.trim() || selected.client.email
                    : "Visiteur anonyme"}
                </span>
                {selected.client?.email && (
                  <span>📧 {selected.client.email}</span>
                )}
                {selected.ipAddress && (
                  <span>🌐 IP : {selected.ipAddress}</span>
                )}
                <span>🕐 {formatDate(selected.creeLe)}</span>
                <span>💬 {selected.nbMessages} messages</span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selected.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-br-sm"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-sm"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${msg.role === "user" ? "text-blue-200" : "text-gray-400"}`}>
                        {new Date(msg.creeLe).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
