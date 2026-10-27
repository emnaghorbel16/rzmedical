import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../config/prisma';

// ─── Configuration ────────────────────────────────────────────────────────────

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

// Fournisseur IA : OpenAI ou Groq (avec basculement automatique si OpenAI est épuisé)
const FORCE_GROQ = process.argv.includes('--groq') || process.env.AI_PROVIDER === 'groq';
let IS_OPENAI = Boolean(OPENAI_API_KEY) && !FORCE_GROQ;
let API_KEY = IS_OPENAI ? OPENAI_API_KEY : GROQ_API_KEY;
const cliModelArg = process.argv.find((a) => a.startsWith('--model='))?.split('=')[1];

let API_URL = IS_OPENAI
  ? 'https://api.openai.com/v1/chat/completions'
  : 'https://api.groq.com/openai/v1/chat/completions';
let MODEL = cliModelArg
  ? cliModelArg
  : IS_OPENAI
    ? (process.env.OPENAI_MODEL || 'gpt-4o-mini')
    : (process.env.GROQ_MODEL || 'openai/gpt-oss-120b');

// Taille du lot traité en parallèle (1 pour rester sous les 8 000 TPM de Groq)
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '1', 10);

// Délai entre les requêtes (ms) pour respecter les quotas Groq
const DELAY_BETWEEN_BATCHES_MS = parseInt(process.env.BATCH_DELAY_MS || '2500', 10);

// Fichier de rapport final
const REPORT_PATH = path.join(process.cwd(), 'reformulation-rapport.txt');

// ─── Cache mémoire (évite les doublons dans le même run) ─────────────────────
const _descCache = new Map<string, string>();

// ─── Détection dynamique du modèle Groq disponible ───────────────────────────
async function resolveGroqModel(apiKey: string): Promise<string> {
  if (process.env.GROQ_MODEL) return process.env.GROQ_MODEL;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      const ids: string[] = (data.data || []).map((m: any) => m.id);
      const preferred = [
        'llama-3.3-70b-versatile',
        'llama-3.1-70b-versatile',
        'llama-3.1-8b-instant',
        'llama3-70b-8192',
        'llama3-8b-8192',
        'gemma2-9b-it',
        'mixtral-8x7b-32768',
      ];
      for (const p of preferred) {
        if (ids.includes(p)) return p;
      }
      if (ids.length > 0) return ids[0];
    }
  } catch {}
  return 'llama-3.1-8b-instant';
}

// ─── Basculement vers Groq ──────────────────────────────────────────────────
async function switchToGroq() {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY n\'est pas défini dans le fichier .env');
  }
  IS_OPENAI = false;
  API_KEY = GROQ_API_KEY;
  API_URL = 'https://api.groq.com/openai/v1/chat/completions';
  MODEL = await resolveGroqModel(GROQ_API_KEY);
  console.log(`🔄 Basculement vers Groq (Modèle actif : ${MODEL} - Gratuit)...`);
}

// ─── Génération IA : Reformulation & Optimisation SEO ───────────────────────

