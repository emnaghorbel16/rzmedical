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

async function groqChat(
  body: Record<string, unknown>,
  fallbackModel?: string,
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
      // Essayer le modèle de secours en premier si disponible
      if (fallbackModel && body.model !== fallbackModel) {
        console.warn(`Rate limit on ${body.model}, switching to fallback ${fallbackModel}`);
        return groqChat({ ...body, model: fallbackModel }, undefined, 0);
      }
      // Retry avec délai exponentiel jusqu'à 2 fois
      if (attempt < 2) {
        // Groq envoie le délai dans le header retry-after ou x-ratelimit-reset-tokens
        const retryAfterHeader = response.headers.get("retry-after");
        const waitMs = retryAfterHeader
          ? Math.ceil(parseFloat(retryAfterHeader) * 1000)
          : (attempt + 1) * 10_000; // 10s puis 20s
        console.warn(`Groq 429, retrying in ${waitMs}ms (attempt ${attempt + 1})...`);
        await new Promise((r) => setTimeout(r, waitMs));
        return groqChat(body, fallbackModel, attempt + 1);
      }
      throw new Error(
        "Le chatbot est temporairement surchargé. Veuillez réessayer dans quelques secondes."
      );
    }
    const error = await response.text();
    throw new Error(`Erreur Groq (${response.status}): ${error}`);
  }

  const data = await response.json();
  return { data, headers: response.headers };
}

