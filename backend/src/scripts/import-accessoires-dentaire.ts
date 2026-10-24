import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import prisma from '../config/prisma';

// Configurer le répertoire de stockage local des uploads
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
const uploadPath = path.isAbsolute(uploadDir)
  ? uploadDir
  : path.join(process.cwd(), uploadDir);

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

interface ScrapedProduct {
  remoteId: string;
  url: string;
  nom: string;
  prix: number;
  image: string;
  inStock: boolean;
  marqueNom?: string;
  description?: string;
}

async function downloadProductImageLocally(remoteUrl: string, remoteId: string): Promise<string | null> {
  if (!remoteUrl || !remoteUrl.startsWith('http')) return null;
  try {
    const res = await fetch(remoteUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) return null;

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let ext = '';
    try {
      ext = path.extname(new URL(remoteUrl).pathname).toLowerCase();
    } catch {
      ext = '';
    }
    if (!ext || ext.length > 5 || !['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'].includes(ext)) {
      ext = '.jpg';
    }

    const filename = `product-${remoteId}-${Date.now()}${ext}`;
    const destination = path.join(uploadPath, filename);

    // Appliquer le filigrane "https://randzmedical.com/" directement avec sharp
    if (ext !== '.svg' && ext !== '.gif') {
      try {
        const image = sharp(buffer);
        const metadata = await image.metadata();
        const width = metadata.width || 800;
        const height = metadata.height || 600;
        const fontSize = Math.max(14, Math.round(width * 0.04));

        const svgOverlay = `
          <svg width="${width}" height="${height}">
            <style>
              .wm { fill: rgba(128, 128, 128, 0.7); font-size: ${fontSize}px; font-weight: bold; font-family: "DejaVu Sans", sans-serif; }
            </style>
            <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" class="wm">https://randzmedical.com/</text>
          </svg>
        `;

        await image
          .composite([{ input: Buffer.from(svgOverlay), blend: 'over' }])
          .toFile(destination);

        return `/uploads/${filename}`;
      } catch (sharpErr) {
        console.warn(`[Watermark] Erreur application watermark pour ${remoteId}, fallback original:`, sharpErr);
      }
    }

    await fs.promises.writeFile(destination, buffer);
    return `/uploads/${filename}`;
  } catch {
    return null;
  }
}

function cleanHtml(raw: string): string {
  return raw
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&ecirc;/g, 'ê')
    .replace(/&agrave;/g, 'à')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&icirc;/g, 'î')
    .replace(/&iuml;/g, 'ï')
    .replace(/&rsquo;/g, "'")
    .trim();
}

function extractMarqueFromTitle(title: string): { cleanTitle: string; marque?: string } {
  // Ex: "100 COINS INTER-DENTAIRE EN BOIS - RUBY DENTAL"
  const parts = title.split(' - ');
  if (parts.length >= 2) {
    const marqueCandidate = parts[parts.length - 1].trim();
    // Si le dernier morceau ressemble à une marque (<= 30 caractères)
    if (marqueCandidate.length > 1 && marqueCandidate.length <= 35) {
      return {
        cleanTitle: parts.slice(0, parts.length - 1).join(' - ').trim(),
        marque: marqueCandidate.toUpperCase(),
      };
    }
  }
  return { cleanTitle: title };
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) {
    throw new Error(`Échec chargement ${url} (HTTP ${res.status})`);
  }
  return await res.text();
}

const PAYS_MAP: Record<string, string> = {
  turkey: 'Turquie',
  turquie: 'Turquie',
  france: 'France',
  germany: 'Allemagne',
  allemagne: 'Allemagne',
  italy: 'Italie',
  italie: 'Italie',
  china: 'Chine',
  chine: 'Chine',
  switzerland: 'Suisse',
  suisse: 'Suisse',
  usa: 'États-Unis',
  'united states': 'États-Unis',
  'etats-unis': 'États-Unis',
  japan: 'Japon',
  japon: 'Japon',
  korea: 'Corée du Sud',
  'south korea': 'Corée du Sud',
  spain: 'Espagne',
  espagne: 'Espagne',
  brazil: 'Brésil',
  bresil: 'Brésil',
  india: 'Inde',
  inde: 'Inde',
  pakistan: 'Pakistan',
  tunisia: 'Tunisie',
  tunisie: 'Tunisie',
  egypt: 'Égypte',
  egypte: 'Égypte',
  uk: 'Royaume-Uni',
  'united kingdom': 'Royaume-Uni',
};

