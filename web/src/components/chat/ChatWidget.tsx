"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/providers/AuthProvider";

// ── Utilitaires ───────────────────────────────────────────────────────────────

/** Transforme un message d'erreur technique Groq en message convivial en français. */
function sanitizeGroqError(raw: string): string {
  if (!raw) return "Une erreur est survenue. Veuillez réessayer.";
  if (
    raw.toLowerCase().includes("surcharg") ||
    raw.toLowerCase().includes("rate limit") ||
    raw.includes("429") ||
    raw.includes("tokens per minute") ||
    raw.includes("rate_limit_exceeded")
  ) {
    return "Le chatbot est momentanément surchargé. Réessayez dans quelques secondes 🙏";
  }
  if (raw.toLowerCase().includes("connexion") || raw.toLowerCase().includes("network") || raw.toLowerCase().includes("fetch")) {
    return "Connexion perdue. Vérifiez votre réseau et réessayez.";
  }
  if (raw.toLowerCase().includes("api_key") || raw.toLowerCase().includes("unauthorized")) {
    return "Problème de configuration du chatbot. Contactez le support.";
  }
  // Masquer les détails JSON techniques
  if (raw.startsWith("{") || raw.includes("\"error\"") || raw.includes("Erreur Groq")) {
    return "Une erreur technique est survenue. Réessayez dans un instant.";
  }
  return raw.length > 120 ? raw.slice(0, 117) + "…" : raw;
}

// ── Types ──────────────────────────────────────────────────────────────────────


interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string;
  timestamp: Date;
  streaming?: boolean;
}

// ── Suggestions de démarrage rapide ───────────────────────────────────────────

const QUICK_SUGGESTIONS = [
  "Quels équipements dentaires proposez-vous ?",
  "Comment passer une commande ?",
  "Livraison en Tunisie ?",
  "Vos marques disponibles ?",
  "Comparez deux produits pour moi",
];

// ── Icônes SVG inline (pas de dépendance externe) ─────────────────────────────

