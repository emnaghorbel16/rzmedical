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
const CATEGORY_NOM = 'Dentaire';
const WATERMARK_TEXT = 'https://randzmedical.com/';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

// ── Fichier log des produits rejetés (image avec signature Comptoir Dentaire)
const REJECTED_LOG_PATH = path.join(process.cwd(), 'produits-rejetes-signature.txt');

// ── Toutes les sous-catégories restantes (slug => Nom affiché)
// Déjà importés : accessoires, endodontie-et-accessoires, instrumentation
const SOUS_CATEGORIES: Array<{ slug: string; nom: string; refPrefix: string; description: string }> = [
  {
    slug: 'anesthesie',
    nom: 'ANESTHESIE',
    refPrefix: 'ANES',
    description: 'Produits et matériel pour anesthésie dentaire',
  },
  {
    slug: 'ciments-et-fonds-de-cavite',
    nom: 'CIMENTS ET FONDS DE CAVITÉ',
    refPrefix: 'CIMF',
    description: 'Ciments dentaires et matériaux de fonds de cavité',
  },
  {
    slug: 'empreintes-et-accessoires',
    nom: 'EMPREINTES ET ACCESSOIRES',
    refPrefix: 'EMPR',
    description: 'Matériaux et accessoires pour empreintes dentaires',
  },
  {
    slug: 'films-et-radiologie-dentaire',
    nom: 'FILMS ET RADIOLOGIE DENTAIRE',
    refPrefix: 'FILM',
    description: 'Films radiographiques et équipement de radiologie dentaire',
  },
  {
    slug: 'fraises',
    nom: 'FRAISES',
    refPrefix: 'FRAI',
    description: 'Fraises dentaires pour préparation et meulage',
  },
  {
    slug: 'gros-equipement',
    nom: 'GROS EQUIPEMENT',
    refPrefix: 'GEQP',
    description: 'Gros équipements pour cabinet dentaire',
  },
  {
    slug: 'implantologie',
    nom: 'IMPLANTOLOGIE',
    refPrefix: 'IMPL',
    description: 'Matériel et implants pour implantologie dentaire',
  },
  {
    slug: 'impression-3d',
    nom: 'IMPRESSION 3D',
    refPrefix: 'IM3D',
    description: 'Résines et équipements pour impression 3D dentaire',
  },
  {
    slug: 'instruments-rotatifs',
    nom: 'INSTRUMENTS ROTATIFS',
    refPrefix: 'IROT',
    description: 'Instruments rotatifs pour dentisterie',
  },
  {
    slug: 'materiaux-de-laboratoire-dentaire',
    nom: 'MATERIAUX DE LABORATOIRE DENTAIRE',
    refPrefix: 'MATL',
    description: 'Matériaux pour laboratoire dentaire',
  },
  {
    slug: 'mobiliers-pour-cabinet',
    nom: 'MOBILIERS POUR CABINET',
    refPrefix: 'MOBI',
    description: 'Mobiliers et agencement pour cabinet dentaire',
  },
  {
    slug: 'orthodontie',
    nom: 'ORTHODONTIE',
    refPrefix: 'ORTH',
    description: 'Matériel et accessoires pour orthodontie',
  },
  {
    slug: 'petits-equipements',
    nom: 'PETITS EQUIPEMENTS',
    refPrefix: 'PEQP',
    description: 'Petits équipements pour cabinet dentaire',
  },
  {
    slug: 'produits-d-hygiene-et-de-desinfection',
    nom: "PRODUITS D'HYGIENE ET DE DESINFECTION",
    refPrefix: 'HYGD',
    description: 'Produits hygiène et désinfection pour cabinet dentaire',
  },
  {
    slug: 'produits-d-obturation-et-accessoires',
    nom: "PRODUITS D'OBTURATION ET ACCESSOIRES",
    refPrefix: 'OBTU',
    description: "Produits d'obturation et accessoires endodontiques",
  },
  {
    slug: 'prophylaxie',
    nom: 'PROPHYLAXIE',
    refPrefix: 'PRPH',
    description: 'Produits de prophylaxie et prévention dentaire',
  },
  {
    slug: 'restauration-dentaire',
    nom: 'RESTAURATION DENTAIRE',
    refPrefix: 'REST',
    description: 'Matériaux et accessoires de restauration dentaire',
  },
  {
    slug: 'usage-unique',
    nom: 'USAGE UNIQUE',
    refPrefix: 'UUQE',
    description: 'Articles à usage unique pour cabinet dentaire',
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScrapedProduct {
  remoteId: string;
  url: string;
  nom: string;
  prix: number;
  image: string;
  inStock: boolean;
  marqueNom?: string;
  slug: string;
}

interface RejectedProduct {
  nom: string;
  url: string;
  imageUrl: string;
  sousCategorie: string;
  raison: string;
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
    .replace(/&#x27;/g, "'")
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

async function fetchProductDetails(productUrl: string): Promise<{
  marqueNom?: string;
  description: string;
  paysFabrication?: string;
}> {
  try {
    const html = await fetchPage(productUrl);

    let marqueNom: string | undefined;
    const marqueMatch = html.match(/<strong>Marque:\s*<\/strong>\s*<a[^>]*>([^<]+)<\/a>/i);
    if (marqueMatch && marqueMatch[1]) {
      marqueNom = cleanHtml(marqueMatch[1]).toUpperCase().trim();
    }

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

function parseProductsFromListHtml(html: string, slug: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  const boxes = html.split(/product-index-box/i);

  for (let i = 1; i < boxes.length; i++) {
    const box = boxes[i];

    // Pattern générique : /products/<slug>/<id>
    const linkRegex = new RegExp(`href="(\\/products\\/${slug}\\/([a-zA-Z0-9]+))"`, 'i');
    const linkMatch = box.match(linkRegex);
    if (!linkMatch) continue;
    const url = `${BASE_URL}${linkMatch[1]}`;
    const remoteId = linkMatch[2];

    const imgMatch = box.match(/<img[^>]+src="([^"]+)"/i);
    const image = imgMatch ? imgMatch[1] : '';

    const titleMatch = box.match(/<h6[^>]*>([\s\S]*?)<\/h6>/i);
    const rawNom = titleMatch ? cleanHtml(titleMatch[1].replace(/<[^>]+>/g, '')) : '';
    if (!rawNom) continue;

    const priceMatch = box.match(/<div class="price">\s*([\d,.]+)\s*DT/i);
    let prix = 0;
    if (priceMatch) {
      const priceStr = priceMatch[1].replace(/\s/g, '').replace(',', '.');
      prix = parseFloat(priceStr) || 0;
    }

    const inStock = !box.includes('Hors stock');
    const { cleanTitle, marque } = extractMarqueFromTitle(rawNom);

    products.push({
      remoteId,
      url,
      nom: cleanTitle || rawNom,
      prix,
      image,
      inStock,
      marqueNom: marque,
      slug,
    });
  }

  return products;
}

// ─── Groq Vision : Détection de signature Comptoir Dentaire ──────────────────

/**
 * Télécharge l'image en base64 et interroge Groq Vision (llama-3.2-11b-vision-preview).
 * Retourne true si l'image contient une signature/logo du Comptoir Dentaire.
 */
async function hasComptoDentaireSignature(imageUrl: string): Promise<boolean> {
  if (!GROQ_API_KEY) {
    // Pas de clé Groq configurée — on accepte toutes les images
    return false;
  }
  if (!imageUrl || !imageUrl.startsWith('http')) return false;

  try {
    // Télécharger l'image
    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) return false;

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    // Déterminer le type MIME
    let mimeType = 'image/jpeg';
    try {
      const ext = path.extname(new URL(imageUrl).pathname).toLowerCase();
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';
      else if (ext === '.gif') mimeType = 'image/gif';
    } catch {
      // Garder image/jpeg par défaut
    }

    // Appel Groq Vision
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
              {
                type: 'text',
                text: `Analyze this image carefully. Does it contain any of the following: 
- The text "Le Comptoir Dentaire" or "lecomptoirdentaire"
- The text "Labland" or "lablandtrading"  
- A logo or watermark that belongs to a dental supply company called "Comptoir Dentaire"
- Any promotional price tag with "DT" currency overlaid as a watermark or brand stamp
- Text like "SMD" (Société Méditerranéenne de Distribution) or similar Tunisian dental supplier branding

Answer with ONLY one word: YES or NO.`,
              },
            ],
          },
        ],
        max_tokens: 5,
        temperature: 0,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.warn(`[Groq] Erreur API (${groqRes.status}): ${errText.slice(0, 200)}`);
      return false;
    }

    const groqData = (await groqRes.json()) as any;
    const answer = groqData?.choices?.[0]?.message?.content?.trim().toUpperCase() ?? '';
    return answer.startsWith('YES');
  } catch (err: any) {
    console.warn(`[Groq] Erreur analyse image ${imageUrl}:`, err.message);
    return false;
  }
}

