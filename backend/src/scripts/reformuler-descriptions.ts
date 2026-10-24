import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../config/prisma';

// ─── Configuration ────────────────────────────────────────────────────────────

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

// Taille du lot traité en parallèle (évite de surcharger l'API)
const BATCH_SIZE = 5;

// Délai entre les lots (ms) — Groq est rapide mais a des rate limits
const DELAY_BETWEEN_BATCHES_MS = 1000;

// Fichier de rapport final
const REPORT_PATH = path.join(process.cwd(), 'reformulation-rapport.txt');

// ─── Cache mémoire (évite les doublons dans le même run) ─────────────────────
const _descCache = new Map<string, string>();

// ─── Groq Text : Reformulation ───────────────────────────────────────────────

async function reformulateDescription(opts: {
  nom: string;
  rawDescription: string;
  sousCategorie?: string;
  marque?: string;
  paysFabrication?: string;
}): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY non défini dans le fichier .env');
  }

  const cacheKey = `${opts.nom}|${opts.rawDescription}`;
  if (_descCache.has(cacheKey)) return _descCache.get(cacheKey)!;

  const contextParts: string[] = [`Produit : "${opts.nom}"`];
  if (opts.sousCategorie) contextParts.push(`Sous-catégorie dentaire : ${opts.sousCategorie}`);
  if (opts.marque) contextParts.push(`Marque : ${opts.marque}`);
  if (opts.paysFabrication) contextParts.push(`Pays de fabrication : ${opts.paysFabrication}`);
  if (opts.rawDescription && opts.rawDescription.trim()) {
    contextParts.push(`Description originale : ${opts.rawDescription}`);
  }

  const prompt =
    `Tu es un expert en matériel dentaire professionnel.\n` +
    `Rédige une description commerciale courte (3 à 5 phrases) en français pour ce produit dentaire destiné aux dentistes et chirurgiens-dentistes.\n` +
    `La description doit être professionnelle, précise et mettre en valeur les avantages et caractéristiques techniques.\n` +
    `N'invente aucune information non mentionnée. Ne commence pas par "Voici" ou "Cette description".\n` +
    `Réponds UNIQUEMENT avec le texte de la description, sans titre, sans liste à puces, sans markdown.\n\n` +
    contextParts.join('\n');

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 350,
      temperature: 0.6,
    }),
  });

  if (!groqRes.ok) {
    const errText = await groqRes.text();
    throw new Error(`Groq API ${groqRes.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await groqRes.json()) as any;
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

  if (!GROQ_API_KEY) {
    console.error('❌ GROQ_API_KEY non défini dans le .env — arrêt.');
    process.exit(1);
  }

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
