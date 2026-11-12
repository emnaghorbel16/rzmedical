import https from "https";
import {
  getBrands,
  getCompanyInfo,
  getMe,
  getMyInvoices,
  getMyOrders,
  getVisibleCategories,
  searchProducts,
} from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_TOOL_ROUNDS = 4; // compare_products + web_search peuvent enchaîner plusieurs appels
const MAX_HISTORY_MESSAGES = 10; // Nombre max de messages à envoyer à Groq (évite les dépassements de tokens)

// Modèles validés et disponibles sur ce compte Groq (chacun avec ses quotas TPM séparés)
const GROQ_MODELS = [
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
] as const;
const DEFAULT_FALLBACK_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
];

async function groqChat(
  body: Record<string, unknown>,
  fallbackModels: string[] = DEFAULT_FALLBACK_MODELS,
  attempt = 0
): Promise<{ data: any; headers: Headers }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY n'est pas configurée.");

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    if (response.status === 429) {
      const currentModel = String(body.model);
      const nextFallback = fallbackModels.find((m) => m !== currentModel);
      if (nextFallback) {
        console.warn(`⚠️ [Groq 429] Limite atteinte sur ${currentModel}, basculement automatique vers ${nextFallback}`);
        return groqChat(
          { ...body, model: nextFallback },
          fallbackModels.filter((m) => m !== nextFallback),
          0
        );
      }
      if (attempt < 1) {
        console.warn(`⚠️ [Groq 429] Attente 1500ms avant réessai sur ${currentModel}...`);
        await new Promise((r) => setTimeout(r, 1500));
        return groqChat(body, fallbackModels, attempt + 1);
      }
      throw new Error(
        "Le chatbot est temporairement surchargé. Veuillez réessayer dans quelques secondes."
      );
    }
    const error = await response.text();
    console.error(`❌ [groqChat] Erreur Groq HTTP ${response.status} sur modèle ${String(body.model)}:`, error.slice(0, 400));
    throw new Error(`Erreur Groq (${response.status}): ${error}`);
  }

  const data = await response.json();
  return { data, headers: response.headers };
}

async function groqStreamChat(
  messages: any[],
  model: string,
  onDelta: (chunk: string) => void,
  fallbackModels: string[] = DEFAULT_FALLBACK_MODELS
): Promise<{ text: string; headers?: Headers }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY n'est pas configurée.");

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      const nextFallback = fallbackModels.find((m) => m !== model);
      if (nextFallback) {
        console.warn(`⚠️ [Groq Stream 429] Limite sur ${model}, basculement immédiat vers ${nextFallback}`);
        return groqStreamChat(
          messages,
          nextFallback,
          onDelta,
          fallbackModels.filter((m) => m !== nextFallback)
        );
      }
      // Si tous les modèles ont été épuisés, attendre 2s pour que le quota de tokens se recharge
      console.warn(`⚠️ [Groq Stream 429] Quota atteint sur tous les modèles, attente 2000ms avant réessai final...`);
      await new Promise((r) => setTimeout(r, 2000));
      return groqStreamChat(messages, model, onDelta, []);
    }
    const errorText = await response.text();
    console.error(`❌ [groqStreamChat] Erreur Groq Stream HTTP ${response.status} sur modèle ${model}:`, errorText.slice(0, 400));
    throw new Error(`Erreur Groq Stream (${response.status}): ${errorText}`);
  }

  if (!response.body) throw new Error("Pas de flux de réponse de Groq.");

  const reader = response.body.getReader();
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

      try {
        const json = JSON.parse(raw);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          onDelta(delta);
        }
      } catch {
        // Ignorer chunks partiels
      }
    }
  }

  return { text: fullText, headers: response.headers };
}

// ─── Recherche web (Tavily AI ou Fallback Web Direct) ─────────────────────────
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