async function reformulateDescription(opts: {
  nom: string;
  reference?: string;
  rawDescription: string;
  categorie?: string;
  sousCategorie?: string;
  marque?: string;
  paysFabrication?: string;
}): Promise<string> {
  if (!API_KEY) {
    throw new Error('Ni OPENAI_API_KEY ni GROQ_API_KEY ne sont définis dans le fichier .env');
  }

  const cacheKey = `${opts.nom}|${opts.rawDescription}`;
  if (_descCache.has(cacheKey)) return _descCache.get(cacheKey)!;

  const contextParts: string[] = [
    `- Nom du produit : ${opts.nom}`,
    opts.reference ? `- Référence : ${opts.reference}` : '',
    opts.marque ? `- Marque / Fabricant : ${opts.marque}` : '- Marque / Fabricant : Non spécifiée',
    opts.categorie || opts.sousCategorie
      ? `- Gamme / Catégorie : ${[opts.categorie, opts.sousCategorie].filter(Boolean).join(' > ')}`
      : '- Gamme / Catégorie : Dispositif médical / dentaire',
    opts.paysFabrication ? `- Pays de fabrication : ${opts.paysFabrication}` : '',
    opts.rawDescription && opts.rawDescription.trim()
      ? `- Fiche technique & données existantes : ${opts.rawDescription.trim()}`
      : '- Données existantes : Aucune description préalable disponible',
  ].filter(Boolean);

  const prompt =
    `Tu es un rédacteur spécialisé en dispositifs médicaux et dentaires, avec une solide maîtrise de la réglementation (marquage CE, normes ISO applicables, DPM en Tunisie) et de la communication technique pour les professionnels de santé.

Rédige une fiche produit d'excellence pour le dispositif suivant :

${contextParts.join('\n')}

DESTINATION : Boutique en ligne médicale et dentaire (RZ Medical Tunisie - vente aux chirurgiens-dentistes, cliniques et professionnels de santé).
LANGUE : Français
TON : Professionnel, clair, factuel, valorisant
LONGUEUR : 120 à 180 mots

STRUCTURE ATTENDUE (2 à 3 paragraphes fluides et aérés, séparés par un saut de ligne) :
1. Présentation & Rôle clinique : Nom et type exact du produit, indications principales, avantages majeurs pour la pratique quotidienne du praticien.
2. Utilisateurs cibles & Caractéristiques techniques : Praticiens concernés (ex: dentistes, orthodontistes, prothésistes), caractéristiques techniques notables (composition, fluidité, temps de prise, précision...).
3. Normes, Précautions & Conditionnement : Conformité réglementaire (marquage CE, normes ISO applicables au dispositif), conditionnement ou précaution essentielle d'usage/conservation.

RÈGLES TYPOGRAPHIQUES & COULEURS (À UTILISER AVEC SOBRIÉTÉ) :
- *mot ou groupe de mots* → GRAS : réservé aux 2 à 4 éléments vraiment clés (ex: nom du produit, caractéristique maîtresse, utilisateurs).
- _mot ou terme technique_ → ITALIQUE : pour les termes techniques spécifiques, dénominations ou normes.
- [red]texte[/red], [blue]texte[/blue], [green]texte[/green] → COULEUR : utilise avec une GRANDE modération. MAXIMUM 1 balise couleur dans toute la fiche produit, et SEULEMENT si c'est vraiment nécessaire (ex: [green] pour certification officielle ISO/CE, [red] pour précaution/sécurité critique). Si aucune couleur n'est indispensable, n'en mets aucune.
- N'utilise jamais de balises markdown interdites (pas de #, pas de **).

RÈGLES IMPÉRATIVES :
1. Rigueur médicale absolue : base-toi sur le type de produit et les informations fournies. N'invente AUCUNE donnée fantaisiste.
2. Commence directement par le corps du texte — JAMAIS par "Voici", "Découvrez", "Fiche produit :" ou des listes de métadonnées brutes.
3. Réponds UNIQUEMENT avec le texte final de la fiche produit prêt à être affiché, rien d'autre.`;

  // Appel API avec gestion automatique du Rate Limit 429 (Groq) et basculement OpenAI
  let data: any = null;
  const maxRetries = 6;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500, // Réduit la réservation TPM de Groq tout en laissant largement la place pour 180 mots
        temperature: 0.5,
      }),
    });

    // Si OpenAI échoue faute de crédit, basculer sur Groq automatiquement
    if (!res.ok && IS_OPENAI && GROQ_API_KEY) {
      const errText = await res.text();
      if (errText.includes('insufficient_quota') || errText.includes('credit_balance_exhausted')) {
        await switchToGroq();
        continue;
      }
      throw new Error(`OpenAI API ${res.status}: ${errText.slice(0, 300)}`);
    }

    // Gestion intelligente du Rate Limit 429 de Groq
    if (res.status === 429) {
      const errText = await res.text();
      const match = errText.match(/try again in ([0-9.]+)s/i);
      const waitSeconds = match ? Math.ceil(parseFloat(match[1])) + 2 : Math.min(25, 6 * attempt);
      console.warn(`   ⏳ Limite Groq (429 TPM) atteinte. Pause de ${waitSeconds}s puis reprise automatique (${attempt}/${maxRetries})...`);
      await sleep(waitSeconds * 1000);
      continue;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`${IS_OPENAI ? 'OpenAI' : 'Groq'} API ${res.status}: ${errText.slice(0, 300)}`);
    }

    data = (await res.json()) as any;
    break;
  }

  if (!data) {
    throw new Error('Échec de la requête après plusieurs tentatives de temporisation (Rate Limit).');
  }
  const choice = data?.choices?.[0];
  let reformulated = (choice?.message?.content ?? '').trim();

  // Si le modèle a loggé sa réponse dans reasoning_content
  if (!reformulated && choice?.message?.reasoning_content) {
    reformulated = choice.message.reasoning_content.trim();
  }

  // Nettoyage et normalisation du rendu
  reformulated = reformulated.replace(/^["'«»]+|["'«»]+$/g, '').trim();
  reformulated = reformulated.replace(/\*\*([^*]+)\*\*/g, '*$1*');

  if (reformulated.length < 20) {
    console.error('⚠️ Réponse brute de l\'IA :', JSON.stringify(choice?.message ?? data, null, 2));
    throw new Error(`Réponse trop courte (${reformulated.length} chars) : "${reformulated}"`);
  }

  _descCache.set(cacheKey, reformulated);
  return reformulated;
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runReformulateAllProducts() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('✍️  REFORMULATION DESCRIPTIONS — Tous les produits en base');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  if (!API_KEY) {
    console.error('❌ Aucune clé API trouvée. Définissez OPENAI_API_KEY ou GROQ_API_KEY dans backend/.env — arrêt.');
    process.exit(1);
  }

  if (!IS_OPENAI && GROQ_API_KEY && !cliModelArg && !process.env.GROQ_MODEL) {
    MODEL = await resolveGroqModel(GROQ_API_KEY);
  }

  console.log(`🤖 Moteur IA      : ${IS_OPENAI ? 'OpenAI GPT' : 'Groq'}`);
  console.log(`🧠 Modèle         : ${MODEL}\n`);

  // ── Lire l'argument optionnel --only-empty (reformuler seulement les descriptions vides/courtes)
  const onlyEmpty = process.argv.includes('--only-empty');
  // ── Sous-catégorie spécifique via --sous-cat=NOM
  const sousCatArg = process.argv.find((a) => a.startsWith('--sous-cat='))?.split('=').slice(1).join('=');
  // ── Limite optionnelle via --limit=N
  const limitArg = parseInt(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? '0', 10);

  console.log(`⚙️  Options :`);
  console.log(`   --only-empty  : ${onlyEmpty ? 'OUI (reformule uniquement les descriptions absentes/courtes)' : 'NON (reformule tous les produits)'}`);
  console.log(`   --sous-cat    : ${sousCatArg ?? 'toutes'}`);
  console.log(`   --limit       : ${limitArg > 0 ? limitArg : 'aucune'}`);
  console.log(`   Batch size    : ${BATCH_SIZE} produits en parallèle\n`);

  // ── Construire le filtre Prisma ───────────────────────────────────────────
  const where: any = {
    sousCategorie: sousCatArg
      ? { nom: { contains: sousCatArg, mode: 'insensitive' } }
      : undefined,
  };

  // Récupérer les produits avec leur référence, sous-catégorie, catégorie et marque
  const produits = await prisma.produit.findMany({
    where,
    select: {
      id: true,
      nom: true,
      reference: true,
      description: true,
      paysFabrication: true,
      sousCategorie: {
        select: {
          nom: true,
          categorie: { select: { nom: true } },
        },
      },
      marque: {
        select: { nom: true },
      },
    },
    orderBy: { id: 'asc' },
    ...(limitArg > 0 ? { take: limitArg } : {}),
  });

  // Filtrer si --only-empty
  const toProcess = onlyEmpty
    ? produits.filter((p) => !p.description || p.description.trim().length < 30)
    : produits;

  console.log(`📦 Produits en base       : ${produits.length}`);
  console.log(`✏️  Produits à reformuler  : ${toProcess.length}\n`);

  if (toProcess.length === 0) {
    console.log('✅ Aucun produit à reformuler.');
    return;
  }

  // ── Initialiser le rapport ────────────────────────────────────────────────
  fs.writeFileSync(
    REPORT_PATH,
    `RAPPORT REFORMULATION DESCRIPTIONS\nGénéré le : ${new Date().toLocaleString('fr-FR')}\n${'═'.repeat(80)}\n\n`,
    'utf-8'
  );

  let reformules = 0;
  let inchanges = 0;
  let erreurs = 0;
  const batches = chunk(toProcess, BATCH_SIZE);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const startIdx = batchIdx * BATCH_SIZE;

    console.log(
      `\n📦 Lot ${batchIdx + 1}/${batches.length} ` +
      `(produits ${startIdx + 1}–${Math.min(startIdx + batch.length, toProcess.length)} / ${toProcess.length})`
    );

    // Traiter le lot en parallèle
    await Promise.all(
      batch.map(async (produit, i) => {
        const globalIdx = startIdx + i + 1;
        try {
          const newDesc = await reformulateDescription({
            nom: produit.nom,
            reference: produit.reference,
            rawDescription: produit.description ?? '',
            categorie: (produit.sousCategorie as any)?.categorie?.nom,
            sousCategorie: produit.sousCategorie?.nom,
            marque: produit.marque?.nom,
            paysFabrication: produit.paysFabrication ?? undefined,
          });

          // Mettre à jour uniquement si la description a changé
          if (newDesc !== produit.description) {
            await prisma.produit.update({
              where: { id: produit.id },
              data: { description: newDesc },
            });
            reformules++;

            // Écrire dans le rapport
            const line =
              `[${globalIdx}/${toProcess.length}] ✅ ${produit.nom}\n` +
              `   Avant : ${(produit.description ?? '').slice(0, 100)}${(produit.description ?? '').length > 100 ? '…' : ''}\n` +
              `   Après : ${newDesc.slice(0, 100)}${newDesc.length > 100 ? '…' : ''}\n` +
              `${'─'.repeat(80)}\n`;
            fs.appendFileSync(REPORT_PATH, line, 'utf-8');

            console.log(`   [${globalIdx}] ✅ ${produit.nom.slice(0, 60)}`);
          } else {
            inchanges++;
            console.log(`   [${globalIdx}] ≡  Inchangé : ${produit.nom.slice(0, 60)}`);
          }
        } catch (err: any) {
          erreurs++;
          console.error(`   [${globalIdx}] ❌ Erreur "${produit.nom.slice(0, 50)}": ${err.message}`);

          const errLine =
            `[${globalIdx}/${toProcess.length}] ❌ ERREUR : ${produit.nom}\n` +
            `   Message : ${err.message}\n` +
            `${'─'.repeat(80)}\n`;
          fs.appendFileSync(REPORT_PATH, errLine, 'utf-8');
        }
      })
    );

    // Délai entre lots pour respecter les rate limits Groq
    if (batchIdx < batches.length - 1) {
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  // ── Résumé final ──────────────────────────────────────────────────────────
  const summary =
    `\n${'═'.repeat(80)}\n` +
    `RÉSUMÉ FINAL\n` +
    `   ✅ Reformulés  : ${reformules}\n` +
    `   ≡  Inchangés   : ${inchanges}\n` +
    `   ❌ Erreurs     : ${erreurs}\n` +
    `   🕐 Terminé le  : ${new Date().toLocaleString('fr-FR')}\n`;

  fs.appendFileSync(REPORT_PATH, summary, 'utf-8');

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🎉 REFORMULATION TERMINÉE');
  console.log(`   ✅ Reformulés  : ${reformules}`);
  console.log(`   ≡  Inchangés   : ${inchanges}`);
  console.log(`   ❌ Erreurs     : ${erreurs}`);
  console.log(`   📄 Rapport     : ${REPORT_PATH}`);
  console.log('═══════════════════════════════════════════════════════════════════');
}

// ─── Exécution ────────────────────────────────────────────────────────────────

runReformulateAllProducts()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