function IconBot() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 min-w-[16px] min-h-[16px] shrink-0" aria-hidden>
      <rect x="3" y="8" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3v5M9 3h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="14" r="1.5" fill="currentColor" />
      <circle cx="15" cy="14" r="1.5" fill="currentColor" />
      <path d="M9 18c1 .7 2.5.7 3 0 .5-.7 2 -.7 3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" aria-hidden>
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2L15 22 11 13 2 9l20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconMinimize() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" aria-hidden>
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" aria-hidden>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconImage() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
      <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5" aria-label="L'assistant rédige une réponse">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-slate-400"
          style={{
            animation: "chatDot 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── Parser de tableaux Markdown standards ─────────────────────────────────────

function parseMarkdownTables(text: string): string {
  const tableRegex = /((?:^[ \t]*\|?.+\|.+[ \t]*\r?\n)(?:^[ \t]*\|?[\s\-:]+[\s\-:|]+[ \t]*\r?\n)(?:^[ \t]*\|?.+\|.+[ \t]*(?:\r?\n|$))+)/gm;

  return text.replace(tableRegex, (match) => {
    const lines = match.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return match;

    const parseRow = (line: string) => {
      let trimmed = line.trim();
      if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
      if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
      return trimmed.split("|").map((cell) => cell.trim());
    };

    const headerCols = parseRow(lines[0]);
    const bodyLines = lines.slice(2);

    let html = '<div class="my-2.5 w-full overflow-x-auto rounded-xl border border-slate-200/90 shadow-sm bg-white"><table class="w-full text-left border-collapse text-[11px]">';
    
    // Header dégradé Navy RZMedical
    html += '<thead style="background: linear-gradient(135deg, #0c2340 0%, #1a3a6b 100%);" class="text-white"><tr>';
    for (const h of headerCols) {
      html += `<th class="px-3 py-2 text-[10.5px] font-bold tracking-wide border-b border-navy-900/40 text-left whitespace-nowrap">${h}</th>`;
    }
    html += '</tr></thead>';

    // Body
    html += '<tbody class="divide-y divide-slate-100">';
    bodyLines.forEach((rowLine, idx) => {
      const cols = parseRow(rowLine);
      const bg = idx % 2 === 0 ? "bg-white" : "bg-slate-50/70";
      html += `<tr class="${bg} hover:bg-azure-50/60 transition-colors">`;
      cols.forEach((cell) => {
        let cellFormatted = cell;
        if (cell.includes("Disponible")) {
          cellFormatted = `<span class="inline-block px-1.5 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-100 text-emerald-800">${cell}</span>`;
        } else if (cell.includes("Épuisé") || cell.includes("Rupture")) {
          cellFormatted = `<span class="inline-block px-1.5 py-0.5 rounded-full text-[9.5px] font-bold bg-red-100 text-red-700">${cell}</span>`;
        } else if (/^\d[\d\s,.]*\s*(TND|dt|DT)?$/i.test(cell.trim())) {
          cellFormatted = `<span class="font-bold text-azure-700">${cell}</span>`;
        }
        html += `<td class="px-3 py-2 text-slate-700 leading-snug border-r border-slate-100 last:border-r-0 whitespace-nowrap">${cellFormatted}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  });
}

// ── Markdown simplifié ────────────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  const withTables = parseMarkdownTables(text);

  return withTables
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-0.5 text-azure-600 hover:text-azure-700 underline font-semibold transition-colors">$1 ↗</a>')
    .replace(/`(.+?)`/g, '<code class="bg-slate-100 text-slate-700 px-1 py-0.5 rounded text-[11px] font-mono border border-slate-200">$1</code>')
    .replace(/^### (.+)$/gm, '<p class="font-semibold text-navy-700 mt-2 mb-0.5">$1</p>')
    .replace(/^## (.+)$/gm, '<p class="font-bold text-navy-800 mt-2 mb-1">$1</p>')
    .replace(/^- (.+)$/gm, '<li class="ml-3 list-disc text-slate-700">$1</li>')
    .replace(/(<li[^>]*>[\s\S]*?<\/li>)/g, '<ul class="space-y-0.5 my-1">$1</ul>')
    .replace(/\n\n/g, '<br class="mb-1" />')
    .replace(/\n/g, "<br />");
}

// ── Tableau de comparaison produits ───────────────────────────────────────────

/** Détecte la "meilleure" colonne pour une ligne (prix le plus bas, stock le plus élevé, etc.) */
function detectBestCol(values: string[]): number | null {
  // Prix : cherche les valeurs numériques (premier nombre dans chaque cellule)
  const nums = values.map((v) => {
    const m = v.match(/[\d]+([.,]\d+)?/);
    return m ? parseFloat(m[0].replace(",", ".")) : null;
  });
  if (nums.every((n) => n !== null)) {
    // Pour le prix → plus bas = meilleur
    const min = Math.min(...(nums as number[]));
    return nums.indexOf(min);
  }
  return null;
}

function CompareCellValue({ val, isBest }: { val: string; isBest: boolean }) {
  const hasCheck = val.includes("✅");
  const hasCross = val.includes("❌");
  const hasWarn  = val.includes("⚠️");

  return (
    <div
      className={`px-2 py-2.5 text-[10.5px] text-center border-r border-slate-200/70 last:border-r-0 leading-snug transition-colors ${
        hasCheck
          ? "text-emerald-700 font-semibold bg-emerald-50/60"
          : hasCross
          ? "text-red-500 font-semibold bg-red-50/40"
          : hasWarn
          ? "text-amber-600 font-semibold bg-amber-50/50"
          : isBest
          ? "text-blue-700 font-semibold"
          : "text-slate-700"
      }`}
    >
      {val}
      {isBest && !hasCheck && !hasCross && !hasWarn && (
        <span className="ml-0.5 text-[8px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded-full align-middle">
          ★
        </span>
      )}
    </div>
  );
}

function CompareTable({
  products,
  rows,
}: {
  products: string[];
  rows: { label: string; values: string[] }[];
}) {
  const colCount = products.length;

  // Colonnes gagnantes par ligne (pour mettre en valeur le meilleur choix)
  const bestCols: (number | null)[] = rows.map((row) => {
    const lbl = row.label.toLowerCase();
    // Pour les lignes de prix : meilleur = plus bas
    if (lbl.includes("prix")) {
      const nums = row.values.map((v) => {
        const m = v.match(/[\d]+([.,]\d+)?/);
        return m ? parseFloat(m[0].replace(",", ".")) : null;
      });
      if (nums.every((n) => n !== null)) {
        const min = Math.min(...(nums as number[]));
        return nums.indexOf(min);
      }
    }
    // Pour le stock : meilleur = plus haut
    if (lbl.includes("stock")) {
      const nums = row.values.map((v) => {
        const m = v.match(/\d+/);
        return m ? parseInt(m[0]) : 0;
      });
      const max = Math.max(...nums);
      return max > 0 ? nums.indexOf(max) : null;
    }
    return null;
  });

  return (
    <div
      className="my-3 w-full overflow-x-auto rounded-2xl border border-slate-200/80 shadow-lg"
      style={{ maxWidth: "100%" }}
    >
      {/* inner wrapper forces a minimum width so names never get crushed */}
      <div style={{ minWidth: `${96 + products.length * 130}px` }}>
      {/* ── Header produits ── */}
      <div
        className="grid"
        style={{ gridTemplateColumns: `96px repeat(${colCount}, minmax(130px, 1fr))` }}
      >
        {/* Coin haut-gauche vide */}
        <div
          className="px-2 py-3 border-b border-r border-white/15 flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #0c2340 0%, #1565c0 100%)" }}
        >
          <span className="text-[9px] text-white/60 font-semibold uppercase tracking-wide">Critères</span>
        </div>

        {/* Colonnes produits */}
        {products.map((name, i) => (
          <div
            key={i}
            className="px-2 py-3 flex flex-col items-center justify-center border-b border-r border-white/15 last:border-r-0 gap-0.5"
            style={{ background: i === 0
              ? "linear-gradient(135deg, #0c2340 0%, #1565c0 100%)"
              : "linear-gradient(135deg, #1a3a5c 0%, #0d47a1 100%)"
            }}
          >
            <span className="text-[11px] font-bold text-white text-center leading-tight break-words">
              {name}
            </span>
            {i === 0 && colCount === 2 && (
              <span className="text-[8px] bg-white/20 text-white/90 px-1.5 py-0.5 rounded-full">A</span>
            )}
            {i === 1 && colCount === 2 && (
              <span className="text-[8px] bg-white/20 text-white/90 px-1.5 py-0.5 rounded-full">B</span>
            )}
          </div>
        ))}
      </div>

      {/* ── Lignes de données ── */}
      {rows.map((row, ri) => (
        <div
          key={ri}
          className="grid items-stretch border-b border-slate-100 last:border-b-0"
          style={{
            gridTemplateColumns: `96px repeat(${colCount}, minmax(130px, 1fr))`,
            background: ri % 2 === 0 ? "#ffffff" : "#f8fafd",
          }}
        >
          {/* Étiquette critère */}
          <div className="px-2 py-2.5 text-[10px] font-semibold text-slate-600 border-r border-slate-200/70 bg-slate-50 leading-tight flex items-center">
            {row.label}
          </div>

          {/* Valeurs par produit */}
          {row.values.map((val, vi) => (
            <CompareCellValue
              key={vi}
              val={val}
              isBest={bestCols[ri] === vi}
            />
          ))}
        </div>
      ))}

      {/* ── Pied de tableau ── */}
      <div
        className="px-3 py-2 text-[9px] text-white/70 text-right"
        style={{ background: "linear-gradient(135deg, #0c2340 0%, #1565c0 100%)" }}
      >
        Comparaison RZBot · données catalogue RZMedical
      </div>
      </div>
    </div>
  );
}

// ── Rendu inline (PRODUCT + SUGGESTION) ───────────────────────────────────────

function renderInlineContent(content: string, onSuggestionClick?: (text: string) => void) {
  const regex = /\[PRODUCT\|(.*?)\|(.*?)\|(.*?)\]|\[SUGGESTION\|(.*?)\]/g;
  const inlineParts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      inlineParts.push(
        <span
          key={`text-${lastIndex}`}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content.slice(lastIndex, match.index)) }}
        />
      );
    }

    if (match[4]) {
      const suggestionText = match[4];
      inlineParts.push(
        <button
          key={`sugg-${match.index}`}
          onClick={() => onSuggestionClick?.(suggestionText)}
          className="inline-block mt-2 mr-2 text-[11px] px-2.5 py-1.5 rounded-xl border border-azure-200 bg-azure-50 text-azure-700 hover:bg-azure-100 hover:border-azure-400 hover:text-azure-800 transition-all duration-150 shadow-sm font-medium"
        >
          {suggestionText}
        </button>
      );
    } else {
      const [, nom, prix, ref] = match;
      inlineParts.push(
        <div key={`card-${match.index}`} className="my-2 p-3 border border-azure-200/60 rounded-xl bg-white shadow-sm flex flex-col gap-1 w-[240px]">
          <div className="flex items-start justify-between gap-2">
            <span className="font-bold text-navy-800 text-[13px] leading-tight">{nom}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-azure-600 font-bold text-[14px]">{prix} TND</span>
            <span className="text-[10px] text-slate-400 font-mono">Réf: {ref}</span>
          </div>
          <a
            href={`/produit/${ref}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 text-[11px] text-center bg-azure-50 text-azure-700 py-1.5 rounded-lg hover:bg-azure-100 transition-colors font-medium border border-azure-200/50"
          >
            Voir le produit
          </a>
        </div>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    inlineParts.push(
      <span
        key={`text-end-${lastIndex}`}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(content.slice(lastIndex)) }}
      />
    );
  }

  return inlineParts.length > 0
    ? <>{inlineParts}</>
    : <span dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />;
}

// ── Rendu de Contenu Riche (Cartes Produits & Suggestions & Comparaisons) ────

function renderMessageContent(content: string, onSuggestionClick?: (text: string) => void) {
  // Détection des blocs COMPARE (multi-lignes):
  //   [COMPARE|NomA|NomB]
  //   [COMPARE_ROW|Critère|ValA|ValB]
  //   [COMPARE_END]
  const compareBlockRegex =
    /\[COMPARE\|([^\]]+)\]([\s\S]*?)\[COMPARE_END\]/g;

  interface Segment {
    type: "text" | "compare";
    content: string;
    products?: string[];
    rows?: { label: string; values: string[] }[];
  }

  const segments: Segment[] = [];
  let lastIdx = 0;
  let cMatch: RegExpExecArray | null;

  while ((cMatch = compareBlockRegex.exec(content)) !== null) {
    if (cMatch.index > lastIdx) {
      segments.push({ type: "text", content: content.slice(lastIdx, cMatch.index) });
    }

    // Noms des produits : séparés par ||| ou par |
    const namesRaw = cMatch[1]
      .split(/\|+/)
      .map((s) => s.trim())
      .filter(Boolean);

    // Parser les COMPARE_ROW
    const bodyRaw = cMatch[2];
    const rows: { label: string; values: string[] }[] = [];
    const rowRegex = /\[COMPARE_ROW\|([^\]]+)\]/g;
    let rMatch: RegExpExecArray | null;
    while ((rMatch = rowRegex.exec(bodyRaw)) !== null) {
      const parts2 = rMatch[1].split("|");
      const label = parts2[0].trim();
      const lower = label.toLowerCase();
      // Exclure Stock et Disponibilité catalogue du tableau comparatif
      if (
        lower.includes("stock") ||
        lower.includes("disponibilité") ||
        lower.includes("disponibilite") ||
        (lower.includes("catalogue") && (lower.includes("dispo") || lower.includes("vendu")))
      ) {
        continue;
      }
      const values = parts2.slice(1).map((v) => v.trim());
      rows.push({ label, values });
    }

    segments.push({ type: "compare", content: "", products: namesRaw, rows });
    lastIdx = compareBlockRegex.lastIndex;
  }

  if (lastIdx < content.length) {
    segments.push({ type: "text", content: content.slice(lastIdx) });
  }

  // Si aucun bloc COMPARE trouvé → rendu inline classique
  if (!segments.some((s) => s.type === "compare")) {
    return renderInlineContent(content, onSuggestionClick);
  }

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "compare" && seg.products && seg.rows) {
          return (
            <CompareTable
              key={`cmp-${i}`}
              products={seg.products}
              rows={seg.rows}
            />
          );
        }
        return (
          <span key={`seg-${i}`}>
            {renderInlineContent(seg.content, onSuggestionClick)}
          </span>
        );
      })}
    </>
  );
}

