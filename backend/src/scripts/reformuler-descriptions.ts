import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../config/prisma';

// ─── Configuration ────────────────────────────────────────────────────────────

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

// Fournisseur IA : OpenAI prioritaire si configuré, sinon Groq
const IS_OPENAI = Boolean(OPENAI_API_KEY);
const API_KEY = OPENAI_API_KEY || GROQ_API_KEY;
const API_URL = IS_OPENAI
  ? 'https://api.openai.com/v1/chat/completions'
  : 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = IS_OPENAI
  ? (process.env.OPENAI_MODEL || 'gpt-4o-mini')
  : (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile');

// Taille du lot traité en parallèle
const BATCH_SIZE = IS_OPENAI ? 5 : 5;

// Délai entre les lots (ms)
const DELAY_BETWEEN_BATCHES_MS = IS_OPENAI ? 500 : 1000;

// Fichier de rapport final
const REPORT_PATH = path.join(process.cwd(), 'reformulation-rapport.txt');

// ─── Cache mémoire (évite les doublons dans le même run) ─────────────────────
const _descCache = new Map<string, string>();

// ─── Génération IA : Reformulation & Optimisation SEO ───────────────────────

async function reformulateDescription(opts: {
  nom: string;
  rawDescription: string;
  sousCategorie?: string;
  marque?: string;
  paysFabrication?: string;
}): Promise<string> {
  if (!API_KEY) {
    throw new Error('Ni OPENAI_API_KEY ni GROQ_API_KEY ne sont définis dans le fichier .env');
  }

  const cacheKey = `${opts.nom}|${opts.rawDescription}`;
  if (_descCache.has(cacheKey)) return _descCache.get(cacheKey)!;

  const contextParts: string[] = [`Produit : "${opts.nom}"`];
  if (opts.sousCategorie) contextParts.push(`Sous-catégorie médico-dentaire : ${opts.sousCategorie}`);
  if (opts.marque) contextParts.push(`Marque : ${opts.marque}`);
  if (opts.paysFabrication) contextParts.push(`Pays de fabrication : ${opts.paysFabrication}`);
  if (opts.rawDescription && opts.rawDescription.trim()) {
    contextParts.push(`Informations existantes : ${opts.rawDescription}`);
  }

  const prompt =
    `Tu es un copywriter expert en équipement médico-dentaire et SEO e-commerce pour professionnels de santé (dentistes, orthodontistes, cliniques).\n` +
    `Rédige une description commerciale et technique percutante (3 à 5 phrases, environ 60 à 90 mots) en français soigné pour ce produit.\n` +
    `Consignes impératives :\n` +
    `1. Intègre naturellement les termes techniques et mots-clés recherchés sur Google (ex: ergonomie, précision, normes médicales, stérilisation autoclave si pertinent, durabilité).\n` +
    `2. Reste factuel : n'invente pas de caractéristiques techniques non mentionnées ou incohérentes.\n` +
    `3. Style fluide, professionnel et vendeur, orienté vers la pratique quotidienne du praticien.\n` +
    `4. Ne commence JAMAIS par "Voici", "Ce produit", "Cette description" ou "Découvrez".\n` +
    `5. Réponds UNIQUEMENT avec le paragraphe de description, sans titre, sans puces, sans markdown.\n\n` +
    contextParts.join('\n');

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.5,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${IS_OPENAI ? 'OpenAI' : 'Groq'} API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as any;
  const reformulated = (data?.choices?.[0]?.message?.content ?? '').trim();

  if (reformulated.length < 20) {
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

  // Récupérer les produits avec leur sous-catégorie et marque
  const produits = await prisma.produit.findMany({
    where,
    select: {
      id: true,
      nom: true,
      description: true,
      paysFabrication: true,
      sousCategorie: {
        select: { nom: true },
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
            rawDescription: produit.description ?? '',
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