// ─── Groq Text : Reformulation de description ───────────────────────────────

// Petit cache en mémoire pour éviter de reformuler la même description plusieurs fois
const _descCache = new Map<string, string>();

/**
 * Envoie la description brute + nom + sous-catégorie à Groq (llama-3.3-70b-versatile)
 * pour obtenir une description commerciale professionnelle en français.
 * Retourne la description originale si Groq échoue ou si la clé est absente.
 */
async function reformulateDescription(opts: {
  nom: string;
  rawDescription: string;
  sousCategorie: string;
  marque?: string;
  paysFabrication?: string;
}): Promise<string> {
  if (!GROQ_API_KEY) return opts.rawDescription;

  // Clé de cache basée sur le nom du produit + description brute
  const cacheKey = `${opts.nom}|${opts.rawDescription}`;
  if (_descCache.has(cacheKey)) return _descCache.get(cacheKey)!;

  try {
    const contextParts: string[] = [
      `Produit : "${opts.nom}"`,
      `Sous-catégorie dentaire : ${opts.sousCategorie}`,
    ];
    if (opts.marque) contextParts.push(`Marque : ${opts.marque}`);
    if (opts.paysFabrication) contextParts.push(`Pays de fabrication : ${opts.paysFabrication}`);
    if (opts.rawDescription) contextParts.push(`Description originale : ${opts.rawDescription}`);

    const prompt = `Tu es un expert en matériel dentaire professionnel. 
Rédige une description commerciale courte (3 à 5 phrases maximum) en français pour ce produit dentaire destiné aux professionnels de santé (dentistes, chirurgiens-dentistes).
La description doit être claire, professionnelle et mettre en valeur les caractéristiques techniques du produit.
N'invente pas d'informations non mentionnées. Ne commence pas par "Voici" ou "Cette description".
Réponds UNIQUEMENT avec le texte de la description, sans titre, sans liste, sans markdown.

${contextParts.join('\n')}`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.6,
      }),
    });

    if (!groqRes.ok) {
      console.warn(`[Groq Text] Erreur API (${groqRes.status})`);
      return opts.rawDescription;
    }

    const data = (await groqRes.json()) as any;
    const reformulated = data?.choices?.[0]?.message?.content?.trim() ?? '';

    if (reformulated.length < 20) return opts.rawDescription;

    _descCache.set(cacheKey, reformulated);
    return reformulated;
  } catch (err: any) {
    console.warn(`[Groq Text] Erreur reformulation "${opts.nom}":`, err.message);
    return opts.rawDescription;
  }
}