// ── Bubble de message ─────────────────────────────────────────────────────────

function MessageBubble({ msg, onSuggestionClick }: { msg: Message; onSuggestionClick?: (t: string) => void }) {
  const isUser = msg.role === "user";
  const time = msg.timestamp.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar bot */}
      {!isUser && (
        <div className="w-7 h-7 min-w-[28px] min-h-[28px] max-w-[28px] max-h-[28px] shrink-0 rounded-full bg-gradient-to-br from-azure-500 to-navy-800 flex items-center justify-center text-white shadow-sm mt-0.5">
          <IconBot />
        </div>
      )}

      <div className={`flex flex-col gap-0.5 max-w-[82%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Bulle */}
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
            isUser
              ? "bg-gradient-to-br from-azure-500 to-navy-700 text-white rounded-br-sm shadow-sm"
              : "bg-white border border-slate-200 text-slate-700 rounded-bl-sm shadow-sm"
          }`}
        >
          {msg.streaming && msg.content === "" ? (
            <TypingDots />
          ) : isUser ? (
            <span className="whitespace-pre-wrap">
              {msg.image && (
                <img src={msg.image} alt="Upload" className="max-w-full h-auto rounded-lg mb-2 border border-white/20" style={{ maxHeight: '160px' }} />
              )}
              {msg.content}
            </span>
          ) : (
            renderMessageContent(msg.content, onSuggestionClick)
          )}
        </div>

        {/* Heure */}
        <span className="text-[10px] text-slate-400 px-1">{time}</span>
      </div>
    </div>
  );
}