async function webSearchFallback(query: string, maxResults = 4): Promise<{ title: string; url: string; content: string }[]> {
  console.log(`🦆 [DuckDuckGo] Lancement recherche fallback: "${query}" (max: ${maxResults})`);
  return new Promise((resolve) => {
    const postData = "q=" + encodeURIComponent(query);
    const options = {
      hostname: "html.duckduckgo.com",
      path: "/html/",
      method: "POST",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          console.warn(`⚠️ [DuckDuckGo] Statut HTTP non-200 : ${res.statusCode}`);
          return resolve([]);
        }

        const snippets = [...data.matchAll(/class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g)].map((m) =>
          decodeHtmlEntities(m[1].replace(/<[^>]+>/g, "").trim())
        );
        const titles = [...data.matchAll(/class="result__a"[^>]*>([\s\S]*?)<\/a>/g)].map((m) =>
          decodeHtmlEntities(m[1].replace(/<[^>]+>/g, "").trim())
        );
        const urls = [...data.matchAll(/<a class="result__url" href="([^"]+)"/g)].map((m) => {
          const u = m[1];
          const match = u.match(/uddg=([^&]+)/);
          return match ? decodeURIComponent(match[1]) : u;
        });

        console.log(`🦆 [DuckDuckGo] ${titles.length} résultat(s) brut(s) trouvé(s) pour "${query}"`);

        const results: { title: string; url: string; content: string }[] = [];
        for (let i = 0; i < Math.min(titles.length, maxResults); i++) {
          if (snippets[i] || titles[i]) {
            results.push({
              title: titles[i] || "Résultat web",
              url: urls[i] || "",
              content: (snippets[i] || "").slice(0, 300),
            });
            console.log(`   └─ [Web ${i + 1}] "${titles[i]}" (${urls[i]?.slice(0, 45) ?? ""}...)`);
            console.log(`      Extrait: ${(snippets[i] || "").slice(0, 140)}...`);
          }
        }
        resolve(results);
      });
    });

    req.setTimeout(3500, () => {
      console.warn(`⚠️ [DuckDuckGo] Timeout 3.5s dépassé pour "${query}"`);
      req.destroy();
      resolve([]);
    });

    req.on("error", (err) => {
      console.error("❌ [DuckDuckGo] Erreur réseau:", err);
      resolve([]);
    });

    req.write(postData);
    req.end();
  });
}

async function tavilySearch(query: string, maxResults = 4, onLog?: (msg: string) => void): Promise<{ title: string; url: string; content: string }[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.log("ℹ️ [Tavily] TAVILY_API_KEY non définie ou vide dans .env.local -> Basculement sur DuckDuckGo");
    onLog?.("ℹ️ Tavily non configuré (clé absente) -> Recherche DuckDuckGo");
    return [];
  }

  console.log(`🔎 [Tavily] 🚀 Appel API Tavily AI pour : "${query}" (Clé présente: ${apiKey.slice(0, 7)}...)`);
  onLog?.(`🚀 Appel Tavily AI pour : "${query}"`);
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        include_answer: true,
        max_results: maxResults,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`❌ [Tavily] Échec API (statut ${res.status}):`, errText);
      onLog?.(`❌ Erreur Tavily (HTTP ${res.status}: ${errText.slice(0, 60)}) -> Repli DuckDuckGo`);
      return [];
    }
    const data = await res.json();
    const results: { title: string; url: string; content: string }[] = (data.results ?? []).slice(0, maxResults).map((r: any) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      content: (r.content ?? "").slice(0, 300),
    }));
    if (data.answer) {
      results.unshift({ title: "Synthèse", url: "", content: data.answer.slice(0, 350) });
    }
    console.log(`✅ [Tavily] Succès ! ${results.length} résultat(s) retourné(s) par Tavily AI pour "${query}"`);
    onLog?.(`✅ Tavily a répondu : ${results.length} résultat(s) trouvés`);
    return results;
  } catch (err: any) {
    const msg = err?.name === "TimeoutError" ? "Timeout 8s dépassé" : (err?.message ?? String(err));
    console.error("❌ [Tavily] Erreur exception fetch:", msg);
    onLog?.(`❌ Exception Tavily (${msg}) -> Repli DuckDuckGo`);
    return [];
  }
}

async function performWebSearch(query: string, maxResults = 4, onLog?: (msg: string) => void): Promise<{ title: string; url: string; content: string }[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  const isTavilyConfigured = !!(apiKey && apiKey.trim().length > 0);
  const engine = isTavilyConfigured ? "Tavily AI (Recherche intelligente)" : "DuckDuckGo (Moteur web fallback)";
  
  console.log(`\n🌐 [RZBot Web Search] Lancement recherche: "${query}" | Moteur: ${engine}`);
  onLog?.(`🌐 Début recherche web : "${query}" [Moteur : ${isTavilyConfigured ? "Tavily AI" : "DuckDuckGo"}]`);
  
  let results: { title: string; url: string; content: string }[] = [];
  if (isTavilyConfigured) {
    results = await tavilySearch(query, maxResults, onLog);
  }
  if (!results || results.length === 0) {
    if (isTavilyConfigured) {
      console.log(`⚠️ [RZBot Web Search] Tavily n'a pas retourné de résultat, passage à DuckDuckGo.`);
      onLog?.("⚠️ Aucun résultat Tavily -> Essai avec DuckDuckGo...");
    }
    results = await webSearchFallback(query, maxResults);
    if (results.length > 0) {
      onLog?.(`✅ DuckDuckGo : ${results.length} résultat(s) obtenus`);
    }
  }

  console.log(`✅ [RZBot Web Search] Terminé : ${results.length} résultat(s) web récupéré(s) pour: "${query}"\n`);
  return results;
}

