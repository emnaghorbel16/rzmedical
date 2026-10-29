"use client";

/**
 * Lazy-loader pour le ChatWidget.
 *
 * Le bundle complet du chatbot (~37 Ko) est exclu du JS critique.
 * Il est chargé dynamiquement après l'hydratation, uniquement côté client.
 * Le bouton FAB reste visible immédiatement grâce au placeholder.
 */

import dynamic from "next/dynamic";

const ChatWidgetDynamic = dynamic(
  () => import("./ChatWidget").then((m) => ({ default: m.ChatWidget })),
  {
    ssr: false,
    // Placeholder : bouton FAB identique, sans interactivité, jusqu'au chargement
    loading: () => (
      <div className="fixed bottom-5 right-4 sm:right-6 z-[110]">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-white"
          style={{
            background: "linear-gradient(135deg, #2196d2 0%, #0c2340 100%)",
            boxShadow: "0 8px 32px rgba(33,150,210,0.45), 0 2px 8px rgba(0,0,0,0.3)",
          }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" aria-hidden>
            <path
              d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    ),
  },
);

export function ChatWidgetLazy() {
  return <ChatWidgetDynamic />;
}
