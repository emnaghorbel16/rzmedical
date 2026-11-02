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
      ficheTechnique: true,
      tva: true,
      remise: true,
      motsCles: true,
      expirationDate: true,
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

  const data = toExport.map((p) => {
    const obj: Record<string, any> = {
      id: p.id,
      nom: p.nom,
      reference: p.reference ?? '',
      marque: p.marque?.nom ?? '',
      categorie: (p.sousCategorie as any)?.categorie?.nom ?? '',
      sousCategorie: p.sousCategorie?.nom ?? '',
      description_actuelle: p.description ?? '',
    };

    // Champs techniques : inclus uniquement s'ils ont une valeur utile
    if (p.ficheTechnique && p.ficheTechnique.trim()) {
      obj.ficheTechnique = p.ficheTechnique.trim();
    }
    if (p.paysFabrication && p.paysFabrication.trim()) {
      obj.paysFabrication = p.paysFabrication.trim();
    }
    if (p.tva !== null && p.tva !== undefined && Number(p.tva) > 0) {
      obj.tva = `${Number(p.tva)}%`;
    }
    if (p.remise !== null && p.remise !== undefined && Number(p.remise) > 0) {
      obj.remise = `${Number(p.remise)}%`;
    }
    if (p.expirationDate) {
      obj.dateExpiration = new Date(p.expirationDate).toLocaleDateString('fr-FR');
    }
    if (p.motsCles && p.motsCles.length > 0) {
      obj.motsCles_actuels = p.motsCles;
    }
    if (p.video && p.video.trim()) {
      obj.video = p.video.trim();
    }

    return obj;
  });

  // Structure finale avec instructions ChatGPT intégrées dans le fichier exporté
  const output = {
    _instructions_chatgpt: [
      'Tu es un rédacteur expert en dispositifs médicaux et dentaires pour RZ Medical Tunisie (vente aux chirurgiens-dentistes, cliniques et professionnels de santé).',
      'Pour CHAQUE produit du tableau "produits" ci-dessous, génère une description professionnelle détaillée ET des mots-clés SEO.',
      '',
      'RÈGLES IMPÉRATIVES :',
      '1. Utilise TOUTES les données fournies pour chaque produit (ficheTechnique, marque, catégorie, sousCategorie, paysFabrication, tva, remise, dateExpiration, motsCles_actuels) afin de rédiger une description précise et riche en détails techniques réels.',
      '2. La description doit faire 120 à 200 mots, en 2-3 paragraphes fluides :',
      '   a) Présentation & rôle clinique : nom exact, type de produit, indications cliniques, bénéfices pour le praticien.',
      '   b) Caractéristiques techniques détaillées : composition, dimensions, matériaux, performance, conditionnement, quantité par boîte, etc. (exploite ficheTechnique en priorité).',
      '   c) Normes & précautions : marquage CE/ISO si applicable, conditions de conservation, date de péremption si fournie.',
      '3. Mise en forme : *mot* = gras (max 4 éléments clés), _terme_ = italique (termes techniques). Jamais de # ni de **.',
      '4. Génère 5 à 12 mots-clés SEO pertinents (termes techniques, marque, spécialité médicale, synonymes français).',
      '5. Réponds UNIQUEMENT avec un tableau JSON valide. Chaque objet contient exactement : "id" (number), "description" (string), "motsCles" (array of strings).',
      'FORMAT ATTENDU : [ { "id": 1, "description": "Texte...", "motsCles": ["mot1", "mot2"] }, { "id": 2, ... } ]',
    ],
    _total: data.length,
    _genere_le: new Date().toLocaleString('fr-FR'),
    produits: data,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`\n✅ ${data.length} produits exportés avec succès dans :`);
  console.log(`   📄 ${outputPath}`);
  console.log(`\n💡 Comment utiliser avec ChatGPT :`);
  console.log(`   1. Envoyez ce fichier JSON à ChatGPT`);
  console.log(`   2. Dites : "Lis les instructions dans _instructions_chatgpt et traite tous les produits"`);
  console.log(`   3. Sauvegardez la réponse JSON (ex: descriptions-chatgpt.json)`);
  console.log(`   4. Importez : npm run import-descriptions -- descriptions-chatgpt.json\n`);
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
