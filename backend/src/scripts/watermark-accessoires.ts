/**
 * watermark-accessoires.ts
 * ----------------------------------------------------------------------------
 * Applique le filigrane "https://randzmedical.com/" sur TOUTES les images
 * des produits de la sous-catégorie "Accessoires".
 *
 * Supporte :
 *   1. Fichiers locaux déjà enregistrés (/uploads/...) : modification in-place
 *   2. Images distantes (http...) : téléchargement, filigrane & mise à jour en BDD
 *
 * Utilisation :
 *   npm run watermark:accessoires:dev (local avec tsx)
 *   npm run watermark:accessoires     (dans le conteneur Docker après build)
 * ----------------------------------------------------------------------------
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import prisma from '../config/prisma';

const uploadDir = process.env.UPLOAD_DIR || 'uploads';
const uploadRoot = path.isAbsolute(uploadDir)
  ? uploadDir
  : path.join(process.cwd(), uploadDir);

if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

const NON_SUPPORTED_EXT = ['.svg', '.pdf', '.mp4', '.webm', '.mov', '.avi', '.gif'];

/** Applique le filigrane SVG randzmedical.com au centre de l'image (in-place) */
async function applyWatermarkInPlace(filePath: string): Promise<boolean> {
  const ext = path.extname(filePath).toLowerCase();
  if (NON_SUPPORTED_EXT.includes(ext)) return false;

  const buffer = await fs.promises.readFile(filePath);
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

  const tmpPath = filePath + '.tmp';
  await image
    .composite([{ input: Buffer.from(svgOverlay), blend: 'over' }])
    .toFile(tmpPath);

  await fs.promises.rename(tmpPath, filePath);
  return true;
}

/** Télécharge une image distante, lui applique le filigrane et la stocke localement */
async function downloadAndWatermarkRemote(remoteUrl: string, productId: number): Promise<string | null> {
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
    if (!ext || ext.length > 5 || !['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      ext = '.jpg';
    }

    const filename = `product-${productId}-${Date.now()}${ext}`;
    const destination = path.join(uploadRoot, filename);

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
  } catch (err) {
    console.error(`  ⚠️ Erreur téléchargement distant ${remoteUrl}:`, err);
    return null;
  }
}

function resolveLocalPath(imageUrl: string): string | null {
  const match = imageUrl.match(/\/?uploads\/(.+)/);
  if (!match) return null;
  return path.join(uploadRoot, match[1]);
}

export async function runWatermarkAccessoires() {
  console.log('====================================================');
  console.log('🏷️  APPLICATION DU FILIGRANE "https://randzmedical.com/"');
  console.log('   SOUS-CATÉGORIE : ACCESSOIRES');
  console.log('====================================================\n');

  // 1. Trouver les sous-catégories nommées "Accessoires"
  const sousCategories = await prisma.sousCategorie.findMany({
    where: { nom: { equals: 'Accessoires', mode: 'insensitive' } },
    include: { categorie: true },
  });

  if (sousCategories.length === 0) {
    console.log('⚠️ Aucune sous-catégorie "Accessoires" trouvée.');
    await prisma.$disconnect();
    return;
  }

  const subCatIds = sousCategories.map(s => s.id);
  console.log(`📁 Sous-catégorie(s) trouvée(s) : ${sousCategories.map(s => `"${s.nom}" (${s.categorie?.nom})`).join(', ')}`);

  // 2. Trouver tous les produits de cette sous-catégorie
  const produits = await prisma.produit.findMany({
    where: { sousCategorieId: { in: subCatIds } },
    select: { id: true, nom: true, reference: true, images: true },
    orderBy: { id: 'asc' },
  });

  console.log(`🔍 ${produits.length} produit(s) trouvé(s) dans la sous-catégorie "Accessoires".\n`);

  let countLocal = 0;
  let countRemote = 0;
  let countSkipped = 0;
  let countErrors = 0;

  for (let i = 0; i < produits.length; i++) {
    const p = produits[i];
    if (!p.images || p.images.length === 0) {
      countSkipped++;
      continue;
    }

    const updatedImages: string[] = [];
    let dbUpdateNeeded = false;

    for (let imgIdx = 0; imgIdx < p.images.length; imgIdx++) {
      const imgUrl = p.images[imgIdx];

      // Cas 1 : Image stockée localement dans /uploads
      const localPath = resolveLocalPath(imgUrl);
      if (localPath) {
        if (fs.existsSync(localPath)) {
          try {
            const ok = await applyWatermarkInPlace(localPath);
            if (ok) {
              countLocal++;
              console.log(`[${i + 1}/${produits.length}] ✅ Filigrane appliqué : ${p.nom} ➔ ${path.basename(localPath)}`);
            } else {
              countSkipped++;
            }
          } catch (err) {
            countErrors++;
            console.error(`[${i + 1}/${produits.length}] ❌ Erreur filigrane : ${p.nom} (${localPath}):`, err);
          }
        } else {
          console.warn(`[${i + 1}/${produits.length}] ⚠️ Fichier local introuvable : ${localPath}`);
          countSkipped++;
        }
        updatedImages.push(imgUrl);
        continue;
      }

      // Cas 2 : Image distante (http...)
      if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
        console.log(`[${i + 1}/${produits.length}] 📥 Téléchargement + filigrane pour : ${p.nom}...`);
        const newLocalPath = await downloadAndWatermarkRemote(imgUrl, p.id);
        if (newLocalPath) {
          updatedImages.push(newLocalPath);
          dbUpdateNeeded = true;
          countRemote++;
          console.log(`   ➔ Enregistré et filigrané : ${newLocalPath}`);
        } else {
          updatedImages.push(imgUrl);
          countErrors++;
        }
        continue;
      }

      // Format inconnu
      updatedImages.push(imgUrl);
      countSkipped++;
    }

    // Mise à jour de la base de données si une image distante est devenue locale
    if (dbUpdateNeeded) {
      await prisma.produit.update({
        where: { id: p.id },
        data: { images: updatedImages },
      });
    }
  }

  console.log('\n====================================================');
  console.log('🎉 TRAITEMENT DU FILIGRANE TERMINÉ !');
  console.log(`   🖼️  Images locales filigranées : ${countLocal}`);
  console.log(`   📥 Images distantes converties & filigranées : ${countRemote}`);
  console.log(`   ⏭️  Images ignorées (introuvables / non-image) : ${countSkipped}`);
  console.log(`   ⚠️  Erreurs : ${countErrors}`);
  console.log('====================================================\n');

  await prisma.$disconnect();
}

if (require.main === module) {
  runWatermarkAccessoires().catch(async (err) => {
    console.error('Erreur fatale :', err);
    await prisma.$disconnect();
    process.exit(1);
  });
}
