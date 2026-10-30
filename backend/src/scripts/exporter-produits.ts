import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../config/prisma';

async function exportProducts() {
  const onlyEmpty = process.argv.includes('--only-empty');
  const startArg = parseInt(process.argv.find((a) => a.startsWith('--start='))?.split('=')[1] ?? '0', 10);
  const skipArg = parseInt(process.argv.find((a) => a.startsWith('--skip='))?.split('=')[1] ?? '0', 10);
  const effectiveSkip = startArg > 1 ? startArg - 1 : (skipArg > 0 ? skipArg : 0);
  const limitArg = parseInt(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? '0', 10);
  const outputFileArg = process.argv.find((a) => a.startsWith('--out='))?.split('=')[1];

  const defaultFileName = onlyEmpty ? 'produits-a-reformuler-vides.json' : 'produits-a-reformuler.json';
  const outputPath = outputFileArg
    ? path.resolve(process.cwd(), outputFileArg)
    : path.resolve(process.cwd(), defaultFileName);

  console.log(`📤 Exportation des produits pour ChatGPT...`);
  console.log(`   --only-empty : ${onlyEmpty ? 'OUI' : 'NON'}`);
  console.log(`   --start      : ${effectiveSkip > 0 ? `à partir du #${effectiveSkip + 1}` : 'dès le début'}`);
  console.log(`   --limit      : ${limitArg > 0 ? limitArg : 'tous'}`);

  const produits = await prisma.produit.findMany({
    select: {
      id: true,
      nom: true,
      reference: true,
      description: true,
      video: true,
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
    ...(effectiveSkip > 0 ? { skip: effectiveSkip } : {}),
    ...(limitArg > 0 ? { take: limitArg } : {}),
  });

  const toExport = onlyEmpty
    ? produits.filter((p) => !p.description || p.description.trim().length < 30)
    : produits;

  const data = toExport.map((p) => ({
    id: p.id,
    nom: p.nom,
    reference: p.reference ?? '',
    marque: p.marque?.nom ?? '',
    categorie: (p.sousCategorie as any)?.categorie?.nom ?? '',
    sousCategorie: p.sousCategorie?.nom ?? '',
    description_actuelle: p.description ?? '',
    video: p.video ?? '',
  }));

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');

  console.log(`\n✅ ${data.length} produits exportés avec succès dans :`);
  console.log(`   📄 ${outputPath}\n`);
}

exportProducts()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
