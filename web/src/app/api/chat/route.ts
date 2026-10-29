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
const MAX_TOOL_ROUNDS = 6; // compare_products + web_search peuvent enchaîner plusieurs appels

async function groqChat(body: Record<string, unknown>, fallbackModel?: string): Promise<{ data: any; headers: Headers }> {
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
    if (response.status === 429 && fallbackModel && body.model !== fallbackModel) {
      console.warn(`Rate limit on ${body.model}, retrying with ${fallbackModel}`);
      return groqChat({ ...body, model: fallbackModel });
    }
    const error = await response.text();
    throw new Error(`Erreur Groq (${response.status}): ${error}`);
  }

  const data = await response.json();
  return { data, headers: response.headers };
}

// ─── Recherche web via Tavily AI ──────────────────────────────────────────────
async function tavilySearch(query: string, maxResults = 3): Promise<{ title: string; url: string; content: string }[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return []; // Désactivé si clé absente — pas bloquant

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        include_answer: true,
        max_results: maxResults,
        include_domains: [], // pas de restriction de domaine
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    // Tavily retourne { results: [{title, url, content}], answer }
    const results: { title: string; url: string; content: string }[] = (data.results ?? []).map((r: any) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      content: (r.content ?? "").slice(0, 400), // limiter à 400 chars par résultat
    }));
    // Ajouter la réponse synthétisée de Tavily en premier si disponible
    if (data.answer) {
      results.unshift({ title: "Synthèse", url: "", content: data.answer.slice(0, 500) });
    }
    return results;
  } catch {
    return [];
  }
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

