import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../config/prisma';

async function importDescriptions() {
  const fileArg = process.argv[2] || 'produits-reformules.json';
  const filePath = path.resolve(process.cwd(), fileArg);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Fichier introuvable : ${filePath}`);
    console.error(`Usage: node dist/src/scripts/importer-descriptions.js [chemin-du-fichier.json]`);
    process.exit(1);
  }

  console.log(`📥 Importation des descriptions depuis : ${filePath}...`);
  const rawData = fs.readFileSync(filePath, 'utf-8');
  let items: any[] = [];

  try {
    items = JSON.parse(rawData);
    if (!Array.isArray(items)) {
      if (items && Array.isArray((items as any).produits)) {
        items = (items as any).produits;
      } else {
        throw new Error('Le fichier JSON doit contenir un tableau d\'objets [ { id, description, motsCles } ].');
      }
    }
  } catch (err: any) {
    console.error(`❌ Erreur de lecture du fichier JSON: ${err.message}`);
    process.exit(1);
  }

  console.log(`📦 ${items.length} produit(s) trouvé(s) dans le fichier.\n`);

  let misAJour = 0;
  let ignores = 0;
  let erreurs = 0;

  for (const item of items) {
    const id = parseInt(item.id, 10);
    const description = (item.description ?? item.nouvelle_description ?? '').trim();
    
    // Tolérance sur les mots-clés (tableau ou chaîne séparée par des virgules)
    let motsCles: string[] = [];
    if (Array.isArray(item.motsCles ?? item.keywords ?? item.mots_cles)) {
      motsCles = (item.motsCles ?? item.keywords ?? item.mots_cles).map((k: any) => String(k).trim()).filter(Boolean);
    } else if (typeof (item.motsCles ?? item.keywords ?? item.mots_cles) === 'string') {
      motsCles = (item.motsCles ?? item.keywords ?? item.mots_cles).split(',').map((k: string) => k.trim()).filter(Boolean);
    }

    const video = (item.video ?? item.youtube ?? item.videoUrl ?? item.youtubeUrl ?? '').trim();

    if (!id || !description) {
      ignores++;
      continue;
    }

    try {
      await prisma.produit.update({
        where: { id },
        data: {
          description,
          ...(motsCles.length > 0 ? { motsCles } : {}),
          ...(video ? { video } : {}),
        },
      });
      misAJour++;
      console.log(`   ✅ [#${id}] Description mise à jour (${motsCles.length} mots-clés${video ? ', vidéo YouTube incluse' : ''})`);
    } catch (err: any) {
      erreurs++;
      console.error(`   ❌ [#${id}] Erreur lors de la mise à jour: ${err.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('🎉 IMPORTATION TERMINÉE');
  console.log(`   ✅ Mis à jour : ${misAJour}`);
  console.log(`   ≡  Ignorés    : ${ignores}`);
  console.log(`   ❌ Erreurs    : ${erreurs}`);
  console.log('═══════════════════════════════════════════════════════════════════');
}

importDescriptions()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
