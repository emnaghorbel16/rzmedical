/**
 * watermark-all-products.ts
 * -------------------------------------------------
 * Applique le filigrane "https://randzmedical.com/"
 * sur TOUTES les images de produits existantes en base.
 *
 * Utilisation dans le conteneur Docker du backend :
 *   npx ts-node watermark-all-products.ts
 * -------------------------------------------------
 */

import "dotenv/config";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Meme logique que l'app
const uploadDir = process.env.UPLOAD_DIR || "uploads";
const uploadRoot = path.isAbsolute(uploadDir)
  ? uploadDir
  : path.join(process.cwd(), uploadDir);

/** Applique le filigrane gris semi-transparent sur un fichier image (in-place). */
async function applyWatermarkInPlace(filePath: string): Promise<void> {
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

  const tmpPath = filePath + ".tmp";
  await image
    .composite([{ input: Buffer.from(svgOverlay), blend: "over" }])
    .toFile(tmpPath);
  await fs.promises.rename(tmpPath, filePath);
}

/** Convertit une URL stockee en base vers un chemin local absolu. */
function urlToLocalPath(imageUrl: string): string | null {
  // Supporte : "/uploads/x.jpg", "uploads/x.jpg"
  const match = imageUrl.match(/\/?uploads\/(.+)/);
  if (!match) return null;
  return path.join(uploadRoot, match[1]);
}

const NON_SUPPORTED = [".svg", ".pdf", ".mp4", ".webm", ".mov", ".avi"];

async function main() {
  console.log("Recuperation de tous les produits...");

  const produits = await prisma.produit.findMany({
    select: { id: true, nom: true, images: true },
  });

  console.log(`${produits.length} produit(s) trouve(s).`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const produit of produits) {
    if (!produit.images || produit.images.length === 0) {
      skipped++;
      continue;
    }

    for (const imageUrl of produit.images) {
      const localPath = urlToLocalPath(imageUrl);

      if (!localPath) {
        console.warn(`  [#${produit.id}] URL non reconnue : ${imageUrl}`);
        skipped++;
        continue;
      }

      if (!fs.existsSync(localPath)) {
        console.warn(`  [#${produit.id}] Fichier introuvable : ${localPath}`);
        skipped++;
        continue;
      }

      const ext = path.extname(localPath).toLowerCase();
      if (NON_SUPPORTED.includes(ext)) {
        console.log(`  [#${produit.id}] Ignore (format ${ext}) : ${path.basename(localPath)}`);
        skipped++;
        continue;
      }

      try {
        await applyWatermarkInPlace(localPath);
        console.log(`  OK [#${produit.id} - ${produit.nom}] ${path.basename(localPath)}`);
        processed++;
      } catch (err) {
        console.error(`  ERR [#${produit.id}] ${localPath}:`, err);
        errors++;
      }
    }
  }

  console.log(`\nTraitees : ${processed} | Ignorees : ${skipped} | Erreurs : ${errors}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Erreur fatale :", err);
  await prisma.$disconnect();
  process.exit(1);
});