// ─── Watermark (Sharp) ────────────────────────────────────────────────────────

async function downloadProductImageLocally(remoteUrl: string, remoteId: string, prefix: string): Promise<string | null> {
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

    const filename = `product-${prefix.toLowerCase()}-${remoteId}-${Date.now()}${ext}`;
    const destination = path.join(uploadPath, filename);

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

// ─── Logger des produits rejetés ─────────────────────────────────────────────

function appendRejectedLog(rejected: RejectedProduct): void {
  const line =
    `[${new Date().toISOString()}] REJETÉ | ${rejected.sousCategorie} | ${rejected.nom}\n` +
    `   URL     : ${rejected.url}\n` +
    `   Image   : ${rejected.imageUrl}\n` +
    `   Raison  : ${rejected.raison}\n` +
    `${'─'.repeat(80)}\n`;
  fs.appendFileSync(REJECTED_LOG_PATH, line, 'utf-8');
}

// ─── Import d'une sous-catégorie ─────────────────────────────────────────────

async function importSousCategorie(
  sousCatConfig: typeof SOUS_CATEGORIES[0],
  categorie: { id: number; nom: string },
  marqueParDefaut: { id: number }
) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📂 SOUS-CATÉGORIE : ${sousCatConfig.nom} (/${sousCatConfig.slug})`);
  console.log(`${'═'.repeat(70)}`);

  // Trouver ou créer la sous-catégorie
  let sousCategorie = await prisma.sousCategorie.findFirst({
    where: {
      categorieId: categorie.id,
      nom: { equals: sousCatConfig.nom, mode: 'insensitive' },
    },
  });
  if (!sousCategorie) {
    sousCategorie = await prisma.sousCategorie.create({
      data: {
        nom: sousCatConfig.nom,
        categorieId: categorie.id,
        description: sousCatConfig.description,
      },
    });
    console.log(`✅ Sous-catégorie créée : "${sousCategorie.nom}" (ID: ${sousCategorie.id})`);
  } else {
    console.log(`✅ Sous-catégorie existante : "${sousCategorie.nom}" (ID: ${sousCategorie.id})`);
  }

  // Parcourir toutes les pages
  const allProducts: ScrapedProduct[] = [];
  const seenRemoteIds = new Set<string>();
  let currentPage = 1;
  let hasMorePages = true;

  while (hasMorePages) {
    const pageUrl = `${BASE_URL}/products/${sousCatConfig.slug}/?pageSize=&page=${currentPage}`;
    console.log(`📥 Page ${currentPage} : ${pageUrl}`);

    try {
      const html = await fetchPage(pageUrl);
      const parsed = parseProductsFromListHtml(html, sousCatConfig.slug);

      if (parsed.length === 0) {
        console.log(`   🏁 Page ${currentPage} vide — fin.`);
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

  let ajoutes = 0;
  let maj = 0;
  let rejetes = 0;
  let erreurs = 0;

  for (let idx = 0; idx < allProducts.length; idx++) {
    const p = allProducts[idx];
    const ref = `${sousCatConfig.refPrefix}-${p.remoteId.slice(-8).toUpperCase()}`;

    try {
      // ── 1. Analyser l'image avec Groq Vision ─────────────────────────────
      if (p.image && GROQ_API_KEY) {
        const hasSignature = await hasComptoDentaireSignature(p.image);
        if (hasSignature) {
          rejetes++;
          console.log(
            `[${idx + 1}/${allProducts.length}] 🚫 REJETÉ (signature Comptoir Dentaire) : ${p.nom}`
          );
          appendRejectedLog({
            nom: p.nom,
            url: p.url,
            imageUrl: p.image,
            sousCategorie: sousCatConfig.nom,
            raison: 'Image contient la signature/logo du Comptoir Dentaire détectée par Groq Vision',
          });
          continue;
        }
      }

      // ── 2. Récupérer les détails (marque, description, pays) ─────────────
      const details = await fetchProductDetails(p.url);
      const marqueNomFinal = details.marqueNom || p.marqueNom;

      // ── 2b. Reformuler la description avec Groq ───────────────────────────
      const descriptionFinale = await reformulateDescription({
        nom: p.nom,
        rawDescription: details.description,
        sousCategorie: sousCatConfig.nom,
        marque: marqueNomFinal,
        paysFabrication: details.paysFabrication,
      });

      // ── 3. Résoudre la marque ─────────────────────────────────────────────
      let marqueId: number = marqueParDefaut.id;
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

      // ── 4. Vérifier existence du produit ─────────────────────────────────
      const existant = await prisma.produit.findUnique({ where: { reference: ref } });

      // ── 5. Télécharger image + filigrane randzmedical ─────────────────────
      let localImagePath: string | null = null;
      if (p.image) {
        if (existant?.images && existant.images.length > 0 && existant.images[0].startsWith('/uploads/')) {
          localImagePath = existant.images[0];
        } else {
          localImagePath = await downloadProductImageLocally(p.image, p.remoteId, sousCatConfig.refPrefix);
        }
      }
      const imagesArray = localImagePath ? [localImagePath] : p.image ? [p.image] : [];

      if (existant) {
        // ── MàJ ──────────────────────────────────────────────────────────────
        await prisma.produit.update({
          where: { id: existant.id },
          data: {
            nom: p.nom,
            prix: p.prix,
            description: descriptionFinale || existant.description,
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
        // ── Création ─────────────────────────────────────────────────────────
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
            description: descriptionFinale || `${sousCatConfig.nom} : ${p.nom}`,
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

  console.log(`\n📊 Résultat ${sousCatConfig.nom}:`);
  console.log(`   ➕ Ajoutés   : ${ajoutes}`);
  console.log(`   🔄 MàJ      : ${maj}`);
  console.log(`   🚫 Rejetés  : ${rejetes} (voir produits-rejetes-signature.txt)`);
  console.log(`   ⚠️  Erreurs  : ${erreurs}`);

  return { ajoutes, maj, rejetes, erreurs };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runImportAllSousCategories() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🦷 IMPORT TOUTES SOUS-CATÉGORIES DENTAIRE — lecomptoirdentaire.tn');
  console.log(`   Nombre de sous-catégories : ${SOUS_CATEGORIES.length}`);
  if (GROQ_API_KEY) {
    console.log('   🤖 Groq Vision activé : détection signature Comptoir Dentaire');
  } else {
    console.log('   ⚠️  GROQ_API_KEY non défini — analyse d\'image désactivée');
    console.log('      Ajoutez GROQ_API_KEY dans le .env pour activer la détection');
  }
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Initialiser le fichier de log des rejetés
  fs.writeFileSync(
    REJECTED_LOG_PATH,
    `PRODUITS REJETÉS — Signature Comptoir Dentaire détectée\n` +
    `Généré le : ${new Date().toLocaleString('fr-FR')}\n` +
    `${'═'.repeat(80)}\n\n`,
    'utf-8'
  );

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
    console.log(`✅ Catégorie : "${categorie.nom}" (ID: ${categorie.id})`);
  }

  // 2. Marque par défaut
  let marqueParDefaut = await prisma.marque.findFirst({
    where: { nom: { equals: 'SANS MARQUE', mode: 'insensitive' }, categorieId: categorie.id },
  });
  if (!marqueParDefaut) {
    marqueParDefaut = await prisma.marque.create({
      data: { nom: 'SANS MARQUE', categorieId: categorie.id },
    });
  }
  console.log(`✅ Marque par défaut : "${marqueParDefaut.nom}" (ID: ${marqueParDefaut.id})\n`);

  // 3. Filtrer selon l'argument --slug si fourni
  const slugArg = process.argv.find((a) => a.startsWith('--slug='))?.split('=')[1];
  const toProcess = slugArg
    ? SOUS_CATEGORIES.filter((sc) => sc.slug === slugArg)
    : SOUS_CATEGORIES;

  if (slugArg && toProcess.length === 0) {
    console.error(`❌ Sous-catégorie avec slug "${slugArg}" introuvable dans la liste.`);
    console.log('Slugs disponibles :', SOUS_CATEGORIES.map((s) => s.slug).join(', '));
    process.exit(1);
  }

  // 4. Importer chaque sous-catégorie
  let totalAjoutes = 0;
  let totalMaj = 0;
  let totalRejetes = 0;
  let totalErreurs = 0;

  for (const sousCatConfig of toProcess) {
    const result = await importSousCategorie(sousCatConfig, categorie, marqueParDefaut);
    totalAjoutes += result.ajoutes;
    totalMaj += result.maj;
    totalRejetes += result.rejetes;
    totalErreurs += result.erreurs;
  }

  // 5. Résumé final
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🎉 IMPORT COMPLET — TOUTES SOUS-CATÉGORIES');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`   📂 Sous-catégories traitées : ${toProcess.length}`);
  console.log(`   ➕ Produits ajoutés          : ${totalAjoutes}`);
  console.log(`   🔄 Produits mis à jour       : ${totalMaj}`);
  console.log(`   🚫 Produits rejetés          : ${totalRejetes}`);
  console.log(`   ⚠️  Erreurs                  : ${totalErreurs}`);
  if (totalRejetes > 0) {
    console.log(`\n📄 Produits rejetés sauvegardés dans :`);
    console.log(`   ${REJECTED_LOG_PATH}`);
  }
  console.log('═══════════════════════════════════════════════════════════════════════');
}

// Exécuter si appelé directement
if (require.main === module) {
  runImportAllSousCategories()
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
