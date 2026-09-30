/**
 * Script : Ajouter le watermark "https://randzmedical.com/" sur toutes les images existantes
 *
 * Usage depuis le dossier backend/ : npx ts-node scripts/watermark-existing.ts
 *
 * ⚠️  Les images originales sont sauvegardées dans uploads/_backup/ avant modification.
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";

const uploadDir =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
const backupDir = path.join(uploadDir, "_backup");

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

async function applyWatermark(filePath: string): Promise<void> {
  const image = sharp(filePath);
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
  await sharp(filePath)
    .composite([{ input: Buffer.from(svgOverlay), blend: "over" }])
    .toFile(tmpPath);

  fs.renameSync(tmpPath, filePath);
}

async function main() {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const files = fs.readdirSync(uploadDir).filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return IMAGE_EXTS.has(ext);
  });

  if (files.length === 0) {
    console.log("Aucune image trouvée dans", uploadDir);
    return;
  }

  console.log(`📂 ${files.length} image(s) trouvée(s). Traitement en cours...\n`);

  let success = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of files) {
    const filePath = path.join(uploadDir, file);
    const backupPath = path.join(backupDir, file);

    try {
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(filePath, backupPath);
      } else {
        console.log(`  ⏭  ${file} — déjà traité (backup existant), ignoré.`);
        skipped++;
        continue;
      }

      await applyWatermark(filePath);
      console.log(`  ✅ ${file}`);
      success++;
    } catch (err) {
      console.error(`  ❌ ${file} — Erreur :`, (err as Error).message);
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, filePath);
      }
      errors++;
    }
  }

  console.log(`\n🎉 Terminé !`);
  console.log(`   ✅ Traités avec succès : ${success}`);
  console.log(`   ⏭  Ignorés (déjà faits) : ${skipped}`);
  console.log(`   ❌ Erreurs              : ${errors}`);
  console.log(`\n📦 Sauvegardes disponibles dans : ${backupDir}`);
}

main().catch((err) => {
  console.error("Erreur fatale :", err);
  process.exit(1);
});
