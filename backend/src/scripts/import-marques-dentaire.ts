import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../config/prisma';

interface ScrapedBrand {
  nom: string;
  remoteLogoUrl?: string;
  url?: string;
}

// Configurer le répertoire de stockage local des uploads
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
const uploadPath = path.isAbsolute(uploadDir)
  ? uploadDir
  : path.join(process.cwd(), uploadDir);

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
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

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) {
    throw new Error(`Échec chargement ${url} (HTTP ${res.status})`);
  }
  return await res.text();
}

/**
 * Télécharge le logo distant et le sauvegarde localement dans /uploads
 * Retourne le chemin relatif local : "/uploads/brand-nom-17000000.png"
 */
async function downloadLogoLocally(remoteUrl: string, brandName: string): Promise<string | null> {
  try {
    const res = await fetch(remoteUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      console.warn(`   ⚠️ Impossible de télécharger l'image depuis ${remoteUrl} (HTTP ${res.status})`);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Déterminer l'extension
    let ext = '';
    try {
      const parsedPath = new URL(remoteUrl).pathname;
      ext = path.extname(parsedPath).toLowerCase();
    } catch {
      ext = '';
    }

    if (!ext || ext.length > 5 || !['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'].includes(ext)) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('png')) ext = '.png';
      else if (contentType.includes('webp')) ext = '.webp';
      else if (contentType.includes('svg')) ext = '.svg';
      else ext = '.jpg';
    }

    const cleanSlug = brandName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const filename = `brand-${cleanSlug}-${Date.now()}${ext}`;
    const destination = path.join(uploadPath, filename);

    await fs.promises.writeFile(destination, buffer);
    return `/uploads/${filename}`;
  } catch (err: any) {
    console.warn(`   ⚠️ Erreur téléchargement logo pour ${brandName}:`, err.message);
    return null;
  }
}

function parseBrandsFromHtml(html: string): ScrapedBrand[] {
  const brands: ScrapedBrand[] = [];
  const seen = new Set<string>();

  // Isoler la section des logos si présente
  const logosGridMatch = html.match(/<div class="logos-grid">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i);
  const searchArea = logosGridMatch ? logosGridMatch[1] : html;

  // Découper chaque bloc de marque
  const blocks = searchArea.split(/<div[^>]*onclick="location\.href='\/products\/brands\//i);

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];

    // Extraire le titre/nom
    const titleMatch = block.match(/title="([^"]+)"/i);
    const labelMatch = block.match(/<span class="label-grid"><b>([\s\S]*?)<\/b><\/span>/i);

    let nom = '';
    if (labelMatch && labelMatch[1]) {
      nom = cleanHtml(labelMatch[1].replace(/<[^>]+>/g, ''));
    } else if (titleMatch && titleMatch[1]) {
      nom = cleanHtml(titleMatch[1]);
    }

    if (!nom || nom.length < 2) continue;

    const normalizedKey = nom.toUpperCase();
    if (seen.has(normalizedKey)) continue;
    seen.add(normalizedKey);

    // Extraire le logo
    const imgMatch = block.match(/<img[^>]+src="([^"]+)"/i);
    const remoteLogoUrl = imgMatch ? imgMatch[1].trim() : undefined;

    // Extraire l'URL
    const urlMatch = block.match(/^([^']+)'/);
    const url = urlMatch ? `https://www.lecomptoirdentaire.tn/products/brands/${urlMatch[1]}` : undefined;

    brands.push({
      nom: nom.toUpperCase(),
      remoteLogoUrl,
      url,
    });
  }

  return brands;
}

export async function runImportMarques() {
  console.log('====================================================');
  console.log('🚀 IMPORT & TÉLÉCHARGEMENT DES LOGOS DES MARQUES');
  console.log('   Destination locale : ' + uploadPath);
  console.log('====================================================\n');

  // 1. Récupérer ou créer la catégorie "Dentaire"
  let categorie = await prisma.categorie.findFirst({
    where: { nom: { equals: 'Dentaire', mode: 'insensitive' } },
  });

  if (!categorie) {
    categorie = await prisma.categorie.create({
      data: { nom: 'Dentaire', visible: true },
    });
    console.log(`✅ Catégorie créée : "${categorie.nom}" (ID: ${categorie.id})\n`);
  } else {
    console.log(`✅ Catégorie trouvée : "${categorie.nom}" (ID: ${categorie.id})\n`);
  }

  // 2. Télécharger la page catalogue pour extraire les marques
  console.log('📥 Téléchargement de la liste des marques...');
  const html = await fetchPage('https://www.lecomptoirdentaire.tn/products/');
  const brands = parseBrandsFromHtml(html);

  console.log(`🔍 ${brands.length} marques trouvées.\n`);
  console.log('⏳ Téléchargement des logos et insertion en base de données...\n');

  let ajoutes = 0;
  let maj = 0;
  let erreurs = 0;

  for (let idx = 0; idx < brands.length; idx++) {
    const b = brands[idx];
    // Normaliser en MAJUSCULES pour respecter la contrainte unique @@unique([nom, categorieId])
    const nomNormalise = b.nom.trim().toUpperCase();
    try {
      // Chercher par nom normalisé (insensible à la casse pour sécurité)
      const existante = await prisma.marque.findFirst({
        where: {
          nom: { equals: nomNormalise, mode: 'insensitive' },
          categorieId: categorie.id,
        },
      });

      // Télécharger le logo localement si une URL distante est fournie
      let localLogoPath: string | null = null;
      if (b.remoteLogoUrl) {
        // Si la marque existe déjà et a déjà un logo local (/uploads/...), on évite de re-télécharger
        if (existante && existante.logo && existante.logo.startsWith('/uploads/')) {
          localLogoPath = existante.logo;
        } else {
          localLogoPath = await downloadLogoLocally(b.remoteLogoUrl, nomNormalise);
        }
      }

      if (existante) {
        if (localLogoPath && existante.logo !== localLogoPath) {
          await prisma.marque.update({
            where: { id: existante.id },
            data: { logo: localLogoPath },
          });
          maj++;
          console.log(`[${idx + 1}/${brands.length}] 🔄 Logo téléchargé & mis à jour : ${nomNormalise} (${localLogoPath})`);
        } else {
          console.log(`[${idx + 1}/${brands.length}] ℹ️ Déjà existante : ${nomNormalise}`);
        }
      } else {
        await prisma.marque.create({
          data: {
            nom: nomNormalise,
            logo: localLogoPath,
            categorieId: categorie.id,
          },
        });
        ajoutes++;
        console.log(`[${idx + 1}/${brands.length}] ➕ Marque ajoutée & logo enregistré : ${nomNormalise} ➔ ${localLogoPath || 'aucun logo'}`);
      }
    } catch (err: any) {
      erreurs++;
      console.error(`[${idx + 1}/${brands.length}] ❌ Erreur sur ${nomNormalise}:`, err.message);
    }
  }

  console.log('\n====================================================');
  console.log('🎉 TÉLÉCHARGEMENT & IMPORT TERMINÉS !');
  console.log(`   ➕ Marques créées           : ${ajoutes}`);
  console.log(`   🔄 Logos mis à jour locaux  : ${maj}`);
  console.log(`   ⚠️ Erreurs                  : ${erreurs}`);
  console.log(`   📁 Dossier des logos        : ${uploadPath}`);
  console.log(`   🏷️  Catégorie parente       : ${categorie.nom}`);
  console.log('====================================================');
}

// Exécuter si appelé directement
if (require.main === module) {
  runImportMarques()
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
