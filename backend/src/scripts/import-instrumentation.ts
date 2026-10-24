import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import prisma from '../config/prisma';

// ─── Configuration ────────────────────────────────────────────────────────────

const uploadDir = process.env.UPLOAD_DIR || 'uploads';
const uploadPath = path.isAbsolute(uploadDir)
  ? uploadDir
  : path.join(process.cwd(), uploadDir);

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const BASE_URL = 'https://www.lecomptoirdentaire.tn';
const CATEGORY_SLUG = 'instrumentation';
const CATEGORY_NOM = 'Dentaire';
const SOUS_CATEGORIE_NOM = 'INSTRUMENTATION';
const WATERMARK_TEXT = 'https://randzmedical.com/';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScrapedProduct {
  remoteId: string;
  url: string;
  nom: string;
  prix: number;
  image: string;
  inStock: boolean;
  marqueNom?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    .replace(/&nbsp;/g, ' ')
    .trim();
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

/**
 * Extrait la marque du titre produit si elle suit le pattern " - MARQUE"
 * Ex: "2- HAURIGAN (AD092-2) - MEDEA" => marque = "MEDEA"
 */
function extractMarqueFromTitle(title: string): { cleanTitle: string; marque?: string } {
  const parts = title.split(' - ');
  if (parts.length >= 2) {
    const marqueCandidate = parts[parts.length - 1].trim();
    if (marqueCandidate.length > 1 && marqueCandidate.length <= 40) {
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
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) {
    throw new Error(`Échec chargement ${url} (HTTP ${res.status})`);
  }
  return await res.text();
}

/**
 * Télécharge les détails d'un produit depuis sa page de détail :
 * - Marque (depuis <strong>Marque: </strong> <a>MARQUE</a>)
 * - Description
 * - Pays de fabrication
 */
async function fetchProductDetails(productUrl: string): Promise<{
  marqueNom?: string;
  description: string;
  paysFabrication?: string;
}> {
  try {
    const html = await fetchPage(productUrl);

    // ── Marque depuis la page détail ──────────────────────────────────────────
    // Pattern: <strong>Marque: </strong> <a href="/products/brands/xxx">BRAND</a>
    let marqueNom: string | undefined;
    const marqueMatch = html.match(/<strong>Marque:\s*<\/strong>\s*<a[^>]*>([^<]+)<\/a>/i);
    if (marqueMatch && marqueMatch[1]) {
      marqueNom = cleanHtml(marqueMatch[1]).toUpperCase().trim();
    }

    // ── Description ───────────────────────────────────────────────────────────
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

    // ── Pays de fabrication ───────────────────────────────────────────────────
    let paysFabrication: string | undefined;
    const countryMatch =
      html.match(/title="Made in ([^"]+)"/i) ||
      html.match(/Made in\s+([^"<,\.\n]+)/i);
    if (countryMatch && countryMatch[1]) {
      paysFabrication = normalizeCountry(countryMatch[1]);
    }

    return { marqueNom, description, paysFabrication };
  } catch {
    return { description: '' };
  }
}

/**
 * Parse les produits depuis le HTML d'une page de listing instrumentation.
 */
function parseProductsFromListHtml(html: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];

  // Split sur les boîtes produits
  const boxes = html.split(/product-index-box/i);

  for (let i = 1; i < boxes.length; i++) {
    const box = boxes[i];

    // Lien & Remote ID — pattern spécifique à la sous-catégorie
    const linkMatch = box.match(/href="(\/products\/instrumentation\/([a-zA-Z0-9]+))"/);
    if (!linkMatch) continue;
    const url = `${BASE_URL}${linkMatch[1]}`;
    const remoteId = linkMatch[2];

    // Image
    const imgMatch = box.match(/<img[^>]+src="([^"]+)"/i);
    const image = imgMatch ? imgMatch[1] : '';

    // Titre (h6)
    const titleMatch = box.match(/<h6[^>]*>([\s\S]*?)<\/h6>/i);
    const rawNom = titleMatch ? cleanHtml(titleMatch[1].replace(/<[^>]+>/g, '')) : '';
    if (!rawNom) continue;

    // Prix — ex: "38,300 DT"
    const priceMatch = box.match(/<div class="price">\s*([\d,.]+)\s*DT/i);
    let prix = 0;
    if (priceMatch) {
      const priceStr = priceMatch[1].replace(/\s/g, '').replace(',', '.');
      prix = parseFloat(priceStr) || 0;
    }

    // Stock
    const inStock = !box.includes('Hors stock');

    // Marque depuis le titre (fallback si détail non disponible)
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

/**
 * Télécharge une image, applique le filigrane "https://randzmedical.com/" et la sauvegarde.
 */
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

    const filename = `product-inst-${remoteId}-${Date.now()}${ext}`;
    const destination = path.join(uploadPath, filename);

    // Appliquer le filigrane avec sharp (sauf SVG/GIF)
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
            <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" class="wm">${WATERMARK_TEXT}</text>
          </svg>
        `;

        await image
          .composite([{ input: Buffer.from(svgOverlay), blend: 'over' }])
          .toFile(destination);

        return `/uploads/${filename}`;
      } catch (sharpErr) {
        console.warn(`[Watermark] Erreur pour ${remoteId}, fallback original:`, sharpErr);
      }
    }

    await fs.promises.writeFile(destination, buffer);
    return `/uploads/${filename}`;
  } catch {
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runImportInstrumentation() {
  console.log('=============================================================');
  console.log('🦷 IMPORT INSTRUMENTATION — lecomptoirdentaire.tn');
  console.log('=============================================================\n');

  // 1. Catégorie "Dentaire"
  let categorie = await prisma.categorie.findFirst({
    where: { nom: { equals: CATEGORY_NOM, mode: 'insensitive' } },
  });
  if (!categorie) {
    categorie = await prisma.categorie.create({
      data: { nom: CATEGORY_NOM, visible: true },
    });
    console.log(`✅ Catégorie créée : "${categorie.nom}" (ID: ${categorie.id})`);
  } else {
    console.log(`✅ Catégorie existante : "${categorie.nom}" (ID: ${categorie.id})`);
  }

  // 2. Sous-catégorie "INSTRUMENTATION"
  let sousCategorie = await prisma.sousCategorie.findFirst({
    where: {
      categorieId: categorie.id,
      nom: { equals: SOUS_CATEGORIE_NOM, mode: 'insensitive' },
    },
  });
  if (!sousCategorie) {
    sousCategorie = await prisma.sousCategorie.create({
      data: {
        nom: SOUS_CATEGORIE_NOM,
        categorieId: categorie.id,
        description: 'Instruments professionnels pour cabinet et chirurgie dentaire',
      },
    });
    console.log(`✅ Sous-catégorie créée : "${sousCategorie.nom}" (ID: ${sousCategorie.id})\n`);
  } else {
    console.log(`✅ Sous-catégorie : "${sousCategorie.nom}" (ID: ${sousCategorie.id})\n`);
  }

  // 3. Marque par défaut
  let marqueParDefaut = await prisma.marque.findFirst({
    where: { nom: { equals: 'SANS MARQUE', mode: 'insensitive' }, categorieId: categorie.id },
  });
  if (!marqueParDefaut) {
    marqueParDefaut = await prisma.marque.create({
      data: { nom: 'SANS MARQUE', categorieId: categorie.id },
    });
    console.log(`✅ Marque par défaut créée : "${marqueParDefaut.nom}" (ID: ${marqueParDefaut.id})\n`);
  } else {
    console.log(`✅ Marque par défaut : "${marqueParDefaut.nom}" (ID: ${marqueParDefaut.id})\n`);
  }

  // 4. Parcourir toutes les pages de la sous-catégorie
  const allProducts: ScrapedProduct[] = [];
  const seenRemoteIds = new Set<string>();
  let currentPage = 1;
  let hasMorePages = true;

  console.log('🔍 Détection de toutes les pages instrumentation...');

  while (hasMorePages) {
    const pageUrl = `${BASE_URL}/products/${CATEGORY_SLUG}/?pageSize=&page=${currentPage}`;
    console.log(`📥 Chargement page ${currentPage}...`);

    try {
      const html = await fetchPage(pageUrl);
      const parsed = parseProductsFromListHtml(html);

      if (parsed.length === 0) {
        console.log(`   🏁 Page ${currentPage} vide : fin de pagination.`);
        hasMorePages = false;
        break;
      }

      let newCount = 0;
      for (const prod of parsed) {
        if (!seenRemoteIds.has(prod.remoteId)) {
          seenRemoteIds.add(prod.remoteId);
          allProducts.push(prod);
          newCount++;
        }
      }

      console.log(`   ➔ ${parsed.length} produits (${newCount} nouveaux). Total : ${allProducts.length}`);

      if (newCount === 0) {
        console.log(`   🏁 Aucun nouveau produit détecté.`);
        hasMorePages = false;
        break;
      }

      currentPage++;
    } catch (err: any) {
      console.error(`❌ Erreur page ${currentPage}:`, err.message);
      hasMorePages = false;
      break;
    }
  }

  console.log(`\n📦 Total produits détectés : ${allProducts.length}`);
  console.log('⏳ Téléchargement images + récupération marques + insertion en base...\n');

  let ajoutes = 0;
  let maj = 0;
  let erreurs = 0;

  for (let idx = 0; idx < allProducts.length; idx++) {
    const p = allProducts[idx];
    const ref = `INST-${p.remoteId.slice(-8).toUpperCase()}`;

    try {
      // ── Récupérer les détails depuis la page produit (marque fiable) ──────
      const details = await fetchProductDetails(p.url);

      // La marque de la page détail prend la priorité sur celle extraite du titre
      const marqueNomFinal = details.marqueNom || p.marqueNom;

      // ── Résoudre l'ID de marque ───────────────────────────────────────────
      let marqueId: number = marqueParDefaut!.id;
      if (marqueNomFinal) {
        const nomNormalise = marqueNomFinal.trim().toUpperCase();
        let marque = await prisma.marque.findFirst({
          where: {
            categorieId: categorie.id,
            nom: { equals: nomNormalise, mode: 'insensitive' },
          },
        });
        if (!marque) {
          marque = await prisma.marque.create({
            data: { nom: nomNormalise, categorieId: categorie.id },
          });
        }
        marqueId = marque.id;
      }

      // ── Vérifier l'existence du produit ───────────────────────────────────
      const existant = await prisma.produit.findUnique({ where: { reference: ref } });

      // ── Télécharger l'image avec filigrane ───────────────────────────────
      let localImagePath: string | null = null;
      if (p.image) {
        if (existant?.images && existant.images.length > 0 && existant.images[0].startsWith('/uploads/')) {
          localImagePath = existant.images[0];
        } else {
          localImagePath = await downloadProductImageLocally(p.image, p.remoteId);
        }
      }
      const imagesArray = localImagePath ? [localImagePath] : p.image ? [p.image] : [];

      if (existant) {
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
        console.log(
          `[${idx + 1}/${allProducts.length}] 🔄 MàJ : ${p.nom} | Marque: ${marqueNomFinal || '—'} | ${p.prix} DT`
        );
      } else {
        await prisma.produit.create({
          data: {
            nom: p.nom,
            reference: ref,
            prix: p.prix,
            prixAchat: Math.round(p.prix * 0.7 * 100) / 100,
            tva: 19,
            remise: 0,
            stock: p.inStock ? 10 : 0,
            disponible: p.inStock,
            disponibleALaVente: p.inStock,
            description: details.description || `Instrument dentaire : ${p.nom}`,
            images: imagesArray,
            motsCles: [],
            sousCategorieId: sousCategorie.id,
            marqueId,
            paysFabrication: details.paysFabrication ?? null,
          },
        });
        ajoutes++;
        console.log(
          `[${idx + 1}/${allProducts.length}] ➕ Ajouté : ${p.nom} | Marque: ${marqueNomFinal || '—'} | ${p.prix} DT | Ref: ${ref}`
        );
      }
    } catch (err: any) {
      erreurs++;
      console.error(`[${idx + 1}/${allProducts.length}] ⚠️ Erreur sur ${p.nom}:`, err.message);
    }
  }

  console.log('\n=============================================================');
  console.log('🎉 IMPORT TERMINÉ !');
  console.log(`   ➕ Produits ajoutés    : ${ajoutes}`);
  console.log(`   🔄 Produits mis à jour : ${maj}`);
  console.log(`   ⚠️  Erreurs             : ${erreurs}`);
  console.log(`   🏷️  Catégorie           : ${categorie.nom}`);
  console.log(`   📂 Sous-catégorie       : ${sousCategorie.nom}`);
  console.log('=============================================================');
}

// Exécuter si appelé directement
if (require.main === module) {
  runImportInstrumentation()
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