// ─── Enregistre l'usage Groq dans le backend ─────────────────────────────────
async function recordGroqUsage(
  data: any,
  headers: Headers,
  modele: string
): Promise<void> {
  try {
    const usage = data?.usage;
    if (!usage) return;

    const tokensPrompt = usage.prompt_tokens ?? 0;
    const tokensCompletion = usage.completion_tokens ?? 0;
    const tokensTotal = usage.total_tokens ?? tokensPrompt + tokensCompletion;

    // Headers rate-limit Groq
    const tokensRestants = headers.get("x-ratelimit-remaining-tokens")
      ? Number(headers.get("x-ratelimit-remaining-tokens"))
      : null;
    const requetesRestantes = headers.get("x-ratelimit-remaining-requests")
      ? Number(headers.get("x-ratelimit-remaining-requests"))
      : null;

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const secret = process.env.INTERNAL_SECRET;
    if (!secret) return;

    await fetch(`${backendUrl}/api/groq-stats/record`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify({ modele, tokensPrompt, tokensCompletion, tokensTotal, tokensRestants, requetesRestantes }),
    });
  } catch (err) {
    // Non bloquant — on log seulement
    console.error("[recordGroqUsage] Erreur:", err);
  }
}

const SYSTEM_PROMPT = `Tu es "RZBot", l'assistant virtuel intelligent de RZMedical — entreprise tunisienne spécialisée dans la vente d'équipements et consommables médico-dentaires professionnels.

Ton rôle :
- Aider les clients à trouver les bons produits dans le catalogue.
- Répondre aux questions sur les équipements médicaux, dentaires, consommables, etc.
- Donner des conseils professionnels et comparatifs techniques.

Règles impératives :
1. OUTILS SYSTÉMATIQUES : Utilise toujours les fonctions appropriées (search_products, get_categories, get_brands, get_contact_info, compare_products, web_search). Ne devine JAMAIS de prix, stock, références ou coordonnées.
2. MOTS-CLÉS COURTS : Pour search_products, utilise 1 à 2 mots-clés simples (ex: "tensiomètre", "fauteuil dentaire"), jamais la phrase entière du client.
3. ABSENCE DU CATALOGUE : Si search_products renvoie 0 produit, appelle OBLIGATOIREMENT l'outil web_search pour décrire les caractéristiques techniques du matériel et indique clairement : "Cet équipement n'est pas actuellement disponible en stock direct dans notre catalogue, mais notre équipe commerciale peut vous le fournir sur commande spéciale."
4. PRIX EN DINARS : Tous les prix indiqués sont en TND (Dinars Tunisiens).
5. INTERDICTION DE REMISE : Ne jamais proposer, négocier ou promettre de réduction. Renvoyer poliment le client vers le service commercial pour toute demande tarifaire spécifique.
6. COORDONNÉES OFFICIELLES : Pour toute demande d'adresse, téléphone, email ou site, utilise l'outil get_contact_info.
7. CARTES PRODUIT : Dès que tu mentionnes un produit du catalogue issu de ta recherche, insère OBLIGATOIREMENT ce tag : [PRODUCT|Nom exact|Prix|Reference]
   Exemple : "Nous disposons de ce modèle. [PRODUCT|Tensiomètre Omron M3|150|REF-OMR-M3]"
8. SUGGESTIONS CLICABLES : À la fin de CHAQUE réponse sans exception, propose 1 ou 2 suggestions sous ce tag exact : [SUGGESTION|Message client]
   RÈGLE ABSOLUE - FORMULATION 100% DU POINT DE VUE DU CLIENT (« COMME L'UTILISATEUR PARLE ») :
   - Ces suggestions sont des boutons que le client clique pour PARLER au chatbot.
   - Le texte DOIT IMPÉRATIVEMENT être écrit du point de vue du client (1ère personne ou requête client adressée à RZMedical).
   - ⛔ INTERDICTION FORMELLE d'utiliser le vouvoiement ou de poser une question au client !
     ❌ STRICTEMENT INTERDIT :
        [SUGGESTION|Pourriez-vous m'indiquer les deux modèles que vous souhaitez comparer ?]
        [SUGGESTION|Quel modèle de tensiomètre souhaitez-vous comparer ?]
        [SUGGESTION|Quel type d'équipement dentaire aimeriez-vous comparer ?]
        [SUGGESTION|Que souhaitez-vous savoir sur...]
     ✔️ EXEMPLES VALIDES (ce que l'utilisateur envoie au chatbot) :
        [SUGGESTION|Je souhaite comparer deux tensiomètres du catalogue]
        [SUGGESTION|Quels sont les fauteuils dentaires disponibles ?]
        [SUGGESTION|Proposez-moi deux modèles à comparer]
        [SUGGESTION|Comparer le fauteuil P3-i et le 208D]
        [SUGGESTION|Puis-je obtenir un devis personnalisé ?]
        [SUGGESTION|Quels sont vos délais de livraison ?]
   - ⛔ INTERDICTION ABSOLUE : Ne JAMAIS citer ni proposer de produits hors du catalogue RZMedical.
9. FORMAT COMPARATIF :
   RÈGLE STRICTE ET ABSOLUE : Tu dois COMPARER UNIQUEMENT DES PRODUITS PRÉSENTS DANS LE CATALOGUE RZMEDICAL. Ne compare JAMAIS de produits hors catalogue !
   - Pour les mots-clés de compare_products : utilise TOUJOURS les vrais noms, marques ou modèles courts des produits existant dans le catalogue RZMedical (ex: ["Ultimate", "P3"] ou ["Omron M3", "Rossmax X3"]), jamais des noms inventés.
   - Si un produit demandé n'est pas dans le catalogue RZMedical, indique clairement qu'il n'est pas commercialisé par RZMedical et qu'on ne compare que les produits de notre catalogue.
   - Ne construis de tableau [COMPARE|...] QUE si au moins 2 produits sont présents dans le catalogue RZMedical.
   [COMPARE|Produit A|Produit B]
   [COMPARE_ROW|Critère|Valeur A|Valeur B]
   [COMPARE_END]
   Lignes en tête : Prix TND, Marque, Référence. Ne JAMAIS inclure de ligne pour le Stock ni pour la Disponibilité catalogue.
   Complète avec les caractéristiques techniques réelles issues de la BDD et du champ webInfo (motorisation, puissance, matériaux, dimensions, normes, etc.). Pas de ligne avec uniquement des N/D.
   Termine obligatoirement par 2-3 phrases de synthèse débutant par : "**Notre recommandation :**".
10. RECHERCHE PAR IMAGE : Si le message contient [Image identifiée : ...], cherche dans le catalogue avec les mots-clés détectés. Si introuvable, résume les caractéristiques professionnelles de l'équipement identifié et propose une commande spéciale.
11. STYLE : Réponds toujours en français, de façon professionnelle, chaleureuse et concise (max 3 paragraphes).`;