function normalizeCountry(raw?: string): string | undefined {
  if (!raw) return undefined;
  const clean = raw.trim().toLowerCase();
  if (PAYS_MAP[clean]) return PAYS_MAP[clean];
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

async function fetchProductDetails(productUrl: string): Promise<{ description: string; paysFabrication?: string }> {
  try {
    const html = await fetchPage(productUrl);
    let description = '';
    const descMatch = html.match(/<strong>Description:<\/strong><\/p>\s*<div[^>]*>([\s\S]*?)<\/div>/i);
    if (descMatch && descMatch[1]) {
      description = cleanHtml(
        descMatch[1]
          .replace(/<\/p>/gi, '\n')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .trim()
      );
    }
    let paysFabrication: string | undefined = undefined;
    const countryMatch = html.match(/title="Made in ([^"]+)"/i) || html.match(/Made in\s+([^"<,\.\n]+)/i);
    if (countryMatch && countryMatch[1]) {
      paysFabrication = normalizeCountry(countryMatch[1]);
    }
    return { description, paysFabrication };
  } catch {
    return { description: '' };
  }
}

function parseProductsFromListHtml(html: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  
  // Découper par boîte produit
  const boxes = html.split(/product-index-box/i);
  // Ignorer le premier élément avant la première boîte
  for (let i = 1; i < boxes.length; i++) {
    const box = boxes[i];

    // Lien & Remote ID
    const linkMatch = box.match(/href="(\/products\/accessoires\/([a-zA-Z0-9]+))"/);
    if (!linkMatch) continue;
    const url = `https://www.lecomptoirdentaire.tn${linkMatch[1]}`;
    const remoteId = linkMatch[2];

    // Image
    const imgMatch = box.match(/<img[^>]+src="([^"]+)"/i);
    const image = imgMatch ? imgMatch[1] : '';

    // Titre
    const titleMatch = box.match(/<h6[^>]*>([\s\S]*?)<\/h6>/i);
    const rawNom = titleMatch ? cleanHtml(titleMatch[1].replace(/<[^>]+>/g, '')) : '';
    if (!rawNom) continue;

    // Prix
    // Ex: "24,000 DT" -> 24.00
    const priceMatch = box.match(/<div class="price">\s*([\d,.]+)\s*DT/i);
    let prix = 0;
    if (priceMatch) {
      const priceStr = priceMatch[1].replace(',', '.');
      prix = parseFloat(priceStr) || 0;
    }

    // Stock
    const inStock = !box.includes('Hors stock');

    // Marque
    const { cleanTitle, marque } = extractMarqueFromTitle(rawNom);

    products.push({
      remoteId,
      url,
      nom: cleanTitle || rawNom,
      prix,
      image,
      inStock,
      marqueNom: marque,
    });
  }

  return products;
}

