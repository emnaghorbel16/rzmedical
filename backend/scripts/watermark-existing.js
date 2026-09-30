/**
 * Script : Ajouter le watermark "https://randzmedical.com/" sur toutes les images existantes
 * Usage  : node scripts/watermark-existing.js
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
const backupDir = path.join(uploadDir, "_backup");

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

async function applyWatermark(filePath) {
  const image = sharp(filePath);
  const metadata = await image.metadata();

  const width = metadata.width || 800;
  const height = metadata.height || 600;
  const fontSize = Math.max(14, Math.round(width * 0.04));

  const svgOverlay = `
    <svg width="${width}" height="${height}">
      <style>
        .wm { fill: rgba(200, 200, 200, 0.75); font-size: ${fontSize}px; font-weight: bold; font-family: "Arial", sans-serif; }
      </style>
      <text x="50%" y="92%" text-anchor="middle" dominant-baseline="middle" class="wm">randzmedical.com</text>
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
      // Sauvegarder l'original si pas encore fait
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(filePath, backupPath);
      } else {
        console.log(`  ⏭  ${file} — déjà traité, ignoré.`);
        skipped++;
        continue;
      }

      await applyWatermark(filePath);
      console.log(`  ✅ ${file}`);
      success++;
    } catch (err) {
      console.error(`  ❌ ${file} — Erreur : ${err.message}`);
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, filePath);
      }
      errors++;
    }
  }

  console.log(`\n🎉 Terminé !`);
  console.log(`   ✅ Traités  : ${success}`);
  console.log(`   ⏭  Ignorés  : ${skipped}`);
  console.log(`   ❌ Erreurs  : ${errors}`);
  console.log(`\n📦 Sauvegardes dans : ${backupDir}`);
}

main().catch((err) => {
  console.error("Erreur fatale :", err);
  process.exit(1);
});