export interface ChatMessage {
  role: "user" | "model" | "assistant" | "system" | "tool";
  content: string;
  image?: string;
}

// Déclaration des outils au format OpenAI/Groq
const tools = [
  {
    type: "function",
    function: {
      name: "search_products",
      description:
        "Recherche des produits dans la base de données RZMedical. Utile pour vérifier la disponibilité, le prix, et les caractéristiques d'un produit (ex: tensiomètre, fauteuil dentaire, gants).",
      parameters: {
        type: "object",
        properties: {
          q: {
            type: "string",
            description:
              "Le mot clé de recherche. Utilise un seul mot ou des termes simples (ex: 'tensiomètre', 'gants latex').",
          },
        },
        required: ["q"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_categories",
      description:
        "Récupère la liste des catégories de produits disponibles (ex: Équipements Médicaux, Consommables).",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_brands",
      description: "Récupère la liste des marques vendues par RZMedical.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact_info",
      description:
        "Récupère les coordonnées officielles de RZMedical (téléphone, email, adresse, site web). À utiliser TOUJOURS quand le client demande un numéro de téléphone, un email, une adresse ou le site web.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_profile",
      description: "Récupère le profil du client actuellement connecté.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_orders",
      description: "Récupère les commandes du client actuellement connecté.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_invoices",
      description: "Récupère les factures du client actuellement connecté.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Recherche sur le web (Google / moteur de recherche). À utiliser OBLIGATOIREMENT dès que search_products ne trouve pas de produit dans le catalogue RZMedical, ou pour des questions générales et techniques sur les équipements médicaux.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "La requête de recherche (ex: 'aspirateur chirurgical caractéristiques', 'tensiomètre rossmax x3 spécifications').",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_products",
      description:
        "Compare UNIQUEMENT des produits vendus dans le catalogue RZMedical. RÈGLE STRICTE : Ne compare jamais de produits hors catalogue. Pour chaque produit du catalogue dont la description ou les spécifications techniques manquent dans la base, l'outil effectue une recherche web pour enrichir sa fiche technique.",
      parameters: {
        type: "object",
        properties: {
          keywords: {
            type: "array",
            items: { type: "string" },
            description:
              "Liste de 2 à 4 mots-clés courts (un par produit à comparer). Exemple : [\"tensiomètre omron\", \"tensiomètre rossmax\"].",
          },
        },
        required: ["keywords"],
      },
    },
  },
];

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

async function executeTool(
  functionName: string,
  rawArgs: string,
  clientToken?: string,
  onLog?: (msg: string) => void,
): Promise<unknown> {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    // arguments malformés : on continue avec un objet vide plutôt que de planter
  }

  console.log(`🤖 [RZBot Tool Call] Outil appelé : ${functionName}`, JSON.stringify(args));

  if (functionName === "search_products") {
    const q = typeof args.q === "string" && args.q.trim() ? args.q.trim() : "";
    if (!q) throw new Error("Le paramètre 'q' est requis pour search_products.");
    console.log(`🔍 [search_products] Recherche BDD pour: "${q}"`);
    onLog?.(`🔍 Recherche catalogue pour "${q}"...`);
    let products: any[] = [];
    try {
      products = await searchProducts(q);
      console.log(`📦 [search_products] ${products.length} produit(s) trouvé(s) en base pour "${q}"`);
      onLog?.(`📦 BDD : ${products.length} produit(s) trouvé(s) pour "${q}"`);
    } catch (err) {
      console.error(`❌ [search_products] Erreur requête BDD pour "${q}":`, err);
      onLog?.(`❌ Erreur BDD pour "${q}"`);
    }
    const mapped = products
      .map((p) => ({
        nom: p.nom,
        reference: p.reference,
        prix: Number(p.prix),
        disponible: p.disponible,
        remise: Number(p.remise),
        marque: p.marque?.nom,
        categorie: p.sousCategorie?.categorie?.nom,
      }))
      .slice(0, 10);

    if (mapped.length === 0) {
      return {
        produits: [],
        message: `Aucun produit correspondant à "${q}" dans le catalogue interne RZMedical. RÈGLE OBLIGATOIRE : Tu DOIS maintenant exécuter l'outil 'web_search' avec la requête "${q}" pour chercher sur le web (Google/Web) et renseigner précisément le client sur cet équipement.`,
      };
    }
    return mapped;
  }

  if (functionName === "web_search") {
    const query = typeof args.query === "string" && args.query.trim() ? args.query.trim() : "";
    if (!query) throw new Error("Le paramètre 'query' est requis pour web_search.");
    const results = await performWebSearch(query, 4, onLog);
    if (results.length === 0) return { message: "Aucun résultat web trouvé pour cette requête." };
    return results;
  }

  if (functionName === "compare_products") {
    const keywords = Array.isArray(args.keywords) ? args.keywords : [];
    if (keywords.length < 2) {
      return {
        message: "Moins de 2 mots-clés fournis. Indiquez au moins deux produits ou références à comparer.",
      };
    }
    onLog?.(`🔄 Comparaison catalogue demandée pour : ${keywords.join(" vs ")}`);
    const selectedIds = new Set<number>();
    const results = [];

    for (const kw of keywords.slice(0, 4)) {
      const q = typeof kw === "string" ? kw.trim() : "";
      if (!q) {
        results.push({ keyword: kw, dansCatalogue: false, produit: null, webInfo: [] });
        continue;
      }

      console.log(`\n======================================================`);
      console.log(`🔍 [compare_products] Recherche BDD pour le mot-clé: "${q}"`);

      // 1. Recherche directe dans le catalogue RZMedical
      let products: any[] = [];
      try {
        products = await searchProducts(q);
        console.log(`📦 [compare_products] Résultat BDD pour "${q}": ${products.length} produit(s) trouvé(s)`);
      } catch (dbErr) {
        console.error(`❌ [compare_products] Erreur requête BDD pour "${q}":`, dbErr);
        products = [];
      }

      // Sélectionner un produit qui n'a pas encore été sélectionné
      let p = Array.isArray(products)
        ? products.find((prod) => !selectedIds.has(prod.id)) || products[0] || null
        : null;

      // 1.bis Si la recherche exacte n'a rien donné, tester avec les termes discriminants
      if (!p) {
        const stopWords = new Set([
          "fauteuil", "dent", "dentaire", "equipement", "équipement", "materiel", "matériel",
          "le", "la", "les", "un", "une", "des", "du", "de", "d", "l", "pour", "avec", "sans",
          "modele", "modèle", "produit", "marque", "vs", "et"
        ]);
        const tokens = q
          .toLowerCase()
          .split(/[\s,+'"-_/]+/)
          .map((t) => t.trim())
          .filter((t) => t.length >= 2);

        const distinctiveTokens = tokens.filter((t) => !stopWords.has(t));
        const searchTokens = distinctiveTokens.length > 0 ? distinctiveTokens : tokens;

        for (const token of searchTokens) {
          try {
            const fallbackProducts = await searchProducts(token);
            if (Array.isArray(fallbackProducts) && fallbackProducts.length > 0) {
              const matched =
                fallbackProducts.find(
                  (fp) => !selectedIds.has(fp.id) && tokens.some((tok) => fp.nom.toLowerCase().includes(tok))
                ) ||
                fallbackProducts.find((fp) => !selectedIds.has(fp.id)) ||
                fallbackProducts[0];
              if (matched) {
                p = matched;
                console.log(`🎯 [compare_products] Produit trouvé via terme alternatif "${token}" : "${p.nom}"`);
                break;
              }
            }
          } catch {}
        }
      }

      if (p) {
        selectedIds.add(p.id);
      }

      // 2. Recherche web UNIQUEMENT pour les produits du catalogue afin d'enrichir la fiche technique
      let webInfo: { title: string; url: string; content: string }[] = [];
      if (p) {
        const descLen = p.description ? p.description.trim().length : 0;
        console.log(`✅ [compare_products] Produit sélectionné : "${p.nom}"`);
        console.log(`   - Marque : ${p.marque?.nom ?? "N/A"} | Réf : ${p.reference}`);
        console.log(`   - Description en base (${descLen} car.) : ${p.description ? `"${p.description.slice(0, 100)}..."` : "VIDE / INEXISTANTE"}`);
        onLog?.(`📦 BDD : "${p.nom}" (${p.marque?.nom ?? "Sans marque"})`);

        try {
          const searchQuery = `${p.nom} ${p.marque?.nom ?? ""} ${p.reference ?? ""} fiche technique spécifications`.trim();
          console.log(`🚀 [compare_products] Recherche Tavily pour enrichir "${p.nom}"`);
          webInfo = await performWebSearch(searchQuery, 2, onLog);
          console.log(`📥 [compare_products] WebInfo : ${webInfo.length} résultat(s) Tavily pour "${p.nom}"`);
        } catch (webErr) {
          console.error(`❌ [compare_products] Erreur recherche web pour "${p.nom}":`, webErr);
          webInfo = [];
        }
      } else {
        console.warn(`⚠️ [compare_products] Produit "${q}" absent du catalogue RZMedical → exclu de la comparaison.`);
        onLog?.(`ℹ️ Produit "${q}" non présent dans le catalogue RZMedical`);
      }
      console.log(`======================================================\n`);

      results.push({
        keyword: kw,
        dansCatalogue: !!p,
        produit: p
          ? {
              nom: p.nom,
              reference: p.reference,
              prix: Number(p.prix),
              remise: Number(p.remise),
              prixFinal: p.remise > 0
                ? Number(p.prix) * (1 - Number(p.remise) / 100)
                : Number(p.prix),
              stock: p.stock ?? 0,
              disponible: p.disponible,
              marque: p.marque?.nom ?? "N/A",
              categorie: p.sousCategorie?.categorie?.nom ?? "N/A",
              sousCategorie: p.sousCategorie?.nom ?? "N/A",
              description: (p.description ?? "").slice(0, 300),
              paysFabrication: p.paysFabrication ?? "N/A",
              tva: p.tva ? `${Number(p.tva)}%` : "N/A",
              motsCles: Array.isArray(p.motsCles) && p.motsCles.length > 0 ? p.motsCles.join(", ") : "N/A",
              ficheTechnique: p.ficheTechnique ? "Disponible" : "Non disponible",
              video: p.video ? "Disponible" : "Non disponible",
            }
          : null,
        webInfo,
        message: p
          ? "Produit présent dans le catalogue RZMedical."
          : `Produit "${kw}" absent du catalogue RZMedical. Exclu de la comparaison.`,
      });
    }

    const trouves = results.filter((r) => r.dansCatalogue);
    const absents = results.filter((r) => !r.dansCatalogue);

    if (trouves.length < 2) {
      return {
        totalDemandes: keywords.length,
        nombreDansCatalogue: trouves.length,
        produitsDansCatalogue: trouves,
        produitsAbsents: absents.map((a) => a.keyword),
        consigne:
          "RÈGLE COMPARATIF STRICTE : Moins de 2 produits demandés sont présents dans le catalogue RZMedical. " +
          "Ne construis AUCUN tableau [COMPARE|...]. " +
          "Indique poliment au client que RZMedical ne commercialise pas " +
          absents.map((a) => `"${a.keyword}"`).join(", ") +
          " et que nous comparons exclusivement les produits disponibles dans notre catalogue. " +
          (trouves.length === 1
            ? `Présente le seul produit trouvé (${trouves[0].produit?.nom}) avec sa carte [PRODUCT|...]. `
            : "") +
          "INTERDICTION FORMELLE : Ne propose JAMAIS dans [SUGGESTION|...] des produits qui ne sont pas dans le catalogue RZMedical ! " +
          "RÈGLE SUGGESTIONS : Rédige TOUS les [SUGGESTION|...] du point de vue de l'utilisateur qui parle au bot (ex: [SUGGESTION|Proposez-moi deux modèles à comparer], [SUGGESTION|Quels sont vos équipements en stock ?]). INTERDICTION de vouvoyer ou de poser une question au client.",
      };
    }

    return {
      totalDemandes: keywords.length,
      nombreDansCatalogue: trouves.length,
      produits: trouves,
      produitsAbsents: absents.map((a) => a.keyword),
      consigne:
        "RÈGLE COMPARATIF : Construis le tableau comparatif [COMPARE|...] EXCLUSIVEMENT pour les " +
        trouves.length +
        " produits du catalogue RZMedical : " +
        trouves.map((t) => `"${t.produit?.nom}"`).join(", ") +
        ". " +
        (absents.length > 0
          ? `Précise que ${absents.map((a) => `"${a.keyword}"`).join(", ")} n'est pas commercialisé par RZMedical et a été exclu. `
          : "") +
        "INTERDICTIONS : " +
        "1) N'inclus JAMAIS de produit hors catalogue dans le tableau. " +
        "2) Ne JAMAIS inclure de ligne 'Stock' ni de ligne 'Disponibilité catalogue'. " +
        "3) Ne JAMAIS proposer dans [SUGGESTION|...] des produits qui ne sont pas dans le catalogue RZMedical. " +
        "4) RÈGLE SUGGESTIONS : Tous les [SUGGESTION|...] doivent être écrits comme des requêtes de l'utilisateur (ex: [SUGGESTION|Je souhaite comparer deux modèles], [SUGGESTION|Puis-je obtenir un devis ?]). Aucune question posée à l'utilisateur.",
    };
  }

  if (functionName === "get_categories") {
    return (await getVisibleCategories()).map((category) => category.nom);
  }

  if (functionName === "get_brands") {
    return (await getBrands()).map((brand) => brand.nom);
  }

  if (functionName === "get_contact_info") {
    const info = await getCompanyInfo();
    return {
      telephone: info.telephone,
      email: info.email,
      adresse: info.adresse,
      siteWeb: info.siteWeb,
    };
  }

  // À partir d'ici, tous les outils nécessitent un client connecté.
  if (!clientToken) {
    return { error: "Le client doit se connecter pour accéder à cette information." };
  }

  if (functionName === "get_my_profile") {
    const profile = await getMe(clientToken);
    return {
      prenom: profile.prenom,
      nom: profile.nom,
      email: profile.email,
      telephone: profile.telephone,
      adresse: profile.adresse,
      activite: profile.activite,
    };
  }
  if (functionName === "get_my_orders") return getMyOrders(clientToken);
  if (functionName === "get_my_invoices") return getMyInvoices(clientToken);

  throw new Error(`Outil inconnu: ${functionName}`);
}

async function runToolCall(toolCall: ToolCall, clientToken?: string, onLog?: (msg: string) => void) {
  const { name, arguments: rawArgs } = toolCall.function;
  onLog?.(`🛠️ Outil IA déclenché : ${name}`);
  let result: unknown;
  try {
    result = await executeTool(name, rawArgs, clientToken, onLog);
  } catch (error) {
    result = { error: error instanceof Error ? error.message : "Erreur lors de l'exécution de l'outil." };
  }
  return {
    role: "tool" as const,
    tool_call_id: toolCall.id,
    content: JSON.stringify(result),
  };
}

async function analyzeImageWithVision(base64Image: string): Promise<string> {
  // Groq vision-capable models available on this account
  const VISION_MODELS = [
    "qwen/qwen3.8-27b",
  ];

  const visionMessages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Tu es un expert en matériel médical. Identifie l'équipement sur cette image.
Réponds en moins de 80 mots avec ce format :
Type: [type d'équipement]
Marque: [marque ou inconnu]
Usage: [spécialité médicale]
Mots-clés: [2-3 mots-clés courts pour chercher dans un catalogue médical]`,
        },
        {
          type: "image_url",
          image_url: {
            url: base64Image,
          },
        },
      ],
    },
  ];

  let lastError = "";
  for (const model of VISION_MODELS) {
    try {
      const res = await groqChat({
        model,
        messages: visionMessages,
        temperature: 0.1,
        max_tokens: 120,
      });
      const text = res.data?.choices?.[0]?.message?.content;
      if (text) return text;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error(`Groq vision (${model}) failed:`, lastError);
    }
  }
  return `Équipement médical (analyse échouée : ${lastError}).`;
}

export async function POST(req: Request) {
  console.log("\n=======================================================");
  console.log("🚀 [SERVER /api/chat] NOUVELLE REQUÊTE CHAT REÇUE DU NAVIGATEUR !");
  try {
    const { messages } = (await req.json()) as { messages: ChatMessage[] };
    const lastUserMsg = messages?.[messages.length - 1];
    console.log(`📩 [SERVER /api/chat] Message du client : "${lastUserMsg?.content ?? "(aucun texte)"}"`);

    if (!messages || !Array.isArray(messages)) {
      console.error("❌ [SERVER /api/chat] Format messages invalide");
      return new Response(JSON.stringify({ error: "Invalid messages array" }), {
        status: 400,
      });
    }

    // Modèle pour la sélection des outils (priorité qwen/qwen3.8-27b sur bucket TPM séparé)
    const TOOL_MODEL = process.env.GROQ_TOOL_MODEL || "qwen/qwen3.8-27b";
    // Modèle pour la rédaction finale (priorité openai/gpt-oss-120b sur un bucket TPM différent pour doubler la capacité)
    const STREAM_MODEL =
      process.env.GROQ_STREAM_MODEL ||
      (TOOL_MODEL === "qwen/qwen3.8-27b" ? "openai/gpt-oss-120b" : "qwen/qwen3.8-27b");

    const toolFallbacks = GROQ_MODELS.filter((m) => m !== TOOL_MODEL);
    const streamFallbacks = GROQ_MODELS.filter((m) => m !== STREAM_MODEL);
    const clientToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    // Traitement des images avant l'orchestration principale
    const processedMessages = await Promise.all(
      messages.map(async (m) => {
        if (m.image) {
          const characteristics = await analyzeImageWithVision(m.image);
          const userText = m.content && m.content !== "Image partagée." ? m.content : "Avez-vous un produit similaire à celui sur cette image ?";
          return {
            role: m.role === "model" ? "assistant" : m.role,
            content: `[Image identifiée : ${characteristics}]\n\nDemande du client : ${userText}`,
          };
        }
        return {
          role: m.role === "model" ? "assistant" : m.role,
          content: m.content,
        };
      })
    );

    // Limiter l'historique pour éviter les dépassements de tokens Groq
    const trimmedMessages = processedMessages.slice(-MAX_HISTORY_MESSAGES);

    const groqMessages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...trimmedMessages,
    ];

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const onLog = (text: string) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ log: text })}\n\n`));
          } catch {}
        };

        try {
          onLog(`Message client reçu : "${lastUserMsg?.content?.slice(0, 60) ?? ""}"`);
          let toolExecuted = false;

          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const response = await groqChat(
              {
                model: TOOL_MODEL,
                messages: groqMessages,
                tools,
                tool_choice: "auto",
                stream: false,
              },
              toolFallbacks
            );

            const choice = response.data?.choices?.[0];
            const message = choice?.message;
            const toolCalls: ToolCall[] | undefined = message?.tool_calls;

            if (!toolCalls || toolCalls.length === 0) {
              // Aucun outil : réponse directe sans streaming
              if (!toolExecuted && message?.content) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: message.content })}\n\n`)
                );
                recordGroqUsage(response.data, response.headers, TOOL_MODEL).catch(() => {});
              }
              break;
            }

            toolExecuted = true;

            // On ajoute le message assistant contenant les tool_calls à l'historique
            groqMessages.push({
              role: "assistant",
              content: message.content ?? null,
              tool_calls: toolCalls,
            });

            // On exécute tous les outils demandés (potentiellement en parallèle)
            const toolResults = await Promise.all(
              toolCalls.map((tc) => runToolCall(tc, clientToken, onLog))
            );
            groqMessages.push(...toolResults);

            // ── OPTIMISATION RATE LIMIT ───────────────────────────────────────
            // Après exécution des outils on sort immédiatement du loop.
            // La réponse finale est rédigée par STREAM_MODEL (openai/gpt-oss-20b)
            // qui a des quotas séparés de TOOL_MODEL (qwen/qwen3.8-27b).
            // Cela évite un 2e appel qwen et divise par 2 le risque de 429.
            break;
          }

          // Si des outils ont été exécutés, on stream la réponse finale token par token en direct !
          if (toolExecuted) {
            onLog("✍️ Rédaction de la réponse...");
            const { text: streamedText, headers } = await groqStreamChat(
              groqMessages,
              STREAM_MODEL,
              (delta) => {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`)
                );
              },
              streamFallbacks
            );
            recordGroqUsage(
              { usage: { total_tokens: 400 } },
              headers ?? new Headers(),
              STREAM_MODEL
            ).catch(() => {});
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Erreur Groq";
          console.error("❌ [RZBot stream] EXCEPTION dans le stream:", message);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal Server Error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}