const SYSTEM_PROMPT = `Tu es "RZBot", l'assistant virtuel intelligent de RZMedical — une entreprise tunisienne spécialisée dans la vente d'équipements et consommables médico-dentaires professionnels.

Ton rôle :
- Aider les clients à trouver les bons produits dans le catalogue.
- Répondre aux questions sur les équipements médicaux, dentaires, etc.
- Donner des conseils professionnels.
- Comparer des produits à la demande du client.
- Enrichir les comparaisons avec des informations techniques issues du web (spécifications, certifications, usages).

Règles importantes :
- TU DOIS UTILISER LES OUTILS (Fonctions) fournis pour chercher des produits, des prix, des catégories ou des marques avant de répondre à une question sur le catalogue. Ne devine jamais les prix ou le stock.
- Quand tu appelles search_products, utilise un mot-clé court et simple (1 à 2 mots), pas la phrase complète du client.
- Ne dis jamais que tu ne peux pas chercher dans la base de données, utilise toujours les outils.
- Réponds TOUJOURS en français, de façon professionnelle et chaleureuse.
- Reste concis (max 3 paragraphes).
- Ne donne jamais de conseils médicaux directs.
- Les prix que l'outil te donne sont en TND (Dinars Tunisiens).
- IMPORTANT : À chaque fois que tu mentionnes un produit spécifique issu de ta recherche, tu DOIS inclure ce tag exact dans ta réponse pour afficher une carte produit : [PRODUCT|Nom exact du produit|Prix|Reference]
  Exemple : "Nous avons le tensiomètre. [PRODUCT|Tensiomètre Omron M3|150|REF-OMR-M3]"
- À la fin de chaque réponse, propose toujours 1 ou 2 questions pertinentes en utilisant ce tag : [SUGGESTION|Question]
  ══════════════════════════════════════════════════════
  RÈGLE ABSOLUE SUR LES SUGGESTIONS : La question DOIT être écrite du point de vue du CLIENT, exactement comme s'il tapait lui-même ce message dans le chat — à la première personne (vous → vous, votre → votre) ou directement.
  Le client s'adresse à toi, pas toi à lui.
  
  ❌ ABSOLUMENT INTERDIT (c'est TOI qui parles au client — JAMAIS AUTORISÉ) :
    - "Quel type d'équipement recherchez-vous ?"
    - "Pouvez-vous préciser une gamme de prix ?"
    - "Souhaitez-vous voir nos promotions ?"
    - "Avez-vous un usage spécifique en tête ?"
  
  ✅ CORRECT (c'est LE CLIENT qui parle, comme s'il tapait dans le chat) :
    - "[SUGGESTION|Avez-vous des fauteuils dentaires ?]"
    - "[SUGGESTION|Quels sont vos prix pour les gants latex ?]"
    - "[SUGGESTION|Est-ce que vous livrez en Tunisie ?]"
    - "[SUGGESTION|Je cherche un tensiomètre, avez-vous du stock ?]"
    - "[SUGGESTION|Quels sont vos délais de livraison ?]"
  ══════════════════════════════════════════════════════
- Ne jamais poser de question ouverte au client dans le corps du message pour lui demander ce qu'il cherche — utilise uniquement les tags [SUGGESTION|...] pour guider.
- INTERDICTION ABSOLUE DE REMISE : Tu ne dois JAMAIS proposer, accorder, négocier ou mentionner une remise, réduction, promotion spéciale ou geste commercial à un client, quelle que soit sa demande. Si le client demande une remise, réponds poliment que les prix affichés sont les prix officiels de RZMedical et que pour toute demande commerciale particulière, il doit contacter directement notre équipe commerciale.
- Si le client demande un numéro de téléphone, un email, une adresse ou le site web de RZMedical, tu DOIS utiliser l'outil get_contact_info. Ne devine et n'invente JAMAIS ces informations — si l'outil renvoie une valeur vide (null), dis au client que cette information n'est pas encore disponible et propose une alternative (ex: page contact du site).
- Si un outil renvoie une erreur d'authentification, explique poliment au client qu'il doit se connecter à son compte pour accéder à cette information.

--- RÈGLES DE COMPARAISON DE PRODUITS ---
Quand le client demande de comparer deux produits ou plus (ex: "compare X et Y", "quelle différence entre X et Y", "lequel choisir entre X et Y") :
1. Utilise l'outil compare_products avec les mots-clés courts de chaque produit.
2. L'outil renvoie automatiquement les données du catalogue ET des infos web (spécifications techniques, certifications, usages typiques) pour chaque produit.
3. Génère ensuite UN SEUL tag [COMPARE|...] structuré comme suit (remplace les exemples par les vraies données) :

[COMPARE|Produit A|Produit B]
[COMPARE_ROW|Prix|150 TND|280 TND]
[COMPARE_ROW|Marque|MedLine|3M]
[COMPARE_ROW|Disponible|✅ Oui|❌ Non]
[COMPARE_ROW|Catégorie|Dentaire|Dentaire]
[COMPARE_ROW|Référence|REF-A|REF-B]
[COMPARE_ROW|Spécifications|Double tête 27Hz|Simple tête 20Hz]
[COMPARE_ROW|Certification|CE, ISO 13485|CE]
[COMPARE_ROW|Usage typique|Cardio + Pulmo|Chirurgie générale]
[COMPARE_END]

Règles du format COMPARE :
- Le premier tag [COMPARE|NomA|NomB] déclare les noms des produits.
- Chaque [COMPARE_ROW|Critère|ValeurA|ValeurB] est une ligne du tableau.
- Termine TOUJOURS par [COMPARE_END].
- Utilise les données réelles de l'outil. Les infos web (spécifications, certification, usage) sont dans le champ webInfo de chaque produit.
- Place le tableau après une courte introduction, puis ajoute ta recommandation et les suggestions.
- Si plus de 2 produits : ajoute les colonnes supplémentaires séparées par |.
- Si webInfo est vide pour un produit, laisse "N/A" dans les cellules web.

--- RÈGLES POUR LA RECHERCHE WEB (web_search) ---
- Utilise web_search UNIQUEMENT si le client pose une question générale sur un équipement médical (pas pour chercher dans le catalogue RZMedical).
- Exemple d'usage : "Qu'est-ce qu'un tensiomètre à mercure ?", "Quelles sont les certifications obligatoires pour les gants chirurgicaux ?"
- Ne jamais inventer des URLs ou des sources. Cite les sources Tavily telles quelles.
- Si Tavily renvoie une réponse vide, dis que tu n'as pas trouvé d'info externe et propose de contacter l'équipe.

--- RÈGLES SPÉCIALES POUR LA RECHERCHE PAR IMAGE ---
Quand le message contient une balise [Image identifiée : ...] avec des caractéristiques extraites par l'IA :
1. Lis attentivement les caractéristiques détectées (type, marque, modèle, usage, matière, couleur).
2. Effectue PLUSIEURS recherches ciblées avec les mots-clés les plus pertinents (ex: si c'est un "stéthoscope Littmann", cherche d'abord "stéthoscope Littmann" puis "stéthoscope" si rien).
3. Si des produits similaires sont trouvés : présente-les avec les cartes [PRODUCT|...] et explique en quoi ils correspondent à l'image.
4. Si AUCUN produit n'est trouvé après plusieurs tentatives : NE DIS PAS juste "nous n'avons pas ce produit". À la place, résume les caractéristiques du produit identifié sur l'image (type, marque probable, usage, matière, dimensions si visibles) de manière professionnelle. Par exemple : "D'après l'image, il s'agit d'un **stéthoscope cardio** double pavillon, probablement de marque Littmann, avec un tube en PVC de couleur noire. Ce type d'équipement n'est pas actuellement disponible dans notre catalogue, mais je vous encourage à contacter notre équipe pour une commande spéciale."
`;

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
        "Recherche des informations techniques sur le web via Tavily AI. Utiliser pour des questions générales sur les équipements médicaux (spécifications, certifications, comparatif de produits). NE PAS utiliser pour chercher des produits dans le catalogue RZMedical (utiliser search_products à la place).",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "La requête de recherche en français ou en anglais. Ex: \"tensiomètre Omron M3 spécifications techniques\".",
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
        "Compare plusieurs produits du catalogue RZMedical côte à côte. Utilise cet outil quand le client demande de comparer deux produits ou plus. Renvoie les données complètes du catalogue (prix, marque, disponibilité, catégorie, référence, description) ET des informations web enrichies (spécifications techniques, certifications, usages) via Tavily.",
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
): Promise<unknown> {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    // arguments malformés : on continue avec un objet vide plutôt que de planter
  }

  if (functionName === "search_products") {
    const q = typeof args.q === "string" && args.q.trim() ? args.q.trim() : "";
    if (!q) throw new Error("Le paramètre 'q' est requis pour search_products.");
    const products = await searchProducts(q);
    return products
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
  }

  if (functionName === "web_search") {
    const query = typeof args.query === "string" && args.query.trim() ? args.query.trim() : "";
    if (!query) throw new Error("Le paramètre 'query' est requis pour web_search.");
    const results = await tavilySearch(query, 4);
    if (results.length === 0) return { message: "Aucun résultat web trouvé." };
    return results;
  }

  if (functionName === "compare_products") {
    const keywords = Array.isArray(args.keywords) ? args.keywords : [];
    if (keywords.length < 2) throw new Error("Au moins 2 mots-clés sont requis pour la comparaison.");
    const results = await Promise.all(
      keywords.slice(0, 4).map(async (kw: string) => {
        const q = typeof kw === "string" ? kw.trim() : "";
        if (!q) return { keyword: kw, produit: null, webInfo: [] };
        // Recherche catalogue + web en parallèle
        const [products, webResults] = await Promise.all([
          searchProducts(q),
          tavilySearch(`${q} spécifications techniques équipement médical`, 2),
        ]);
        const p = products[0] ?? null;
        return {
          keyword: kw,
          produit: p
            ? {
                nom: p.nom,
                reference: p.reference,
                prix: Number(p.prix),
                remise: Number(p.remise),
                disponible: p.disponible,
                marque: p.marque?.nom ?? "N/A",
                categorie: p.sousCategorie?.categorie?.nom ?? "N/A",
                sousCategorie: p.sousCategorie?.nom ?? "N/A",
                description: p.description ?? "",
                tva: Number(p.tva),
                paysFabrication: p.paysFabrication ?? "N/A",
              }
            : null,
          // Informations web enrichies (spécifications, certifications, etc.)
          webInfo: webResults.map(r => r.content).filter(Boolean),
        };
      })
    );
    return results;
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

async function runToolCall(toolCall: ToolCall, clientToken?: string) {
  const { name, arguments: rawArgs } = toolCall.function;
  let result: unknown;
  try {
    result = await executeTool(name, rawArgs, clientToken);
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
    "qwen/qwen3.6-27b",
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
  try {
    const { messages } = (await req.json()) as { messages: ChatMessage[] };

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages array" }), {
        status: 400,
      });
    }

    const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
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

    const groqMessages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...processedMessages,
    ];

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let finalText: string | undefined;

          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const response = await groqChat({
              model: GROQ_MODEL,
              messages: groqMessages,
              tools,
              tool_choice: "auto",
              stream: false,
            }, "openai/gpt-oss-20b");

            const choice = response.data?.choices?.[0];
            const message = choice?.message;
            const toolCalls: ToolCall[] | undefined = message?.tool_calls;

            if (!toolCalls || toolCalls.length === 0) {
              finalText = message?.content;
              // Enregistrer l'usage de la réponse finale
              recordGroqUsage(response.data, response.headers, GROQ_MODEL).catch(() => {});
              break;
            }

            // On ajoute le message assistant contenant les tool_calls à l'historique
            groqMessages.push({
              role: "assistant",
              content: message.content ?? null,
              tool_calls: toolCalls,
            });

            // On exécute tous les outils demandés (potentiellement en parallèle)
            const toolResults = await Promise.all(
              toolCalls.map((tc) => runToolCall(tc, clientToken)),
            );
            groqMessages.push(...toolResults);
          }

          if (!finalText) {
            const fallback = await groqChat({
              model: GROQ_MODEL,
              messages: [
                ...groqMessages,
                {
                  role: "system",
                  content: "Réponds maintenant au client avec les informations déjà obtenues, sans appeler d'autre outil.",
                },
              ],
              stream: false,
            });
            finalText = fallback.data?.choices?.[0]?.message?.content;
            recordGroqUsage(fallback.data, fallback.headers, GROQ_MODEL).catch(() => {});
          }

          if (finalText) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: finalText })}\n\n`));
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Erreur Groq";
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