export async function runImportAccessoires() {
  console.log('====================================================');
  console.log('🚀 IMPORT DES ACCESSOIRES DE LECOMPTOIRDENTAIRE.TN');
  console.log('====================================================\n');

  // 1. Récupérer ou créer la catégorie "Dentaire" (insensible à la casse)
  let categorie = await prisma.categorie.findFirst({
    where: { nom: { equals: 'Dentaire', mode: 'insensitive' } },
  });

  if (!categorie) {
    categorie = await prisma.categorie.create({
      data: { nom: 'Dentaire', visible: true },
    });
    console.log(`✅ Catégorie créée : "${categorie.nom}" (ID: ${categorie.id})`);
  } else {
    console.log(`✅ Catégorie existante trouvée : "${categorie.nom}" (ID: ${categorie.id})`);
  }

  // 2. Récupérer ou créer la sous-catégorie "Accessoires" liée à "Dentaire" (insensible à la casse)
  let sousCategorie = await prisma.sousCategorie.findFirst({
    where: {
      categorieId: categorie.id,
      nom: { equals: 'Accessoires', mode: 'insensitive' },
    },
  });

  if (!sousCategorie) {
    sousCategorie = await prisma.sousCategorie.create({
      data: {
        nom: 'Accessoires',
        categorieId: categorie.id,
        description: 'Accessoires dentaires professionnels',
      },
    });
    console.log(`✅ Sous-catégorie créée : "${sousCategorie.nom}" (ID: ${sousCategorie.id})\n`);
  } else {
    console.log(`✅ Sous-catégorie utilisée : "${sousCategorie.nom}" (ID: ${sousCategorie.id}) dans catégorie "${categorie.nom}"\n`);
  }

  // 3. Marque par défaut (marqueId est obligatoire dans le schéma)
  let marqueParDefaut = await prisma.marque.findFirst({
    where: { nom: { equals: 'SANS MARQUE', mode: 'insensitive' }, categorieId: categorie.id },
  });
  if (!marqueParDefaut) {
    marqueParDefaut = await prisma.marque.create({
      data: { nom: 'SANS MARQUE', categorieId: categorie.id },
    });
    console.log(`✅ Marque par défaut créée : "${marqueParDefaut.nom}" (ID: ${marqueParDefaut.id})\n`);
  } else {
    console.log(`✅ Marque par défaut trouvée : "${marqueParDefaut.nom}" (ID: ${marqueParDefaut.id})\n`);
  }

  // 4. Parcourir dynamiquement TOUTES les pages d'accessoires jusqu'à la fin
  const allProducts: ScrapedProduct[] = [];
  const seenRemoteIds = new Set<string>();
  let currentPage = 1;
  let hasMorePages = true;

  console.log('🔍 Détection et téléchargement de TOUTES les pages d\'accessoires...');

  while (hasMorePages) {
    const pageUrl = `https://www.lecomptoirdentaire.tn/products/accessoires/?pageSize=&page=${currentPage}`;
    console.log(`📥 Chargement de la page ${currentPage}...`);

    try {
      const html = await fetchPage(pageUrl);
      const parsed = parseProductsFromListHtml(html);

      if (parsed.length === 0) {
        console.log(`   🏁 Page ${currentPage} vide : fin de la pagination atteinte.`);
        hasMorePages = false;
        break;
      }

      // Filtrer les doublons éventuels
      let newCount = 0;
      for (const prod of parsed) {
        if (!seenRemoteIds.has(prod.remoteId)) {
          seenRemoteIds.add(prod.remoteId);
          allProducts.push(prod);
          newCount++;
        }
      }

      console.log(`   ➔ ${parsed.length} produits trouvés (${newCount} nouveaux). Total cumulé : ${allProducts.length}`);

      // Si aucun nouveau produit n'a été ajouté sur cette page, on arrête pour éviter toute boucle infinie
      if (newCount === 0) {
        console.log(`   🏁 Plus de nouveaux produits détectés.`);
        hasMorePages = false;
        break;
      }

      currentPage++;
    } catch (err: any) {
      console.error(`❌ Erreur sur la page ${currentPage}:`, err.message);
      hasMorePages = false;
      break;
    }
  }

  console.log(`\n📦 Total de TOUS les produits détectés : ${allProducts.length}`);
  console.log('⏳ Début du téléchargement des images locales et de l\'insertion en base...\n');

  let ajoutes = 0;
  let maj = 0;
  let erreurs = 0;

  for (let idx = 0; idx < allProducts.length; idx++) {
    const p = allProducts[idx];
    const ref = `CD-${p.remoteId.slice(-8).toUpperCase()}`;

    try {
      // Gérer la marque (marqueId est obligatoire dans le schéma Prisma)
      let marqueId: number = marqueParDefaut!.id;
      if (p.marqueNom) {
        // Normaliser en MAJUSCULES pour éviter les doublons casse-sensibles (contrainte unique Prisma)
        const nomNormalise = p.marqueNom.trim().toUpperCase();
        let marque = await prisma.marque.findFirst({
          where: {
            categorieId: categorie.id,
            nom: { equals: nomNormalise, mode: 'insensitive' },
          },
        });
        if (!marque) {
          marque = await prisma.marque.create({
            data: {
              nom: nomNormalise,
              categorieId: categorie.id,
            },
          });
        }
        marqueId = marque.id;
      }

      // Vérifier si le produit existe déjà par sa référence
      const existant = await prisma.produit.findUnique({
        where: { reference: ref },
      });

      // Télécharger la description et le pays de fabrication
      const details = await fetchProductDetails(p.url);

      // Télécharger l'image localement si possible
      let localImagePath: string | null = null;
      if (p.image) {
        if (existant && existant.images && existant.images.length > 0 && existant.images[0].startsWith('/uploads/')) {
          localImagePath = existant.images[0];
        } else {
          localImagePath = await downloadProductImageLocally(p.image, p.remoteId);
        }
      }
      const imagesArray = localImagePath ? [localImagePath] : (p.image ? [p.image] : []);

      if (existant) {
        // Mise à jour — aligner sur les champs disponibles dans products.service.ts
        await prisma.produit.update({
          where: { id: existant.id },
          data: {
            nom: p.nom,
            prix: p.prix,
            description: details.description || existant.description,
            disponible: p.inStock,
            disponibleALaVente: p.inStock,
            images: imagesArray.length > 0 ? imagesArray : existant.images,
            sousCategorieId: sousCategorie.id,
            marqueId,
            paysFabrication: details.paysFabrication ?? existant.paysFabrication,
          },
        });
        maj++;
        console.log(`[${idx + 1}/${allProducts.length}] 🔄 Mis à jour : ${p.nom} (${p.prix} DT)`);
      } else {
        // Création — tous les champs obligatoires sont fournis
        await prisma.produit.create({
          data: {
            nom: p.nom,
            reference: ref,
            prix: p.prix,
            prixAchat: Math.round(p.prix * 0.7 * 100) / 100, // Estimation prix d'achat à 70%
            tva: 19,
            remise: 0,
            stock: p.inStock ? 10 : 0,
            disponible: p.inStock,
            disponibleALaVente: p.inStock,
            description: details.description || `Accessoire dentaire : ${p.nom}`,
            images: imagesArray,
            motsCles: [],
            sousCategorieId: sousCategorie.id,
            marqueId,
            paysFabrication: details.paysFabrication ?? null,
          },
        });
        ajoutes++;
        console.log(`[${idx + 1}/${allProducts.length}] ➕ Ajouté : ${p.nom} (${p.prix} DT) - Ref: ${ref} - Image: ${localImagePath || 'URL'}`);
      }
    } catch (err: any) {
      erreurs++;
      console.error(`[${idx + 1}/${allProducts.length}] ⚠️ Erreur sur ${p.nom}:`, err.message);
    }
  }

  console.log('\n====================================================');
  console.log('🎉 IMPORT TERMINÉ AVEC SUCCÈS !');
  console.log(`   ➕ Produits ajoutés   : ${ajoutes}`);
  console.log(`   🔄 Produits actualisés : ${maj}`);
  console.log(`   ⚠️ Erreurs             : ${erreurs}`);
  console.log(`   🏷️  Catégorie          : ${categorie.nom}`);
  console.log(`   📂 Sous-catégorie      : ${sousCategorie.nom}`);
  console.log('====================================================');
}

// Exécuter si appelé directement
if (require.main === module) {
  runImportAccessoires()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