async function groqStreamChat(
  messages: any[],
  model: string,
  onDelta: (chunk: string) => void,
  fallbackModel?: string
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
    if (response.status === 429 && fallbackModel && model !== fallbackModel) {
      console.warn(`Rate limit on ${model} (stream), switching to fallback ${fallbackModel}`);
      return groqStreamChat(messages, fallbackModel, onDelta);
    }
    const errorText = await response.text();
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
              content: (snippets[i] || "").slice(0, 750),
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
    const results: { title: string; url: string; content: string }[] = (data.results ?? []).map((r: any) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      content: (r.content ?? "").slice(0, 1200),
    }));
    if (data.answer) {
      results.unshift({ title: "Synthèse Tavily", url: "", content: data.answer.slice(0, 600) });
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
- À la fin de chaque réponse, propose TOUJOURS 1 ou 2 questions pertinentes en utilisant OBLIGATOIREMENT ce tag : [SUGGESTION|Question]
  ══════════════════════════════════════════════════════
  RÈGLE ABSOLUE SUR LES SUGGESTIONS : 
  1. Toute suggestion DOIT être emballée dans le tag [SUGGESTION|...]. Ne JAMAIS écrire une suggestion en texte libre à la fin du message sans le tag !
  2. La question DOIT être formulée EXACTEMENT du point de vue du CLIENT (comme s'il tapait lui-même dans le chat pour s'adresser à RZMedical) :
  
  ❌ INTERDIT (texte libre ou le bot qui pose la question) :
    - Je souhaite comparer ces moteurs...
    - Quels sont vos délais... (sans tag [SUGGESTION|...])
    - Quel type de matériel voulez-vous ?
  
  ✅ OBLIGATOIRE (avec le tag et point de vue client) :
    - [SUGGESTION|Quels sont vos délais de livraison pour ces moteurs ?]
    - [SUGGESTION|Avez-vous une garantie sur ces équipements ?]
    - [SUGGESTION|Puis-je avoir un devis pour le C-Sailor Pro ?]
  ══════════════════════════════════════════════════════
- Ne jamais poser de question ouverte au client dans le corps du message pour lui demander ce qu'il cherche — utilise uniquement les tags [SUGGESTION|...] pour guider.
- INTERDICTION ABSOLUE DE REMISE : Tu ne dois JAMAIS proposer, accorder, négocier ou mentionner une remise, réduction, promotion spéciale ou geste commercial à un client, quelle que soit sa demande. Si le client demande une remise, réponds poliment que les prix affichés sont les prix officiels de RZMedical et que pour toute demande commerciale particulière, il doit contacter directement notre équipe commerciale.
- Si le client demande un numéro de téléphone, un email, une adresse ou le site web de RZMedical, tu DOIS utiliser l'outil get_contact_info. Ne devine et n'invente JAMAIS ces informations — si l'outil renvoie une valeur vide (null), dis au client que cette information n'est pas encore disponible et propose une alternative (ex: page contact du site).
- Si un outil renvoie une erreur d'authentification, explique poliment au client qu'il doit se connecter à son compte pour accéder à cette information.

--- RÈGLES DE COMPARAISON DE PRODUITS ---
- Quand le client demande de comparer des produits :
  1. Utilise TOUJOURS l'outil compare_products avec les mots-clés courts de chaque produit.
  2. L'outil cherche d'abord dans le catalogue RZMedical, puis enrichit CHAQUE produit avec une recherche Tavily (que le produit soit dans le catalogue ou non).
  3. Tu reçois pour chaque produit : dansCatalogue (true/false), les données BDD si disponibles, et le champ webInfo (résultats Tavily).
  4. Génère UN SEUL tag [COMPARE|...] structuré.

RÈGLE AFFICHAGE :
- Si un produit est dans le catalogue RZMedical (dansCatalogue: true) : utilise ses données BDD (prix, stock, référence) et complète avec webInfo pour les specs techniques. Indique "✅ Vendu par RZMedical" dans une ligne du tableau.
- Si un produit n'est PAS dans le catalogue (dansCatalogue: false) : utilise uniquement le webInfo pour construire sa colonne. Indique "❌ Non vendu par RZMedical" dans une ligne du tableau. Ne donne pas de prix ni de stock inventés.
- Tu peux générer un tableau comparatif même si aucun produit n'est dans le catalogue, tant que le webInfo contient des informations techniques suffisantes.

FORMAT OBLIGATOIRE :
[COMPARE|Nom Produit A|Nom Produit B]
[COMPARE_ROW|Critère|Valeur A|Valeur B]
...
[COMPARE_END]

RÈGLES GÉNÉRALES :
- TOUJOURS inclure en premier : Prix TND (avec remise si applicable), Marque, Stock, Référence, Disponible, Pays fabrication.
- Pour le stock : "Disponible (X unités)" si > 5 | "Stock faible (X unités)" si 1-5 | "Épuisé" si 0.
- Pour le prix : affiche "X TND (-Y%)" si remise > 0, sinon juste "X TND".
- Critères SANS emojis — texte uniquement.
- INTERDICTION ABSOLUE DES LIGNES DOUBLES "N/D" : Ne mets JAMAIS une ligne où les deux produits ont "N/D" (par exemple si "Rotation backrest" ou "Charge max" est inconnu pour les 2, NE METS PAS cette ligne). Chaque ligne du tableau doit apporter au moins une vraie valeur concrète !
- N'ajoute QUE les critères techniques pour lesquels tu as trouvé des informations réelles dans le catalogue ou dans le webInfo (ex: Revêtement, Équipements inclus, Commandes, Positions, Fonctions spéciales).
- Termine TOUJOURS par [COMPARE_END].
- APRÈS le tableau, rédige OBLIGATOIREMENT une recommandation personnalisée de 2-3 phrases. Commence par "**Notre recommandation :**".
- Si plus de 2 produits : ajoute les colonnes supplémentaires séparées par |.

CRITÈRES SPÉCIFIQUES PAR CATÉGORIE — utilise ces critères SELON la catégorie des produits comparés (extrait-la de sousCategorie, categorie ou motsCles dans les données de l'outil) :

━━━ TENSIOMÈTRE / SPHYGMOMANOMÈTRE ━━━
Critères spécifiques à ajouter après les critères généraux :
[COMPARE_ROW|Technologie de mesure|ex: Intellisense / Oscillométrique / Manuelle]
[COMPARE_ROW|Position de mesure|ex: Bras / Poignet / Doigt]
[COMPARE_ROW|Précision (±mmHg)|ex: ±3 mmHg / ±5 mmHg]
[COMPARE_ROW|Tour de bras supporté|ex: 22-32 cm / 25-40 cm]
[COMPARE_ROW|Utilisateurs|ex: 1 utilisateur / 2 utilisateurs / Multi]
[COMPARE_ROW|Connectivité|ex: Bluetooth / Wi-Fi / Aucune]
[COMPARE_ROW|Alimentation|ex: Piles AA / Secteur / Rechargeable USB]
[COMPARE_ROW|Mémoire|ex: 60 mesures / 120 mesures]
[COMPARE_ROW|Détection arythmie|ex: Oui / Non]
[COMPARE_ROW|Certification|ex: CE, ISO 13485 / CE uniquement]
[COMPARE_ROW|Usage cible|ex: Domicile / Clinique / Professionnel]

━━━ FAUTEUIL DENTAIRE / UNIT DENTAIRE ━━━
[COMPARE_ROW|Motorisation|ex: Hydraulique / Électrique]
[COMPARE_ROW|Rotation backrest|ex: 360° / Fixe]
[COMPARE_ROW|Scialytique intégré|ex: LED / Halogène / Non]
[COMPARE_ROW|Crachoir|ex: Intégré / Non]
[COMPARE_ROW|Tablette|ex: Droite / Pivotante / Non]
[COMPARE_ROW|Revêtement|ex: Simili-cuir / PVC médical]
[COMPARE_ROW|Nombre de moteurs|ex: 3 moteurs / 5 moteurs]
[COMPARE_ROW|Positions|ex: 3 positions / Multiples programmables]
[COMPARE_ROW|Commande|ex: Pédale / Télécommande / Panneau]
[COMPARE_ROW|Charge max|ex: 150 kg / 200 kg]

━━━ GANTS (MÉDICAUX / CHIRURGICAUX / DENTAIRES) ━━━
[COMPARE_ROW|Matière|ex: Latex / Nitrile / Vinyle / Néoprène]
[COMPARE_ROW|Type|ex: Chirurgicaux / Examen / Protection]
[COMPARE_ROW|Épaisseur|ex: 0,08 mm / 0,12 mm]
[COMPARE_ROW|Stérilité|ex: Stérile / Non stérile]
[COMPARE_ROW|Sans poudre|ex: Oui / Non]
[COMPARE_ROW|Texturation|ex: Lisse / Texturé doigts / Texturé paume]
[COMPARE_ROW|Conditionnement|ex: 100 pcs/boîte / 50 paires/boîte]
[COMPARE_ROW|Tailles disponibles|ex: XS, S, M, L, XL / S, M, L]
[COMPARE_ROW|Norme|ex: EN 455 / EN 374 / ISO 11193]
[COMPARE_ROW|Usage|ex: Chirurgie / Examen / Dentaire / Labo]

━━━ STÉTHOSCOPE ━━━
[COMPARE_ROW|Type|ex: Acoustique / Électronique / Foetal]
[COMPARE_ROW|Nombre de fréquences|ex: Double (cloche+membrane) / Simple]
[COMPARE_ROW|Longueur tubes|ex: 27 cm / 40 cm]
[COMPARE_ROW|Type d'oreillettes|ex: Soft-sealing / Dur]
[COMPARE_ROW|Poids|ex: 120 g / 180 g]
[COMPARE_ROW|Spécialité|ex: Cardio / Pédiatrique / Général]
[COMPARE_ROW|Amplification électronique|ex: Oui (24x) / Non]
[COMPARE_ROW|Réduction de bruit|ex: Oui / Non]
[COMPARE_ROW|Usage|ex: Domicile / Généraliste / Cardiologue]

━━━ AUTOCLAVE / STÉRILISATEUR ━━━
[COMPARE_ROW|Type de stérilisation|ex: Vapeur classe B / Classe N / EO]
[COMPARE_ROW|Volume chambre|ex: 18 litres / 22 litres / 45 litres]
[COMPARE_ROW|Température max|ex: 134°C / 121°C]
[COMPARE_ROW|Durée cycle|ex: 15 min / 30 min (selon charge)]
[COMPARE_ROW|Type d'eau|ex: Distillée uniquement / Osmosée]
[COMPARE_ROW|Affichage|ex: LCD / Écran tactile / Analogique]
[COMPARE_ROW|Traçabilité|ex: Imprimante intégrée / Non]
[COMPARE_ROW|Norme|ex: EN 13060 classe B / EN 285]
[COMPARE_ROW|Puissance|ex: 1800 W / 2200 W]

━━━ SCIALYTIQUE / LAMPE CHIRURGICALE ━━━
[COMPARE_ROW|Technologie|ex: LED / Halogène]
[COMPARE_ROW|Éclairement (lux)|ex: 30 000 lux / 60 000 lux]
[COMPARE_ROW|Température couleur|ex: 4 500 K / 6 000 K]
[COMPARE_ROW|Rendu couleur (CRI)|ex: CRI > 95 / CRI 85]
[COMPARE_ROW|Profondeur d'ombre|ex: 1,2 m / 1,5 m]
[COMPARE_ROW|Bras|ex: Double / Simple / Satellite]
[COMPARE_ROW|Batterie de secours|ex: Intégrée / Non]
[COMPARE_ROW|Diamètre lumière|ex: 20 cm / 28 cm]

━━━ PANSEMENTS / CONSOMMABLES STÉRILES ━━━
[COMPARE_ROW|Matière|ex: Gaze / Tissu non-tissé / Hydrocolloïde]
[COMPARE_ROW|Dimensions|ex: 10x10 cm / 20x20 cm]
[COMPARE_ROW|Stérilité|ex: Stérile / Non stérile]
[COMPARE_ROW|Type de plaies|ex: Plaies simples / Chroniques / Brûlures]
[COMPARE_ROW|Absorption|ex: Faible / Moyenne / Haute]
[COMPARE_ROW|Conditionnement|ex: 10 pcs/boîte / 50 pcs/boîte]

━━━ MATÉRIEL DENTAIRE (TURBINE, CONTRE-ANGLE, MICROMOTEUR) ━━━
[COMPARE_ROW|Type|ex: Turbine / Contre-angle / Micromoteur]
[COMPARE_ROW|Vitesse max|ex: 400 000 tr/min / 200 000 tr/min]
[COMPARE_ROW|Fibre optique|ex: Intégrée / Non]
[COMPARE_ROW|Spray eau|ex: Triple jet / Simple jet / Non]
[COMPARE_ROW|Type de connexion|ex: Standard ISO / Kavo / W&H]
[COMPARE_ROW|Maintenance|ex: Autolubrifiante / Lubrification manuelle]
[COMPARE_ROW|Niveau sonore|ex: < 65 dB / < 70 dB]

━━━ PRODUIT GÉNÉRIQUE (si catégorie non reconnue) ━━━
Si la catégorie n'est pas dans la liste ci-dessus, utilise les critères issus de la description, des motsCles et du webInfo : extrait les caractéristiques RÉELLES du produit (dimensions, matériaux, normes, puissance, capacité...) et n'utilise PAS les exemples d'autres catégories.

IMPORTANT — UTILISATION DE webInfo POUR COMPLÉTER LES DESCRIPTIONS DU CATALOGUE :
- Pour chaque produit du catalogue, tu reçois : ses données BDD (prix, marque, stock, description) ET un champ "webInfo" contenant des extraits web sur ce produit spécifique.
- RÈGLE ABSOLUE DE PRIORITÉ :
  1. Données BDD (prix, marque, stock, référence, disponibilité, paysFabrication) → TOUJOURS prioritaires, ne jamais les modifier avec le web.
  2. Données techniques (motorisation, positions, revêtement, crachoir, tablette, commande, dimensions, normes, poids...) → Si absentes ou vagues dans la description BDD, EXTRAIS-LES IMPÉRATIVEMENT du webInfo.
  3. OBLIGATION : Pour chaque ligne du tableau comparatif qui affiche "Non spécifié" ou "N/D", tu DOIS relire le webInfo du produit concerné et chercher la valeur. Si tu ne la trouves pas dans webInfo, SEULEMENT ALORS écris "N/D".
- MÉTHODE CONCRÈTE : Pour chaque critère du tableau (ex: "Crachoir"), lis l'intégralité du webInfo du produit A et cherche si "crachoir", "spittoon", "crachat" y apparaît. Fait de même pour le webInfo du produit B.
- N'écris "N/D" QUE si le terme technique est TOTALEMENT absent des deux sources (description BDD + webInfo).
- Si les 2 produits sont de catégories DIFFÉRENTES → utilise les critères communs (prix, marque, stock, usage) et mentionne qu'ils ne sont pas directement comparables dans ta recommandation.

--- RÈGLE CRUCIALE : RECHERCHE WEB QUAND UN PRODUIT EST INTROUVABLE DANS LE CATALOGUE ---
- Quand le client recherche un produit ou demande des informations sur un équipement : tu DOIS d'abord chercher avec search_products.
- SI search_products NE RENVOIE AUCUN PRODUIT (0 résultat dans le catalogue RZMedical) :
  👉 Tu DOIS OBLIGATOIREMENT APPELER L'OUTIL web_search pour chercher sur le web (Google / Web).
  👉 Avec les informations trouvées sur le web :
     1. Explique en détail et de manière professionnelle ce qu'est cet équipement, ses fonctions, ses caractéristiques techniques majeures et son utilité médicale ou dentaire.
     2. Indique clairement : "Cet équipement n'est pas actuellement disponible en stock dans notre catalogue en ligne RZMedical, mais notre équipe peut vous le fournir sur commande spéciale auprès de nos partenaires."
     3. Invite le client à contacter le service commercial de RZMedical pour un devis ou une commande sur mesure.
  👉 Ne dis JAMAIS simplement "nous n'avons pas ce produit" sans faire de recherche web pour renseigner le client !

--- RÈGLES GÉNÉRALES POUR LA RECHERCHE WEB (web_search) ---
- Utilise web_search pour toute question technique ou générale sur un équipement médical, son fonctionnement, ses normes (CE, ISO, etc.) ou ses spécifications.
- Utilise web_search pour enrichir tes connaissances dès qu'un équipement n'est pas dans le catalogue.
- Cite les éléments concrets et fiables obtenus sur le web.

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
    const results = await Promise.all(
      keywords.slice(0, 4).map(async (kw: string) => {
        const q = typeof kw === "string" ? kw.trim() : "";
        if (!q) return { keyword: kw, dansCatalogue: false, produit: null, webInfo: [] };

        console.log(`\n======================================================`);
        console.log(`🔍 [compare_products] Recherche BDD pour le mot-clé: "${q}"`);

        // 1. Recherche DANS le catalogue RZMedical
        let products: any[] = [];
        try {
          products = await searchProducts(q);
          console.log(`📦 [compare_products] Résultat BDD pour "${q}": ${products.length} produit(s) trouvé(s)`);
        } catch (dbErr) {
          console.error(`❌ [compare_products] Erreur requête BDD pour "${q}":`, dbErr);
          products = [];
        }
        const p = Array.isArray(products) ? products[0] ?? null : null;

        // 2. Recherche web UNIQUEMENT pour les produits du catalogue afin de compléter les descriptions/spécifications manquantes
        let webInfo: { title: string; url: string; content: string }[] = [];
        if (p) {
          const descLen = p.description ? p.description.trim().length : 0;
          console.log(`✅ [compare_products] Produit sélectionné : "${p.nom}"`);
          console.log(`   - Marque : ${p.marque?.nom ?? "N/A"} | Réf : ${p.reference}`);
          console.log(`   - Description en base (${descLen} car.) : ${p.description ? `"${p.description.slice(0, 100)}..."` : "VIDE / INEXISTANTE"}`);
          onLog?.(`📦 BDD : "${p.nom}" (${p.marque?.nom ?? "Sans marque"})`);

          // Pour la comparaison, on enrichit TOUJOURS avec la recherche web (Tavily)
          // afin d'obtenir les spécifications techniques, certifications, etc.
          const needsWebSearch = true;
          if (needsWebSearch) {
            try {
              const searchQuery = `${p.nom} ${p.marque?.nom ?? ""} ${p.reference ?? ""} fiche technique spécifications`.trim();
              console.log(`🚀 [compare_products] Recherche Tavily pour enrichir "${p.nom}"`);
              webInfo = await performWebSearch(searchQuery, 4, onLog);
              console.log(`📥 [compare_products] WebInfo : ${webInfo.length} résultat(s) Tavily pour "${p.nom}"`);
            } catch (webErr) {
              console.error(`❌ [compare_products] Erreur recherche web pour "${p.nom}":`, webErr);
              webInfo = [];
            }
          }
        } else {
          // Produit absent du catalogue : on recherche quand même sur le web pour récupérer les specs
          console.warn(`⚠️ [compare_products] Produit "${q}" absent du catalogue RZMedical → Recherche Tavily pour specs externes.`);
          onLog?.(`⚠️ Produit "${q}" absent du catalogue RZMedical — recherche web en cours...`);
          try {
            const searchQuery = `${q} fiche technique spécifications équipement médical`.trim();
            console.log(`🚀 [compare_products] Recherche Tavily (hors catalogue) pour "${q}"`);
            webInfo = await performWebSearch(searchQuery, 4, onLog);
            console.log(`📥 [compare_products] WebInfo hors catalogue : ${webInfo.length} résultat(s) pour "${q}"`);
          } catch (webErr) {
            console.error(`❌ [compare_products] Erreur recherche web hors catalogue pour "${q}":`, webErr);
            webInfo = [];
          }
        }
        console.log(`======================================================\n`);

        return {
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
                description: (p.description ?? "").slice(0, 800),
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
            : `Produit "${kw}" absent du catalogue RZMedical : caractéristiques techniques récupérées via recherche web Tavily pour la comparaison.`,
        };
      })
    );

    const trouves = results.filter((r) => r.dansCatalogue);
    return {
      totalDemandes: keywords.length,
      nombreDansCatalogue: trouves.length,
      produits: results,
      consigne:
        "RÈGLE COMPARATIF : Construis OBLIGATOIREMENT le tableau comparatif [COMPARE|...] pour TOUS les produits demandés. " +
        "1) Pour les produits vendus par RZMedical (dansCatalogue: true) : affiche leurs données officielles (prix, remise, stock, réf) et complète OBLIGATOIREMENT les spécifications techniques avec le champ webInfo (Tavily). Ajoute une ligne 'Disponibilité catalogue' = '✅ Vendu par RZMedical'. " +
        "2) Pour les produits non vendus par RZMedical (dansCatalogue: false) : utilise EXCLUSIVEMENT le champ webInfo (Tavily) pour remplir leurs caractéristiques techniques. Ajoute une ligne 'Disponibilité catalogue' = '❌ Non vendu par RZMedical' et n'invente aucun prix ni stock. " +
        "3) EXPLOITE À FOND les informations techniques contenues dans webInfo (puissance, dimensions, fonctionnalités, matériaux, options, etc.) pour créer un tableau riche avec de vrais critères techniques.",
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

    const GROQ_MODEL = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
    const FALLBACK_MODEL = "openai/gpt-oss-20b";
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
                model: GROQ_MODEL,
                messages: groqMessages,
                tools,
                tool_choice: "auto",
                stream: false,
              },
              FALLBACK_MODEL
            );

            const choice = response.data?.choices?.[0];
            const message = choice?.message;
            const toolCalls: ToolCall[] | undefined = message?.tool_calls;

            if (!toolCalls || toolCalls.length === 0) {
              if (!toolExecuted && message?.content) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: message.content })}\n\n`)
                );
                recordGroqUsage(response.data, response.headers, GROQ_MODEL).catch(() => {});
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
          }

          // Si des outils ont été exécutés, on stream la réponse finale token par token en direct !
          if (toolExecuted) {
            onLog("✍️ Rédaction de la réponse...");
            const { text: streamedText, headers } = await groqStreamChat(
              groqMessages,
              GROQ_MODEL,
              (delta) => {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`)
                );
              },
              FALLBACK_MODEL
            );
            recordGroqUsage(
              { usage: { total_tokens: 400 } },
              headers ?? new Headers(),
              GROQ_MODEL
            ).catch(() => {});
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