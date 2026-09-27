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
const MAX_TOOL_ROUNDS = 4; // évite les boucles infinies d'appels d'outils

async function groqChat(body: Record<string, unknown>, fallbackModel?: string) {
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
    // On 429 (rate limit), automatically retry with the smaller model
    if (response.status === 429 && fallbackModel && body.model !== fallbackModel) {
      console.warn(`Rate limit on ${body.model}, retrying with ${fallbackModel}`);
      return groqChat({ ...body, model: fallbackModel });
    }
    const error = await response.text();
    throw new Error(`Erreur Groq (${response.status}): ${error}`);
  }

  return response.json();
}

const SYSTEM_PROMPT = `Tu es "RZBot", l'assistant virtuel intelligent de RZMedical — une entreprise tunisienne spécialisée dans la vente d'équipements et consommables médico-dentaires professionnels.

Ton rôle :
- Aider les clients à trouver les bons produits dans le catalogue.
- Répondre aux questions sur les équipements médicaux, dentaires, etc.
- Donner des conseils professionnels.

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
      const text = res.choices?.[0]?.message?.content;
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

            const choice = response.choices?.[0];
            const message = choice?.message;
            const toolCalls: ToolCall[] | undefined = message?.tool_calls;

            if (!toolCalls || toolCalls.length === 0) {
              finalText = message?.content;
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
            // Sécurité si on a atteint MAX_TOOL_ROUNDS sans réponse finale
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
            finalText = fallback.choices?.[0]?.message?.content;
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