// ── Widget principal ──────────────────────────────────────────────────────────

export function ChatWidget() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  // Mobile keyboard detection
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef<boolean>(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Restaurer l'historique depuis sessionStorage au chargement
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("rzmedical_chat_messages");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
          setShowSuggestions(false);
        }
      }
    } catch {}
  }, []);

  // Sauvegarder automatiquement l'historique dans sessionStorage
  useEffect(() => {
    if (messages.length > 0) {
      try {
        sessionStorage.setItem("rzmedical_chat_messages", JSON.stringify(messages));
      } catch {}
    }
  }, [messages]);

  // Détection adaptation au clavier virtuel mobile via visualViewport
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onViewportResize = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
      if (offset > 50 && !isUserScrolledUpRef.current) {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    };

    vv.addEventListener("resize", onViewportResize);
    vv.addEventListener("scroll", onViewportResize);
    return () => {
      vv.removeEventListener("resize", onViewportResize);
      vv.removeEventListener("scroll", onViewportResize);
    };
  }, []);

  // Gestion du scroll utilisateur pour pouvoir "dérouler" librement
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const scrolledUp = distanceFromBottom > 100;
    isUserScrolledUpRef.current = scrolledUp;
    setIsScrolledUp(scrolledUp);
  };

  const scrollToBottom = () => {
    isUserScrolledUpRef.current = false;
    setIsScrolledUp(false);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll automatique uniquement si l'utilisateur est déjà en bas
  useLayoutEffect(() => {
    if (!isUserScrolledUpRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Focus sur l'input à l'ouverture
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
      setHasNewMessage(false);
    }
  }, [open]);

  // Nettoyage de l'AbortController
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if ((!text.trim() && !selectedImage) || loading) return;

      const imageToSend = selectedImage;
      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text.trim() || (imageToSend ? "Image partagée." : ""),
        image: imageToSend || undefined,
        timestamp: new Date(),
      };

      const assistantMsgId = `a-${Date.now()}`;
      const assistantMsg: Message = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setSelectedImage(null);
      setLoading(true);
      setShowSuggestions(false);
      isUserScrolledUpRef.current = false;
      setIsScrolledUp(false);

      // Construction de l'historique pour l'API
      const history = [...messages, userMsg].map((m) => ({
        role: m.role === "user" ? "user" : "model" as "user" | "model",
        content: m.content,
        image: m.image,
      }));

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      console.log("💬 [RZBot Navigateur (F12)] Envoi du message au serveur:", text.trim() || "(image)");

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ messages: history }),
          signal: ctrl.signal,
        });

        console.log("📡 [RZBot Navigateur (F12)] Réponse HTTP statut:", res.status);

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.error || `Erreur ${res.status} — réessayez dans un instant.`,
          );
        }

        if (!res.body) throw new Error("Pas de flux de réponse.");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") break;

            let parsed: { error?: string; text?: string; log?: string };
            try {
              parsed = JSON.parse(raw);
            } catch {
              // ligne mal formée, on ignore
              continue;
            }

            if (parsed.log) {
              console.log(
                `%c[RZBot F12] ${parsed.log}`,
                "color: #0284c7; background: #f0f9ff; padding: 2px 8px; border-radius: 4px; font-weight: 600; border-left: 3px solid #0284c7;"
              );
            }

            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) {
              fullText += parsed.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: fullText, streaming: true }
                    : m,
                ),
              );
            }
          }
        }

        console.log("%c[RZBot F12] ✅ Réponse complète reçue et affichée.", "color: #16a34a; font-weight: bold;");

        // Fin du streaming
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, streaming: false, timestamp: new Date() }
              : m,
          ),
        );

        if (!open) setHasNewMessage(true);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const rawMsg = err instanceof Error ? err.message : "";
        // Convertir les erreurs techniques en messages conviviaux
        const errorText = sanitizeGroqError(rawMsg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: `⚠️ ${errorText}`, streaming: false }
              : m,
          ),
        );
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [loading, messages, open, token, selectedImage],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() || selectedImage) {
        sendMessage(input);
      }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        const MAX_WIDTH = 512;
        const MAX_HEIGHT = 512;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        // Reduce quality to 0.5 to stay within Groq vision payload limit
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.5);
        setSelectedImage(compressedBase64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // Reset input
  };

  const handleSuggestion = (s: string) => {
    sendMessage(s);
  };

  const clearConversation = () => {
    abortRef.current?.abort();
    setMessages([]);
    try {
      sessionStorage.removeItem("rzmedical_chat_messages");
    } catch {}
    setShowSuggestions(true);
    setLoading(false);
  };

  return (
    <>
      {/* ── Styles d'animation injectés ────────────────────────────────────── */}
      <style>{`
        @keyframes chatDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes chatFadeIn {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes chatPulseRing {
          0%   { transform: scale(1);    opacity: 0.6; }
          70%  { transform: scale(1.35); opacity: 0; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @keyframes chatBounce {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.08); }
        }
        .chat-window-enter {
          animation: chatFadeIn 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        .chat-msg-enter {
          animation: chatFadeIn 0.2s ease-out forwards;
        }
        #rzbot-input::placeholder { color: #94a3b8; }
        #rzbot-scroll::-webkit-scrollbar { width: 4px; }
        #rzbot-scroll::-webkit-scrollbar-track { background: transparent; }
        #rzbot-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
      `}</style>

      {/* ── Fenêtre de chat (thème CLAIR) ──────────────────────────────────── */}
      {open && (
        <div
          id="rzmedical-chatbot-window"
          role="dialog"
          aria-label="Assistant RZBot"
          aria-modal="true"
          className="chat-window-enter fixed z-[110] flex flex-col overflow-hidden bottom-20 right-3 left-3 sm:left-auto sm:right-6 sm:bottom-24 sm:w-[400px] h-[540px] max-h-[75vh] sm:max-h-[82vh] rounded-2xl border border-slate-200/90 shadow-2xl"
          style={{
            background: "#ffffff",
            boxShadow: "0 20px 60px rgba(12,35,64,0.22), 0 4px 20px rgba(12,35,64,0.10)",
            ...(keyboardOffset > 0 ? { bottom: keyboardOffset + 12 } : {}),
          }}
        >
          {/* ── Header navy gradient ─────────────────────────────────────── */}
          <div
            className="flex-shrink-0 flex items-center gap-3 px-4 py-3"
            style={{
              background: "linear-gradient(135deg, #0c2340 0%, #1a3a6b 100%)",
            }}
          >
            {/* Avatar bot */}
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-white shadow-sm">
                <IconBot />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0c2340] shadow" />
            </div>

            {/* Titre */}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-white tracking-tight leading-none">RZBot</p>
              <p className="text-[11px] text-sky-200 mt-0.5 truncate">Assistant RZMedical · En ligne</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearConversation}
                  title="Effacer la conversation"
                  className="px-2 py-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors text-[10px] font-medium"
                >
                  Effacer
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Réduire le chat"
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <IconMinimize />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer le chat"
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-red-400/25 transition-colors"
              >
                <IconClose />
              </button>
            </div>
          </div>

          {/* ── Zone de messages — fond gris très clair ──────────────────── */}
          <div
            id="rzbot-scroll"
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-3 relative"
            style={{
              background: "#f8fafc",
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-y",
            }}
          >
            {/* Message de bienvenue */}
            {messages.length === 0 && (
              <div className="chat-msg-enter">
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 min-w-[28px] min-h-[28px] max-w-[28px] max-h-[28px] shrink-0 rounded-full bg-gradient-to-br from-azure-600 to-navy-800 flex items-center justify-center text-white shadow-sm mt-0.5">
                    <IconBot />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-[13px] leading-relaxed bg-white border border-slate-200 shadow-sm">
                      <span className="text-slate-700">
                        👋 Bonjour ! Je suis <strong className="text-navy-900">RZBot</strong>, votre assistant RZMedical.
                        <br />
                        Je suis là pour vous aider à trouver vos équipements médico-dentaires. 😊
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 px-1">Maintenant</span>
                  </div>
                </div>

                {/* Suggestions */}
                {showSuggestions && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {QUICK_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleSuggestion(s)}
                        className="text-[11px] px-2.5 py-1.5 rounded-xl border border-azure-200 bg-white text-azure-700 hover:bg-azure-50 hover:border-azure-400 hover:text-azure-800 transition-all duration-150 text-left leading-snug shadow-sm font-medium"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            {messages.map((msg) => (
              <div key={msg.id} className="chat-msg-enter">
                <MessageBubble msg={msg} onSuggestionClick={handleSuggestion} />
              </div>
            ))}

            {/* Bouton pour redescendre rapidement en bas si on a déroulé vers le haut */}
            {isScrolledUp && (
              <div className="sticky bottom-1 left-0 right-0 flex justify-center z-20 pointer-events-none">
                <button
                  type="button"
                  onClick={scrollToBottom}
                  className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/85 hover:bg-slate-900 text-white text-[11px] font-medium shadow-lg backdrop-blur transition-all duration-200 animate-fadeIn"
                >
                  <span>↓ Derniers messages</span>
                </button>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* ── Zone de saisie — fond blanc ──────────────────────────────── */}
          <div
            className="flex-shrink-0 border-t border-slate-100 px-3 py-3"
            style={{
              background: "#ffffff",
              paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            }}
          >
            {/* Image Preview Area */}
            {selectedImage && (
              <div className="relative inline-block mb-3 ml-2 group animate-chatFadeIn">
                <img src={selectedImage} alt="Aperçu" className="h-16 w-16 object-cover rounded-lg border-2 border-azure-200 shadow-sm" />
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-0.5 shadow transition-transform hover:scale-110"
                  aria-label="Supprimer l'image"
                >
                  <IconClose />
                </button>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              {/* Hidden inputs */}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageSelect}
              />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                ref={cameraInputRef}
                onChange={handleImageSelect}
              />
              {/* Gallery button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                aria-label="Choisir une image depuis la galerie"
                title="Galerie"
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-slate-400 bg-slate-50 border border-slate-200 rounded-xl transition-colors hover:text-azure-600 hover:bg-azure-50 hover:border-azure-200 disabled:opacity-50"
              >
                <IconImage />
              </button>
              {/* Camera button */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={loading}
                aria-label="Prendre une photo directement"
                title="Appareil photo"
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-slate-400 bg-slate-50 border border-slate-200 rounded-xl transition-colors hover:text-azure-600 hover:bg-azure-50 hover:border-azure-200 disabled:opacity-50"
              >
                <IconCamera />
              </button>
              <textarea
                ref={inputRef}
                id="rzbot-input"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder="Posez votre question…"
                disabled={loading}
                rows={1}
                aria-label="Message à envoyer"
                className="flex-1 resize-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-800 outline-none focus:border-azure-400 focus:ring-2 focus:ring-azure-100 transition-all disabled:opacity-50 leading-relaxed min-h-[40px]"
                style={{ scrollbarWidth: "thin" }}
              />
              <button
                type="submit"
                disabled={loading || (!input.trim() && !selectedImage)}
                aria-label="Envoyer le message"
                className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-azure-500 to-navy-700 flex items-center justify-center text-white shadow transition-all hover:from-azure-400 hover:to-navy-600 hover:shadow-md disabled:opacity-35 disabled:cursor-not-allowed active:scale-95"
              >
                <IconSend />
              </button>
            </form>

            <p className="text-[10px] text-slate-400 text-center mt-2">
              Propulsé par <span className="text-azure-500 font-medium">RZ MEDICAL AI</span>
            </p>
          </div>
        </div>
      )}

      {/* ── Bouton FAB (masqué quand le chat est ouvert) ─────────────────── */}
      {!open && (
      <div className="fixed bottom-5 right-4 sm:right-6 z-[110]">
        {!open && (
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background: "rgba(33, 150, 210, 0.3)",
              animation: "chatPulseRing 2.2s ease-out infinite",
            }}
            aria-hidden
          />
        )}

        {hasNewMessage && !open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-sm animate-bounce" />
        )}

        <button
          id="rzbot-fab-button"
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fermer l'assistant" : "Ouvrir l'assistant RZBot"}
          aria-expanded={open}
          aria-controls="rzmedical-chatbot-window"
          style={{
            background: open
              ? "linear-gradient(135deg, #475569 0%, #334155 100%)"
              : "linear-gradient(135deg, #2196d2 0%, #0c2340 100%)",
            boxShadow: open
              ? "0 4px 20px rgba(0,0,0,0.4)"
              : "0 8px 32px rgba(33,150,210,0.45), 0 2px 8px rgba(0,0,0,0.3)",
            animation: open ? "none" : "chatBounce 3s ease-in-out infinite 2s",
          }}
          className="relative w-14 h-14 rounded-full flex items-center justify-center text-white transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-azure-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          <span
            className="transition-all duration-300"
            style={{
              transform: open ? "rotate(90deg) scale(0.85)" : "scale(1)",
            }}
          >
            {open ? <IconClose /> : <IconChat />}
          </span>
        </button>
      </div>
      )}
    </>
  );
}
