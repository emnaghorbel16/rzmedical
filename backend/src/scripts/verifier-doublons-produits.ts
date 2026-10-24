import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../config/prisma';

// ─── Normalisation ─────────────────────────────────────────────────────────────

/** Supprime les accents, met en minuscule et normalise les espaces */
function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // supprime les accents
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ') // remplace ponctuation par espace
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalise une référence pour détecter les variations (tirets, espaces, casse) */
function normalizeRef(ref: string): string {
  return ref
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '') // supprime tirets, slashs, espaces
    .trim();
}

interface ProductInfo {
  id: number;
  nom: string;
  reference: string;
  prix: number | string;
  stock: number;
  image: string | null;
  disponible: boolean;
  creeLe: Date;
  marque: string;
  sousCategorie: string;
}

interface DuplicateGroup {
  cle: string;
  type: string;
  produits: ProductInfo[];
}

async function checkDuplicates() {
  console.log('🔍 Analyse de la base de données pour détecter les produits en double...\n');

  const produits = await prisma.produit.findMany({
    select: {
      id: true,
      nom: true,
      reference: true,
      prix: true,
      stock: true,
      images: true,
      disponible: true,
      creeLe: true,
      marque: {
        select: { nom: true },
      },
      sousCategorie: {
        select: { nom: true },
      },
    },
    orderBy: { id: 'asc' },
  });

  console.log(`📦 Total des produits en base : ${produits.length}`);

  if (produits.length === 0) {
    console.log('Aucun produit trouvé dans la base.');
    return;
  }

  const formattedProducts: ProductInfo[] = produits.map((p) => ({
    id: p.id,
    nom: p.nom,
    reference: p.reference,
    prix: p.prix.toString(),
    stock: p.stock,
    image: Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null,
    disponible: p.disponible,
    creeLe: p.creeLe,
    marque: p.marque?.nom || 'Sans marque',
    sousCategorie: p.sousCategorie?.nom || 'Sans sous-catégorie',
  }));

  // 1. Regroupement par Nom Exact (insensible à la casse / espaces aux extrémités)
  const byExactName = new Map<string, ProductInfo[]>();
  // 2. Regroupement par Nom Normalisé (sans accents, sans ponctuation)
  const byNormalizedName = new Map<string, ProductInfo[]>();
  // 3. Regroupement par Référence Normalisée (sans tirets, espaces, etc.)
  const byNormalizedRef = new Map<string, ProductInfo[]>();
  // 4. Regroupement par Nom + Marque
  const byNameAndBrand = new Map<string, ProductInfo[]>();

  for (const p of formattedProducts) {
    // Exact name (trimmed lowercase)
    const exactNameKey = p.nom.trim().toLowerCase();
    if (!byExactName.has(exactNameKey)) byExactName.set(exactNameKey, []);
    byExactName.get(exactNameKey)!.push(p);

    // Normalized name
    const normNameKey = normalizeText(p.nom);
    if (normNameKey) {
      if (!byNormalizedName.has(normNameKey)) byNormalizedName.set(normNameKey, []);
      byNormalizedName.get(normNameKey)!.push(p);
    }

    // Normalized ref
    const normRefKey = normalizeRef(p.reference);
    if (normRefKey) {
      if (!byNormalizedRef.has(normRefKey)) byNormalizedRef.set(normRefKey, []);
      byNormalizedRef.get(normRefKey)!.push(p);
    }

    // Name + Brand
    const nameBrandKey = `${normNameKey} | ${normalizeText(p.marque)}`;
    if (normNameKey) {
      if (!byNameAndBrand.has(nameBrandKey)) byNameAndBrand.set(nameBrandKey, []);
      byNameAndBrand.get(nameBrandKey)!.push(p);
    }
  }

  // Filtrer les groupes qui ont 2 ou plus produits
  const exactNameDups = Array.from(byExactName.entries())
    .filter(([_, list]) => list.length > 1)
    .map(([cle, produits]) => ({ cle, type: 'MÊME NOM EXACT', produits }));

  const normRefDups = Array.from(byNormalizedRef.entries())
    .filter(([_, list]) => list.length > 1)
    .map(([cle, produits]) => ({ cle, type: 'MÊME RÉFÉRENCE (normalisée)', produits }));

  const normNameDups = Array.from(byNormalizedName.entries())
    .filter(([cle, list]) => list.length > 1 && !byExactName.has(cle))
    .map(([cle, produits]) => ({ cle, type: 'NOM TRÈS SIMILAIRE (accents/ponctuation)', produits }));

  console.log('\n=============================================================');
  console.log('                 📊 RÉSULTAT DE L\'ANALYSE                   ');
  console.log('=============================================================');
  console.log(`• Doublons par Nom Exact : ${exactNameDups.length} groupe(s)`);
  console.log(`• Doublons par Référence (variantes de tirets/espaces) : ${normRefDups.length} groupe(s)`);
  console.log(`• Doublons par Nom similaire : ${normNameDups.length} groupe(s)`);
  console.log('=============================================================\n');

  // Affichage détaillé des doublons par Référence
  if (normRefDups.length > 0) {
    console.log('\n🚨 ─── DOUBLONS PAR RÉFÉRENCE NORMALISÉE ───');
    for (const group of normRefDups) {
      console.log(`\n🔑 Référence clé : "${group.cle}" (${group.produits.length} occurrences) :`);
      for (const p of group.produits) {
        console.log(`   - [ID ${p.id}] "${p.nom}" | Réf: "${p.reference}" | Marque: ${p.marque} | Prix: ${p.prix} DT | Stock: ${p.stock}`);
      }
    }
  }

  // Affichage détaillé des doublons par Nom Exact
  if (exactNameDups.length > 0) {
    console.log('\n⚠️ ─── DOUBLONS PAR NOM EXACT ───');
    for (const group of exactNameDups) {
      console.log(`\n🔑 Nom : "${group.produits[0].nom}" (${group.produits.length} occurrences) :`);
      for (const p of group.produits) {
        console.log(`   - [ID ${p.id}] Réf: "${p.reference}" | Marque: ${p.marque} | Cat: ${p.sousCategorie} | Prix: ${p.prix} DT | Stock: ${p.stock}`);
      }
    }
  }

  // Affichage des noms similaires
  if (normNameDups.length > 0) {
    console.log('\nℹ️ ─── DOUBLONS PAR NOM SIMILAIRE ───');
    for (const group of normNameDups.slice(0, 30)) {
      console.log(`\n🔑 Base : "${group.cle}" (${group.produits.length} occurrences) :`);
      for (const p of group.produits) {
        console.log(`   - [ID ${p.id}] "${p.nom}" | Réf: "${p.reference}" | Marque: ${p.marque}`);
      }
    }
    if (normNameDups.length > 30) {
      console.log(`\n... et ${normNameDups.length - 30} autres groupes (voir rapport complet).`);
    }
  }

  if (exactNameDups.length === 0 && normRefDups.length === 0 && normNameDups.length === 0) {
    console.log('✅ Aucun doublon détecté dans la base ! Tout est unique.');
  }

  // Sauvegarder un rapport complet en JSON et TXT
  const reportDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const jsonReportPath = path.join(reportDir, 'doublons-produits.json');
  const txtReportPath = path.join(reportDir, 'doublons-produits.txt');

  const reportData = {
    date: new Date().toISOString(),
    totalProduits: produits.length,
    statistiques: {
      doublonsNomExact: exactNameDups.length,
      doublonsReference: normRefDups.length,
      doublonsNomSimilaire: normNameDups.length,
    },
    doublonsReference: normRefDups,
    doublonsNomExact: exactNameDups,
    doublonsNomSimilaire: normNameDups,
  };

  fs.writeFileSync(jsonReportPath, JSON.stringify(reportData, null, 2), 'utf-8');

  // Génération du texte
  let txtContent = `RAPPORT D'ANALYSE DES DOUBLONS PRODUITS - RZ MEDICAL\n`;
  txtContent += `Date : ${new Date().toLocaleString('fr-FR')}\n`;
  txtContent += `Total produits analysés : ${produits.length}\n\n`;
  txtContent += `STATISTIQUES :\n`;
  txtContent += `- Doublons par Nom Exact : ${exactNameDups.length}\n`;
  txtContent += `- Doublons par Référence : ${normRefDups.length}\n`;
  txtContent += `- Doublons par Nom Similaire : ${normNameDups.length}\n\n`;

  if (normRefDups.length > 0) {
    txtContent += `=== DOUBLONS PAR RÉFÉRENCE ===\n`;
    for (const g of normRefDups) {
      txtContent += `\n[Clé: ${g.cle}]\n`;
      for (const p of g.produits) {
        txtContent += `  ID: ${p.id} | Nom: ${p.nom} | Réf: ${p.reference} | Marque: ${p.marque} | Prix: ${p.prix} DT\n`;
      }
    }
    txtContent += `\n\n`;
  }

  if (exactNameDups.length > 0) {
    txtContent += `=== DOUBLONS PAR NOM EXACT ===\n`;
    for (const g of exactNameDups) {
      txtContent += `\n[Nom: ${g.produits[0].nom}]\n`;
      for (const p of g.produits) {
        txtContent += `  ID: ${p.id} | Réf: ${p.reference} | Marque: ${p.marque} | Sous-cat: ${p.sousCategorie} | Prix: ${p.prix} DT\n`;
      }
    }
    txtContent += `\n\n`;
  }

  if (normNameDups.length > 0) {
    txtContent += `=== DOUBLONS PAR NOM SIMILAIRE ===\n`;
    for (const g of normNameDups) {
      txtContent += `\n[Clé: ${g.cle}]\n`;
      for (const p of g.produits) {
        txtContent += `  ID: ${p.id} | Nom: ${p.nom} | Réf: ${p.reference} | Marque: ${p.marque}\n`;
      }
    }
  }

  fs.writeFileSync(txtReportPath, txtContent, 'utf-8');

  console.log(`\n📄 Rapports enregistrés avec succès :`);
  console.log(`   - Fichier Texte : ${txtReportPath}`);
  console.log(`   - Fichier JSON  : ${jsonReportPath}`);
}

checkDuplicates()
  .catch((err) => {
    console.error('❌ Erreur lors de l’analyse :', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
